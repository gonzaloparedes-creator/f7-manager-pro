-- Falta el costo histórico por venta para poder calcular "costo de
-- productos vendidos" en Reportes (mismo criterio que order_parts.historical_cost
-- para reparaciones: congelar el costo al momento de la venta, no leerlo del
-- producto actual que puede haber cambiado de precio después).
ALTER TABLE public.product_sales
  ADD COLUMN unit_cost numeric NOT NULL DEFAULT 0;
