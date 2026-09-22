-- Apertura de caja: el conteo de efectivo con el que se abre el día (el
-- "fondo" para dar vuelto). A diferencia de Cierre de Caja, puede
-- registrarla cualquier miembro del equipo (staff o admin) — en la
-- práctica son los empleados quienes abren la caja al iniciar el día,
-- mientras que el cierre/reconciliación queda en manos del admin.
-- Mismo criterio que cash_closings: sin UNIQUE(company_id, opening_date),
-- "volver a abrir" inserta una fila nueva y la UI toma la más reciente.
CREATE TABLE public.cash_openings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  opening_date date NOT NULL,
  opening_cash numeric NOT NULL DEFAULT 0,
  notes text,
  opened_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_openings_company_date ON public.cash_openings (company_id, opening_date DESC);

ALTER TABLE public.cash_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_openings FORCE ROW LEVEL SECURITY;

CREATE POLICY "Cash openings select same company" ON public.cash_openings
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR company_id = public.get_user_company(auth.uid())
);

CREATE POLICY "Cash openings insert same company" ON public.cash_openings
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.is_company_active(company_id)
  AND opened_by = auth.uid()
);

-- Append-only, igual que cash_closings: si hubo un error se vuelve a abrir
-- (nueva fila) en vez de editar el histórico.
CREATE POLICY "Cash openings no update" ON public.cash_openings
AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "Cash openings no delete" ON public.cash_openings
AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

GRANT SELECT, INSERT ON public.cash_openings TO authenticated;
