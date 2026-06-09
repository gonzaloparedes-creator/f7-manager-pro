ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS device_pin text,
  ADD COLUMN IF NOT EXISTS device_pattern integer[] DEFAULT '{}'::integer[],
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_signature text;