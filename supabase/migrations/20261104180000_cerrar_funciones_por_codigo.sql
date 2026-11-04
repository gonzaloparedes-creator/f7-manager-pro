-- Cierra la fuga de órdenes por número de orden (revisión de seguridad 2026-11-04).
--
-- Las funciones "por código" buscaban una orden por su número (ORD-0001) en
-- TODAS las empresas, sin token, y las podía ejecutar cualquiera sin iniciar
-- sesión. Desde la numeración por empresa (20260824010000) cada taller arranca
-- en ORD-0001, así que el mismo código existe en muchas empresas y la función
-- devolvía la orden de la empresa más antigua: un visitante anónimo podía
-- recorrer ORD-0001, ORD-0002… y leer órdenes de otros talleres (estado,
-- montos, falla, historial con fotos y, si las tiene, IMEI y documentos).
-- Aquella migración volvió a otorgar EXECUTE a anon, deshaciendo lo que se
-- había cerrado el 2026-07-28 (20260728000000_secure_public_tracking.sql).
--
-- Los links nuevos usan tracking_token (uuid, no adivinable) y todas las
-- órdenes tienen uno, así que estas funciones ya no hacen falta: solo 4 órdenes
-- son anteriores al 28-jul, cuando todavía se entregaban links por número.
-- Supabase otorga EXECUTE a anon y authenticated por defecto, por eso no
-- alcanza con revocarlo a PUBLIC.

REVOKE EXECUTE ON FUNCTION public.get_order_by_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_history_by_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_technical_notes_by_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_company_currency_by_code(text) FROM PUBLIC, anon, authenticated;

-- La vista previa de WhatsApp (api/tracking-og.ts) también aceptaba el número de
-- orden además del token. Ahora solo resuelve por token; CREATE OR REPLACE con la
-- misma firma conserva los permisos actuales (anon sigue pudiendo ejecutarla).
CREATE OR REPLACE FUNCTION public.get_tracking_og_info(_code text)
RETURNS TABLE(order_number text, device_type text, status text, company_name text, company_logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.order_number, o.device_type, o.status, c.name AS company_name, c.logo_url AS company_logo_url
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  WHERE o.tracking_token::text = _code
  LIMIT 1;
$$;
