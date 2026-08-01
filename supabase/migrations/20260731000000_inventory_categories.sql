-- Categorización libre por empresa (categoría + subcategoría), para
-- Inventario (Taller) y Productos (Tienda) por igual — comparten
-- `inventory_items`, así que comparten taxonomía.
--
-- El enum `inventory_category` ('Repuesto'/'Accesorio'/'Herramienta'/
-- 'Producto') era fijo a nivel de base de datos: no servía para que cada
-- negocio arme sus propias categorías/subcategorías (ej: "Accesorios" →
-- "Auriculares"). Se reemplaza por tablas propias, editables por el dueño
-- del negocio. category_id/subcategory_id son NULLABLES a propósito: un
-- ítem puede quedar "Sin categoría" — categorizar es opcional, no un
-- requisito para poder cargar stock.

CREATE TABLE public.inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.inventory_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.inventory_categories(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);
ALTER TABLE public.inventory_subcategories ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_inventory_subcategories_category ON public.inventory_subcategories(category_id);

-- RLS: mismo criterio que inventory_items (cualquier usuario de la empresa
-- puede crear/editar — igual que puede cargar un ítem nuevo al vuelo desde
-- una orden; borrar categorías queda restringido a admin, como el borrado
-- de ítems de inventario).
CREATE POLICY "Categories select tenant scoped" ON public.inventory_categories
FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Categories insert tenant scoped" ON public.inventory_categories
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company(auth.uid()) AND public.is_company_active(company_id))
);

CREATE POLICY "Categories update tenant scoped" ON public.inventory_categories
FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR company_id = public.get_user_company(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()) OR company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Categories delete admin tenant scoped" ON public.inventory_categories
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Subcategories select tenant scoped" ON public.inventory_subcategories
FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Subcategories insert tenant scoped" ON public.inventory_subcategories
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company(auth.uid()) AND public.is_company_active(company_id))
);

CREATE POLICY "Subcategories update tenant scoped" ON public.inventory_subcategories
FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR company_id = public.get_user_company(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()) OR company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Subcategories delete admin tenant scoped" ON public.inventory_subcategories
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
);

-- inventory_items: agrega category_id/subcategory_id
ALTER TABLE public.inventory_items
  ADD COLUMN category_id uuid REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
  ADD COLUMN subcategory_id uuid REFERENCES public.inventory_subcategories(id) ON DELETE SET NULL;

CREATE INDEX idx_inventory_items_category ON public.inventory_items(category_id);
CREATE INDEX idx_inventory_items_subcategory ON public.inventory_items(subcategory_id);

-- Backfill: una categoría por cada (empresa, valor de enum) que esté
-- realmente en uso, para no perder la categorización que ya existía.
INSERT INTO public.inventory_categories (company_id, name)
SELECT DISTINCT company_id, category::text
FROM public.inventory_items
ON CONFLICT (company_id, name) DO NOTHING;

UPDATE public.inventory_items ii
SET category_id = ic.id
FROM public.inventory_categories ic
WHERE ic.company_id = ii.company_id AND ic.name = ii.category::text;

-- El enum ya cumplió su función (queda reemplazado por category_id).
ALTER TABLE public.inventory_items DROP COLUMN category;
DROP TYPE public.inventory_category;

-- Defensa en profundidad: que subcategory_id siempre pertenezca a
-- category_id, y que ambos sean de la misma empresa que el ítem.
CREATE FUNCTION public.validate_inventory_item_taxonomy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_categories
      WHERE id = NEW.category_id AND company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'Categoría inválida para esta empresa';
    END IF;
  END IF;
  IF NEW.subcategory_id IS NOT NULL THEN
    IF NEW.category_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.inventory_subcategories
      WHERE id = NEW.subcategory_id AND category_id = NEW.category_id
    ) THEN
      RAISE EXCEPTION 'La subcategoría no pertenece a la categoría seleccionada';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_items_validate_taxonomy
BEFORE INSERT OR UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.validate_inventory_item_taxonomy();

-- Sin esto, RLS nunca llega a evaluarse: Postgres rechaza el acceso a nivel
-- de tabla antes ("permission denied for table ..."). Ya nos pasó una vez
-- con product_sales/notification_send_log — no repetirlo.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_categories TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_subcategories TO anon, authenticated, service_role;
