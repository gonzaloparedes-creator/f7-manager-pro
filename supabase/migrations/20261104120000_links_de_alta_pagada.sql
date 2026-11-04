-- Links de alta pagada (garantía de 7 días): el cliente paga por WhatsApp, el super admin
-- crea un link de un solo uso (f7manager.com/empezar/CODIGO) con el plan y el período que
-- pagó, y al registrarse con ese link la empresa nace con el plan activo, sin prueba gratis.
--
-- Diseño:
--   * signup_invites: un link por cliente. Lo crea y lo ve solo el super admin (RLS).
--     El período (plan_paid_from / plan_expires_at) se calcula en el panel con la misma
--     función que "Registrar pago" (suggestedExpiry), así ambos caminos dan lo mismo.
--   * get_signup_invite(code): pública (anon), devuelve solo el plan, el ciclo y si el link
--     sirve todavía, para el código EXACTO. No expone notas ni empresas.
--   * handle_new_user: si el registro trae signup_invite y el link sirve (sin usar, sin
--     anular y con el período vigente), crea la empresa con ese plan, el período pagado e
--     is_paying = true, y marca el link como usado en la misma transacción (FOR UPDATE:
--     dos registros simultáneos con el mismo link no pueden usarlo los dos). Si el link no
--     sirve, el alta sigue igual que hoy (Starter con prueba gratis): nunca se rompe un
--     registro por un link viejo.
--   * Con plan_expires_at cargado, set_company_trial_end no pone prueba gratis.
--   * El resto de handle_new_user es idéntico a 20260905180000 (fundadores, ref, perfil).

-- ============================================================
-- 1. Tabla
-- ============================================================
CREATE TABLE IF NOT EXISTS public.signup_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
    CHECK (code ~ '^[A-Z0-9]{6,16}$'),
  plan_type text NOT NULL CHECK (plan_type IN ('starter', 'pro', 'business', 'retail')),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('mensual', 'semestral', 'anual')),
  plan_paid_from date NOT NULL,
  plan_expires_at date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  used_at timestamptz,
  used_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  CONSTRAINT signup_invites_period_check CHECK (plan_expires_at >= plan_paid_from)
);

ALTER TABLE public.signup_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage signup invites" ON public.signup_invites;
CREATE POLICY "Super admins manage signup invites"
  ON public.signup_invites
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

REVOKE ALL ON public.signup_invites FROM anon;

-- ============================================================
-- 2. Lectura pública de un link (solo plan, ciclo y si sirve)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_signup_invite(_code text)
RETURNS TABLE (plan_type text, billing_cycle text, plan_expires_at date, usable boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    i.plan_type,
    i.billing_cycle,
    i.plan_expires_at,
    (i.used_at IS NULL
      AND i.revoked_at IS NULL
      AND i.plan_expires_at >= (now() AT TIME ZONE 'America/Asuncion')::date) AS usable
  FROM public.signup_invites i
  WHERE i.code = upper(btrim(_code));
$$;

REVOKE ALL ON FUNCTION public.get_signup_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_signup_invite(text) TO anon, authenticated;

-- ============================================================
-- 3. Alta de cuentas: igual que 20260905180000 + el link de alta pagada
-- ============================================================
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
  invite_code text;
  inv public.signup_invites%ROWTYPE;
  has_invite boolean := false;
BEGIN
  meta_company := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid;

  IF meta_company IS NULL THEN
    -- Self-signup: create a new tenant for this user
    ref_slug := NULLIF(NEW.raw_user_meta_data->>'referral_slug', '');
    IF ref_slug IS NOT NULL THEN
      SELECT id INTO ref_partner_id FROM public.referral_partners WHERE slug = ref_slug;
    END IF;

    -- Link de alta pagada: solo si sirve todavía; si no, alta normal.
    invite_code := upper(NULLIF(btrim(NEW.raw_user_meta_data->>'signup_invite'), ''));
    IF invite_code IS NOT NULL THEN
      SELECT * INTO inv
      FROM public.signup_invites i
      WHERE i.code = invite_code
        AND i.used_at IS NULL
        AND i.revoked_at IS NULL
        AND i.plan_expires_at >= (now() AT TIME ZONE 'America/Asuncion')::date
      FOR UPDATE;
      has_invite := FOUND;
    END IF;

    auto_founder := COALESCE(ref_slug = 'celutecnicos', false) AND NOT has_invite;
    auto_plan := CASE
      WHEN has_invite THEN inv.plan_type
      WHEN auto_founder THEN 'business'
      ELSE 'starter'
    END;

    INSERT INTO public.companies (
      name, referral_partner_id, has_own_shop, weekly_repairs_estimate, previous_system,
      country, department, city, plan_type, founder_cohort, founder_cohort_at,
      billing_cycle, plan_paid_from, plan_expires_at, is_paying
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
      CASE WHEN auto_founder THEN now() ELSE NULL END,
      CASE WHEN has_invite THEN inv.billing_cycle ELSE NULL END,
      CASE WHEN has_invite THEN inv.plan_paid_from ELSE NULL END,
      CASE WHEN has_invite THEN inv.plan_expires_at ELSE NULL END,
      has_invite
    )
    RETURNING id INTO new_company;
    meta_company := new_company;

    IF has_invite THEN
      UPDATE public.signup_invites
      SET used_at = now(), used_company_id = new_company
      WHERE id = inv.id;
    END IF;

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
