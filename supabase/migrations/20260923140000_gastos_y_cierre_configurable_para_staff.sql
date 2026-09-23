-- Permite al admin decidir, por empresa, si el staff/recepción pueden usar
-- el apartado de Gastos y/o hacer el Cierre de Caja (por defecto ambos
-- quedan ocultos, igual que hoy — el admin los habilita si los necesita).
-- A diferencia de staff_can_view_stock/staff_can_view_products (que solo
-- restringen al rol "staff", dejando a Recepción siempre con acceso), acá
-- el pedido es explícito: el flag cubre tanto "staff" como "recepcion".
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS staff_can_view_gastos boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS staff_can_close_caja boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.company_staff_can_view_gastos(_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT staff_can_view_gastos FROM public.companies WHERE id = _company_id), false);
$$;

CREATE OR REPLACE FUNCTION public.company_staff_can_close_caja(_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT staff_can_close_caja FROM public.companies WHERE id = _company_id), false);
$$;

-- ===== expense_categories: solo se relaja el alta (dar de baja sigue admin-only) =====
DROP POLICY IF EXISTS "Expense categories insert admin same company" ON public.expense_categories;
CREATE POLICY "Expense categories insert admin or allowed staff" ON public.expense_categories
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND public.is_company_active(company_id)
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.company_staff_can_view_gastos(company_id))
  )
);

-- ===== expenses: CRUD completo si el flag está activo =====
DROP POLICY IF EXISTS "Expenses select tenant admin" ON public.expenses;
CREATE POLICY "Expenses select tenant admin or allowed staff" ON public.expenses
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.company_staff_can_view_gastos(company_id))
  )
);

DROP POLICY IF EXISTS "Expenses insert tenant admin" ON public.expenses;
CREATE POLICY "Expenses insert tenant admin or allowed staff" ON public.expenses
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.is_company_active(company_id)
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.company_staff_can_view_gastos(company_id))
);

DROP POLICY IF EXISTS "Expenses update tenant admin" ON public.expenses;
CREATE POLICY "Expenses update tenant admin or allowed staff" ON public.expenses
FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.company_staff_can_view_gastos(company_id))
)
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.company_staff_can_view_gastos(company_id))
);

DROP POLICY IF EXISTS "Expenses delete tenant admin" ON public.expenses;
CREATE POLICY "Expenses delete tenant admin or allowed staff" ON public.expenses
FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.company_staff_can_view_gastos(company_id))
);

-- ===== expense_payments: lectura si cualquiera de los dos flags está
-- activo (Cierre de Caja necesita leer este ledger aunque Gastos esté
-- apagado), alta solo si el flag de Gastos está activo =====
DROP POLICY IF EXISTS "Expense payments select tenant admin" ON public.expense_payments;
CREATE POLICY "Expense payments select tenant admin or allowed staff" ON public.expense_payments
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.company_staff_can_view_gastos(company_id)
      OR public.company_staff_can_close_caja(company_id)
    )
  )
);

DROP POLICY IF EXISTS "Expense payments insert tenant admin" ON public.expense_payments;
CREATE POLICY "Expense payments insert tenant admin or allowed staff" ON public.expense_payments
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.is_company_active(company_id)
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.company_staff_can_view_gastos(company_id))
);

-- ===== cash_closings: lectura/alta si el flag de cierre está activo =====
DROP POLICY IF EXISTS "Cash closings select tenant admin" ON public.cash_closings;
CREATE POLICY "Cash closings select tenant admin or allowed staff" ON public.cash_closings
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.company_staff_can_close_caja(company_id))
  )
);

DROP POLICY IF EXISTS "Cash closings insert tenant admin" ON public.cash_closings;
CREATE POLICY "Cash closings insert tenant admin or allowed staff" ON public.cash_closings
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.is_company_active(company_id)
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.company_staff_can_close_caja(company_id))
  AND closed_by = auth.uid()
);
