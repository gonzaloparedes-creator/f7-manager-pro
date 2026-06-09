ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_technical_notes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.branches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_technical_notes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles select self or company admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert self or company admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update self or company admin" ON public.profiles;
DROP POLICY IF EXISTS "Users view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Roles insert company admin" ON public.user_roles;
DROP POLICY IF EXISTS "Roles update company admin" ON public.user_roles;
DROP POLICY IF EXISTS "Roles delete company admin" ON public.user_roles;

CREATE POLICY "Profiles select same company"
ON public.profiles
FOR SELECT
TO authenticated
USING (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Profiles insert same company"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Profiles update same company"
ON public.profiles
FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company(auth.uid()))
WITH CHECK (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Roles select same company"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.get_user_company(user_id) = public.get_user_company(auth.uid()));

CREATE POLICY "Roles insert company admin"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.get_user_company(user_id) = public.get_user_company(auth.uid())
);

CREATE POLICY "Roles update company admin"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.get_user_company(user_id) = public.get_user_company(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.get_user_company(user_id) = public.get_user_company(auth.uid())
);

CREATE POLICY "Roles delete company admin"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.get_user_company(user_id) = public.get_user_company(auth.uid())
);

DROP POLICY IF EXISTS "Branches update company admin" ON public.branches;
DROP POLICY IF EXISTS "Clients update same company" ON public.clients;
DROP POLICY IF EXISTS "Orders update tenant scoped" ON public.orders;

CREATE POLICY "Branches update company admin"
ON public.branches
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND company_id = public.get_user_company(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Clients update same company"
ON public.clients
FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company(auth.uid()))
WITH CHECK (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Orders update tenant scoped"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = technician_id
    OR auth.uid() = assigned_technician_id
    OR (current_branch_id IS NOT NULL AND current_branch_id = public.get_user_branch(auth.uid()))
  )
)
WITH CHECK (company_id = public.get_user_company(auth.uid()));