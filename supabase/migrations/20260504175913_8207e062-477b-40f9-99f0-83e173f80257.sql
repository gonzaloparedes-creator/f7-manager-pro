
-- Create order_parts table linking orders to inventory items
CREATE TABLE public.order_parts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_parts_order_id ON public.order_parts(order_id);
CREATE INDEX idx_order_parts_inventory_item_id ON public.order_parts(inventory_item_id);

ALTER TABLE public.order_parts ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped via the parent order's company
CREATE POLICY "Order parts select tenant scoped"
ON public.order_parts FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = order_parts.order_id
    AND o.company_id = public.get_user_company(auth.uid())
));

CREATE POLICY "Order parts insert tenant scoped"
ON public.order_parts FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = order_parts.order_id
    AND o.company_id = public.get_user_company(auth.uid())
));

CREATE POLICY "Order parts delete tenant scoped"
ON public.order_parts FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = order_parts.order_id
    AND o.company_id = public.get_user_company(auth.uid())
));
