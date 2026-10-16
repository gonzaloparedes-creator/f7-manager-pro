-- B1 seminuevos, parte 8: reservas de equipos con seña.
--
-- Un cliente separa un equipo dejando (o no) una seña. Mientras la reserva está
-- activa el equipo no se puede vender a otra persona; al venderlo desde la
-- reserva la seña se descuenta de lo que hay que cobrar; si la reserva se
-- cancela, la seña se devuelve y/o se retiene (todo o parte).
--
-- Modelo (mismo criterio que compras de equipos / pagos de órdenes):
--   * device_reservations: la reserva en sí. Estado activa -> vendida | cancelada.
--     La seña se fija al crear la reserva y no cambia.
--   * device_reservation_movements: libro append-only de la plata que entró o
--     salió por señas (sena = entró, devolucion = salió; retencion = lo que la
--     tienda se quedó, sin movimiento de caja). Es lo que lee Caja.
--   * product_sales.reservation_deposit: la seña que se aplicó al vender. La
--     pone el trigger a partir de la reserva, nunca el cliente.
--
-- Las tablas NO tienen permiso de INSERT/UPDATE/DELETE para usuarios: todas las
-- escrituras pasan por funciones SECURITY DEFINER que revisan empresa,
-- sucursal y empresa activa. Así nadie puede inventar un movimiento de seña
-- (que mueve el efectivo esperado de Caja) por la API.

ALTER TABLE public.companies
  ADD COLUMN device_reservation_seq integer NOT NULL DEFAULT 0;

CREATE TABLE public.device_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  receipt_number text NOT NULL,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  device_name text NOT NULL,
  imei text,
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 120),
  customer_phone text CHECK (customer_phone IS NULL OR char_length(customer_phone) <= 40),
  agreed_price numeric NOT NULL CHECK (agreed_price > 0),
  deposit_amount numeric NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  deposit_payment_method text,
  expires_on date NOT NULL,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  status text NOT NULL DEFAULT 'activa' CHECK (status IN ('activa', 'vendida', 'cancelada')),
  refunded_amount numeric NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  retained_amount numeric NOT NULL DEFAULT 0 CHECK (retained_amount >= 0),
  cancel_reason text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 300),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_reservations_receipt_unique UNIQUE (company_id, receipt_number),
  CONSTRAINT device_reservations_deposit_within_price CHECK (deposit_amount <= agreed_price),
  CONSTRAINT device_reservations_resolution_within_deposit CHECK (refunded_amount + retained_amount <= deposit_amount),
  CONSTRAINT device_reservations_resolved_consistent CHECK ((status = 'activa') = (resolved_at IS NULL))
);

-- Un equipo no puede tener dos reservas activas a la vez.
CREATE UNIQUE INDEX uq_device_reservations_active_item
  ON public.device_reservations (inventory_item_id)
  WHERE status = 'activa';

CREATE INDEX idx_device_reservations_company_created
  ON public.device_reservations (company_id, created_at DESC);
CREATE INDEX idx_device_reservations_company_status
  ON public.device_reservations (company_id, status);

ALTER TABLE public.device_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_reservations FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.device_reservations TO authenticated;

CREATE POLICY "Device reservations select tenant scoped" ON public.device_reservations
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR company_id = public.get_user_company(auth.uid())
);

CREATE POLICY "Device reservations no insert" ON public.device_reservations
AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY "Device reservations no update" ON public.device_reservations
AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "Device reservations no delete" ON public.device_reservations
AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

-- Un usuario con "Solo ve su sucursal" solo ve las reservas de la suya.
CREATE POLICY "Branch restricted device reservations" ON public.device_reservations
AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
);

CREATE TABLE public.device_reservation_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.device_reservations(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('sena', 'devolucion', 'retencion')),
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_reservation_movements_method_required CHECK (kind = 'retencion' OR payment_method IS NOT NULL)
);

CREATE INDEX idx_device_reservation_movements_company_created
  ON public.device_reservation_movements (company_id, created_at DESC);
CREATE INDEX idx_device_reservation_movements_reservation
  ON public.device_reservation_movements (reservation_id);

ALTER TABLE public.device_reservation_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_reservation_movements FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.device_reservation_movements TO authenticated;

CREATE POLICY "Reservation movements select tenant scoped" ON public.device_reservation_movements
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR company_id = public.get_user_company(auth.uid())
);

CREATE POLICY "Reservation movements no insert" ON public.device_reservation_movements
AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY "Reservation movements no update" ON public.device_reservation_movements
AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "Reservation movements no delete" ON public.device_reservation_movements
AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

CREATE POLICY "Branch restricted reservation movements" ON public.device_reservation_movements
AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
);

-- La venta que sale de una reserva guarda la seña que se aplicó.
ALTER TABLE public.product_sales
  ADD COLUMN reservation_id uuid REFERENCES public.device_reservations(id) ON DELETE SET NULL,
  ADD COLUMN reservation_deposit numeric NOT NULL DEFAULT 0 CHECK (reservation_deposit >= 0);

-- Un equipo con una reserva activa no se puede borrar del catálogo: la reserva
-- tiene plata de un cliente adentro. Hay que venderla o cancelarla primero.
CREATE FUNCTION public.block_delete_reserved_item()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.device_reservations
    WHERE inventory_item_id = OLD.id
      AND company_id = OLD.company_id
      AND status = 'activa'
  ) THEN
    RAISE EXCEPTION 'Este equipo tiene una reserva activa: vendelo o cancelá la reserva antes de eliminarlo';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER block_delete_reserved_item
  BEFORE DELETE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.block_delete_reserved_item();

-- Misma función de siempre (sucursal/categoría/IMEI congelados + descuento de
-- stock, buscando el ítem solo dentro de la empresa de la venta) con las reglas
-- de reserva:
--   * una línea puede venir con reservation_id: tiene que ser un equipo y la
--     reserva tiene que ser de la misma empresa, de ese equipo y estar activa.
--     La seña la pone el trigger desde la reserva y la reserva pasa a 'vendida'.
--   * una línea de un equipo con reserva activa que NO viene de esa reserva se
--     rechaza: el equipo está apartado para otra persona.
CREATE OR REPLACE FUNCTION public.process_product_sale()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
  v_res RECORD;
BEGIN
  NEW.reservation_deposit := 0;

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

      IF NEW.reservation_id IS NOT NULL THEN
        SELECT r.id, r.deposit_amount
          INTO v_res
          FROM public.device_reservations r
          WHERE r.id = NEW.reservation_id
            AND r.company_id = NEW.company_id
            AND r.inventory_item_id = NEW.inventory_item_id
            AND r.status = 'activa'
          FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'La reserva no existe o ya fue resuelta';
        END IF;
        IF v_res.deposit_amount > NEW.quantity * NEW.unit_price THEN
          RAISE EXCEPTION 'La seña no puede superar el precio de venta del equipo';
        END IF;
        NEW.reservation_deposit := v_res.deposit_amount;
        UPDATE public.device_reservations
          SET status = 'vendida', resolved_at = now(), resolved_by = NEW.created_by
          WHERE id = v_res.id;
      ELSIF EXISTS (
        SELECT 1 FROM public.device_reservations r
        WHERE r.company_id = NEW.company_id
          AND r.inventory_item_id = NEW.inventory_item_id
          AND r.status = 'activa'
      ) THEN
        RAISE EXCEPTION 'Este equipo está reservado: vendelo desde la reserva o cancelala';
      END IF;
    ELSE
      IF NEW.reservation_id IS NOT NULL THEN
        RAISE EXCEPTION 'Solo un equipo puede venderse desde una reserva';
      END IF;
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
    IF NEW.reservation_id IS NOT NULL THEN
      RAISE EXCEPTION 'Solo un equipo puede venderse desde una reserva';
    END IF;
    NEW.imei := NULL;
    NEW.warranty_days := NULL;
    NEW.customer_name := NULL;
    NEW.customer_phone := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Venta con canje (register_sale_with_trade_in), ahora con líneas que pueden
-- venir de una reserva. El equipo recibido y las señas, juntos, no pueden
-- superar el total de la venta.
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
      warranty_days, customer_name, customer_phone, reservation_id
    ) VALUES (
      _company, _inv.id, _inv.name, (_entry->>'quantity')::integer, (_entry->>'unit_price')::numeric,
      _inv.cost_price, _method, _uid, _group, CASE WHEN _first THEN _value ELSE 0 END,
      _warranty, _buyer_name, _buyer_phone, NULLIF(_entry->>'reservation_id', '')::uuid
    )
    RETURNING id, product_name, quantity, unit_price, payment_method, created_at, branch_id,
              imei, warranty_days, customer_name, customer_phone, reservation_deposit
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

-- Crea la reserva (y el movimiento de la seña si la hay) en una transacción.
-- SECURITY DEFINER: revisa a mano lo que antes revisaba la RLS (empresa del
-- que llama, empresa activa, equipo de su empresa y de su sucursal si está
-- restringido a una).
CREATE FUNCTION public.register_device_reservation(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company uuid := public.get_user_company(_uid);
  _item_id uuid := NULLIF(p->>'inventory_item_id', '')::uuid;
  _customer text := NULLIF(btrim(coalesce(p->>'customer_name', '')), '');
  _phone text := NULLIF(btrim(coalesce(p->>'customer_phone', '')), '');
  _price numeric := NULLIF(btrim(coalesce(p->>'agreed_price', '')), '')::numeric;
  _deposit numeric := coalesce(NULLIF(btrim(coalesce(p->>'deposit_amount', '')), '')::numeric, 0);
  _method text := NULLIF(btrim(coalesce(p->>'payment_method', '')), '');
  _expires date := NULLIF(btrim(coalesce(p->>'expires_on', '')), '')::date;
  _notes text := NULLIF(btrim(coalesce(p->>'notes', '')), '');
  _item record;
  _number text;
  _seq integer;
  _row public.device_reservations%ROWTYPE;
BEGIN
  IF _uid IS NULL OR _company IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF NOT public.is_company_active(_company) THEN
    RAISE EXCEPTION 'La cuenta de la empresa no está activa';
  END IF;
  IF _item_id IS NULL THEN RAISE EXCEPTION 'Falta el equipo a reservar'; END IF;
  IF _customer IS NULL THEN RAISE EXCEPTION 'Falta el nombre del cliente'; END IF;
  IF char_length(_customer) > 120 THEN RAISE EXCEPTION 'El nombre del cliente es demasiado largo'; END IF;
  IF _phone IS NOT NULL AND char_length(_phone) > 40 THEN RAISE EXCEPTION 'El teléfono es demasiado largo'; END IF;
  IF _price IS NULL OR _price <= 0 OR _price <> trunc(_price) THEN
    RAISE EXCEPTION 'El precio acordado tiene que ser un monto entero mayor a cero';
  END IF;
  IF _deposit < 0 OR _deposit <> trunc(_deposit) THEN
    RAISE EXCEPTION 'La seña tiene que ser un monto entero (o cero)';
  END IF;
  IF _deposit > _price THEN RAISE EXCEPTION 'La seña no puede superar el precio acordado'; END IF;
  IF _deposit > 0 AND _method IS NULL THEN
    RAISE EXCEPTION 'Elegí con qué medio de pago dejó la seña';
  END IF;
  IF _expires IS NULL THEN RAISE EXCEPTION 'Falta la fecha hasta la que se reserva'; END IF;
  IF _notes IS NOT NULL AND char_length(_notes) > 500 THEN
    RAISE EXCEPTION 'Las notas son demasiado largas (máximo 500 caracteres)';
  END IF;

  SELECT ii.id, ii.name, ii.imei, ii.branch_id, ii.stock, ii.is_device, ii.is_for_sale
    INTO _item
    FROM public.inventory_items ii
    WHERE ii.id = _item_id AND ii.company_id = _company
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ese equipo no existe'; END IF;
  IF public.is_branch_restricted(_uid)
     AND _item.branch_id IS DISTINCT FROM public.get_user_branch(_uid) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF NOT _item.is_device THEN RAISE EXCEPTION 'Solo se pueden reservar equipos'; END IF;
  IF NOT _item.is_for_sale OR _item.stock < 1 THEN
    RAISE EXCEPTION 'Este equipo no está disponible para reservar';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.device_reservations r
    WHERE r.inventory_item_id = _item.id AND r.company_id = _company AND r.status = 'activa'
  ) THEN
    RAISE EXCEPTION 'Este equipo ya está reservado';
  END IF;

  UPDATE public.companies
    SET device_reservation_seq = device_reservation_seq + 1
    WHERE id = _company
    RETURNING device_reservation_seq INTO _seq;
  _number := 'RES-' || lpad(_seq::text, 4, '0');

  INSERT INTO public.device_reservations (
    company_id, branch_id, receipt_number, inventory_item_id, device_name, imei,
    customer_name, customer_phone, agreed_price, deposit_amount, deposit_payment_method,
    expires_on, notes, created_by
  ) VALUES (
    _company, _item.branch_id, _number, _item.id, _item.name, _item.imei,
    _customer, _phone, _price, _deposit, CASE WHEN _deposit > 0 THEN _method ELSE NULL END,
    _expires, _notes, _uid
  )
  RETURNING * INTO _row;

  IF _deposit > 0 THEN
    INSERT INTO public.device_reservation_movements (
      reservation_id, company_id, branch_id, kind, amount, payment_method, created_by
    ) VALUES (
      _row.id, _company, _row.branch_id, 'sena', _deposit, _method, _uid
    );
  END IF;

  RETURN to_jsonb(_row);
END;
$$;

REVOKE ALL ON FUNCTION public.register_device_reservation(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_device_reservation(jsonb) TO authenticated;

-- Cancela una reserva activa. La seña se reparte entre lo que se devuelve al
-- cliente (sale de caja, con su medio de pago) y lo que la tienda retiene.
-- refund_amount va de 0 (se retiene toda) a la seña completa (se devuelve toda).
CREATE FUNCTION public.cancel_device_reservation(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company uuid := public.get_user_company(_uid);
  _id uuid := NULLIF(p->>'reservation_id', '')::uuid;
  _refund numeric := coalesce(NULLIF(btrim(coalesce(p->>'refund_amount', '')), '')::numeric, 0);
  _method text := NULLIF(btrim(coalesce(p->>'refund_method', '')), '');
  _reason text := NULLIF(btrim(coalesce(p->>'reason', '')), '');
  _res public.device_reservations%ROWTYPE;
  _retained numeric;
BEGIN
  IF _uid IS NULL OR _company IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF NOT public.is_company_active(_company) THEN
    RAISE EXCEPTION 'La cuenta de la empresa no está activa';
  END IF;
  IF _id IS NULL THEN RAISE EXCEPTION 'Falta la reserva a cancelar'; END IF;
  IF _reason IS NOT NULL AND char_length(_reason) > 300 THEN
    RAISE EXCEPTION 'El motivo es demasiado largo (máximo 300 caracteres)';
  END IF;

  SELECT * INTO _res
    FROM public.device_reservations
    WHERE id = _id AND company_id = _company
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La reserva no existe'; END IF;
  IF public.is_branch_restricted(_uid)
     AND _res.branch_id IS DISTINCT FROM public.get_user_branch(_uid) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _res.status <> 'activa' THEN RAISE EXCEPTION 'Esta reserva ya fue resuelta'; END IF;

  IF _refund < 0 OR _refund <> trunc(_refund) THEN
    RAISE EXCEPTION 'El monto a devolver tiene que ser un monto entero (o cero)';
  END IF;
  IF _refund > _res.deposit_amount THEN
    RAISE EXCEPTION 'No se puede devolver más que la seña (%)', _res.deposit_amount;
  END IF;
  IF _refund > 0 AND _method IS NULL THEN
    RAISE EXCEPTION 'Elegí con qué medio de pago se devuelve la seña';
  END IF;
  _retained := _res.deposit_amount - _refund;

  IF _refund > 0 THEN
    INSERT INTO public.device_reservation_movements (
      reservation_id, company_id, branch_id, kind, amount, payment_method, created_by
    ) VALUES (_res.id, _company, _res.branch_id, 'devolucion', _refund, _method, _uid);
  END IF;
  IF _retained > 0 THEN
    INSERT INTO public.device_reservation_movements (
      reservation_id, company_id, branch_id, kind, amount, payment_method, created_by
    ) VALUES (_res.id, _company, _res.branch_id, 'retencion', _retained, NULL, _uid);
  END IF;

  UPDATE public.device_reservations
    SET status = 'cancelada',
        refunded_amount = _refund,
        retained_amount = _retained,
        cancel_reason = _reason,
        resolved_at = now(),
        resolved_by = _uid
    WHERE id = _res.id
    RETURNING * INTO _res;

  RETURN to_jsonb(_res);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_device_reservation(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_device_reservation(jsonb) TO authenticated;

-- Extiende el plazo de una reserva activa.
CREATE FUNCTION public.extend_device_reservation(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company uuid := public.get_user_company(_uid);
  _id uuid := NULLIF(p->>'reservation_id', '')::uuid;
  _expires date := NULLIF(btrim(coalesce(p->>'expires_on', '')), '')::date;
  _res public.device_reservations%ROWTYPE;
BEGIN
  IF _uid IS NULL OR _company IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF NOT public.is_company_active(_company) THEN
    RAISE EXCEPTION 'La cuenta de la empresa no está activa';
  END IF;
  IF _id IS NULL THEN RAISE EXCEPTION 'Falta la reserva'; END IF;
  IF _expires IS NULL THEN RAISE EXCEPTION 'Falta la nueva fecha'; END IF;

  SELECT * INTO _res
    FROM public.device_reservations
    WHERE id = _id AND company_id = _company
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La reserva no existe'; END IF;
  IF public.is_branch_restricted(_uid)
     AND _res.branch_id IS DISTINCT FROM public.get_user_branch(_uid) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _res.status <> 'activa' THEN RAISE EXCEPTION 'Esta reserva ya fue resuelta'; END IF;

  UPDATE public.device_reservations
    SET expires_on = _expires
    WHERE id = _res.id
    RETURNING * INTO _res;

  RETURN to_jsonb(_res);
END;
$$;

REVOKE ALL ON FUNCTION public.extend_device_reservation(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extend_device_reservation(jsonb) TO authenticated;
