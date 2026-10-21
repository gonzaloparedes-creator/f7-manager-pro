-- Vencimiento del plan: desde cuándo está pagado y hasta cuándo rige.
--
-- Hasta hoy el cobro se coordina por WhatsApp y la base no guarda ninguna
-- fecha: no hay forma de ver cuánto le queda a cada negocio. Estas tres
-- columnas guardan el período vigente (el último pago registrado):
--   billing_cycle   ciclo pagado: mensual / semestral / anual
--   plan_paid_from  primer día cubierto (la fecha "desde que pagó")
--   plan_expires_at último día cubierto (se calcula desde la fecha + ciclo,
--                   pero el super admin puede ajustarlo)
-- Son informativas: no activan ni desactivan funciones por sí solas (la
-- suspensión sigue siendo is_active, a mano).
--
-- Quién lee: la propia empresa y el super admin, por la política que ya
-- existe en companies ("Members view own company") — ninguna empresa ve las
-- fechas de otra. Quién escribe: solo el super admin; se suman al trigger
-- prevent_company_billing_self_update para que un admin de taller no pueda
-- extenderse el plan desde la consola del navegador.
--
-- Las empresas existentes quedan sin período (NULL): el super admin carga la
-- fecha real con "Pagado". No se inventan vencimientos.

ALTER TABLE public.companies
  ADD COLUMN billing_cycle text,
  ADD COLUMN plan_paid_from date,
  ADD COLUMN plan_expires_at date;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_billing_cycle_check
    CHECK (billing_cycle IS NULL OR billing_cycle IN ('mensual', 'semestral', 'anual')),
  ADD CONSTRAINT companies_plan_period_check
    CHECK (
      (billing_cycle IS NULL AND plan_paid_from IS NULL AND plan_expires_at IS NULL)
      OR (
        billing_cycle IS NOT NULL
        AND plan_paid_from IS NOT NULL
        AND plan_expires_at IS NOT NULL
        AND plan_expires_at >= plan_paid_from
      )
    );

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
      OR NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at)
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo un super admin puede modificar el plan, el estado, el vencimiento o los datos del programa de fundadores';
  END IF;
  RETURN NEW;
END;
$$;
