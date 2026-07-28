-- Fase 0 (auditoría 2026-07-28): la restitución de stock al quitar un
-- repuesto solo vivía en OrderPartsSection.removePart() (JS de cliente). Pero
-- OrderActionsMenu.handleDelete() borra la orden directo, y order_parts cae
-- por ON DELETE CASCADE a nivel de base — ese camino nunca pasa por
-- removePart(), así que cada orden eliminada con repuestos usados perdía ese
-- stock para siempre. El agregado de stock (addPart) también hacía
-- read→resta→write en el cliente, sin atomicidad (condición de carrera entre
-- dos técnicos agregando la última unidad a la vez).
--
-- Esta migración mueve el movimiento de stock a un trigger de base de datos
-- — única fuente de verdad — con UPDATE atómico. Cubre tanto el borrado
-- explícito de un repuesto como el cascade al eliminar la orden completa,
-- porque los triggers AFTER DELETE de la tabla hija sí se disparan durante un
-- ON DELETE CASCADE en Postgres.

CREATE FUNCTION public.adjust_inventory_stock_on_order_part()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.inventory_item_id IS NOT NULL THEN
      UPDATE public.inventory_items
        SET stock = stock - NEW.quantity
        WHERE id = NEW.inventory_item_id
          AND stock >= NEW.quantity;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock insuficiente para el artículo seleccionado';
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.inventory_item_id IS NOT NULL THEN
      UPDATE public.inventory_items
        SET stock = stock + OLD.quantity
        WHERE id = OLD.inventory_item_id;
    END IF;
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    -- La UI actual no edita cantidad ni artículo de un repuesto ya cargado,
    -- pero el trigger queda correcto si eso cambia en el futuro: revierte el
    -- movimiento viejo y aplica el nuevo de forma atómica.
    IF OLD.inventory_item_id IS NOT NULL THEN
      UPDATE public.inventory_items
        SET stock = stock + OLD.quantity
        WHERE id = OLD.inventory_item_id;
    END IF;
    IF NEW.inventory_item_id IS NOT NULL THEN
      UPDATE public.inventory_items
        SET stock = stock - NEW.quantity
        WHERE id = NEW.inventory_item_id
          AND stock >= NEW.quantity;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock insuficiente para el artículo seleccionado';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER order_parts_adjust_stock
AFTER INSERT OR UPDATE OR DELETE ON public.order_parts
FOR EACH ROW EXECUTE FUNCTION public.adjust_inventory_stock_on_order_part();
