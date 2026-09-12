-- Permite al admin decidir si el rol "staff" puede ver el stock disponible
-- en Inventario y Productos. Por defecto NO lo ve (false) — el admin lo
-- habilita explícitamente desde Configuración → Usuarios si lo necesita.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS staff_can_view_stock boolean NOT NULL DEFAULT false;
