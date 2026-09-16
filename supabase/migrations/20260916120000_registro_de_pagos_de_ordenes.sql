-- Hasta ahora orders.deposit_amount/deposit_payment_method son un solo par
-- de campos que se pisa en cada pago nuevo: si la seña se pagó en efectivo
-- y el saldo por transferencia, el sistema solo recuerda "transferencia" —
-- la parte en efectivo queda invisible para cualquier reporte por medio de
-- pago o para un cierre de caja real.
--
-- order_payments es un registro append-only (mismo criterio que
-- product_sales/order_status_history: nunca se edita ni se borra desde la
-- app) con una fila por cada pago real recibido, para poder reconstruir con
-- precisión cuánto entró por cada medio de pago en un día puntual.
CREATE TABLE public.order_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_payments_company_created ON public.order_payments (company_id, created_at DESC);
CREATE INDEX idx_order_payments_order ON public.order_payments (order_id);

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments FORCE ROW LEVEL SECURITY;

CREATE POLICY "Order payments select tenant scoped" ON public.order_payments
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR company_id = public.get_user_company(auth.uid())
);

CREATE POLICY "Order payments insert tenant scoped" ON public.order_payments
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.is_company_active(company_id)
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.company_id = order_payments.company_id
  )
);

-- Registro append-only: nunca se edita ni se borra desde la app (mismo
-- criterio que product_sales/order_status_history). Una corrección de un
-- pago mal cargado es un flujo de negocio propio, todavía sin construir —
-- no un UPDATE/DELETE acá.
CREATE POLICY "Order payments no update" ON public.order_payments
AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "Order payments no delete" ON public.order_payments
AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);
