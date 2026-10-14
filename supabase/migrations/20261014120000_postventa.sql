-- A8 "Para contactar hoy": mensajes de post-venta (pedir reseña, aviso de
-- garantía por vencer, saludo de cumpleaños) con el mismo flujo seguro de
-- WhatsApp de la cola de avisos: F7 prepara el mensaje, la persona lo manda
-- con un toque. Nada se manda solo.

-- 1. Cumpleaños del cliente (opcional; lo carga el taller desde Clientes).
ALTER TABLE public.clients
  ADD COLUMN birth_date date;

-- 2. El saludo de cumpleaños no tiene orden, así que el historial de
-- mensajes necesita poder apuntar al cliente.
ALTER TABLE public.customer_message_log
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;

CREATE INDEX idx_customer_message_log_company_client
  ON public.customer_message_log (company_id, client_id, created_at DESC);

-- El EXISTS sobre clients respeta el RLS de quien inserta y además exige
-- que el cliente sea de la misma empresa que el registro.
DROP POLICY "Message log insert same company" ON public.customer_message_log;

CREATE POLICY "Message log insert same company" ON public.customer_message_log
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.is_company_active(company_id)
  AND created_by = auth.uid()
  AND (
    order_id IS NULL
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id)
  )
  AND (
    client_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id
        AND c.company_id = customer_message_log.company_id
    )
  )
);

-- 3. Cada empresa decide qué mensajes de post-venta quiere ver (todo
-- apagado por defecto) y, para pedir reseñas, el link de su ficha.
ALTER TABLE public.companies
  ADD COLUMN postsale_review_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN postsale_warranty_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN postsale_birthday_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN review_url text
    CHECK (review_url IS NULL OR (review_url ~* '^https?://' AND length(review_url) <= 500));
