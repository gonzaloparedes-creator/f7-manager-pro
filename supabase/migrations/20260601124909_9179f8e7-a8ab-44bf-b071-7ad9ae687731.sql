
-- 1. Mark existing user as super admin
UPDATE public.profiles p
SET is_super_admin = true
FROM auth.users u
WHERE u.id = p.id AND lower(u.email) = 'ojvenialgo1@gmail.com';

-- 2. Trigger to auto-promote that email on signup
CREATE OR REPLACE FUNCTION public.auto_promote_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'ojvenialgo1@gmail.com' THEN
    UPDATE public.profiles SET is_super_admin = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_promote_super_admin_trigger ON auth.users;
CREATE TRIGGER auto_promote_super_admin_trigger
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_super_admin();

-- 3. RLS: allow super admins to SELECT all order_parts globally
DROP POLICY IF EXISTS "Order parts select super admin" ON public.order_parts;
CREATE POLICY "Order parts select super admin"
ON public.order_parts
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));
