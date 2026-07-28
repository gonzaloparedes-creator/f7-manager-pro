-- Fase 0 (auditoría 2026-07-28): cierra la fuga de datos entre empresas en el
-- tracking público. Los códigos de orden (ORD-0001, ORD-0002...) son
-- correlativos y adivinables, y las funciones get_order_by_code /
-- get_history_by_code / get_technical_notes_by_code son SECURITY DEFINER
-- otorgadas a `anon`, así que cualquiera que recorra códigos en un loop podía
-- leer notas técnicas internas de cualquier empresa de la plataforma.
--
-- El esquema ya tenía medio construido el camino seguro: orders.tracking_token
-- (uuid, único, indexado) y las funciones get_order_by_tracking /
-- get_order_history_by_tracking, pero nunca se completó ni se conectó al
-- frontend. Esta migración lo completa:
--   1. Agrega get_technical_notes_by_tracking, la pieza que faltaba.
--   2. Actualiza get_order_by_tracking para tener paridad de campos con la
--      versión más reciente de get_order_by_code (problems, cargos, etc).
--   3. Revoca el acceso anónimo a get_technical_notes_by_code — la pieza más
--      sensible — para todo lookup nuevo. get_order_by_code / get_history_by_code
--      quedan accesibles para no romper QR/recibos ya impresos y entregados a
--      clientes reales; el riesgo residual (enumeración de estado/monto, sin
--      notas técnicas) queda documentado como pendiente de deprecar.

-- 1. Nueva función segura para notas técnicas por tracking_token
CREATE FUNCTION public.get_technical_notes_by_tracking(_token uuid)
RETURNS TABLE(id uuid, note text, created_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.note, t.created_at
  FROM public.order_technical_notes t
  JOIN public.orders o ON o.id = t.order_id
  WHERE o.tracking_token = _token
  ORDER BY t.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_technical_notes_by_tracking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_technical_notes_by_tracking(uuid) TO anon, authenticated, service_role;

-- 2. get_order_by_tracking con paridad de campos respecto a get_order_by_code
DROP FUNCTION IF EXISTS public.get_order_by_tracking(uuid);

CREATE FUNCTION public.get_order_by_tracking(_token uuid)
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, order_number, device_type, status, technician_notes,
         estimated_delivery_date, created_at, updated_at,
         quote_amount, deposit_amount, cargos_adicionales,
         problems, problem_other, problem_description
  FROM public.orders
  WHERE tracking_token = _token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_order_by_tracking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO anon, authenticated, service_role;

-- 3. Cerrar la fuga crítica: ya no se otorga acceso anónimo a notas técnicas
--    por código correlativo. get_order_by_code / get_history_by_code se
--    mantienen (compatibilidad con QR/recibos ya distribuidos); esta es la
--    única de las tres que exponía datos que nunca fueron pensados como
--    públicos (order_technical_notes no tiene ni tuvo un flag is_internal:
--    todo lo que contiene se asumía interno del taller).
REVOKE EXECUTE ON FUNCTION public.get_technical_notes_by_code(text) FROM anon, authenticated;
