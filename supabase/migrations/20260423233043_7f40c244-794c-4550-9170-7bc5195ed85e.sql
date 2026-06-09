CREATE SEQUENCE IF NOT EXISTS public.orders_friendly_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'ORD-' || lpad(nextval('public.orders_friendly_seq')::text, 4, '0');
$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS imei text,
  ADD COLUMN IF NOT EXISTS problems text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS problem_other text,
  ADD COLUMN IF NOT EXISTS quote_amount bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_delivery_date date;

ALTER TABLE public.orders ALTER COLUMN problem_description DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN problem_description SET DEFAULT '';

CREATE OR REPLACE FUNCTION public.validate_order_amounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_amount < 0 THEN
    RAISE EXCEPTION 'El presupuesto no puede ser negativo';
  END IF;
  IF NEW.deposit_amount < 0 THEN
    RAISE EXCEPTION 'La seña no puede ser negativa';
  END IF;
  IF NEW.deposit_amount > NEW.quote_amount THEN
    RAISE EXCEPTION 'La seña no puede superar al presupuesto';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_amounts_trigger ON public.orders;
CREATE TRIGGER validate_order_amounts_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_amounts();

DROP FUNCTION IF EXISTS public.get_order_by_tracking(uuid);
CREATE OR REPLACE FUNCTION public.get_order_by_tracking(_token uuid)
RETURNS TABLE(
  id uuid,
  order_number text,
  device_type text,
  status text,
  technician_notes text,
  estimated_delivery_date date,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, order_number, device_type, status, technician_notes, estimated_delivery_date, created_at, updated_at
  FROM public.orders
  WHERE tracking_token = _token
  LIMIT 1;
$$;