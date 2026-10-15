-- B1 seminuevos, parte 6: batería % y origen de cada equipo.
--
-- inventory_items.battery_health: salud de batería en % (0-100), solo para
-- equipos; NULL = no se midió / no aplica. Se puede corregir después (por
-- ejemplo si se le cambia la batería). device_purchases.battery_health guarda
-- el valor declarado al comprar/recibir el equipo y queda en el comprobante:
-- esa tabla es append-only, así que es el registro de cómo llegó.
--
-- inventory_items.origin: de dónde vino el equipo.
--   proveedor | compra_cliente | canje | stock_propio | consignado
-- NULL = sin dato (equipos cargados antes de esta parte o a mano sin elegir).

ALTER TABLE public.inventory_items
  ADD COLUMN battery_health smallint
    CONSTRAINT inventory_items_battery_health_range CHECK (battery_health IS NULL OR battery_health BETWEEN 0 AND 100),
  ADD COLUMN origin text
    CONSTRAINT inventory_items_origin_valid CHECK (origin IS NULL OR origin IN ('proveedor', 'compra_cliente', 'canje', 'stock_propio', 'consignado'));

ALTER TABLE public.device_purchases
  ADD COLUMN battery_health smallint
    CONSTRAINT device_purchases_battery_health_range CHECK (battery_health IS NULL OR battery_health BETWEEN 0 AND 100);

-- Los equipos que ya entraron por "Comprar a cliente" o por canje tienen
-- origen conocido. El cruce es por id Y por empresa: nunca se mezcla una
-- empresa con otra.
UPDATE public.inventory_items ii
SET origin = CASE dp.kind WHEN 'canje' THEN 'canje' ELSE 'compra_cliente' END
FROM public.device_purchases dp
WHERE dp.inventory_item_id = ii.id
  AND dp.company_id = ii.company_id
  AND ii.origin IS NULL;

-- Misma función que antes (ver 20261015140000_canje_en_venta.sql), ahora
-- también recibe la batería % y deja el origen del equipo según el tipo.
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
  IF _kind NOT IN ('compra', 'canje') THEN RAISE EXCEPTION 'Tipo de compra inválido'; END IF;
  IF _name = '' THEN RAISE EXCEPTION 'Falta el nombre del equipo'; END IF;
  IF _seller = '' THEN RAISE EXCEPTION 'Falta el nombre del vendedor'; END IF;
  IF _price <= 0 THEN RAISE EXCEPTION 'El precio de compra tiene que ser mayor a cero'; END IF;
  IF _selling < 0 THEN RAISE EXCEPTION 'El precio de venta no puede ser negativo'; END IF;
  IF jsonb_typeof(_checklist) <> 'array' OR jsonb_typeof(_accessories) <> 'array' THEN
    RAISE EXCEPTION 'Datos de la compra inválidos';
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

  INSERT INTO public.inventory_items (
    company_id, branch_id, category_id, name, imei, is_device, is_for_sale, is_for_repair,
    stock, min_stock_alert, purchase_cost, repair_cost, cost_price, selling_price, notes, created_by,
    battery_health, origin
  ) VALUES (
    _company, _branch, _category, _name, _imei, true, true, false,
    1, 0, _price, 0, _price, _selling, _notes, _uid,
    _battery, _origin
  ) RETURNING id INTO _item;

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
