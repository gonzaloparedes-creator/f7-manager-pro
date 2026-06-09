ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS has_sim boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_sd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_esim boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_case boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS received_by_id uuid REFERENCES public.profiles(id);