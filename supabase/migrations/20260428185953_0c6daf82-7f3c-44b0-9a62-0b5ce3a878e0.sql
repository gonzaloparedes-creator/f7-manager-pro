-- Add payment date columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deposit_date timestamptz,
  ADD COLUMN IF NOT EXISTS final_payment_date timestamptz;

-- Backfill deposit_date for existing orders that have a deposit
UPDATE public.orders
SET deposit_date = created_at
WHERE deposit_amount > 0 AND deposit_date IS NULL;

-- Backfill final_payment_date for delivered & fully paid orders
UPDATE public.orders o
SET final_payment_date = updated_at
WHERE final_payment_date IS NULL
  AND status = 'entregado'
  AND quote_amount > 0
  AND deposit_amount >= (
    quote_amount + COALESCE((
      SELECT SUM((elem->>'monto')::numeric)
      FROM jsonb_array_elements(o.cargos_adicionales) elem
    ), 0)
  );

-- Trigger function to maintain payment dates automatically
CREATE OR REPLACE FUNCTION public.maintain_order_payment_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cargos_total numeric := 0;
  total_amount numeric := 0;
BEGIN
  -- First deposit timestamp
  IF COALESCE(OLD.deposit_amount, 0) = 0
     AND COALESCE(NEW.deposit_amount, 0) > 0
     AND NEW.deposit_date IS NULL THEN
    NEW.deposit_date := now();
  END IF;

  -- Compute total including additional charges
  SELECT COALESCE(SUM((elem->>'monto')::numeric), 0)
    INTO cargos_total
  FROM jsonb_array_elements(COALESCE(NEW.cargos_adicionales, '[]'::jsonb)) elem;

  total_amount := COALESCE(NEW.quote_amount, 0) + cargos_total;

  IF total_amount > 0 AND COALESCE(NEW.deposit_amount, 0) >= total_amount THEN
    IF NEW.final_payment_date IS NULL THEN
      NEW.final_payment_date := now();
    END IF;
  ELSE
    -- Saldo went back above 0 (e.g. new charge added) — clear final payment date
    NEW.final_payment_date := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintain_order_payment_dates ON public.orders;
CREATE TRIGGER trg_maintain_order_payment_dates
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.maintain_order_payment_dates();