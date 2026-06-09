-- Add cargos_adicionales array to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cargos_adicionales jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add is_internal flag to status history
ALTER TABLE public.order_status_history
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

-- Update public RPCs to filter out internal notes and expose financials
CREATE OR REPLACE FUNCTION public.get_history_by_code(_code text)
 RETURNS TABLE(id uuid, status text, note text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT h.id, h.status, h.note, h.created_at
  FROM public.order_status_history h
  JOIN public.orders o ON o.id = h.order_id
  WHERE upper(o.order_number) = upper(_code)
    AND h.is_internal = false
  ORDER BY h.created_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_order_history_by_tracking(_token uuid)
 RETURNS TABLE(id uuid, status text, note text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT h.id, h.status, h.note, h.created_at
  FROM public.order_status_history h
  JOIN public.orders o ON o.id = h.order_id
  WHERE o.tracking_token = _token
    AND h.is_internal = false
  ORDER BY h.created_at ASC;
$function$;

-- Drop and recreate to add financial columns to public response
DROP FUNCTION IF EXISTS public.get_order_by_code(text);
CREATE FUNCTION public.get_order_by_code(_code text)
 RETURNS TABLE(
   id uuid, order_number text, device_type text, status text,
   technician_notes text, estimated_delivery_date date,
   created_at timestamp with time zone, updated_at timestamp with time zone,
   quote_amount bigint, deposit_amount bigint, cargos_adicionales jsonb
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, order_number, device_type, status, technician_notes,
         estimated_delivery_date, created_at, updated_at,
         quote_amount, deposit_amount, cargos_adicionales
  FROM public.orders
  WHERE upper(order_number) = upper(_code)
  LIMIT 1;
$function$;