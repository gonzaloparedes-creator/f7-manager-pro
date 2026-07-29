-- El check de "super admin" estaba partido en dos sistemas que nunca se
-- sincronizaron:
--   1. user_roles.role = 'superadmin' — controla el acceso a /master-admin
--      (useSuperAdmin -> useUserRole) y una política RLS sobre companies
--      ("Superadmins can update companies") que vive en producción pero
--      no está en ninguna migración versionada de este repo.
--   2. profiles.is_super_admin — lo que usa la función is_super_admin(),
--      que a su vez usan casi todas las demás políticas RLS y el trigger
--      companies_prevent_billing_self_update que blindamos en la Fase 0.
--
-- Resultado real: un super admin legítimo por el sistema (1) entra al
-- panel y la política RLS lo deja actualizar companies, pero el trigger de
-- billing —que solo conoce el sistema (2)— lo bloquea con "Solo un super
-- admin puede modificar el plan...". Falso positivo sobre el dueño real
-- del sistema.
--
-- Se unifica is_super_admin() para reconocer cualquiera de las dos señales,
-- sin tocar datos de profiles (evita pisar el trigger anti-autoescalada de
-- profiles, que es un problema aparte y correcto).

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE((SELECT is_super_admin FROM public.profiles WHERE id = _user_id), false)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'superadmin'::public.app_role
    );
$$;
