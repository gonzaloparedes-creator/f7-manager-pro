-- Alianza con Kike: trae la comunidad de 700 técnicos a cambio de un 20%
-- de lo que entre a través de su link. Esto agrega la atribución
-- (qué empresa vino por qué aliado) y las 3 preguntas de calificación del
-- Programa Fundadores, capturadas en el mismo paso del registro.
--
-- El comisionamiento exacto en guaraníes/dólares no se calcula acá — el
-- sistema no trackea montos realmente cobrados (no hay pasarela de pago
-- todavía, ver product_sales/upgrade.ts). Esto da la atribución y el
-- estado de pago (companies.is_paying, ya existente); la cuenta final la
-- hace Gonzalo contra lo que efectivamente cobró.

CREATE TABLE public.referral_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  commission_rate numeric NOT NULL DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;

-- Lectura pública: Register.tsx necesita resolver el slug del link
-- (?ref=kike) ANTES de que la persona tenga sesión.
CREATE POLICY "Referral partners public read" ON public.referral_partners
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Referral partners admin write insert" ON public.referral_partners
FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Referral partners admin write update" ON public.referral_partners
FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Referral partners admin write delete" ON public.referral_partners
FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- Sin esto, RLS ni se evalúa (ya nos pasó dos veces este mismo mes con
-- otras tablas nuevas — permission denied a nivel de tabla).
GRANT SELECT ON public.referral_partners TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_partners TO service_role;

INSERT INTO public.referral_partners (name, slug, commission_rate) VALUES ('Kike', 'kike', 20);

ALTER TABLE public.companies
  ADD COLUMN referral_partner_id uuid REFERENCES public.referral_partners(id) ON DELETE SET NULL,
  ADD COLUMN has_own_shop boolean,
  ADD COLUMN weekly_repairs_estimate text,
  ADD COLUMN previous_system text;

-- Mismo criterio que plan_type/is_active/founder_cohort/is_paying: quién
-- refirió a una empresa mueve dinero real (la comisión de Kike), así que
-- una empresa no puede reasignarse su propio aliado desde el navegador.
CREATE OR REPLACE FUNCTION public.prevent_company_billing_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.plan_type IS DISTINCT FROM OLD.plan_type
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
      OR NEW.founder_cohort IS DISTINCT FROM OLD.founder_cohort
      OR NEW.founder_cohort_at IS DISTINCT FROM OLD.founder_cohort_at
      OR NEW.is_paying IS DISTINCT FROM OLD.is_paying
      OR NEW.referral_partner_id IS DISTINCT FROM OLD.referral_partner_id)
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo un super admin puede modificar el plan, el estado o los datos del programa de fundadores';
  END IF;
  RETURN NEW;
END;
$$;

-- handle_new_user: además de crear la empresa nueva en el auto-registro,
-- resuelve el aliado por slug (si vino ?ref=kike) y guarda las 3
-- respuestas de calificación, todo en el mismo INSERT.
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

    INSERT INTO public.companies (name, referral_partner_id, has_own_shop, weekly_repairs_estimate, previous_system)
    VALUES (
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), 'Mi Empresa'),
      ref_partner_id,
      NULLIF(NEW.raw_user_meta_data->>'has_own_shop', '')::boolean,
      NULLIF(NEW.raw_user_meta_data->>'weekly_repairs_estimate', ''),
      NULLIF(NEW.raw_user_meta_data->>'previous_system', '')
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
