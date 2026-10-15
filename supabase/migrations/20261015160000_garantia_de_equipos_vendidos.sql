-- B1 seminuevos, parte 4: garantía de los equipos vendidos, consultable por IMEI.
--
-- Una venta de mostrador de un equipo ahora guarda, en cada línea de equipo:
--   * warranty_days: días de garantía que se le dieron al comprador (NULL = ventas
--     anteriores a esta función, "sin garantía registrada"; 0 = sin garantía).
--   * imei: copia del IMEI del equipo al momento de la venta. La pone el trigger
--     a partir del inventario, nunca el cliente, y queda congelada igual que
--     product_name / unit_price.
--   * customer_name / customer_phone: datos opcionales del comprador.
-- Todo esto solo se conserva en líneas de equipos (is_device); en cualquier otro
-- producto el trigger lo descarta, venga lo que venga del cliente.

ALTER TABLE public.product_sales
  ADD COLUMN warranty_days integer CHECK (warranty_days IS NULL OR (warranty_days >= 0 AND warranty_days <= 3650)),
  ADD COLUMN imei text,
  ADD COLUMN customer_name text CHECK (customer_name IS NULL OR char_length(customer_name) <= 120),
  ADD COLUMN customer_phone text CHECK (customer_phone IS NULL OR char_length(customer_phone) <= 40);

CREATE INDEX idx_product_sales_company_imei
  ON public.product_sales (company_id, imei)
  WHERE imei IS NOT NULL;

-- Ventas de equipos ya hechas: se les copia el IMEI del equipo (si el ítem sigue
-- en el catálogo), siempre dentro de la misma empresa. La garantía queda NULL.
UPDATE public.product_sales ps
SET imei = ii.imei
FROM public.inventory_items ii
WHERE ps.inventory_item_id = ii.id
  AND ps.company_id = ii.company_id
  AND ii.is_device
  AND ii.imei IS NOT NULL;

-- Misma función de siempre (sucursal/categoría congeladas + descuento de stock),
-- con dos cambios:
--   1. Ahora también congela el IMEI y limpia los datos de garantía/comprador de
--      lo que no es un equipo.
--   2. El ítem se busca SOLO dentro de la empresa de la venta. Antes la búsqueda
--      era por id a secas (la función es SECURITY DEFINER), así que una venta
--      cargada con el id de un ítem de otra empresa le descontaba el stock a esa
--      otra empresa. Ahora ese caso falla como "no disponible para venta".
CREATE OR REPLACE FUNCTION public.process_product_sale()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.inventory_item_id IS NOT NULL THEN
    SELECT ii.branch_id, ii.is_for_sale, ii.is_device, ii.imei,
           ic.name AS category_name, isc.name AS subcategory_name
      INTO v_item
      FROM public.inventory_items ii
      LEFT JOIN public.inventory_categories ic ON ic.id = ii.category_id
      LEFT JOIN public.inventory_subcategories isc ON isc.id = ii.subcategory_id
      WHERE ii.id = NEW.inventory_item_id
        AND ii.company_id = NEW.company_id;

    IF NOT FOUND OR NOT v_item.is_for_sale THEN
      RAISE EXCEPTION 'Este artículo no está disponible para venta';
    END IF;

    NEW.branch_id := v_item.branch_id;
    NEW.category_name := v_item.category_name;
    NEW.subcategory_name := v_item.subcategory_name;

    IF v_item.is_device THEN
      NEW.imei := v_item.imei;
      NEW.customer_name := NULLIF(btrim(coalesce(NEW.customer_name, '')), '');
      NEW.customer_phone := NULLIF(btrim(coalesce(NEW.customer_phone, '')), '');
    ELSE
      NEW.imei := NULL;
      NEW.warranty_days := NULL;
      NEW.customer_name := NULL;
      NEW.customer_phone := NULL;
    END IF;

    UPDATE public.inventory_items
      SET stock = stock - NEW.quantity
      WHERE id = NEW.inventory_item_id
        AND company_id = NEW.company_id
        AND stock >= NEW.quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para vender este producto';
    END IF;
  ELSE
    NEW.imei := NULL;
    NEW.warranty_days := NULL;
    NEW.customer_name := NULL;
    NEW.customer_phone := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Misma venta con canje de antes (register_sale_with_trade_in), ahora también
-- recibe la garantía y los datos del comprador (a nivel de venta: valen para
-- todos los equipos del carrito) y los devuelve en las filas insertadas.
CREATE OR REPLACE FUNCTION public.register_sale_with_trade_in(p jsonb)
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
  _warranty integer := NULLIF(btrim(coalesce(p->>'warranty_days', '')), '')::integer;
  _buyer_name text := NULLIF(btrim(coalesce(p->>'customer_name', '')), '');
  _buyer_phone text := NULLIF(btrim(coalesce(p->>'customer_phone', '')), '');
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
  IF _warranty IS NOT NULL AND (_warranty < 0 OR _warranty > 3650) THEN
    RAISE EXCEPTION 'La garantía tiene que estar entre 0 y 3650 días';
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
      payment_method, created_by, sale_group_id, trade_in_value,
      warranty_days, customer_name, customer_phone
    ) VALUES (
      _company, _inv.id, _inv.name, (_entry->>'quantity')::integer, (_entry->>'unit_price')::numeric,
      _inv.cost_price, _method, _uid, _group, CASE WHEN _first THEN _value ELSE 0 END,
      _warranty, _buyer_name, _buyer_phone
    )
    RETURNING id, product_name, quantity, unit_price, payment_method, created_at, branch_id,
              imei, warranty_days, customer_name, customer_phone
      INTO _row;

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
