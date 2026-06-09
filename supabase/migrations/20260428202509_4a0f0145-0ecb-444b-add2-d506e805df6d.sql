
-- 1. Branches
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_branches_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 3. Profiles: branch
ALTER TABLE public.profiles
  ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 4. Now safe to define get_user_branch (depends on profiles.branch_id)
CREATE OR REPLACE FUNCTION public.get_user_branch(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.profiles WHERE id = _user_id
$$;

-- 5. Orders: branch + assignment fields
ALTER TABLE public.orders
  ADD COLUMN received_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN current_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN assigned_technician_id uuid;

-- 6. RLS: branches
CREATE POLICY "Authenticated can view branches" ON public.branches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert branches" ON public.branches
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update branches" ON public.branches
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete branches" ON public.branches
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. RLS: user_roles
CREATE POLICY "Users view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8. Profiles admin policies
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 9. Orders RLS rewritten
DROP POLICY IF EXISTS "Technicians view own orders" ON public.orders;
DROP POLICY IF EXISTS "Technicians update own orders" ON public.orders;
DROP POLICY IF EXISTS "Technicians delete own orders" ON public.orders;
DROP POLICY IF EXISTS "Technicians insert own orders" ON public.orders;

CREATE POLICY "Orders select role/branch/assigned" ON public.orders
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR auth.uid() = technician_id
    OR auth.uid() = assigned_technician_id
    OR (current_branch_id IS NOT NULL AND current_branch_id = public.get_user_branch(auth.uid()))
  );
CREATE POLICY "Orders insert authenticated" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = technician_id);
CREATE POLICY "Orders update role/branch/assigned" ON public.orders
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR auth.uid() = technician_id
    OR auth.uid() = assigned_technician_id
    OR (current_branch_id IS NOT NULL AND current_branch_id = public.get_user_branch(auth.uid()))
  );
CREATE POLICY "Orders delete admin or owner" ON public.orders
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR auth.uid() = technician_id
  );

-- 10. Seed default branch + assign existing data + promote existing users to admin
DO $$
DECLARE v_branch_id uuid;
BEGIN
  INSERT INTO public.branches (name, address)
  VALUES ('Sucursal Principal', NULL)
  RETURNING id INTO v_branch_id;

  UPDATE public.profiles SET branch_id = v_branch_id WHERE branch_id IS NULL;

  UPDATE public.orders SET
    received_branch_id = COALESCE(received_branch_id, v_branch_id),
    current_branch_id  = COALESCE(current_branch_id,  v_branch_id),
    assigned_technician_id = COALESCE(assigned_technician_id, technician_id);

  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin'::public.app_role FROM public.profiles
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
