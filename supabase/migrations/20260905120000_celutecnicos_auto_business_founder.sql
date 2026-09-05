-- Celu Técnicos VIP (reto 45 días): quien se registre por
-- /register?ref=celutecnicos debe quedar directo con plan Business y ya
-- marcado como Fundador, sin que alguien tenga que entrar al Panel de
-- Fundadores a tildarlo a mano uno por uno durante el lanzamiento. El resto
-- de los registros (Kike, sin aliado, etc.) siguen exactamente igual que
-- antes — 'starter' por defecto y founder_cohort en false hasta que un
-- super admin lo marque.

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

    auto_founder := (ref_slug = 'celutecnicos');
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

-- Backfill: por si alguien ya se registró por ese link mientras el reto
-- estaba en marcha, antes de este fix. companies_prevent_billing_self_update
-- bloquea este UPDATE fuera de una sesión de super admin (acá corre como
-- rol de migración, sin auth.uid()), así que se desactiva solo para esta
-- sentencia puntual.
ALTER TABLE public.companies DISABLE TRIGGER companies_prevent_billing_self_update;

UPDATE public.companies
SET
  plan_type = 'business',
  founder_cohort = true,
  founder_cohort_at = COALESCE(founder_cohort_at, now())
WHERE referral_partner_id = (SELECT id FROM public.referral_partners WHERE slug = 'celutecnicos')
  AND (plan_type <> 'business' OR NOT founder_cohort);

ALTER TABLE public.companies ENABLE TRIGGER companies_prevent_billing_self_update;
