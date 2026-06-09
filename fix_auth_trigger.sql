-- Ensure the trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles for any user that was created without the trigger
DO $$
DECLARE
    u auth.users%rowtype;
    meta_company uuid;
    new_company uuid;
BEGIN
    FOR u IN SELECT * FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles) LOOP
        meta_company := NULLIF(u.raw_user_meta_data->>'company_id', '')::uuid;

        IF meta_company IS NULL THEN
            INSERT INTO public.companies (name)
            VALUES (COALESCE(NULLIF(u.raw_user_meta_data->>'business_name', ''), 'Mi Empresa'))
            RETURNING id INTO new_company;
            meta_company := new_company;

            INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'admin')
            ON CONFLICT DO NOTHING;
        END IF;

        INSERT INTO public.profiles (id, full_name, business_name, phone, company_id)
        VALUES (
            u.id,
            COALESCE(u.raw_user_meta_data->>'full_name', ''),
            COALESCE(u.raw_user_meta_data->>'business_name', ''),
            COALESCE(u.raw_user_meta_data->>'phone', ''),
            meta_company
        );
    END LOOP;
END
$$;
