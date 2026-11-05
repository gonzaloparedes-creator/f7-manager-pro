-- Aviso de compras a Meta (API de conversiones) desde los links de alta pagada.
-- amount_gs: lo que pagó el cliente (puede no ser el precio de lista, por ejemplo un precio
-- de fundador); si queda vacío, la función usa el precio del plan.
-- meta_reported_at / meta_report_error: si ya se le avisó a Meta y, si falló, por qué.
-- Los links usados antes de esta migración quedan pendientes a propósito: los avisa la
-- función report-purchase en cuanto haya clave de Meta (Meta acepta hasta 7 días atrás).

ALTER TABLE public.signup_invites
  ADD COLUMN IF NOT EXISTS amount_gs integer CHECK (amount_gs IS NULL OR amount_gs >= 0),
  ADD COLUMN IF NOT EXISTS meta_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_report_error text;
