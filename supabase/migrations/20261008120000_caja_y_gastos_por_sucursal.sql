-- Caja (apertura y cierre) y Gastos por sucursal.
--
-- La migración 20261006120000 les vedó estas tablas por completo a los
-- usuarios con "Solo ve su sucursal", porque no tenían forma de atribuir una
-- fila a una sucursal. Resultado: los empleados restringidos perdieron Caja y
-- Gastos. Acá se agrega branch_id y se les devuelve el acceso, recortado a su
-- sucursal. Lo que ya existía queda con branch_id NULL ("general", de toda la
-- empresa) y solo lo ven los usuarios sin restricción, como siempre.

ALTER TABLE public.cash_openings
  ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.cash_closings
  ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.expenses
  ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.expense_payments
  ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Branch restricted no cash closings" ON public.cash_closings;
DROP POLICY IF EXISTS "Branch restricted no cash openings" ON public.cash_openings;
DROP POLICY IF EXISTS "Branch restricted no expenses" ON public.expenses;
DROP POLICY IF EXISTS "Branch restricted no expense payments" ON public.expense_payments;

-- Políticas RESTRICTIVE: se suman (AND) a las permisivas de cada tabla, así
-- que los permisos por rol/flags de staff siguen aplicando igual. Un usuario
-- restringido solo lee y escribe filas de su propia sucursal.
CREATE POLICY "Branch restricted cash closings" ON public.cash_closings
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
)
WITH CHECK (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
);

CREATE POLICY "Branch restricted cash openings" ON public.cash_openings
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
)
WITH CHECK (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
);

CREATE POLICY "Branch restricted expenses" ON public.expenses
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
)
WITH CHECK (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
);

CREATE POLICY "Branch restricted expense payments" ON public.expense_payments
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
)
WITH CHECK (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
);

CREATE INDEX idx_cash_openings_company_branch_date ON public.cash_openings (company_id, branch_id, opening_date DESC);
CREATE INDEX idx_cash_closings_company_branch_date ON public.cash_closings (company_id, branch_id, closing_date DESC);
CREATE INDEX idx_expenses_company_branch_date ON public.expenses (company_id, branch_id, expense_date DESC);
