-- Recibos de suscripción: descuento sobre el precio.
--
-- Hasta ahora el recibo solo guardaba el monto cobrado. Ahora guarda también
-- el precio antes del descuento (subtotal), cuánto se descontó y el motivo,
-- para que el recibo muestre "Precio − Descuento = Total" y quede el rastro de
-- por qué se cobró menos que la lista.
--
-- `amount` sigue siendo lo que realmente se recibió (el total), así que todo
-- lo que ya lo lee (historial, búsquedas) sigue igual. La base exige que
-- amount = subtotal − descuento: la cuenta no se puede romper desde afuera.

ALTER TABLE public.subscription_receipts
  ADD COLUMN subtotal numeric,
  ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN discount_note text;

-- Los recibos que ya existían no tenían descuento: el subtotal es lo que se cobró.
UPDATE public.subscription_receipts SET subtotal = amount WHERE subtotal IS NULL;

ALTER TABLE public.subscription_receipts
  ALTER COLUMN subtotal SET NOT NULL,
  ADD CONSTRAINT subscription_receipts_discount_check
    CHECK (subtotal > 0 AND discount_amount >= 0 AND amount = subtotal - discount_amount),
  ADD CONSTRAINT subscription_receipts_discount_note_check
    CHECK (discount_note IS NULL OR (discount_amount > 0 AND char_length(btrim(discount_note)) BETWEEN 1 AND 150));

-- Mismo guardián de antes (número correlativo, sin fecha futura, solo anular),
-- con los tres campos nuevos protegidos contra edición. Al insertar, si no
-- viene el subtotal se toma como monto + descuento (sin descuento = el monto).
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
    NEW.subtotal := COALESCE(NEW.subtotal, NEW.amount + NEW.discount_amount);
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
     OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.discount_note IS DISTINCT FROM OLD.discount_note
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
