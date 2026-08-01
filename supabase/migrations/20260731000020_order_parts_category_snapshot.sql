-- Mismo criterio que product_sales: congelar categoría/subcategoría del
-- repuesto al momento de usarlo en una orden, para que los reportes por
-- categoría del Taller no cambien retroactivamente si se edita el ítem.
-- A diferencia de historical_cost (que carga el cliente), esto lo deriva
-- un trigger — el cliente ya manda inventory_item_id, no hace falta que
-- también conozca categorías.

ALTER TABLE public.order_parts
  ADD COLUMN category_name text,
  ADD COLUMN subcategory_name text;

UPDATE public.order_parts op
SET category_name = ic.name,
    subcategory_name = isc.name
FROM public.inventory_items ii
LEFT JOIN public.inventory_categories ic ON ic.id = ii.category_id
LEFT JOIN public.inventory_subcategories isc ON isc.id = ii.subcategory_id
WHERE op.inventory_item_id = ii.id;

CREATE FUNCTION public.snapshot_order_part_category()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.inventory_item_id IS NOT NULL THEN
    SELECT ic.name, isc.name
      INTO NEW.category_name, NEW.subcategory_name
      FROM public.inventory_items ii
      LEFT JOIN public.inventory_categories ic ON ic.id = ii.category_id
      LEFT JOIN public.inventory_subcategories isc ON isc.id = ii.subcategory_id
      WHERE ii.id = NEW.inventory_item_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_parts_snapshot_category
BEFORE INSERT ON public.order_parts
FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_part_category();
