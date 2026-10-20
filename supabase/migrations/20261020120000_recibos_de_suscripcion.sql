-- Recibos de suscripción: comprobantes que el dueño de la plataforma (super
-- admin) emite cuando una empresa le paga un plan de F7 Manager Pro.
--
-- Hasta ahora no había rastro de los cobros de F7 (no hay pasarela de pago;
-- companies.is_paying es solo una marca). Esta tabla guarda cada recibo con
-- una foto de los datos al momento de emitirlo: quién pagó, qué plan y ciclo,
-- desde cuándo rige, cuánto y cómo se pagó. Así el recibo se puede volver a
-- imprimir idéntico aunque después cambie el nombre o el plan de la empresa.
--
-- Reglas (todas por trigger, no solo por la pantalla):
--  * Solo el super admin lee o escribe. Ninguna empresa ve estos datos.
--  * El número (F7-0001, F7-0002…) lo asigna la base, correlativo y único.
--  * Un recibo no se edita ni se borra: solo se anula (queda el rastro y el
--    número no se reutiliza).
--  * No se emiten recibos con fecha de pago futura.

CREATE SEQUENCE public.subscription_receipt_seq START 1;

CREATE TABLE public.subscription_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_number text NOT NULL UNIQUE,
  -- Empresa de F7 que pagó. Opcional: se puede emitir a alguien que todavía
  -- no tiene cuenta. SET NULL para no perder el recibo si la empresa se borra.
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  customer_name text NOT NULL CHECK (char_length(btrim(customer_name)) BETWEEN 1 AND 150),
  customer_document text CHECK (customer_document IS NULL OR char_length(customer_document) <= 40),
  customer_email text CHECK (customer_email IS NULL OR char_length(customer_email) <= 150),
  customer_phone text CHECK (customer_phone IS NULL OR char_length(customer_phone) <= 40),
  plan_type text NOT NULL CHECK (plan_type IN ('starter', 'pro', 'business', 'retail')),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('mensual', 'semestral', 'anual')),
  -- Fecha en que se adquirió el plan (inicio del período) y hasta cuándo rige.
  period_start date NOT NULL,
  period_end date NOT NULL,
  payment_date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency IN ('PYG', 'USD')),
  payment_method text NOT NULL CHECK (char_length(btrim(payment_method)) BETWEEN 1 AND 80),
  payment_reference text CHECK (payment_reference IS NULL OR char_length(payment_reference) <= 120),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 500),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  -- Quién emite, tal como sale impreso (el nombre y los datos legales de F7).
  issuer_name text NOT NULL CHECK (char_length(btrim(issuer_name)) BETWEEN 1 AND 150),
  issuer_details text CHECK (issuer_details IS NULL OR char_length(issuer_details) <= 500),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  voided_at timestamp with time zone,
  voided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  void_reason text CHECK (void_reason IS NULL OR char_length(void_reason) <= 300),
  CONSTRAINT subscription_receipts_period_check CHECK (period_end >= period_start)
);

CREATE INDEX idx_subscription_receipts_company ON public.subscription_receipts (company_id, created_at DESC);
CREATE INDEX idx_subscription_receipts_created ON public.subscription_receipts (created_at DESC);

ALTER TABLE public.subscription_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY "Subscription receipts select super admin" ON public.subscription_receipts
FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Subscription receipts insert super admin" ON public.subscription_receipts
FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

-- Sin política de DELETE: no se borra. UPDATE solo existe para anular
-- (el trigger de abajo rechaza cualquier otro cambio).
CREATE POLICY "Subscription receipts void super admin" ON public.subscription_receipts
FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

REVOKE ALL ON public.subscription_receipts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.subscription_receipts TO authenticated;
GRANT ALL ON public.subscription_receipts TO service_role;
REVOKE ALL ON SEQUENCE public.subscription_receipt_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.subscription_receipts_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Asuncion')::date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_date > v_today THEN
      RAISE EXCEPTION 'La fecha de pago no puede ser futura';
    END IF;
    NEW.receipt_number := 'F7-' || lpad(nextval('public.subscription_receipt_seq')::text, 4, '0');
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.voided_at := NULL;
    NEW.voided_by := NULL;
    NEW.void_reason := NULL;
    RETURN NEW;
  END IF;

  -- Sin sesión de usuario (service role, migraciones, borrado de perfiles): no se interviene.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- UPDATE: lo único que cambia es la anulación (y que un perfil o empresa borrados queden en NULL).
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.receipt_number IS DISTINCT FROM OLD.receipt_number
     OR (NEW.company_id IS DISTINCT FROM OLD.company_id AND NEW.company_id IS NOT NULL)
     OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
     OR NEW.customer_document IS DISTINCT FROM OLD.customer_document
     OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
     OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
     OR NEW.plan_type IS DISTINCT FROM OLD.plan_type
     OR NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle
     OR NEW.period_start IS DISTINCT FROM OLD.period_start
     OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.payment_date IS DISTINCT FROM OLD.payment_date
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.issuer_name IS DISTINCT FROM OLD.issuer_name
     OR NEW.issuer_details IS DISTINCT FROM OLD.issuer_details
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (NEW.created_by IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Un recibo no se puede editar: solo se puede anular';
  END IF;

  IF OLD.voided_at IS NOT NULL THEN
    IF NEW.voided_at IS DISTINCT FROM OLD.voided_at
       OR NEW.void_reason IS DISTINCT FROM OLD.void_reason
       OR (NEW.voided_by IS DISTINCT FROM OLD.voided_by AND NEW.voided_by IS NOT NULL) THEN
      RAISE EXCEPTION 'Este recibo ya estaba anulado';
    END IF;
  ELSIF NEW.voided_at IS NOT NULL THEN
    NEW.voided_at := now();
    NEW.voided_by := auth.uid();
  ELSE
    NEW.voided_by := NULL;
    NEW.void_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.subscription_receipts_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER subscription_receipts_guard
BEFORE INSERT OR UPDATE ON public.subscription_receipts
FOR EACH ROW EXECUTE FUNCTION public.subscription_receipts_guard();
