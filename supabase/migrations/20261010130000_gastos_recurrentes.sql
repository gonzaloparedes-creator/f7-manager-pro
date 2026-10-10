-- Bloque 1 (A7): gastos recurrentes.
--
-- Una regla (mensual con día fijo, o semanal con día de la semana) crea sola el
-- gasto cuando llega su fecha: alquiler, internet, sueldos, etc. Mismo acceso
-- que Gastos (admin, o staff/recepción si el admin lo habilitó) y mismo recorte
-- por sucursal.
--
-- La generación corre cuando alguien con acceso a Gastos abre la app
-- (generate_recurring_expenses) y rellena los días que quedaron sin abrir con la
-- fecha correcta de cada ocurrencia. No usa pg_cron: la función solo toca la
-- empresa de quien la llama.

CREATE TABLE public.recurring_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL CHECK (amount > 0),
  frequency text NOT NULL CHECK (frequency IN ('mensual', 'semanal')),
  day_of_month integer CHECK (day_of_month BETWEEN 1 AND 31),
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),
  -- NULL = el gasto nace "a pagar" (queda pendiente hasta abonarlo); con valor
  -- nace pagado de contado con ese método y entra al Cierre de Caja.
  payment_method text,
  start_date date NOT NULL,
  -- Último día ya revisado por la generación (las ocurrencias hasta esa fecha ya se resolvieron).
  generated_through date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recurring_expenses_schedule_check CHECK (
    (frequency = 'mensual' AND day_of_month IS NOT NULL AND day_of_week IS NULL)
    OR (frequency = 'semanal' AND day_of_week IS NOT NULL AND day_of_month IS NULL)
  ),
  CONSTRAINT recurring_expenses_id_company_key UNIQUE (id, company_id)
);
CREATE INDEX idx_recurring_expenses_company ON public.recurring_expenses (company_id, active);
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recurring expenses select tenant admin or allowed staff" ON public.recurring_expenses
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.company_staff_can_view_gastos(company_id))
  )
);

CREATE POLICY "Recurring expenses insert tenant admin or allowed staff" ON public.recurring_expenses
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.is_company_active(company_id)
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.company_staff_can_view_gastos(company_id))
);

CREATE POLICY "Recurring expenses update tenant admin or allowed staff" ON public.recurring_expenses
FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.company_staff_can_view_gastos(company_id))
)
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.company_staff_can_view_gastos(company_id))
);

CREATE POLICY "Recurring expenses delete tenant admin or allowed staff" ON public.recurring_expenses
FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.company_staff_can_view_gastos(company_id))
);

-- Igual que expenses: un usuario con "Solo ve su sucursal" solo ve y escribe reglas de su sucursal.
CREATE POLICY "Branch restricted recurring expenses" ON public.recurring_expenses
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
)
WITH CHECK (
  NOT (SELECT public.is_branch_restricted(auth.uid()))
  OR branch_id = (SELECT public.get_user_branch(auth.uid()))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;

-- Cada gasto generado apunta a su regla. La clave compuesta con company_id
-- impide enlazar un gasto con la regla de otra empresa; el índice único hace
-- que una misma fecha nunca se genere dos veces (dos pestañas abiertas a la vez).
ALTER TABLE public.expenses
  ADD COLUMN recurring_expense_id uuid;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_recurring_expense_fkey
  FOREIGN KEY (recurring_expense_id, company_id)
  REFERENCES public.recurring_expenses (id, company_id)
  ON DELETE SET NULL (recurring_expense_id);
CREATE UNIQUE INDEX uq_expenses_recurring_date
  ON public.expenses (recurring_expense_id, expense_date)
  WHERE recurring_expense_id IS NOT NULL;

-- ¿Le toca a la regla en esa fecha? Un día 29/30/31 en un mes más corto cae
-- el último día del mes. Semanal: 0 = domingo … 6 = sábado (igual que Date.getDay()).
CREATE OR REPLACE FUNCTION public.recurring_expense_is_due(
  p_frequency text, p_day_of_month integer, p_day_of_week integer, p_date date
) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_frequency
    WHEN 'mensual' THEN
      extract(day FROM p_date)::integer = LEAST(
        p_day_of_month,
        extract(day FROM (date_trunc('month', p_date::timestamp) + interval '1 month' - interval '1 day'))::integer
      )
    WHEN 'semanal' THEN extract(dow FROM p_date)::integer = p_day_of_week
    ELSE false
  END;
$$;

-- Crea los gastos que ya vencieron (hasta hoy, hora de Paraguay) para las
-- reglas activas de la empresa de quien llama. Devuelve cuántos creó.
-- Solo mira hasta 93 días atrás, para no inundar de gastos viejos a quien
-- vuelve después de mucho tiempo.
CREATE OR REPLACE FUNCTION public.generate_recurring_expenses() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_company uuid;
  v_today date := (now() AT TIME ZONE 'America/Asuncion')::date;
  r public.recurring_expenses%ROWTYPE;
  v_from date;
  d date;
  v_expense_id uuid;
  v_created integer := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  v_company := public.get_user_company(v_uid);
  IF v_company IS NULL OR NOT public.is_company_active(v_company) THEN RETURN 0; END IF;
  IF NOT (public.has_role(v_uid, 'admin'::public.app_role) OR public.company_staff_can_view_gastos(v_company)) THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT * FROM public.recurring_expenses
    WHERE company_id = v_company AND active
    ORDER BY created_at
    FOR UPDATE
  LOOP
    v_from := GREATEST(r.start_date, COALESCE(r.generated_through + 1, r.start_date), v_today - 93);

    FOR d IN
      SELECT g::date FROM generate_series(v_from::timestamp, v_today::timestamp, interval '1 day') AS g
    LOOP
      CONTINUE WHEN NOT public.recurring_expense_is_due(r.frequency, r.day_of_month, r.day_of_week, d);

      v_expense_id := NULL;
      INSERT INTO public.expenses (
        company_id, branch_id, category, description, amount, payment_type, amount_paid,
        installments_total, installments_paid, expense_date, notes, created_by, recurring_expense_id
      ) VALUES (
        r.company_id, r.branch_id, r.category, r.description, r.amount,
        CASE WHEN r.payment_method IS NULL THEN 'credito' ELSE 'contado' END,
        CASE WHEN r.payment_method IS NULL THEN 0 ELSE r.amount END,
        NULL, 0, d, r.notes, r.created_by, r.id
      )
      ON CONFLICT (recurring_expense_id, expense_date) WHERE recurring_expense_id IS NOT NULL DO NOTHING
      RETURNING id INTO v_expense_id;

      IF v_expense_id IS NOT NULL THEN
        v_created := v_created + 1;
        IF r.payment_method IS NOT NULL THEN
          INSERT INTO public.expense_payments (expense_id, company_id, branch_id, amount, payment_method, created_by)
          VALUES (v_expense_id, r.company_id, r.branch_id, r.amount, r.payment_method, r.created_by);
        END IF;
      END IF;
    END LOOP;

    IF r.start_date <= v_today THEN
      UPDATE public.recurring_expenses SET generated_through = v_today WHERE id = r.id;
    END IF;
  END LOOP;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_recurring_expenses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_recurring_expenses() TO authenticated;
REVOKE ALL ON FUNCTION public.recurring_expense_is_due(text, integer, integer, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recurring_expense_is_due(text, integer, integer, date) TO authenticated;
