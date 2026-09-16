-- Cierre de caja diario: compara el efectivo esperado (según order_payments +
-- product_sales de ese día) contra el efectivo contado físicamente, y deja
-- un registro histórico de cada cierre. No es append-only en el sentido
-- estricto de "un evento por fila" (se puede volver a cerrar el mismo día si
-- hubo un error) — por eso no hay UNIQUE(company_id, closing_date): la UI
-- siempre toma el cierre más reciente de cada día y muestra el resto como
-- historial.
CREATE TABLE public.cash_closings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  closing_date date NOT NULL,
  expected_cash numeric NOT NULL DEFAULT 0,
  counted_cash numeric NOT NULL,
  difference numeric NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  closed_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_closings_company_date ON public.cash_closings (company_id, closing_date DESC);

ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_closings FORCE ROW LEVEL SECURITY;

CREATE POLICY "Cash closings select tenant admin" ON public.cash_closings
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Cash closings insert tenant admin" ON public.cash_closings
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.is_company_active(company_id)
  AND public.has_role(auth.uid(), 'admin'::app_role)
  AND closed_by = auth.uid()
);

-- Un cierre ya confirmado no se corrige: si hubo un error se vuelve a cerrar
-- ese mismo día (nueva fila) en vez de editar el histórico.
CREATE POLICY "Cash closings no update" ON public.cash_closings
AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "Cash closings no delete" ON public.cash_closings
AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

-- Lección de la migración anterior: RLS por sí sola no alcanza, Postgres
-- exige además el GRANT de base para el rol antes de evaluar las políticas.
GRANT SELECT, INSERT ON public.cash_closings TO authenticated;
