CREATE OR REPLACE FUNCTION public.validate_order_amounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cargos_total numeric := 0;
  total_amount numeric := 0;
BEGIN
  IF NEW.quote_amount < 0 THEN
    RAISE EXCEPTION 'El presupuesto no puede ser negativo';
  END IF;
  IF NEW.deposit_amount < 0 THEN
    RAISE EXCEPTION 'La seña no puede ser negativa';
  END IF;

  SELECT COALESCE(SUM((elem->>'monto')::numeric), 0)
    INTO cargos_total
  FROM jsonb_array_elements(COALESCE(NEW.cargos_adicionales, '[]'::jsonb)) elem;

  total_amount := COALESCE(NEW.quote_amount, 0) + cargos_total;

  IF NEW.deposit_amount > total_amount THEN
    RAISE EXCEPTION 'La seña no puede superar al total (presupuesto + cargos adicionales)';
  END IF;

  RETURN NEW;
END;
$$;