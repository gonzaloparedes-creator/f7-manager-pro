-- 1) Create clients table
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique per technician + phone (only when phone present)
CREATE UNIQUE INDEX clients_tech_phone_unique
  ON public.clients (technician_id, phone)
  WHERE phone IS NOT NULL AND phone <> '';

CREATE INDEX clients_technician_id_idx ON public.clients (technician_id);

-- updated_at trigger
CREATE TRIGGER clients_set_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Technicians view own clients"
ON public.clients FOR SELECT
USING (auth.uid() = technician_id);

CREATE POLICY "Technicians insert own clients"
ON public.clients FOR INSERT
WITH CHECK (auth.uid() = technician_id);

CREATE POLICY "Technicians update own clients"
ON public.clients FOR UPDATE
USING (auth.uid() = technician_id);

CREATE POLICY "Technicians delete own clients"
ON public.clients FOR DELETE
USING (auth.uid() = technician_id);

-- 2) Add client_id to orders (nullable for safe backfill)
ALTER TABLE public.orders
  ADD COLUMN client_id uuid;

-- 3) Backfill: create one client per (technician_id, phone) and link orders
DO $$
DECLARE
  r RECORD;
  new_client_id uuid;
BEGIN
  -- Orders with a phone: dedupe by (technician_id, phone)
  FOR r IN
    SELECT DISTINCT ON (technician_id, customer_phone)
      technician_id, customer_phone, customer_name
    FROM public.orders
    WHERE customer_phone IS NOT NULL AND customer_phone <> ''
    ORDER BY technician_id, customer_phone, created_at ASC
  LOOP
    INSERT INTO public.clients (technician_id, name, phone)
    VALUES (r.technician_id, COALESCE(NULLIF(r.customer_name, ''), 'Cliente'), r.customer_phone)
    RETURNING id INTO new_client_id;

    UPDATE public.orders
    SET client_id = new_client_id
    WHERE technician_id = r.technician_id
      AND customer_phone = r.customer_phone;
  END LOOP;

  -- Orders without phone: one client per order
  FOR r IN
    SELECT id, technician_id, customer_name
    FROM public.orders
    WHERE (customer_phone IS NULL OR customer_phone = '') AND client_id IS NULL
  LOOP
    INSERT INTO public.clients (technician_id, name, phone)
    VALUES (r.technician_id, COALESCE(NULLIF(r.customer_name, ''), 'Cliente'), NULL)
    RETURNING id INTO new_client_id;

    UPDATE public.orders SET client_id = new_client_id WHERE id = r.id;
  END LOOP;
END $$;

-- 4) FK + index on orders.client_id
ALTER TABLE public.orders
  ADD CONSTRAINT orders_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX orders_client_id_idx ON public.orders (client_id);
