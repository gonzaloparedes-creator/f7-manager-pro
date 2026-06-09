-- 1. Schema changes
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- 2. Helper function
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_super_admin FROM public.profiles WHERE id = _user_id), false);
$$;

CREATE OR REPLACE FUNCTION public.is_company_active(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_active FROM public.companies WHERE id = _company_id), true);
$$;

-- 3. companies policies
DROP POLICY IF EXISTS "Members view own company" ON public.companies;
DROP POLICY IF EXISTS "Admins update own company" ON public.companies;
DROP POLICY IF EXISTS "Super admin select all companies" ON public.companies;
DROP POLICY IF EXISTS "Super admin update all companies" ON public.companies;

CREATE POLICY "Members view own company" ON public.companies
FOR SELECT TO authenticated
USING (id = get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins update own company" ON public.companies
FOR UPDATE TO authenticated
USING (
  ((id = get_user_company(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role))
  OR public.is_super_admin(auth.uid())
);

-- 4. profiles policies
DROP POLICY IF EXISTS "Profiles select same company" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update self or company admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert self or company admin" ON public.profiles;

CREATE POLICY "Profiles select same company" ON public.profiles
FOR SELECT TO authenticated
USING (company_id = get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Profiles update self or company admin" ON public.profiles
FOR UPDATE TO authenticated
USING (
  ((company_id = get_user_company(auth.uid())) AND ((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role)))
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  ((company_id = get_user_company(auth.uid())) AND ((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role)))
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Profiles insert self or company admin" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  ((company_id = get_user_company(auth.uid())) AND ((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role)))
  OR public.is_super_admin(auth.uid())
);

-- 5. branches policies
DROP POLICY IF EXISTS "Branches select same company" ON public.branches;
DROP POLICY IF EXISTS "Branches insert company admin" ON public.branches;
DROP POLICY IF EXISTS "Branches update company admin" ON public.branches;
DROP POLICY IF EXISTS "Branches delete company admin" ON public.branches;

CREATE POLICY "Branches select same company" ON public.branches
FOR SELECT TO authenticated
USING (company_id = get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Branches insert company admin" ON public.branches
FOR INSERT TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company(auth.uid())) AND public.is_company_active(company_id))
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Branches update company admin" ON public.branches
FOR UPDATE TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company(auth.uid())))
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company(auth.uid())))
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Branches delete company admin" ON public.branches
FOR DELETE TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company(auth.uid())))
  OR public.is_super_admin(auth.uid())
);

-- 6. orders policies
DROP POLICY IF EXISTS "Orders select tenant scoped" ON public.orders;
DROP POLICY IF EXISTS "Orders insert tenant scoped" ON public.orders;
DROP POLICY IF EXISTS "Orders update tenant scoped" ON public.orders;
DROP POLICY IF EXISTS "Orders delete tenant scoped" ON public.orders;

CREATE POLICY "Orders select tenant scoped" ON public.orders
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    (company_id = get_user_company(auth.uid()))
    AND (has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = technician_id) OR (auth.uid() = assigned_technician_id) OR ((current_branch_id IS NOT NULL) AND (current_branch_id = get_user_branch(auth.uid()))))
  )
);

CREATE POLICY "Orders insert tenant scoped" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    (company_id = get_user_company(auth.uid()))
    AND (auth.uid() = technician_id)
    AND public.is_company_active(company_id)
  )
);

CREATE POLICY "Orders update tenant scoped" ON public.orders
FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    (company_id = get_user_company(auth.uid()))
    AND (has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = technician_id) OR (auth.uid() = assigned_technician_id) OR ((current_branch_id IS NOT NULL) AND (current_branch_id = get_user_branch(auth.uid()))))
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (company_id = get_user_company(auth.uid()))
);

CREATE POLICY "Orders delete tenant scoped" ON public.orders
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    (company_id = get_user_company(auth.uid()))
    AND (has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = technician_id))
  )
);

-- 7. inventory_items policies
DROP POLICY IF EXISTS "Inventory select same company" ON public.inventory_items;
DROP POLICY IF EXISTS "Inventory insert same company" ON public.inventory_items;
DROP POLICY IF EXISTS "Inventory update same company" ON public.inventory_items;
DROP POLICY IF EXISTS "Inventory delete admin same company" ON public.inventory_items;

CREATE POLICY "Inventory select same company" ON public.inventory_items
FOR SELECT TO authenticated
USING (company_id = get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Inventory insert same company" ON public.inventory_items
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR ((company_id = get_user_company(auth.uid())) AND public.is_company_active(company_id))
);

CREATE POLICY "Inventory update same company" ON public.inventory_items
FOR UPDATE TO authenticated
USING (company_id = get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (company_id = get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Inventory delete admin same company" ON public.inventory_items
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR ((company_id = get_user_company(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role))
);

-- 8. clients policies
DROP POLICY IF EXISTS "Clients select same company" ON public.clients;
DROP POLICY IF EXISTS "Clients insert same company" ON public.clients;
DROP POLICY IF EXISTS "Clients update same company" ON public.clients;
DROP POLICY IF EXISTS "Clients delete same company" ON public.clients;

CREATE POLICY "Clients select same company" ON public.clients
FOR SELECT TO authenticated
USING (company_id = get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Clients insert same company" ON public.clients
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR ((company_id = get_user_company(auth.uid())) AND (auth.uid() = technician_id) AND public.is_company_active(company_id))
);

CREATE POLICY "Clients update same company" ON public.clients
FOR UPDATE TO authenticated
USING (company_id = get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (company_id = get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Clients delete same company" ON public.clients
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR ((company_id = get_user_company(auth.uid())) AND (has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = technician_id)))
);

-- 9. user_roles policies (super admin can read across)
DROP POLICY IF EXISTS "Roles select same company" ON public.user_roles;
CREATE POLICY "Roles select same company" ON public.user_roles
FOR SELECT TO authenticated
USING (get_user_company(user_id) = get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));