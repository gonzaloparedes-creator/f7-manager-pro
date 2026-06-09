ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS secondary_phone text,
ADD COLUMN IF NOT EXISTS secondary_contact_name text;
