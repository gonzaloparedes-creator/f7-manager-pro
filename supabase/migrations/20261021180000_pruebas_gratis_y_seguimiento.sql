-- Pruebas gratis que se suspenden solas + seguimiento de clientes (Super Admin).
--
-- Diseño (misma idea que la suspensión por vencimiento, 20261021150000):
--   * companies.trial_ends_at = último día de la prueba gratis (inclusive).
--   * El bloqueo se CALCULA, no hay ningún job:
--       fin efectivo = plan_expires_at (si hay un pago cargado) si no, trial_ends_at
--       acceso hasta = fin efectivo + días de gracia
--       bloqueada    = NOT is_active  OR  hoy (Asunción) > acceso hasta
--     Un pago cargado manda sobre la prueba: al pagar, la prueba deja de contar.
--   * Sin ninguna de las dos fechas (NULL) la empresa nunca se bloquea por tiempo:
--     las empresas que ya existen quedan EXACTAMENTE igual que hoy.
--   * Solo las empresas NUEVAS reciben la prueba (por trigger al insertar).
--     Las del programa de fundadores no: tienen su propio desafío de 45 días.
--   * Solo el super admin puede escribir trial_ends_at (trigger de facturación).
--
-- Seguimiento: company_contact_log registra a quién se le escribió y qué tipo de
-- mensaje (cobro / prueba); solo el super admin la ve y solo se agrega.

-- ============================================================
-- 1. Duración de la prueba (un único lugar para cambiarla)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trial_default_days()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT 14;
$$;

-- ============================================================
-- 2. Columna (sin DEFAULT: las empresas existentes quedan en NULL)
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS trial_ends_at date;

-- ============================================================
-- 3. Empresas nuevas: prueba de trial_default_days() días (hoy cuenta como día 1)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_company_trial_end()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.trial_ends_at IS NULL
     AND NEW.plan_expires_at IS NULL
     AND NOT COALESCE(NEW.founder_cohort, false)
     AND NOT COALESCE(NEW.is_paying, false) THEN
    NEW.trial_ends_at := (now() AT TIME ZONE 'America/Asuncion')::date + (public.trial_default_days() - 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_company_trial_end ON public.companies;
CREATE TRIGGER set_company_trial_end
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_company_trial_end();

-- ============================================================
-- 4. Solo el super admin puede tocar la fecha de la prueba
-- ============================================================
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
      OR NEW.referral_partner_id IS DISTINCT FROM OLD.referral_partner_id
      OR NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle
      OR NEW.plan_paid_from IS DISTINCT FROM OLD.plan_paid_from
      OR NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at
      OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at)
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo un super admin puede modificar el plan, el estado, el vencimiento, la prueba gratis o los datos del programa de fundadores';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. is_company_active: activa Y dentro del plazo (pago o, si no hay, prueba)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_company_active(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT c.is_active
             AND NOT public.plan_is_lapsed(
               COALESCE(c.plan_expires_at, c.trial_ends_at),
               (now() AT TIME ZONE 'America/Asuncion')::date,
               public.plan_grace_days()
             )
      FROM public.companies c
      WHERE c.id = _company_id
    ),
    true
  );
$$;

-- ============================================================
-- 6. Estado de acceso de MI empresa (la empresa sale del usuario autenticado)
--    kind: 'paid' (hay pago cargado) | 'trial' (solo prueba) | 'none' (sin fechas)
--    access_until / lapsed / blocked ya consideran la prueba.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_my_company_access();

CREATE FUNCTION public.get_my_company_access()
RETURNS TABLE (
  is_active boolean,
  billing_cycle text,
  plan_paid_from date,
  plan_expires_at date,
  grace_days integer,
  access_until date,
  today date,
  lapsed boolean,
  blocked boolean,
  kind text,
  trial_ends_at date,
  company_created_at date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.is_active,
    c.billing_cycle,
    c.plan_paid_from,
    c.plan_expires_at,
    public.plan_grace_days(),
    COALESCE(c.plan_expires_at, c.trial_ends_at) + public.plan_grace_days(),
    (now() AT TIME ZONE 'America/Asuncion')::date,
    public.plan_is_lapsed(COALESCE(c.plan_expires_at, c.trial_ends_at), (now() AT TIME ZONE 'America/Asuncion')::date, public.plan_grace_days()),
    NOT c.is_active
      OR public.plan_is_lapsed(COALESCE(c.plan_expires_at, c.trial_ends_at), (now() AT TIME ZONE 'America/Asuncion')::date, public.plan_grace_days()),
    CASE
      WHEN c.plan_expires_at IS NOT NULL THEN 'paid'
      WHEN c.trial_ends_at IS NOT NULL THEN 'trial'
      ELSE 'none'
    END,
    c.trial_ends_at,
    (c.created_at AT TIME ZONE 'America/Asuncion')::date
  FROM public.companies c
  WHERE c.id = public.get_user_company(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.trial_default_days() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_company_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trial_default_days() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_company_access() TO authenticated;

-- ============================================================
-- 7. Bitácora de contactos (solo super admin, solo se agrega)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_contact_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cobro', 'prueba', 'otro')),
  message text CHECK (message IS NULL OR char_length(message) <= 2000),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_contact_log_company
  ON public.company_contact_log (company_id, created_at DESC);

ALTER TABLE public.company_contact_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contact log select super admin" ON public.company_contact_log;
CREATE POLICY "Contact log select super admin" ON public.company_contact_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Contact log insert super admin" ON public.company_contact_log;
CREATE POLICY "Contact log insert super admin" ON public.company_contact_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

REVOKE ALL ON public.company_contact_log FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.company_contact_log TO authenticated;

-- ============================================================
-- 8. Resumen para "Para contactar": una fila por empresa con quién administra,
--    su teléfono, cuánto usó el sistema y cuándo se le escribió por última vez.
--    SECURITY DEFINER pero exige ser super admin: un cliente común recibe error.
-- ============================================================
CREATE OR REPLACE FUNCTION public.superadmin_followup_overview()
RETURNS TABLE (
  company_id uuid,
  admin_name text,
  admin_phone text,
  orders_count bigint,
  last_order_at timestamptz,
  last_contact_at timestamptz,
  last_contact_kind text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo un super admin puede ver el seguimiento de clientes';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    adm.full_name,
    adm.phone,
    COALESCE(o.cnt, 0),
    o.last_at,
    lc.created_at,
    lc.kind
  FROM public.companies c
  LEFT JOIN LATERAL (
    SELECT p.full_name, p.phone
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'
    WHERE p.company_id = c.id
    ORDER BY p.created_at ASC
    LIMIT 1
  ) adm ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt, max(od.created_at) AS last_at
    FROM public.orders od
    WHERE od.company_id = c.id
  ) o ON true
  LEFT JOIN LATERAL (
    SELECT l.created_at, l.kind
    FROM public.company_contact_log l
    WHERE l.company_id = c.id
    ORDER BY l.created_at DESC
    LIMIT 1
  ) lc ON true;
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_followup_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.superadmin_followup_overview() TO authenticated;
