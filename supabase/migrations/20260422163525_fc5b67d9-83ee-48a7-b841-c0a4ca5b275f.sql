-- Remove the broad public SELECT on orders
DROP POLICY IF EXISTS "Public can view orders by tracking token" ON public.orders;
DROP POLICY IF EXISTS "Public can view order history" ON public.order_status_history;

-- Public tracking via SECURITY DEFINER function returning only safe fields
CREATE OR REPLACE FUNCTION public.get_order_by_tracking(_token UUID)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  device_type TEXT,
  status TEXT,
  technician_notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, order_number, device_type, status, technician_notes, created_at, updated_at
  FROM public.orders
  WHERE tracking_token = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_order_history_by_tracking(_token UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id, h.status, h.note, h.created_at
  FROM public.order_status_history h
  JOIN public.orders o ON o.id = h.order_id
  WHERE o.tracking_token = _token
  ORDER BY h.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_history_by_tracking(UUID) TO anon, authenticated;

-- Harden set_updated_at search path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Remove broad SELECT on storage.objects for order-photos.
-- Files in a public bucket are still served via /storage/v1/object/public/ URLs.
DROP POLICY IF EXISTS "Public can view order photos" ON storage.objects;
