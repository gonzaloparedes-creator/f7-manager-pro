-- B1 seminuevos, parte 1: "Comprar a cliente".
--
-- Una tienda de celulares compra equipos usados a particulares. Cada compra
-- deja un comprobante numerado (con datos del vendedor, IMEI, estado del
-- equipo y qué plata salió de la caja) y da de alta el equipo en el catálogo
-- (inventory_items, is_device) con su costo de compra — así el costo entra
-- como costo de la venta cuando se revenda, no como un gasto del mes.
--
-- device_purchases es un registro append-only (mismo criterio que
-- product_sales / order_payments): no se edita ni se borra desde la app. El
-- equipo en sí sigue siendo editable desde Productos.

ALTER TABLE public.companies
  ADD COLUMN device_purchase_seq integer NOT NULL DEFAULT 0;

CREATE TABLE public.device_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  receipt_number text NOT NULL,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  device_name text NOT NULL,
  imei text,
  seller_name text NOT NULL,
  seller_cedula text,
  seller_phone text,
  purchase_price numeric NOT NULL CHECK (purchase_price > 0),
  payment_method text,
  reason text,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  accessories jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_purchases_receipt_unique UNIQUE (company_id, receipt_number)
);

CREATE INDEX idx_device_purchases_company_created ON public.device_purchases (company_id, created_at DESC);
CREATE INDEX idx_device_purchases_company_imei ON public.device_purchases (company_id, imei);

ALTER TABLE public.device_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_purchases FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.device_purchases TO authenticated;

CREATE POLICY "Device purchases select tenant scoped" ON public.device_purchases
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR company_id = public.get_user_company(auth.uid())
);

CREATE POLICY "Device purchases insert tenant scoped" ON public.device_purchases
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND public.is_company_active(company_id)
    AND created_by = auth.uid()
  )
);

CREATE POLICY "Device purchases no update" ON public.device_purchases
AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "Device purchases no delete" ON public.device_purchases
AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

-- Un usuario con "Solo ve su sucursal" solo ve y carga compras de la suya.
CREATE POLICY "Branch restricted device purchases" ON public.device_purchases
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
)
WITH CHECK (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
);

-- Numeración por empresa (CMP-0001, CMP-0002...). SECURITY DEFINER porque el
-- UPDATE sobre companies está reservado a admins; el chequeo explícito de
-- "misma empresa que el que llama" reemplaza esa protección (mismo patrón que
-- generate_order_number).
CREATE FUNCTION public.next_device_purchase_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next integer;
BEGIN
  IF _company_id IS DISTINCT FROM public.get_user_company(auth.uid())
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.companies
  SET device_purchase_seq = device_purchase_seq + 1
  WHERE id = _company_id
  RETURNING device_purchase_seq INTO _next;

  IF _next IS NULL THEN
    RAISE EXCEPTION 'Empresa % no encontrada', _company_id;
  END IF;

  RETURN 'CMP-' || lpad(_next::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_device_purchase_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_device_purchase_number(uuid) TO authenticated;

-- Registra la compra completa en una sola transacción: número de comprobante,
-- alta del equipo en el catálogo y el registro de la compra. SECURITY INVOKER:
-- los inserts pasan por la RLS del usuario (misma empresa, sucursal, empresa
-- activa), así que no abre ningún permiso nuevo.
CREATE FUNCTION public.register_device_purchase(p jsonb)
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
  _number text;
  _item uuid;
  _purchase uuid;
BEGIN
  IF _uid IS NULL OR _company IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _name = '' THEN RAISE EXCEPTION 'Falta el nombre del equipo'; END IF;
  IF _seller = '' THEN RAISE EXCEPTION 'Falta el nombre del vendedor'; END IF;
  IF _price <= 0 THEN RAISE EXCEPTION 'El precio de compra tiene que ser mayor a cero'; END IF;
  IF _selling < 0 THEN RAISE EXCEPTION 'El precio de venta no puede ser negativo'; END IF;
  IF jsonb_typeof(_checklist) <> 'array' OR jsonb_typeof(_accessories) <> 'array' THEN
    RAISE EXCEPTION 'Datos de la compra inválidos';
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

  INSERT INTO public.inventory_items (
    company_id, branch_id, category_id, name, imei, is_device, is_for_sale, is_for_repair,
    stock, min_stock_alert, purchase_cost, repair_cost, cost_price, selling_price, notes, created_by
  ) VALUES (
    _company, _branch, _category, _name, _imei, true, true, false,
    1, 0, _price, 0, _price, _selling, _notes, _uid
  ) RETURNING id INTO _item;

  INSERT INTO public.device_purchases (
    company_id, branch_id, receipt_number, inventory_item_id, device_name, imei,
    seller_name, seller_cedula, seller_phone, purchase_price, payment_method,
    reason, checklist, accessories, notes, created_by
  ) VALUES (
    _company, _branch, _number, _item, _name, _imei,
    _seller,
    NULLIF(btrim(coalesce(p->>'seller_cedula', '')), ''),
    NULLIF(btrim(coalesce(p->>'seller_phone', '')), ''),
    _price,
    NULLIF(btrim(coalesce(p->>'payment_method', '')), ''),
    NULLIF(btrim(coalesce(p->>'reason', '')), ''),
    _checklist, _accessories, _notes, _uid
  ) RETURNING id INTO _purchase;

  RETURN jsonb_build_object(
    'purchase_id', _purchase,
    'receipt_number', _number,
    'inventory_item_id', _item
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_device_purchase(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_device_purchase(jsonb) TO authenticated;
