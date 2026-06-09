-- 1. Companies (tenants) table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER companies_set_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Add company_id to relevant tables (nullable first for backfill)
ALTER TABLE public.profiles ADD COLUMN company_id uuid;
ALTER TABLE public.branches ADD COLUMN company_id uuid;
ALTER TABLE public.clients  ADD COLUMN company_id uuid;
ALTER TABLE public.orders   ADD COLUMN company_id uuid;

-- 3. Backfill: create default company and assign everything
DO $$
DECLARE
  default_company_id uuid;
BEGIN
  INSERT INTO public.companies (name) VALUES ('Mi Empresa') RETURNING id INTO default_company_id;
  UPDATE public.profiles SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.branches SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.clients  SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.orders   SET company_id = default_company_id WHERE company_id IS NULL;
END $$;

-- 4. Enforce NOT NULL + FKs
ALTER TABLE public.profiles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.branches ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.clients  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.orders   ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
ALTER TABLE public.branches ADD CONSTRAINT branches_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
ALTER TABLE public.clients  ADD CONSTRAINT clients_company_fk  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
ALTER TABLE public.orders   ADD CONSTRAINT orders_company_fk   FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;

CREATE INDEX idx_profiles_company ON public.profiles(company_id);
CREATE INDEX idx_branches_company ON public.branches(company_id);
CREATE INDEX idx_clients_company  ON public.clients(company_id);
CREATE INDEX idx_orders_company   ON public.orders(company_id);

-- 5. Helper function: get the company of a user
CREATE OR REPLACE FUNCTION public.get_user_company(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id
$$;

-- 6. RLS: companies (users can see only their own company)
CREATE POLICY "Members view own company"
ON public.companies FOR SELECT TO authenticated
USING (id = public.get_user_company(auth.uid()));

CREATE POLICY "Admins update own company"
ON public.companies FOR UPDATE TO authenticated
USING (id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- 7. Rewrite RLS policies on profiles for tenant isolation
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Profiles select self or company admin"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR (public.has_role(auth.uid(), 'admin') AND company_id = public.get_user_company(auth.uid()))
);

CREATE POLICY "Profiles insert self or company admin"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = id
  OR (public.has_role(auth.uid(), 'admin') AND company_id = public.get_user_company(auth.uid()))
);

CREATE POLICY "Profiles update self or company admin"
ON public.profiles FOR UPDATE TO authenticated
USING (
  auth.uid() = id
  OR (public.has_role(auth.uid(), 'admin') AND company_id = public.get_user_company(auth.uid()))
);

-- 8. Branches: tenant-scoped
DROP POLICY IF EXISTS "Authenticated can view branches" ON public.branches;
DROP POLICY IF EXISTS "Admins insert branches" ON public.branches;
DROP POLICY IF EXISTS "Admins update branches" ON public.branches;
DROP POLICY IF EXISTS "Admins delete branches" ON public.branches;

CREATE POLICY "Branches select same company"
ON public.branches FOR SELECT TO authenticated
USING (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Branches insert company admin"
ON public.branches FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND company_id = public.get_user_company(auth.uid())
);

CREATE POLICY "Branches update company admin"
ON public.branches FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND company_id = public.get_user_company(auth.uid())
);

CREATE POLICY "Branches delete company admin"
ON public.branches FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND company_id = public.get_user_company(auth.uid())
);

-- 9. Clients: tenant-scoped (any company member can CRUD their company's clients)
DROP POLICY IF EXISTS "Technicians view own clients"  ON public.clients;
DROP POLICY IF EXISTS "Technicians insert own clients" ON public.clients;
DROP POLICY IF EXISTS "Technicians update own clients" ON public.clients;
DROP POLICY IF EXISTS "Technicians delete own clients" ON public.clients;

CREATE POLICY "Clients select same company"
ON public.clients FOR SELECT TO authenticated
USING (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Clients insert same company"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND auth.uid() = technician_id
);

CREATE POLICY "Clients update same company"
ON public.clients FOR UPDATE TO authenticated
USING (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Clients delete same company"
ON public.clients FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR auth.uid() = technician_id)
);

-- 10. Orders: rewrite to enforce company isolation in addition to existing logic
DROP POLICY IF EXISTS "Orders select role/branch/assigned" ON public.orders;
DROP POLICY IF EXISTS "Orders update role/branch/assigned" ON public.orders;
DROP POLICY IF EXISTS "Orders insert authenticated" ON public.orders;
DROP POLICY IF EXISTS "Orders delete admin or owner" ON public.orders;

CREATE POLICY "Orders select tenant scoped"
ON public.orders FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR auth.uid() = technician_id
    OR auth.uid() = assigned_technician_id
    OR (current_branch_id IS NOT NULL AND current_branch_id = public.get_user_branch(auth.uid()))
  )
);

CREATE POLICY "Orders insert tenant scoped"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND auth.uid() = technician_id
);

CREATE POLICY "Orders update tenant scoped"
ON public.orders FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR auth.uid() = technician_id
    OR auth.uid() = assigned_technician_id
    OR (current_branch_id IS NOT NULL AND current_branch_id = public.get_user_branch(auth.uid()))
  )
);

CREATE POLICY "Orders delete tenant scoped"
ON public.orders FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR auth.uid() = technician_id)
);

-- 11. user_roles: restrict admin actions to same-company users
DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;

CREATE POLICY "Roles insert company admin"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND public.get_user_company(user_id) = public.get_user_company(auth.uid())
);

CREATE POLICY "Roles update company admin"
ON public.user_roles FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.get_user_company(user_id) = public.get_user_company(auth.uid())
);

CREATE POLICY "Roles delete company admin"
ON public.user_roles FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.get_user_company(user_id) = public.get_user_company(auth.uid())
);

-- 12. Update handle_new_user: assign company from metadata or create new tenant
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  meta_company uuid;
  new_company uuid;
BEGIN
  meta_company := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid;

  IF meta_company IS NULL THEN
    -- Self-signup: create a new tenant for this user
    INSERT INTO public.companies (name)
    VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), 'Mi Empresa'))
    RETURNING id INTO new_company;
    meta_company := new_company;

    -- First user of a brand-new tenant becomes its admin
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.profiles (id, full_name, business_name, phone, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'business_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    meta_company
  );
  RETURN NEW;
END;
$$;
