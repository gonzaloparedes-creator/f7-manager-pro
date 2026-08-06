-- Carrito de venta en Tienda: una sola "venta" puede incluir varios
-- productos distintos. product_sales sigue siendo una fila por línea de
-- producto (mismo criterio que ya tenía), pero ahora las líneas que se
-- confirman juntas en un mismo carrito comparten sale_group_id — sirve
-- para agrupar "Ventas recientes" y para imprimir un solo ticket con
-- todas las líneas en vez de uno por producto.
--
-- Nullable y sin default a propósito: las ventas históricas (una por
-- producto, sin carrito) quedan con sale_group_id NULL, que es
-- exactamente "grupo de una sola línea" — no hace falta backfill.

ALTER TABLE public.product_sales
  ADD COLUMN sale_group_id uuid;

CREATE INDEX idx_product_sales_group ON public.product_sales (company_id, sale_group_id)
  WHERE sale_group_id IS NOT NULL;
