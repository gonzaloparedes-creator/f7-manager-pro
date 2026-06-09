CREATE OR REPLACE FUNCTION public.prevent_super_admin_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    IF NOT public.is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only super admins can modify is_super_admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_super_admin_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_super_admin_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_super_admin_self_escalation();

DROP POLICY IF EXISTS "Order history no update" ON public.order_status_history;
DROP POLICY IF EXISTS "Order history no delete" ON public.order_status_history;
CREATE POLICY "Order history no update"
  ON public.order_status_history AS RESTRICTIVE FOR UPDATE
  TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Order history no delete"
  ON public.order_status_history AS RESTRICTIVE FOR DELETE
  TO authenticated, anon USING (false);

DROP POLICY IF EXISTS "Inventory images authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Inventory images authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Inventory images authenticated delete" ON storage.objects;

CREATE POLICY "Inventory images company upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inventory-images'
    AND (storage.foldername(name))[1] = (public.get_user_company(auth.uid()))::text
  );

CREATE POLICY "Inventory images company update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'inventory-images'
    AND (storage.foldername(name))[1] = (public.get_user_company(auth.uid()))::text
  )
  WITH CHECK (
    bucket_id = 'inventory-images'
    AND (storage.foldername(name))[1] = (public.get_user_company(auth.uid()))::text
  );

CREATE POLICY "Inventory images company delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'inventory-images'
    AND (storage.foldername(name))[1] = (public.get_user_company(auth.uid()))::text
  );

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_user_branch(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_user_company(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_company_active(uuid) FROM anon, authenticated, public;