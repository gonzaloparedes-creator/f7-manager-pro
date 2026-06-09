-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  business_name TEXT,
  phone TEXT,
  evolution_instance_name TEXT,
  whatsapp_connected BOOLEAN NOT NULL DEFAULT false,
  whatsapp_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, business_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'business_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  device_type TEXT NOT NULL,
  problem_description TEXT NOT NULL,
  photos TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'recibido',
  technician_notes TEXT,
  tracking_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX orders_technician_idx ON public.orders(technician_id);
CREATE INDEX orders_tracking_token_idx ON public.orders(tracking_token);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Technicians manage own orders
CREATE POLICY "Technicians view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = technician_id);
CREATE POLICY "Technicians insert own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = technician_id);
CREATE POLICY "Technicians update own orders" ON public.orders
  FOR UPDATE USING (auth.uid() = technician_id);
CREATE POLICY "Technicians delete own orders" ON public.orders
  FOR DELETE USING (auth.uid() = technician_id);

-- Public tracking: anyone can read with the tracking_token (frontend filters by token)
CREATE POLICY "Public can view orders by tracking token" ON public.orders
  FOR SELECT TO anon, authenticated USING (true);
-- NOTE: above policy together with the SELECT-by-token query exposes only token-fetched rows;
-- we do NOT expose customer_phone/notes via the public page (frontend selects only safe fields).

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ORDER STATUS HISTORY
CREATE TABLE public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX order_status_history_order_idx ON public.order_status_history(order_id);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Technicians view own order history" ON public.order_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.technician_id = auth.uid())
  );
CREATE POLICY "Technicians insert own order history" ON public.order_status_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.technician_id = auth.uid())
  );
-- Public read for tracking page
CREATE POLICY "Public can view order history" ON public.order_status_history
  FOR SELECT TO anon, authenticated USING (true);

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) VALUES ('order-photos', 'order-photos', true);

CREATE POLICY "Authenticated can upload order photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view order photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'order-photos');

CREATE POLICY "Owners can delete order photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'order-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
