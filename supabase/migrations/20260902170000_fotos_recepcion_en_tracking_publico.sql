-- Las fotos que se sacan al recepcionar el equipo (orders.photos, cargadas
-- desde Nueva Orden / Modo Lote) nunca se exponían en get_order_by_code /
-- get_order_by_tracking, así que el cliente jamás las veía en su link de
-- seguimiento — solo se le mostraban las fotos de "Evidencia fotográfica"
-- adjuntadas después, al cambiar de estado (order_status_history.image_urls).
-- Se agrega o.photos como columna más.
--
-- Mismo cuerpo que la versión de
-- 20260902160000_documentos_financieros_en_tracking_publico.sql, sumando
-- o.photos.

DROP FUNCTION IF EXISTS public.get_order_by_code(text);
CREATE FUNCTION public.get_order_by_code(_code text) RETURNS TABLE(
  id uuid, order_number text, device_type text, status text, technician_notes text,
  estimated_delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone,
  quote_amount bigint, deposit_amount bigint, cargos_adicionales jsonb,
  problems text[], problem_other text, problem_description text,
  accessories text[], checklist jsonb,
  quote_response text, quote_response_note text, quote_responded_at timestamptz,
  company_name text, company_logo_url text, status_label text,
  marca text, modelo text, imei text, financial_documents jsonb, photos text[]
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT o.id, o.order_number, o.device_type, o.status, o.technician_notes,
         o.estimated_delivery_date, o.created_at, o.updated_at,
         o.quote_amount, o.deposit_amount, o.cargos_adicionales,
         o.problems, o.problem_other, o.problem_description,
         o.accessories, o.checklist,
         o.quote_response, o.quote_response_note, o.quote_responded_at,
         c.name AS company_name, c.logo_url AS company_logo_url,
         sp.label AS status_label,
         o.marca, o.modelo, o.imei, o.financial_documents, o.photos
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  LEFT JOIN public.order_status_presets sp ON sp.company_id = o.company_id AND sp.key = o.status
  WHERE upper(o.order_number) = upper(_code)
  ORDER BY o.created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_code(text) TO service_role;

DROP FUNCTION IF EXISTS public.get_order_by_tracking(uuid);
CREATE FUNCTION public.get_order_by_tracking(_token uuid) RETURNS TABLE(
  id uuid, order_number text, device_type text, status text, technician_notes text,
  estimated_delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone,
  quote_amount bigint, deposit_amount bigint, cargos_adicionales jsonb,
  problems text[], problem_other text, problem_description text,
  accessories text[], checklist jsonb,
  quote_response text, quote_response_note text, quote_responded_at timestamptz,
  company_name text, company_logo_url text, status_label text,
  marca text, modelo text, imei text, financial_documents jsonb, photos text[]
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT o.id, o.order_number, o.device_type, o.status, o.technician_notes,
         o.estimated_delivery_date, o.created_at, o.updated_at,
         o.quote_amount, o.deposit_amount, o.cargos_adicionales,
         o.problems, o.problem_other, o.problem_description,
         o.accessories, o.checklist,
         o.quote_response, o.quote_response_note, o.quote_responded_at,
         c.name AS company_name, c.logo_url AS company_logo_url,
         sp.label AS status_label,
         o.marca, o.modelo, o.imei, o.financial_documents, o.photos
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  LEFT JOIN public.order_status_presets sp ON sp.company_id = o.company_id AND sp.key = o.status
  WHERE o.tracking_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO service_role;
