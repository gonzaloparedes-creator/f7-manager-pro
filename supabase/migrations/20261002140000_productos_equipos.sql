-- Productos de tipo "equipo" (celulares usados/reacondicionados): unidad única
-- con IMEI, costo de compra, costo de repuestos y notas. cost_price sigue siendo
-- el costo total (compra + repuestos), así el POS y Reportes calculan el margen
-- real sin cambios.
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS is_device boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS imei text,
  ADD COLUMN IF NOT EXISTS purchase_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repair_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repair_details text,
  ADD COLUMN IF NOT EXISTS notes text;
