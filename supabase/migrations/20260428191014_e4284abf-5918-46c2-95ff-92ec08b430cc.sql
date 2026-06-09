-- Capture the original seña (deposit) amount so reports can compute saldo income correctly
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS senia_amount bigint NOT NULL DEFAULT 0;

-- Backfill: for orders that already have a deposit_date, assume the current deposit_amount
-- was the original seña UNLESS the order is fully paid (then we cannot know — leave as deposit_amount, which is the best historical proxy we have).
UPDATE public.orders
SET senia_amount = deposit_amount
WHERE senia_amount = 0
  AND deposit_amount > 0
  AND deposit_date IS NOT NULL
  AND final_payment_date IS NULL;

-- For fully paid orders, assume the seña was the deposit at deposit_date — use deposit_amount as fallback proxy
UPDATE public.orders
SET senia_amount = deposit_amount
WHERE senia_amount = 0
  AND deposit_amount > 0
  AND deposit_date IS NOT NULL
  AND final_payment_date IS NOT NULL;

-- Update payment-date trigger to also lock senia_amount the first time a deposit is recorded,
-- and to keep it stable when "Cobrar Saldo" later raises deposit_amount to the full total.
CREATE OR REPLACE FUNCTION public.maintain_order_payment_dates()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  cargos_total numeric := 0;
  total_amount numeric := 0;
BEGIN
  -- First deposit timestamp + lock the original seña amount
  IF COALESCE(OLD.deposit_amount, 0) = 0
     AND COALESCE(NEW.deposit_amount, 0) > 0 THEN
    IF NEW.deposit_date IS NULL THEN
      NEW.deposit_date := now();
    END IF;
    IF COALESCE(NEW.senia_amount, 0) = 0 THEN
      NEW.senia_amount := NEW.deposit_amount;
    END IF;
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
    NEW.final_payment_date := NULL;
  END IF;

  RETURN NEW;
END;
$function$;
