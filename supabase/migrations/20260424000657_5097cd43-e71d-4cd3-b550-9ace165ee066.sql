CREATE TABLE public.order_technical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_technical_notes_order_id ON public.order_technical_notes(order_id, created_at DESC);

ALTER TABLE public.order_technical_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Technicians view own order technical notes"
ON public.order_technical_notes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = order_technical_notes.order_id
    AND o.technician_id = auth.uid()
));

CREATE POLICY "Technicians insert own order technical notes"
ON public.order_technical_notes
FOR INSERT
WITH CHECK (
  auth.uid() = technician_id
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_technical_notes.order_id
      AND o.technician_id = auth.uid()
  )
);

CREATE POLICY "Technicians delete own order technical notes"
ON public.order_technical_notes
FOR DELETE
USING (auth.uid() = technician_id);