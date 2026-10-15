-- B1 seminuevos, parte 2: equipo recibido como parte de pago (canje).
--
-- Un cliente compra un equipo y entrega el suyo como parte del pago. Contablemente:
--   * La venta sigue valiendo su precio completo (ingreso y costo de lo vendido).
--   * El equipo recibido entra al catálogo a su valor de canje, como costo de su
--     futura reventa (igual que una compra a cliente, pero sin mover plata).
--   * Caja solo cuenta lo que realmente se cobró: el total menos el valor del canje.
--
-- product_sales.trade_in_value guarda ese valor (en la primera línea del
-- carrito). device_purchases pasa a tener "kind" (compra | canje) y la venta
-- a la que pertenece el canje.

ALTER TABLE public.device_purchases
  ADD COLUMN kind text NOT NULL DEFAULT 'compra' CHECK (kind IN ('compra', 'canje')),
  ADD COLUMN sale_group_id uuid;

ALTER TABLE public.device_purchases
  ADD CONSTRAINT device_purchases_canje_has_sale CHECK (kind <> 'canje' OR sale_group_id IS NOT NULL);

-- Un solo equipo en canje por venta (primera versión).
CREATE UNIQUE INDEX idx_device_purchases_one_canje_per_sale
  ON public.device_purchases (company_id, sale_group_id)
  WHERE kind = 'canje';

ALTER TABLE public.product_sales
  ADD COLUMN trade_in_value numeric NOT NULL DEFAULT 0 CHECK (trade_in_value >= 0);

-- Misma función que antes, ahora también registra canjes. Un canje solo se
-- acepta si coincide con el valor de canje de una venta ya cargada: no se
-- puede dar de alta un equipo "gratis" llamando a la función directamente.
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
  _tiv numeric;
  _number text;
  _item uuid;
  _purchase uuid;
BEGIN
  IF _uid IS NULL OR _company IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _kind NOT IN ('compra', 'canje') THEN RAISE EXCEPTION 'Tipo de compra inválido'; END IF;
  IF _name = '' THEN RAISE EXCEPTION 'Falta el nombre del equipo'; END IF;
  IF _seller = '' THEN RAISE EXCEPTION 'Falta el nombre del vendedor'; END IF;
  IF _price <= 0 THEN RAISE EXCEPTION 'El precio de compra tiene que ser mayor a cero'; END IF;
  IF _selling < 0 THEN RAISE EXCEPTION 'El precio de venta no puede ser negativo'; END IF;
  IF jsonb_typeof(_checklist) <> 'array' OR jsonb_typeof(_accessories) <> 'array' THEN
    RAISE EXCEPTION 'Datos de la compra inválidos';
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
    IF _branch IS NULL THEN
      SELECT branch_id INTO _branch FROM public.product_sales
        WHERE company_id = _company AND sale_group_id = _group AND branch_id IS NOT NULL
        LIMIT 1;
    END IF;
  ELSE
    _group := NULL;
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
    reason, checklist, accessories, notes, created_by, kind, sale_group_id
  ) VALUES (
    _company, _branch, _number, _item, _name, _imei,
    _seller,
    NULLIF(btrim(coalesce(p->>'seller_cedula', '')), ''),
    NULLIF(btrim(coalesce(p->>'seller_phone', '')), ''),
    _price,
    _method,
    NULLIF(btrim(coalesce(p->>'reason', '')), ''),
    _checklist, _accessories, _notes, _uid, _kind, _group
  ) RETURNING id INTO _purchase;

  RETURN jsonb_build_object(
    'purchase_id', _purchase,
    'receipt_number', _number,
    'inventory_item_id', _item,
    'branch_id', _branch
  );
END;
$$;

-- Venta con equipo recibido en canje, todo en una sola transacción: si algo
-- falla (stock, IMEI, sucursal...) no queda la venta sin el equipo ni el
-- equipo sin la venta. SECURITY INVOKER: los inserts pasan por la RLS del usuario.
-- El nombre y el costo de cada producto se leen acá del inventario de la
-- empresa; del cliente solo llegan el producto, la cantidad y el precio.
CREATE FUNCTION public.register_sale_with_trade_in(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company uuid := public.get_user_company(_uid);
  _group uuid := NULLIF(p->>'sale_group_id', '')::uuid;
  _method text := NULLIF(btrim(coalesce(p->>'payment_method', '')), '');
  _items jsonb := coalesce(p->'items', '[]'::jsonb);
  _trade jsonb := p->'trade_in';
  _value numeric;
  _total numeric := 0;
  _entry jsonb;
  _qty integer;
  _price numeric;
  _inv record;
  _row record;
  _rows jsonb := '[]'::jsonb;
  _first boolean := true;
  _purchase jsonb;
BEGIN
  IF _uid IS NULL OR _company IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _group IS NULL THEN RAISE EXCEPTION 'Falta el identificador de la venta'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'La venta no tiene productos';
  END IF;
  IF _trade IS NULL OR jsonb_typeof(_trade) <> 'object' THEN
    RAISE EXCEPTION 'Falta el equipo recibido en canje';
  END IF;
  _value := coalesce((_trade->>'purchase_price')::numeric, 0);
  IF _value <= 0 THEN RAISE EXCEPTION 'El valor del equipo recibido tiene que ser mayor a cero'; END IF;

  FOR _entry IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_entry->>'quantity')::integer;
    _price := (_entry->>'unit_price')::numeric;
    IF _qty IS NULL OR _qty <= 0 OR _price IS NULL OR _price < 0 THEN
      RAISE EXCEPTION 'Hay una línea de la venta con datos inválidos';
    END IF;
    _total := _total + _qty * _price;
  END LOOP;
  IF _value > _total THEN
    RAISE EXCEPTION 'El valor del equipo recibido no puede superar el total de la venta';
  END IF;

  FOR _entry IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT id, name, cost_price INTO _inv
      FROM public.inventory_items
      WHERE id = (_entry->>'inventory_item_id')::uuid AND company_id = _company;
    IF NOT FOUND THEN RAISE EXCEPTION 'Uno de los productos de la venta no existe'; END IF;

    INSERT INTO public.product_sales (
      company_id, inventory_item_id, product_name, quantity, unit_price, unit_cost,
      payment_method, created_by, sale_group_id, trade_in_value
    ) VALUES (
      _company, _inv.id, _inv.name, (_entry->>'quantity')::integer, (_entry->>'unit_price')::numeric,
      _inv.cost_price, _method, _uid, _group, CASE WHEN _first THEN _value ELSE 0 END
    )
    RETURNING id, product_name, quantity, unit_price, payment_method, created_at, branch_id INTO _row;

    _rows := _rows || jsonb_build_array(to_jsonb(_row));
    _first := false;
  END LOOP;

  _purchase := public.register_device_purchase(
    _trade || jsonb_build_object('kind', 'canje', 'sale_group_id', _group)
  );

  RETURN jsonb_build_object('sale_group_id', _group, 'rows', _rows, 'purchase', _purchase);
END;
$$;

REVOKE ALL ON FUNCTION public.register_sale_with_trade_in(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_sale_with_trade_in(jsonb) TO authenticated;
