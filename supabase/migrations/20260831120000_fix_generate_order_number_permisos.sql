-- Bug: generate_order_number() no es SECURITY DEFINER, así que el UPDATE
-- sobre companies corre con los permisos del usuario que llama y queda
-- sujeto a la policy "Admins update own company" (requiere rol admin). Un
-- miembro del staff que crea una orden dispara un UPDATE que la RLS filtra
-- en silencio (0 filas), _next queda NULL, y la función tira "Empresa % no
-- encontrada" — un mensaje engañoso: la empresa existe, lo que falta es el
-- permiso. Reportado en producción por un staff de una empresa real.
--
-- Fix: SECURITY DEFINER para saltar esa RLS (pensada para ediciones de
-- configuración de la empresa, no para este contador interno), reemplazando
-- la protección por un chequeo explícito de "misma empresa que el que
-- llama" (mismo patrón que el resto de las RPC multi-tenant de este
-- proyecto) — así cualquier usuario autenticado sigue sin poder incrementar
-- el contador de una empresa ajena.
CREATE OR REPLACE FUNCTION public.generate_order_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next bigint;
BEGIN
  IF _company_id IS DISTINCT FROM public.get_user_company(auth.uid())
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

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
