-- Ubicación del taller: país (detectado por IP en el registro, siempre
-- editable) y, solo para Paraguay, departamento + ciudad. Sirve para dos
-- cosas: (1) segmentar métricas del Panel de Fundadores/MasterAdmin por
-- zona, (2) tener un dato real ("tantas reparaciones gestionadas en el
-- departamento Central") para usar en marketing más adelante.
--
-- No es un dato de billing (no mueve comisiones ni planes), así que NO se
-- agrega a prevent_company_billing_self_update() — el propio admin del
-- taller puede corregirlo libremente si la detección automática falló.

ALTER TABLE public.companies
  ADD COLUMN country text NOT NULL DEFAULT 'PY',
  ADD COLUMN department text,
  ADD COLUMN city text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  meta_company uuid;
  new_company uuid;
  ref_slug text;
  ref_partner_id uuid;
BEGIN
  meta_company := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid;

  IF meta_company IS NULL THEN
    -- Self-signup: create a new tenant for this user
    ref_slug := NULLIF(NEW.raw_user_meta_data->>'referral_slug', '');
    IF ref_slug IS NOT NULL THEN
      SELECT id INTO ref_partner_id FROM public.referral_partners WHERE slug = ref_slug;
    END IF;

    INSERT INTO public.companies (
      name, referral_partner_id, has_own_shop, weekly_repairs_estimate, previous_system,
      country, department, city
    )
    VALUES (
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), 'Mi Empresa'),
      ref_partner_id,
      NULLIF(NEW.raw_user_meta_data->>'has_own_shop', '')::boolean,
      NULLIF(NEW.raw_user_meta_data->>'weekly_repairs_estimate', ''),
      NULLIF(NEW.raw_user_meta_data->>'previous_system', ''),
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'country', ''), 'PY'),
      NULLIF(NEW.raw_user_meta_data->>'department', ''),
      NULLIF(NEW.raw_user_meta_data->>'city', '')
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
