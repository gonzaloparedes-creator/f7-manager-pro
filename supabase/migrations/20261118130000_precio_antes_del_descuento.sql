-- Ventas: guardar el precio de cada producto ANTES del descuento del carrito.
--
-- El carrito reparte el descuento dentro del precio de cada línea: unit_price ya viene
-- rebajado y así lo suman Reportes y Caja. Eso es lo que se cobró de verdad, pero el ticket
-- imprimía solo ese precio rebajado ("Glass 18.000" cuando en el catálogo vale 30.000) y el
-- dueño no entendía por qué. Con el precio original guardado, el ticket y el comprobante por
-- WhatsApp pueden mostrar el precio de lista y el descuento aparte.
--
-- NULL = sin descuento registrado: todas las ventas anteriores y las que no tuvieron
-- descuento. unit_price sigue siendo lo que se cobró: Reportes, Caja y la ganancia no
-- cambian. Es una columna informativa y sin restricciones, para que nunca pueda hacer
-- fallar una venta.

ALTER TABLE public.product_sales
  ADD COLUMN IF NOT EXISTS unit_price_before_discount numeric;

COMMENT ON COLUMN public.product_sales.unit_price_before_discount IS
  'Precio por unidad antes del descuento del carrito. NULL = sin descuento registrado. unit_price es lo cobrado.';

-- register_sale_with_trade_in: idéntica a la de 20261015220000_reservas_de_equipos.sql (es la
-- que está en producción), salvo que cada línea del pedido puede traer
-- unit_price_before_discount: se guarda y se devuelve con la fila.
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
  _deposits numeric := 0;
  _deposit numeric;
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

    IF NULLIF(_entry->>'reservation_id', '') IS NOT NULL THEN
      SELECT r.deposit_amount INTO _deposit
        FROM public.device_reservations r
        WHERE r.id = (_entry->>'reservation_id')::uuid
          AND r.company_id = _company
          AND r.status = 'activa';
      IF NOT FOUND THEN RAISE EXCEPTION 'La reserva no existe o ya fue resuelta'; END IF;
      _deposits := _deposits + _deposit;
    END IF;
  END LOOP;
  IF _value > _total THEN
    RAISE EXCEPTION 'El valor del equipo recibido no puede superar el total de la venta';
  END IF;
  IF _value + _deposits > _total THEN
    RAISE EXCEPTION 'El equipo recibido y la seña no pueden superar el total de la venta';
  END IF;

  FOR _entry IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT id, name, cost_price INTO _inv
      FROM public.inventory_items
      WHERE id = (_entry->>'inventory_item_id')::uuid AND company_id = _company;
    IF NOT FOUND THEN RAISE EXCEPTION 'Uno de los productos de la venta no existe'; END IF;

    INSERT INTO public.product_sales (
      company_id, inventory_item_id, product_name, quantity, unit_price, unit_cost,
      payment_method, created_by, sale_group_id, trade_in_value,
      warranty_days, customer_name, customer_phone, reservation_id, unit_price_before_discount
    ) VALUES (
      _company, _inv.id, _inv.name, (_entry->>'quantity')::integer, (_entry->>'unit_price')::numeric,
      _inv.cost_price, _method, _uid, _group, CASE WHEN _first THEN _value ELSE 0 END,
      _warranty, _buyer_name, _buyer_phone, NULLIF(_entry->>'reservation_id', '')::uuid,
      NULLIF(_entry->>'unit_price_before_discount', '')::numeric
    )
    RETURNING id, product_name, quantity, unit_price, payment_method, created_at, branch_id,
              imei, warranty_days, customer_name, customer_phone, reservation_deposit,
              unit_price_before_discount
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
