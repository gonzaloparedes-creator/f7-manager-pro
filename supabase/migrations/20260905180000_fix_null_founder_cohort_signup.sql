-- HOTFIX: la migración anterior (celutecnicos_auto_business_founder) rompió
-- el registro para CUALQUIER usuario que no viniera del link de Celu
-- Técnicos VIP (incluido el registro sin ningún ?ref=, el caso más común).
--
-- Causa: `auto_founder := (ref_slug = 'celutecnicos');` — cuando ref_slug es
-- NULL (no vino ningún referral_slug en los metadatos, que es el caso de
-- CUALQUIER registro sin ?ref=), la comparación `NULL = 'celutecnicos'` da
-- NULL en SQL, no false. Ese NULL se insertaba directo en
-- companies.founder_cohort, que es NOT NULL → Postgres rechazaba el INSERT
-- completo → Supabase Auth lo reportaba como "Database error saving new
-- user" y no se creaba ni el usuario ni la empresa.
--
-- Fix: envolver la comparación en COALESCE para que siempre sea un booleano
-- real. Confirmado con una consulta directa que TODOS los registros exitosos
-- desde que se aplicó el bug (hace ~2.5 horas) fueron por celutecnicos —
-- cualquier otro intento de registro en esa ventana falló.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  meta_company uuid;
  new_company uuid;
  ref_slug text;
  ref_partner_id uuid;
  auto_plan text;
  auto_founder boolean;
BEGIN
  meta_company := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid;

  IF meta_company IS NULL THEN
    -- Self-signup: create a new tenant for this user
    ref_slug := NULLIF(NEW.raw_user_meta_data->>'referral_slug', '');
    IF ref_slug IS NOT NULL THEN
      SELECT id INTO ref_partner_id FROM public.referral_partners WHERE slug = ref_slug;
    END IF;

    auto_founder := COALESCE(ref_slug = 'celutecnicos', false);
    auto_plan := CASE WHEN auto_founder THEN 'business' ELSE 'starter' END;

    INSERT INTO public.companies (
      name, referral_partner_id, has_own_shop, weekly_repairs_estimate, previous_system,
      country, department, city, plan_type, founder_cohort, founder_cohort_at
    )
    VALUES (
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), 'Mi Empresa'),
      ref_partner_id,
      NULLIF(NEW.raw_user_meta_data->>'has_own_shop', '')::boolean,
      NULLIF(NEW.raw_user_meta_data->>'weekly_repairs_estimate', ''),
      NULLIF(NEW.raw_user_meta_data->>'previous_system', ''),
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'country', ''), 'PY'),
      NULLIF(NEW.raw_user_meta_data->>'department', ''),
      NULLIF(NEW.raw_user_meta_data->>'city', ''),
      auto_plan,
      auto_founder,
      CASE WHEN auto_founder THEN now() ELSE NULL END
    )
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
