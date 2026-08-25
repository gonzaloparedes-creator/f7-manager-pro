-- Numeración de órdenes por empresa (antes: secuencia global compartida
-- por toda la plataforma, por lo que la primera orden de una empresa nueva
-- podía aparecer como "ORD-0247"). Cada empresa ahora tiene su propio
-- contador en companies.order_seq, incrementado atómicamente vía
-- UPDATE ... RETURNING (evita condiciones de carrera sin necesitar una
-- secuencia de Postgres por empresa).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS order_seq bigint NOT NULL DEFAULT 0;

-- Empresas que ya tienen órdenes: arrancan su contador en su propio máximo
-- actual (no en 0), para no reescribir ni chocar con números ya impresos
-- en recibos/QR. Empresas nuevas arrancan limpio en 1, 2, 3...
UPDATE public.companies c
SET order_seq = sub.max_seq
FROM (
  SELECT company_id, MAX(COALESCE(NULLIF(substring(order_number from '\d+'), '')::bigint, 0)) AS max_seq
  FROM public.orders
  GROUP BY company_id
) sub
WHERE sub.company_id = c.id;

-- El order_number deja de ser único a nivel plataforma y pasa a serlo por
-- empresa (dos talleres distintos ya pueden tener ambos un "ORD-0001").
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_number_key;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_company_order_number_key UNIQUE (company_id, order_number);

DROP FUNCTION IF EXISTS public.generate_order_number();

CREATE FUNCTION public.generate_order_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'public'
AS $$
DECLARE
  _next bigint;
BEGIN
  UPDATE public.companies
  SET order_seq = order_seq + 1
  WHERE id = _company_id
  RETURNING order_seq INTO _next;

  IF _next IS NULL THEN
    RAISE EXCEPTION 'Empresa % no encontrada', _company_id;
  END IF;

  RETURN 'ORD-' || lpad(_next::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_order_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number(uuid) TO service_role;

-- El código corto (ORD-XXXX, sin token) ya no es único a nivel plataforma,
-- así que el lookup público por código pasa a resolver de forma
-- determinística (la orden más antigua con ese código) en vez de un LIMIT 1
-- sin ORDER BY. En la práctica esta ambigüedad es solo teórica: todo QR y
-- link generado hoy usa tracking_token (uuid, siempre presente), y este
-- código corto solo sigue vivo para recibos impresos antes de que
-- existiera el token.
DROP FUNCTION IF EXISTS public.get_order_by_code(text);
CREATE FUNCTION public.get_order_by_code(_code text) RETURNS TABLE(id uuid, order_number text, device_type text, status text, technician_notes text, estimated_delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone, quote_amount bigint, deposit_amount bigint, cargos_adicionales jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id, order_number, device_type, status, technician_notes,
         estimated_delivery_date, created_at, updated_at,
         quote_amount, deposit_amount, cargos_adicionales
  FROM public.orders
  WHERE upper(order_number) = upper(_code)
  ORDER BY created_at ASC
  LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.get_history_by_code(text);
CREATE FUNCTION public.get_history_by_code(_code text) RETURNS TABLE(id uuid, status text, note text, created_at timestamp with time zone, image_urls text[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT h.id, h.status, h.note, h.created_at, h.image_urls
  FROM public.order_status_history h
  WHERE h.order_id = (SELECT o.id FROM public.get_order_by_code(_code) o)
    AND h.is_internal = false
  ORDER BY h.created_at ASC;
$$;

DROP FUNCTION IF EXISTS public.get_technical_notes_by_code(text);
CREATE FUNCTION public.get_technical_notes_by_code(_code text) RETURNS TABLE(id uuid, note text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT t.id, t.note, t.created_at
  FROM public.order_technical_notes t
  WHERE t.order_id = (SELECT o.id FROM public.get_order_by_code(_code) o)
  ORDER BY t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_code(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_history_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_history_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_history_by_code(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_technical_notes_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_technical_notes_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_technical_notes_by_code(text) TO service_role;

-- Info mínima para armar el preview dinámico de WhatsApp/redes del link de
-- seguimiento ("Seguimiento · {Taller}" en vez del genérico "F7 Manager
-- Pro" fijo en index.html). Deliberadamente NO expone nombre/teléfono del
-- cliente ni montos: esto lo va a leer un crawler público sin auth.
CREATE FUNCTION public.get_tracking_og_info(_code text) RETURNS TABLE(order_number text, device_type text, status text, company_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT o.order_number, o.device_type, o.status, c.name AS company_name
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  WHERE o.tracking_token::text = _code OR upper(o.order_number) = upper(_code)
  ORDER BY o.created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_tracking_og_info(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_tracking_og_info(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tracking_og_info(text) TO service_role;
