-- Derivar una orden a otra sucursal, como una operación atómica del servidor.
--
-- Hacerlo con un UPDATE directo desde el cliente falla cuando el usuario solo
-- ve su sucursal (y también para un staff común que no es el técnico de la
-- orden): Postgres aplica las políticas de SELECT a la fila NUEVA de un
-- UPDATE que filtra por columnas, y la orden ya derivada deja de ser visible
-- para quien la derivó. El permiso se valida acá con la misma regla que la
-- política de UPDATE de orders (admin, técnico, técnico asignado o misma
-- sucursal que la orden), y el historial se anota en la misma transacción.

CREATE OR REPLACE FUNCTION public.transfer_order_to_branch(_order_id uuid, _branch_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_user_branch uuid;
  v_branch_name text;
  v_label text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada';
  END IF;

  IF NOT public.is_super_admin(v_uid) THEN
    IF v_order.company_id IS DISTINCT FROM public.get_user_company(v_uid) THEN
      RAISE EXCEPTION 'Orden no encontrada';
    END IF;

    v_user_branch := public.get_user_branch(v_uid);

    IF public.is_branch_restricted(v_uid)
       AND v_order.current_branch_id IS DISTINCT FROM v_user_branch THEN
      RAISE EXCEPTION 'Orden no encontrada';
    END IF;

    IF NOT (
      public.has_role(v_uid, 'admin'::app_role)
      OR v_uid = v_order.technician_id
      OR v_uid = v_order.assigned_technician_id
      OR (v_order.current_branch_id IS NOT NULL AND v_order.current_branch_id = v_user_branch)
    ) THEN
      RAISE EXCEPTION 'No tenés permiso para derivar esta orden';
    END IF;
  END IF;

  IF v_order.current_branch_id IS NOT DISTINCT FROM _branch_id THEN
    RAISE EXCEPTION 'La orden ya está en esa sucursal';
  END IF;

  SELECT name INTO v_branch_name
  FROM public.branches
  WHERE id = _branch_id AND company_id = v_order.company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sucursal no encontrada';
  END IF;

  UPDATE public.orders SET current_branch_id = _branch_id WHERE id = _order_id;

  SELECT label INTO v_label
  FROM public.order_status_presets
  WHERE company_id = v_order.company_id AND key = v_order.status;

  INSERT INTO public.order_status_history (order_id, status, status_label, note, is_internal)
  VALUES (_order_id, v_order.status, v_label, 'Equipo derivado a ' || v_branch_name, true);
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_order_to_branch(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_order_to_branch(uuid, uuid) TO authenticated;
