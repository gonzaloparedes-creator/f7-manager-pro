-- Fase 2 (arranque): inventario híbrido interno/externo, tal como se
-- recomendó en la auditoría — un solo `inventory_items` con dos flags,
-- no una tabla `products` paralela que duplicaría RLS/stock/índices.
--
-- is_for_repair: repuestos que un técnico puede cargar a una orden.
-- is_for_sale:   productos de mostrador para el catálogo de venta (plan
--                Business/Retail). Un ítem puede ser ambas cosas, pero por
--                ahora el frontend crea cada uno como puramente uno u otro.

ALTER TABLE public.inventory_items
  ADD COLUMN is_for_repair boolean NOT NULL DEFAULT true,
  ADD COLUMN is_for_sale boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT chk_inventory_channel CHECK (is_for_repair OR is_for_sale);

CREATE INDEX idx_inventory_items_repair ON public.inventory_items (company_id) WHERE is_for_repair;
CREATE INDEX idx_inventory_items_sale ON public.inventory_items (company_id) WHERE is_for_sale;

-- Categoría genérica para productos de venta (celulares, accesorios de
-- mostrador, etc.) que no encajan en Repuesto/Accesorio/Herramienta, que
-- son categorías pensadas para el taller.
ALTER TYPE public.inventory_category ADD VALUE IF NOT EXISTS 'Producto';

-- Enforcement a nivel de base, no solo en el frontend: un repuesto de orden
-- no puede salir de stock marcado exclusivamente "para venta". Corre BEFORE
-- INSERT, antes de que el trigger de descuento de stock (order_parts_adjust_stock,
-- AFTER INSERT) llegue a tocar nada.
CREATE FUNCTION public.validate_order_part_is_repair_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.inventory_item_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_items
      WHERE id = NEW.inventory_item_id AND is_for_repair
    ) THEN
      RAISE EXCEPTION 'Este artículo no está disponible para reparaciones (es de venta exclusiva)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_parts_require_repair_item
BEFORE INSERT ON public.order_parts
FOR EACH ROW EXECUTE FUNCTION public.validate_order_part_is_repair_item();
