-- Encargado de sucursal: un switch por usuario ("Solo ve su sucursal") que,
-- sin cambiar su rol (admin/staff), lo limita a los datos de su sucursal.
--
-- Se implementa con políticas RESTRICTIVE (se suman con AND a las políticas
-- permisivas existentes, sin reescribirlas): para un usuario sin el switch
-- activado todas valen TRUE y nada cambia. Fail-closed: si el switch está
-- activo pero el usuario no tiene sucursal asignada, no ve nada.
--
-- Alcance: productos/inventario, ventas de mostrador, órdenes (y por ende
-- sus pagos, repuestos, historial y notas, que cuelgan de orders) y todo lo
-- que se calcula a partir de eso (Dashboard, Reportes). Gastos y Caja no
-- tienen columna de sucursal, así que quedan vedados a estos usuarios.

ALTER TABLE public.profiles
  ADD COLUMN restrict_to_branch boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_branch_restricted(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT restrict_to_branch FROM public.profiles WHERE id = _user_id), false)
$$;

GRANT EXECUTE ON FUNCTION public.is_branch_restricted(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Datos por sucursal
-- ---------------------------------------------------------------------------

CREATE POLICY "Branch restricted inventory" ON public.inventory_items
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
)
WITH CHECK (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
);

-- product_sales.branch_id lo fija el trigger a partir del ítem vendido, así
-- que vender un ítem de otra sucursal falla acá (y revierte el descuento de
-- stock, que ocurre en el mismo BEFORE INSERT).
CREATE POLICY "Branch restricted product sales" ON public.product_sales
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
)
WITH CHECK (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
);

CREATE POLICY "Branch restricted orders select" ON public.orders
AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR current_branch_id = (SELECT public.get_user_branch(auth.uid()))
);

CREATE POLICY "Branch restricted orders insert" ON public.orders
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR current_branch_id = (SELECT public.get_user_branch(auth.uid()))
);

-- WITH CHECK (true): el encargado puede derivar una orden a otra sucursal
-- (cambia current_branch_id); lo que no puede es tocar órdenes ajenas.
CREATE POLICY "Branch restricted orders update" ON public.orders
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR current_branch_id = (SELECT public.get_user_branch(auth.uid()))
)
WITH CHECK (true);

CREATE POLICY "Branch restricted orders delete" ON public.orders
AS RESTRICTIVE FOR DELETE TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR current_branch_id = (SELECT public.get_user_branch(auth.uid()))
);

-- order_payments se filtraba solo por empresa; el EXISTS pasa por las
-- políticas de orders, así que hereda el filtro de sucursal.
CREATE POLICY "Branch restricted order payments select" ON public.order_payments
AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_payments.order_id)
);

-- ---------------------------------------------------------------------------
-- Datos sin sucursal: vedados (no se pueden atribuir a una sucursal)
-- ---------------------------------------------------------------------------

CREATE POLICY "Branch restricted no cash closings" ON public.cash_closings
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT (SELECT public.is_branch_restricted(auth.uid())))
WITH CHECK (NOT (SELECT public.is_branch_restricted(auth.uid())));

CREATE POLICY "Branch restricted no cash openings" ON public.cash_openings
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT (SELECT public.is_branch_restricted(auth.uid())))
WITH CHECK (NOT (SELECT public.is_branch_restricted(auth.uid())));

CREATE POLICY "Branch restricted no expenses" ON public.expenses
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT (SELECT public.is_branch_restricted(auth.uid())))
WITH CHECK (NOT (SELECT public.is_branch_restricted(auth.uid())));

CREATE POLICY "Branch restricted no expense payments" ON public.expense_payments
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT (SELECT public.is_branch_restricted(auth.uid())))
WITH CHECK (NOT (SELECT public.is_branch_restricted(auth.uid())));

-- ---------------------------------------------------------------------------
-- Administración de la empresa: un encargado restringido no puede cambiar
-- roles, sucursales ni la configuración de la empresa. Si no, podría
-- quitarse la restricción o crear un admin sin restricción.
-- Solo INSERT/UPDATE/DELETE: la lectura (su propio rol) sigue abierta.
-- ---------------------------------------------------------------------------

CREATE POLICY "Branch restricted no roles insert" ON public.user_roles
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT (SELECT public.is_branch_restricted(auth.uid())));

CREATE POLICY "Branch restricted no roles update" ON public.user_roles
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (NOT (SELECT public.is_branch_restricted(auth.uid())))
WITH CHECK (NOT (SELECT public.is_branch_restricted(auth.uid())));

CREATE POLICY "Branch restricted no roles delete" ON public.user_roles
AS RESTRICTIVE FOR DELETE TO authenticated
USING (NOT (SELECT public.is_branch_restricted(auth.uid())));

CREATE POLICY "Branch restricted no branches insert" ON public.branches
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT (SELECT public.is_branch_restricted(auth.uid())));

CREATE POLICY "Branch restricted no branches update" ON public.branches
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (NOT (SELECT public.is_branch_restricted(auth.uid())))
WITH CHECK (NOT (SELECT public.is_branch_restricted(auth.uid())));

CREATE POLICY "Branch restricted no branches delete" ON public.branches
AS RESTRICTIVE FOR DELETE TO authenticated
USING (NOT (SELECT public.is_branch_restricted(auth.uid())));

CREATE POLICY "Branch restricted no company update" ON public.companies
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (NOT (SELECT public.is_branch_restricted(auth.uid())))
WITH CHECK (NOT (SELECT public.is_branch_restricted(auth.uid())));

-- Un restringido solo puede editar su propio perfil (nombre, teléfono, etc.)
CREATE POLICY "Branch restricted profiles update self only" ON public.profiles
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR id = auth.uid()
)
WITH CHECK (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR id = auth.uid()
);

-- Ni siquiera sobre su propio perfil puede un restringido cambiar su
-- sucursal o el switch. Y nadie puede restringirse a sí mismo: un dueño que
-- se activa el switch por error quedaría sin acceso a la configuración.
CREATE OR REPLACE FUNCTION public.protect_branch_restriction()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.restrict_to_branch IS DISTINCT FROM OLD.restrict_to_branch
      OR NEW.branch_id IS DISTINCT FROM OLD.branch_id)
     AND public.is_branch_restricted(auth.uid()) THEN
    RAISE EXCEPTION 'Un usuario restringido a su sucursal no puede cambiar su sucursal ni esta restricción';
  END IF;

  IF NEW.restrict_to_branch
     AND NEW.restrict_to_branch IS DISTINCT FROM OLD.restrict_to_branch
     AND NEW.id = auth.uid() THEN
    RAISE EXCEPTION 'No podés restringirte a vos mismo a una sucursal';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_branch_restriction
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_branch_restriction();
