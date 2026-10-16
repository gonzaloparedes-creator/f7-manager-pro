-- Panel de Equipos: "Comprar para piezas" (chatarra).
--
-- Un taller compra un equipo roto a un cliente, no para revenderlo sino para
-- desarmarlo y sacarle repuestos. Contablemente:
--   * Sale plata de la caja hoy, con comprobante (igual que "Comprar a cliente").
--   * El equipo NO entra al catálogo de venta ni al inventario: queda solo como
--     registro en device_purchases con kind = 'piezas' (la "chatarra").
--   * Cada pieza que se le saca se carga al inventario de repuestos
--     (inventory_items, is_for_repair) con el costo que se le asigna del precio
--     pagado por el equipo. device_parts guarda esa trazabilidad (de qué equipo
--     salió cada pieza y cuánto costo se le asignó).
--   * La suma de costos asignados nunca supera lo que se pagó por el equipo.
--
-- device_parts es append-only (mismo criterio que device_purchases): la pieza en
-- sí es un artículo de inventario y se edita desde Inventario.

ALTER TABLE public.device_purchases DROP CONSTRAINT device_purchases_kind_check;
ALTER TABLE public.device_purchases
  ADD CONSTRAINT device_purchases_kind_check CHECK (kind IN ('compra', 'canje', 'piezas'));

CREATE TABLE public.device_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  purchase_id uuid NOT NULL REFERENCES public.device_purchases(id) ON DELETE RESTRICT,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  part_name text NOT NULL CHECK (char_length(btrim(part_name)) BETWEEN 1 AND 120),
  allocated_cost numeric NOT NULL DEFAULT 0 CHECK (allocated_cost >= 0),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_parts_company_purchase ON public.device_parts (company_id, purchase_id);

ALTER TABLE public.device_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_parts FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.device_parts TO authenticated;

CREATE POLICY "Device parts select tenant scoped" ON public.device_parts
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR company_id = public.get_user_company(auth.uid())
);

CREATE POLICY "Device parts insert tenant scoped" ON public.device_parts
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND public.is_company_active(company_id)
    AND created_by = auth.uid()
  )
);

CREATE POLICY "Device parts no update" ON public.device_parts
AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "Device parts no delete" ON public.device_parts
AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

-- Un usuario con "Solo ve su sucursal" solo ve y carga piezas de la suya.
CREATE POLICY "Branch restricted device parts" ON public.device_parts
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
)
WITH CHECK (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
);

-- Misma función que antes (ver 20261015180000_bateria_y_origen_de_equipos.sql),
-- ahora también registra compras para piezas: mismo comprobante y mismo pago,
-- pero sin dar de alta el equipo en el inventario.
CREATE OR REPLACE FUNCTION public.register_device_purchase(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company uuid := public.get_user_company(_uid);
  _branch uuid := NULLIF(p->>'branch_id', '')::uuid;
  _category uuid := NULLIF(p->>'category_id', '')::uuid;
  _name text := btrim(coalesce(p->>'device_name', ''));
  _seller text := btrim(coalesce(p->>'seller_name', ''));
  _price numeric := coalesce((p->>'purchase_price')::numeric, 0);
  _selling numeric := coalesce((p->>'selling_price')::numeric, 0);
  _imei text := NULLIF(btrim(coalesce(p->>'imei', '')), '');
  _notes text := NULLIF(btrim(coalesce(p->>'notes', '')), '');
  _checklist jsonb := coalesce(p->'checklist', '[]'::jsonb);
  _accessories jsonb := coalesce(p->'accessories', '[]'::jsonb);
  _kind text := coalesce(NULLIF(p->>'kind', ''), 'compra');
  _group uuid := NULLIF(p->>'sale_group_id', '')::uuid;
  _method text := NULLIF(btrim(coalesce(p->>'payment_method', '')), '');
  _battery_raw text := NULLIF(btrim(coalesce(p->>'battery_health', '')), '');
  _battery smallint;
  _origin text;
  _tiv numeric;
  _number text;
  _item uuid;
  _purchase uuid;
BEGIN
  IF _uid IS NULL OR _company IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _kind NOT IN ('compra', 'canje', 'piezas') THEN RAISE EXCEPTION 'Tipo de compra inválido'; END IF;
  IF _name = '' THEN RAISE EXCEPTION 'Falta el nombre del equipo'; END IF;
  IF _seller = '' THEN RAISE EXCEPTION 'Falta el nombre del vendedor'; END IF;
  IF _price <= 0 THEN RAISE EXCEPTION 'El precio de compra tiene que ser mayor a cero'; END IF;
  IF _selling < 0 THEN RAISE EXCEPTION 'El precio de venta no puede ser negativo'; END IF;
  IF jsonb_typeof(_checklist) <> 'array' OR jsonb_typeof(_accessories) <> 'array' THEN
    RAISE EXCEPTION 'Datos de la compra inválidos';
  END IF;

  IF _kind = 'piezas' THEN
    -- Un equipo para desarmar no se revende: no tiene batería, precio de venta
    -- ni categoría de catálogo.
    _battery_raw := NULL;
    _selling := 0;
    _category := NULL;
  END IF;

  IF _battery_raw IS NOT NULL THEN
    IF _battery_raw !~ '^[0-9]{1,3}$' OR _battery_raw::int > 100 THEN
      RAISE EXCEPTION 'La batería tiene que ser un porcentaje entre 0 y 100';
    END IF;
    _battery := _battery_raw::smallint;
  END IF;

  IF _kind = 'canje' THEN
    IF _group IS NULL THEN RAISE EXCEPTION 'El canje tiene que estar ligado a una venta'; END IF;
    SELECT coalesce(sum(trade_in_value), 0) INTO _tiv
      FROM public.product_sales WHERE company_id = _company AND sale_group_id = _group;
    IF _tiv <> _price THEN
      RAISE EXCEPTION 'El valor del canje no coincide con la venta';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.device_purchases
      WHERE company_id = _company AND kind = 'canje' AND sale_group_id = _group
    ) THEN
      RAISE EXCEPTION 'Esta venta ya tiene un equipo recibido en canje';
    END IF;
    _method := 'Canje';
    _origin := 'canje';
    IF _branch IS NULL THEN
      SELECT branch_id INTO _branch FROM public.product_sales
        WHERE company_id = _company AND sale_group_id = _group AND branch_id IS NOT NULL
        LIMIT 1;
    END IF;
  ELSE
    _group := NULL;
    _origin := 'compra_cliente';
  END IF;

  IF _branch IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches WHERE id = _branch AND company_id = _company
  ) THEN
    RAISE EXCEPTION 'Sucursal inválida';
  END IF;
  IF _category IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.inventory_categories WHERE id = _category AND company_id = _company
  ) THEN
    RAISE EXCEPTION 'Categoría inválida';
  END IF;

  _number := public.next_device_purchase_number(_company);

  IF _kind <> 'piezas' THEN
    INSERT INTO public.inventory_items (
      company_id, branch_id, category_id, name, imei, is_device, is_for_sale, is_for_repair,
      stock, min_stock_alert, purchase_cost, repair_cost, cost_price, selling_price, notes, created_by,
      battery_health, origin
    ) VALUES (
      _company, _branch, _category, _name, _imei, true, true, false,
      1, 0, _price, 0, _price, _selling, _notes, _uid,
      _battery, _origin
    ) RETURNING id INTO _item;
  END IF;

  INSERT INTO public.device_purchases (
    company_id, branch_id, receipt_number, inventory_item_id, device_name, imei,
    seller_name, seller_cedula, seller_phone, purchase_price, payment_method,
    reason, checklist, accessories, notes, created_by, kind, sale_group_id, battery_health
  ) VALUES (
    _company, _branch, _number, _item, _name, _imei,
    _seller,
    NULLIF(btrim(coalesce(p->>'seller_cedula', '')), ''),
    NULLIF(btrim(coalesce(p->>'seller_phone', '')), ''),
    _price,
    _method,
    NULLIF(btrim(coalesce(p->>'reason', '')), ''),
    _checklist, _accessories, _notes, _uid, _kind, _group, _battery
  ) RETURNING id INTO _purchase;

  RETURN jsonb_build_object(
    'purchase_id', _purchase,
    'receipt_number', _number,
    'inventory_item_id', _item,
    'branch_id', _branch
  );
END;
$$;

-- Carga una pieza sacada de un equipo de chatarra: la da de alta como repuesto
-- en el inventario (1 unidad) con el costo asignado y deja el vínculo con el
-- equipo. SECURITY INVOKER: los inserts pasan por la RLS del usuario.
CREATE FUNCTION public.register_device_part(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company uuid := public.get_user_company(_uid);
  _purchase_id uuid := NULLIF(p->>'purchase_id', '')::uuid;
  _name text := btrim(coalesce(p->>'part_name', ''));
  _cost numeric := coalesce((p->>'allocated_cost')::numeric, 0);
  _selling numeric := coalesce((p->>'selling_price')::numeric, 0);
  _purchase record;
  _allocated numeric;
  _item uuid;
  _part uuid;
BEGIN
  IF _uid IS NULL OR _company IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _purchase_id IS NULL THEN RAISE EXCEPTION 'Falta el equipo de origen de la pieza'; END IF;
  IF _name = '' THEN RAISE EXCEPTION 'Falta el nombre de la pieza'; END IF;
  IF char_length(_name) > 120 THEN RAISE EXCEPTION 'El nombre de la pieza es demasiado largo'; END IF;
  IF _cost < 0 THEN RAISE EXCEPTION 'El costo de la pieza no puede ser negativo'; END IF;
  IF _selling < 0 THEN RAISE EXCEPTION 'El precio de la pieza no puede ser negativo'; END IF;

  SELECT id, branch_id, kind, purchase_price, device_name, receipt_number INTO _purchase
    FROM public.device_purchases
    WHERE id = _purchase_id AND company_id = _company;
  IF NOT FOUND OR _purchase.kind <> 'piezas' THEN
    RAISE EXCEPTION 'Este equipo no está en la chatarra';
  END IF;

  -- Dos cargas simultáneas sobre el mismo equipo no pueden pasarse del precio pagado.
  PERFORM pg_advisory_xact_lock(hashtext('device_parts:' || _purchase_id::text));

  SELECT coalesce(sum(allocated_cost), 0) INTO _allocated
    FROM public.device_parts
    WHERE company_id = _company AND purchase_id = _purchase_id;
  IF _allocated + _cost > _purchase.purchase_price THEN
    RAISE EXCEPTION 'El costo asignado a las piezas no puede superar lo que pagaste por el equipo';
  END IF;

  INSERT INTO public.inventory_items (
    company_id, branch_id, name, is_device, is_for_sale, is_for_repair,
    stock, min_stock_alert, purchase_cost, repair_cost, cost_price, selling_price, notes, created_by
  ) VALUES (
    _company, _purchase.branch_id, _name, false, false, true,
    1, 0, 0, 0, _cost, _selling,
    'Pieza de ' || _purchase.device_name || ' (' || _purchase.receipt_number || ')', _uid
  ) RETURNING id INTO _item;

  INSERT INTO public.device_parts (
    company_id, branch_id, purchase_id, inventory_item_id, part_name, allocated_cost, created_by
  ) VALUES (
    _company, _purchase.branch_id, _purchase_id, _item, _name, _cost, _uid
  ) RETURNING id INTO _part;

  RETURN jsonb_build_object('part_id', _part, 'inventory_item_id', _item);
END;
$$;

REVOKE ALL ON FUNCTION public.register_device_part(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_device_part(jsonb) TO authenticated;
