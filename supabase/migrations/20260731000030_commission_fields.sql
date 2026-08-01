-- Comisiones por venta/reparación: no todos los talleres/tiendas pagan
-- comisión a su personal, por eso es un toggle por empresa (no todos los
-- planes/negocios lo necesitan) más una tasa individual por usuario.
-- El cálculo de comisión (venta atribuida × tasa) se hace en Reportes, a
-- partir de product_sales.created_by / orders.assigned_technician_id, que
-- ya existían — esto solo agrega el porcentaje configurable.
--
-- Las políticas de UPDATE ya existentes en `companies` (admin de la propia
-- empresa) y `profiles` (self o admin de la empresa) ya cubren estas
-- columnas nuevas, no hace falta RLS adicional.

ALTER TABLE public.companies
  ADD COLUMN commission_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN commission_rate numeric NOT NULL DEFAULT 0
    CHECK (commission_rate >= 0 AND commission_rate <= 100);
