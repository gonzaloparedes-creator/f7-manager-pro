-- Adjuntar PDF (ej. una factura) en "Información financiera" de una orden.
-- Queda interno: NO se agrega a get_order_by_code/get_order_by_tracking ni a
-- la página pública de seguimiento — el cliente no ve estos documentos.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS financial_documents jsonb NOT NULL DEFAULT '[]'::jsonb;
  -- array de objetos { name, url, uploaded_at } — mismo estilo que cargos_adicionales,
  -- para poder mostrar el nombre real del archivo y no un path de storage.

INSERT INTO storage.buckets (id, name, public) VALUES ('order-documents', 'order-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Mismo patrón que inventory-images: público para lectura (el bucket público
-- sirve los objetos por URL directa), escritura scoped por company_id vía
-- (storage.foldername(name))[1] — sin exigir rol admin, es una tarea
-- operativa (como agregar un cargo adicional), no una decisión de marca.
CREATE POLICY "Order documents company upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'order-documents'
    AND (storage.foldername(name))[1] = (public.get_user_company(auth.uid()))::text
  );

CREATE POLICY "Order documents company update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'order-documents'
    AND (storage.foldername(name))[1] = (public.get_user_company(auth.uid()))::text
  )
  WITH CHECK (
    bucket_id = 'order-documents'
    AND (storage.foldername(name))[1] = (public.get_user_company(auth.uid()))::text
  );

CREATE POLICY "Order documents company delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'order-documents'
    AND (storage.foldername(name))[1] = (public.get_user_company(auth.uid()))::text
  );
