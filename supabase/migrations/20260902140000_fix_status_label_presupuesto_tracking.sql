-- Bug: en el link de seguimiento público, el badge "Estado actual" de una
-- orden en estado "presupuesto" mostraba el texto crudo "presupuesto" en
-- vez de "Presupuesto". Causa: get_order_by_code/get_order_by_tracking
-- resuelven status_label con COALESCE(sp.label, o.status) contra
-- order_status_presets — pero "presupuesto" nunca tiene fila ahí a
-- propósito (no es uno de los 6 estados configurables del flujo de
-- reparación: recibido/en_diagnostico/en_reparacion/listo/entregado/
-- garantia), así que el LEFT JOIN siempre da NULL y cae directo al texto
-- crudo, sin pasar por STATUS_LABELS.
--
-- El frontend (PublicTrackingByCode.tsx) ya tiene el fallback correcto:
-- `order.status_label ?? STATUS_LABELS[order.status] ?? order.status`.
-- El fix es simplemente dejar de resolver el NULL en SQL y devolver
-- sp.label tal cual (nullable), para que ese fallback del frontend haga
-- su trabajo. El historial (get_history_by_code/get_order_history_by_tracking)
-- no tiene este problema porque status_label ahí es un snapshot ya resuelto
-- al momento de cada cambio de estado (order_status_history.status_label).
--
-- Mismo cuerpo que la versión de 20260828120000_estados_de_orden_configurables.sql,
-- cambiando únicamente esa columna calculada.

DROP FUNCTION IF EXISTS public.get_order_by_code(text);
CREATE FUNCTION public.get_order_by_code(_code text) RETURNS TABLE(
  id uuid, order_number text, device_type text, status text, technician_notes text,
  estimated_delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone,
  quote_amount bigint, deposit_amount bigint, cargos_adicionales jsonb,
  problems text[], problem_other text, problem_description text,
  accessories text[], checklist jsonb,
  quote_response text, quote_response_note text, quote_responded_at timestamptz,
  company_name text, company_logo_url text, status_label text
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
         sp.label AS status_label
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
  company_name text, company_logo_url text, status_label text
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
         sp.label AS status_label
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  LEFT JOIN public.order_status_presets sp ON sp.company_id = o.company_id AND sp.key = o.status
  WHERE o.tracking_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO service_role;
