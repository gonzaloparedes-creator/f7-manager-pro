-- Fase 0 (auditoría 2026-07-28): orders.technician_id era ON DELETE CASCADE
-- hacia profiles. Dar de baja (o eliminar) a un técnico borraba en cascada
-- TODAS las órdenes que él creó, incluidas las ya reasignadas a otro
-- técnico — pérdida contable y legal irreversible (garantías, comprobantes).
-- Se cambia a RESTRICT: eliminar un perfil con órdenes a su nombre ahora
-- falla explícitamente, forzando reasignar esas órdenes antes de dar de baja
-- al técnico. technician_id es NOT NULL, así que SET NULL no es una opción
-- sin volver nullable la columna (cambio mayor, fuera de alcance acá).

ALTER TABLE public.orders DROP CONSTRAINT orders_technician_id_fkey;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_technician_id_fkey
  FOREIGN KEY (technician_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
