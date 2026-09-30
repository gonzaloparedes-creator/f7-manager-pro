-- "Presupuesto inicial" en la ficha de la orden mostraba orders.quote_amount,
-- que se pisa al ajustar el precio (lápiz de Información financiera, Editar
-- orden o descuento al registrar un pago). Resultado: si se bajaba de 950.000
-- a 650.000, el "inicial" también pasaba a 650.000 y se perdía el registro.
--
-- Se agrega original_quote_amount: el primer monto que tuvo el presupuesto
-- antes de su primer cambio. Lo fija un trigger a nivel base de datos para
-- cubrir todos los caminos que editan quote_amount, sin tocar quote_amount
-- (que siguen usando Reportes, Dashboard y cobros como el precio vigente).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS original_quote_amount bigint;

CREATE OR REPLACE FUNCTION public.capture_original_quote_amount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.original_quote_amount IS NULL
     AND NEW.quote_amount IS DISTINCT FROM OLD.quote_amount
     AND COALESCE(OLD.quote_amount, 0) > 0 THEN
    NEW.original_quote_amount := OLD.quote_amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_original_quote_amount ON public.orders;
CREATE TRIGGER trg_capture_original_quote_amount
  BEFORE UPDATE OF quote_amount ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.capture_original_quote_amount();

-- El link de seguimiento público también muestra "Presupuesto inicial":
-- mismo cuerpo que 20260902170000_fotos_recepcion_en_tracking_publico.sql,
-- sumando o.original_quote_amount.

DROP FUNCTION IF EXISTS public.get_order_by_code(text);
CREATE FUNCTION public.get_order_by_code(_code text) RETURNS TABLE(
  id uuid, order_number text, device_type text, status text, technician_notes text,
  estimated_delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone,
  quote_amount bigint, deposit_amount bigint, cargos_adicionales jsonb,
  problems text[], problem_other text, problem_description text,
  accessories text[], checklist jsonb,
  quote_response text, quote_response_note text, quote_responded_at timestamptz,
  company_name text, company_logo_url text, status_label text,
  marca text, modelo text, imei text, financial_documents jsonb, photos text[],
  original_quote_amount bigint
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
         o.marca, o.modelo, o.imei, o.financial_documents, o.photos,
         o.original_quote_amount
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
  marca text, modelo text, imei text, financial_documents jsonb, photos text[],
  original_quote_amount bigint
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
         o.marca, o.modelo, o.imei, o.financial_documents, o.photos,
         o.original_quote_amount
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  LEFT JOIN public.order_status_presets sp ON sp.company_id = o.company_id AND sp.key = o.status
  WHERE o.tracking_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO service_role;
