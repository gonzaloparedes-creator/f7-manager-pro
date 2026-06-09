-- Drop the function and recreate it with problems, problem_other, and problem_description
DROP FUNCTION IF EXISTS public.get_order_by_code(text);

CREATE OR REPLACE FUNCTION public.get_order_by_code(_code text)
 RETURNS TABLE(
   id uuid,
   order_number text,
   device_type text,
   status text,
   technician_notes text,
   estimated_delivery_date date,
   created_at timestamp with time zone,
   updated_at timestamp with time zone,
   quote_amount bigint,
   deposit_amount bigint,
   cargos_adicionales jsonb,
   problems text[],
   problem_other text,
   problem_description text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, order_number, device_type, status, technician_notes,
         estimated_delivery_date, created_at, updated_at,
         quote_amount, deposit_amount, cargos_adicionales,
         problems, problem_other, problem_description
  FROM public.orders
  WHERE upper(order_number) = upper(_code)
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_order_by_code(text) TO anon, authenticated;
