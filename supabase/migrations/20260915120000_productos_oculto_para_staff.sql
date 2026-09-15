-- Permite al admin bloquear el acceso completo a la sección Productos
-- (venta de catálogo) para el rol "staff". A diferencia del stock (oculto
-- por defecto), acá el default es visible (true): muchos talleres ya
-- dependen de que el staff use Productos para cobrar ventas, así que
-- restringirlo por defecto para todos los clientes existentes rompería su
-- flujo de un día para el otro. El admin lo apaga explícitamente si lo
-- necesita.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS staff_can_view_products boolean NOT NULL DEFAULT true;
