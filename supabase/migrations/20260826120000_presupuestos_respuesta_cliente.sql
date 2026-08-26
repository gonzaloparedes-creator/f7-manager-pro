-- Presupuestos: el cliente puede responder (aceptar / rechazar / pedir
-- cambios) desde el link público de tracking (solo vía tracking_token, ver
-- respond-to-quote/index.ts). Columnas nuevas, nullable y aditivas — no
-- tocan status ni ningún otro campo existente.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quote_response text,
  ADD COLUMN IF NOT EXISTS quote_response_note text,
  ADD COLUMN IF NOT EXISTS quote_responded_at timestamptz;

ALTER TABLE public.orders
  ADD CONSTRAINT chk_quote_response CHECK (
    quote_response IS NULL OR quote_response IN ('aceptado', 'rechazado', 'cambios_solicitados')
  );

-- Se reconstruyen get_order_by_code / get_order_by_tracking para exponer las
-- 3 columnas nuevas (solo lectura, mismo nivel de sensibilidad que
-- quote_amount/deposit_amount que ya se exponen acá). Importante: el DROP
-- borra los grants existentes, así que se vuelven a declarar explícitamente
-- abajo — el mismo descuido ya reabrió por error el acceso anónimo a
-- get_technical_notes_by_code en 20260824010000 después de haber sido
-- cerrado a propósito en 20260728000000. No repetir ese error acá.

DROP FUNCTION IF EXISTS public.get_order_by_code(text);
CREATE FUNCTION public.get_order_by_code(_code text) RETURNS TABLE(
  id uuid, order_number text, device_type text, status text, technician_notes text,
  estimated_delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone,
  quote_amount bigint, deposit_amount bigint, cargos_adicionales jsonb,
  problems text[], problem_other text, problem_description text,
  accessories text[], checklist jsonb,
  quote_response text, quote_response_note text, quote_responded_at timestamptz
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id, order_number, device_type, status, technician_notes,
         estimated_delivery_date, created_at, updated_at,
         quote_amount, deposit_amount, cargos_adicionales,
         problems, problem_other, problem_description,
         accessories, checklist,
         quote_response, quote_response_note, quote_responded_at
  FROM public.orders
  WHERE upper(order_number) = upper(_code)
  ORDER BY created_at ASC
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
  quote_response text, quote_response_note text, quote_responded_at timestamptz
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id, order_number, device_type, status, technician_notes,
         estimated_delivery_date, created_at, updated_at,
         quote_amount, deposit_amount, cargos_adicionales,
         problems, problem_other, problem_description,
         accessories, checklist,
         quote_response, quote_response_note, quote_responded_at
  FROM public.orders
  WHERE tracking_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO service_role;
