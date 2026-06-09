
-- 1. Add warranty columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS warranty_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone;

-- 2. Backfill delivered_at for existing entregado orders (best estimate: updated_at)
UPDATE public.orders
   SET delivered_at = updated_at
 WHERE status = 'entregado' AND delivered_at IS NULL;

-- 3. Trigger to auto-set delivered_at when transitioning to 'entregado' (preserve original on transitions away)
CREATE OR REPLACE FUNCTION public.maintain_delivered_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'entregado' AND (OLD.status IS DISTINCT FROM 'entregado') AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  -- Do NOT clear delivered_at when leaving 'entregado'; preserve warranty start
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_maintain_delivered_at ON public.orders;
CREATE TRIGGER trg_orders_maintain_delivered_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.maintain_delivered_at();

-- Also set on insert if status starts as entregado (rare)
CREATE OR REPLACE FUNCTION public.maintain_delivered_at_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'entregado' AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_maintain_delivered_at_insert ON public.orders;
CREATE TRIGGER trg_orders_maintain_delivered_at_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.maintain_delivered_at_insert();
