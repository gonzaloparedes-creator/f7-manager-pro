CREATE OR REPLACE FUNCTION public.get_order_by_code(_code text)
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
  WHERE upper(order_number) = upper(_code)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_history_by_code(_code text)
RETURNS TABLE(id uuid, status text, note text, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id, h.status, h.note, h.created_at
  FROM public.order_status_history h
  JOIN public.orders o ON o.id = h.order_id
  WHERE upper(o.order_number) = upper(_code)
  ORDER BY h.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_technical_notes_by_code(_code text)
RETURNS TABLE(id uuid, note text, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.note, t.created_at
  FROM public.order_technical_notes t
  JOIN public.orders o ON o.id = t.order_id
  WHERE upper(o.order_number) = upper(_code)
  ORDER BY t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_history_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_technical_notes_by_code(text) TO anon, authenticated;