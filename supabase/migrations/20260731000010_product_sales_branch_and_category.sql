-- Multi-sucursal para ventas de mostrador + snapshot de categoría, ambos
-- derivados automáticamente del ítem vendido (nunca los manda el cliente):
-- así una venta siempre queda atribuida a la sucursal y categoría reales
-- del producto en el momento de la venta, congeladas para que el reporte
-- histórico no cambie si después se edita el ítem (mismo criterio que
-- product_name/unit_price ya congelados).

ALTER TABLE public.product_sales
  ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN category_name text,
  ADD COLUMN subcategory_name text;

CREATE INDEX idx_product_sales_branch ON public.product_sales(branch_id) WHERE branch_id IS NOT NULL;

-- Backfill best-effort para ventas ya existentes, a partir del estado
-- actual del ítem (si todavía existe).
UPDATE public.product_sales ps
SET branch_id = ii.branch_id,
    category_name = ic.name,
    subcategory_name = isc.name
FROM public.inventory_items ii
LEFT JOIN public.inventory_categories ic ON ic.id = ii.category_id
LEFT JOIN public.inventory_subcategories isc ON isc.id = ii.subcategory_id
WHERE ps.inventory_item_id = ii.id;

CREATE OR REPLACE FUNCTION public.process_product_sale()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.inventory_item_id IS NOT NULL THEN
    SELECT ii.branch_id, ii.is_for_sale, ic.name AS category_name, isc.name AS subcategory_name
      INTO v_item
      FROM public.inventory_items ii
      LEFT JOIN public.inventory_categories ic ON ic.id = ii.category_id
      LEFT JOIN public.inventory_subcategories isc ON isc.id = ii.subcategory_id
      WHERE ii.id = NEW.inventory_item_id;

    IF NOT FOUND OR NOT v_item.is_for_sale THEN
      RAISE EXCEPTION 'Este artículo no está disponible para venta';
    END IF;

    NEW.branch_id := v_item.branch_id;
    NEW.category_name := v_item.category_name;
    NEW.subcategory_name := v_item.subcategory_name;

    UPDATE public.inventory_items
      SET stock = stock - NEW.quantity
      WHERE id = NEW.inventory_item_id
        AND stock >= NEW.quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para vender este producto';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
