-- Enum for category
DO $$ BEGIN
  CREATE TYPE public.inventory_category AS ENUM ('Repuesto', 'Accesorio', 'Herramienta');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  category public.inventory_category NOT NULL DEFAULT 'Repuesto',
  stock integer NOT NULL DEFAULT 0,
  min_stock_alert integer NOT NULL DEFAULT 0,
  cost_price numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  image_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inventory select same company"
ON public.inventory_items FOR SELECT TO authenticated
USING (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Inventory insert same company"
ON public.inventory_items FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Inventory update same company"
ON public.inventory_items FOR UPDATE TO authenticated
USING (company_id = public.get_user_company(auth.uid()))
WITH CHECK (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Inventory delete admin same company"
ON public.inventory_items FOR DELETE TO authenticated
USING (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_inventory_items_company ON public.inventory_items(company_id);
CREATE INDEX idx_inventory_items_branch ON public.inventory_items(branch_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory-images', 'inventory-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Inventory images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'inventory-images');

CREATE POLICY "Inventory images authenticated upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inventory-images');

CREATE POLICY "Inventory images authenticated update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'inventory-images');

CREATE POLICY "Inventory images authenticated delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'inventory-images');
