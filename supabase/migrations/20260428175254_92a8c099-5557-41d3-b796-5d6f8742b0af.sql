-- Add image_urls column to order_status_history
ALTER TABLE public.order_status_history
ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

-- Drop and recreate get_history_by_code with new return shape
DROP FUNCTION IF EXISTS public.get_history_by_code(text);
CREATE FUNCTION public.get_history_by_code(_code text)
 RETURNS TABLE(id uuid, status text, note text, created_at timestamp with time zone, image_urls text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT h.id, h.status, h.note, h.created_at, h.image_urls
  FROM public.order_status_history h
  JOIN public.orders o ON o.id = h.order_id
  WHERE upper(o.order_number) = upper(_code)
    AND h.is_internal = false
  ORDER BY h.created_at ASC;
$function$;

DROP FUNCTION IF EXISTS public.get_order_history_by_tracking(uuid);
CREATE FUNCTION public.get_order_history_by_tracking(_token uuid)
 RETURNS TABLE(id uuid, status text, note text, created_at timestamp with time zone, image_urls text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT h.id, h.status, h.note, h.created_at, h.image_urls
  FROM public.order_status_history h
  JOIN public.orders o ON o.id = h.order_id
  WHERE o.tracking_token = _token
    AND h.is_internal = false
  ORDER BY h.created_at ASC;
$function$;

-- Public storage bucket for repair evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('repair-evidence', 'repair-evidence', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Repair evidence is publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'repair-evidence');

CREATE POLICY "Technicians can upload repair evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'repair-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Technicians can update own repair evidence"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'repair-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Technicians can delete own repair evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'repair-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);