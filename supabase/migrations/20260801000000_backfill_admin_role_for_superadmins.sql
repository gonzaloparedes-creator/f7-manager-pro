-- Bug real detectado en vivo: una cuenta con rol 'superadmin' (acceso a
-- /master-admin) que nunca recibió también el rol 'admin' de su propia
-- empresa queda bloqueada por sus propias políticas RLS al intentar crear
-- usuarios o reasignar roles en Configuración → Usuarios — has_role(uid,
-- 'admin') exige la fila 'admin' explícita, is_super_admin() no alcanza
-- para esas políticas puntuales (branches, user_roles, inventory delete,
-- etc. solo miran has_role, no is_super_admin). Y al no tener 'admin'
-- todavía, tampoco puede otorgárselo desde la UI: WITH CHECK
-- has_role(auth.uid(),'admin') se lo bloquea a sí mismo.
--
-- El seed original (20260428202509) le dio 'admin' a todos los perfiles
-- que existían en ese momento; cualquier cuenta creada o reseteada después
-- se quedó afuera de ese lote. Este backfill es idempotente (ON CONFLICT
-- DO NOTHING) y solo agrega el rol que falta — nunca toca ni quita
-- 'superadmin' ni ningún otro dato existente.

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT p.id, 'admin'::public.app_role
FROM public.profiles p
WHERE p.is_super_admin = true
   OR EXISTS (
     SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = p.id AND ur.role = 'superadmin'::public.app_role
   )
ON CONFLICT (user_id, role) DO NOTHING;
