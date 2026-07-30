-- Venta rápida manual (sin cobro/factura real todavía): registra cada venta
-- de un producto del catálogo externo y descuenta stock de forma atómica,
-- con el mismo patrón que ya usamos para repuestos de reparación
-- (order_parts_adjust_stock) — nunca restar en el cliente.
--
-- product_name/unit_price quedan congelados al momento de la venta (mismo
-- criterio que order_parts.historical_cost/historical_selling_price), para
-- que el historial no cambie si después se edita o se borra el producto.

CREATE TABLE public.product_sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  payment_method text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_sales_quantity_check CHECK (quantity > 0)
);

CREATE INDEX idx_product_sales_company_created ON public.product_sales (company_id, created_at DESC);

ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sales FORCE ROW LEVEL SECURITY;

CREATE POLICY "Product sales select tenant scoped" ON public.product_sales
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR company_id = public.get_user_company(auth.uid())
);

CREATE POLICY "Product sales insert tenant scoped" ON public.product_sales
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND public.is_company_active(company_id)
    AND created_by = auth.uid()
  )
);

-- Registro de venta append-only: nunca se edita ni se borra desde la app
-- (mismo criterio que order_status_history). Una devolución/anulación es un
-- flujo de negocio propio, todavía sin construir — no un UPDATE/DELETE acá.
CREATE POLICY "Product sales no update" ON public.product_sales
AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "Product sales no delete" ON public.product_sales
AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

CREATE FUNCTION public.process_product_sale()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.inventory_item_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_items
      WHERE id = NEW.inventory_item_id AND is_for_sale
    ) THEN
      RAISE EXCEPTION 'Este artículo no está disponible para venta';
    END IF;

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

CREATE TRIGGER product_sales_process
BEFORE INSERT ON public.product_sales
FOR EACH ROW EXECUTE FUNCTION public.process_product_sale();
