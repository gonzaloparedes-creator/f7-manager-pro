-- Finanzas internas de F7 Manager Pro (control de los socios).
--
-- Son las cuentas DE F7 como negocio (ingresos por suscripciones, hosting,
-- publicidad, aportes y retiros de los socios...), no las de los talleres
-- clientes. Todo es exclusivo del super admin: ninguna empresa cliente ni
-- `anon` puede leer ni escribir una sola fila.
--
--   f7_partners            los socios y su porcentaje de utilidad
--   f7_finance_categories  categorías de ingreso y de gasto
--   f7_recurring_expenses  gastos fijos (plantillas que generan vencimientos)
--   f7_finance_entries     el libro: ingresos, gastos, aportes, reembolsos y
--                          retiros de utilidad (se anulan, nunca se borran)
--
-- Se cuenta cuando se cobra o se paga (solo `pagado` y no anulado). Los
-- `pendiente` son por cobrar / por pagar.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

CREATE TABLE public.f7_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  share_pct numeric(5,2) NOT NULL DEFAULT 50 CHECK (share_pct >= 0 AND share_pct <= 100),
  active boolean NOT NULL DEFAULT true,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX f7_partners_name_key ON public.f7_partners (lower(btrim(name)));

CREATE TABLE public.f7_finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('ingreso', 'gasto')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX f7_finance_categories_name_key ON public.f7_finance_categories (kind, lower(btrim(name)));

INSERT INTO public.f7_finance_categories (kind, name, sort_order) VALUES
  ('ingreso', 'Suscripciones', 10),
  ('ingreso', 'Instalación y configuración', 20),
  ('ingreso', 'Capacitación', 30),
  ('ingreso', 'Otros ingresos', 90),
  ('gasto', 'Base de datos (Supabase)', 10),
  ('gasto', 'Hosting web (Vercel)', 20),
  ('gasto', 'Dominio', 30),
  ('gasto', 'Publicidad (Meta Ads)', 40),
  ('gasto', 'WhatsApp y mensajería', 50),
  ('gasto', 'Herramientas y software', 60),
  ('gasto', 'Sueldos y honorarios', 70),
  ('gasto', 'Contabilidad y trámites', 80),
  ('gasto', 'Impuestos', 85),
  ('gasto', 'Comisiones bancarias', 88),
  ('gasto', 'Equipos', 89),
  ('gasto', 'Otros gastos', 90);

CREATE TABLE public.f7_recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  category_id uuid NOT NULL REFERENCES public.f7_finance_categories(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'PYG' CHECK (currency IN ('PYG', 'USD')),
  fx_rate numeric(12,2) CHECK (fx_rate IS NULL OR fx_rate > 0),
  frequency text NOT NULL CHECK (frequency IN ('semanal', 'mensual', 'anual')),
  start_date date NOT NULL CHECK (start_date >= DATE '2020-01-01'),
  end_date date,
  default_partner_id uuid REFERENCES public.f7_partners(id) ON DELETE RESTRICT,
  payment_method text CHECK (payment_method IS NULL OR char_length(payment_method) <= 80),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT f7_recurring_fx_check CHECK ((currency = 'USD') = (fx_rate IS NOT NULL)),
  CONSTRAINT f7_recurring_dates_check CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE public.f7_finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('ingreso', 'gasto', 'aporte', 'reembolso', 'distribucion')),
  -- Pendiente: fecha de vencimiento. Pagado: fecha en que se cobró o pagó.
  entry_date date NOT NULL CHECK (entry_date >= DATE '2020-01-01'),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 200),
  category_id uuid REFERENCES public.f7_finance_categories(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'PYG' CHECK (currency IN ('PYG', 'USD')),
  -- Guaraníes por dólar del día (obligatorio en US$, vacío en Gs.).
  fx_rate numeric(12,2) CHECK (fx_rate IS NULL OR fx_rate > 0),
  amount_pyg numeric GENERATED ALWAYS AS (
    round(CASE WHEN currency = 'USD' THEN amount * fx_rate ELSE amount END)
  ) STORED,
  status text NOT NULL DEFAULT 'pagado' CHECK (status IN ('pagado', 'pendiente')),
  -- ingreso: NULL = cobrado en la caja de F7, si no, en la cuenta de ese socio.
  -- gasto: NULL = pagado desde la caja de F7, si no, adelantado por ese socio.
  -- aporte / reembolso / distribucion: el socio que pone o recibe (obligatorio).
  partner_id uuid REFERENCES public.f7_partners(id) ON DELETE RESTRICT,
  -- reembolso / distribucion: NULL = sale de la caja, si no, del bolsillo de este socio.
  via_partner_id uuid REFERENCES public.f7_partners(id) ON DELETE RESTRICT,
  payment_method text CHECK (payment_method IS NULL OR char_length(payment_method) <= 80),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  receipt_id uuid UNIQUE REFERENCES public.subscription_receipts(id) ON DELETE SET NULL,
  recurring_id uuid REFERENCES public.f7_recurring_expenses(id) ON DELETE RESTRICT,
  recurring_due date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz,
  voided_at timestamptz,
  voided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  void_reason text CHECK (void_reason IS NULL OR char_length(void_reason) <= 300),
  CONSTRAINT f7_entries_fx_check CHECK ((currency = 'USD') = (fx_rate IS NOT NULL)),
  CONSTRAINT f7_entries_category_check CHECK ((kind IN ('ingreso', 'gasto')) = (category_id IS NOT NULL)),
  CONSTRAINT f7_entries_status_check CHECK (kind IN ('ingreso', 'gasto') OR status = 'pagado'),
  CONSTRAINT f7_entries_partner_check CHECK (kind IN ('ingreso', 'gasto') OR partner_id IS NOT NULL),
  CONSTRAINT f7_entries_via_check CHECK (via_partner_id IS NULL OR kind IN ('reembolso', 'distribucion')),
  -- Reembolsarle a un socio con su propio bolsillo no mueve nada.
  CONSTRAINT f7_entries_via_reembolso_check CHECK (kind <> 'reembolso' OR via_partner_id IS DISTINCT FROM partner_id),
  CONSTRAINT f7_entries_receipt_check CHECK (receipt_id IS NULL OR kind = 'ingreso'),
  CONSTRAINT f7_entries_recurring_check CHECK (
    (recurring_id IS NULL) = (recurring_due IS NULL) AND (recurring_id IS NULL OR kind = 'gasto')
  ),
  CONSTRAINT f7_entries_void_check CHECK (
    (voided_at IS NULL AND void_reason IS NULL)
    OR (voided_at IS NOT NULL AND void_reason IS NOT NULL AND char_length(btrim(void_reason)) >= 1)
  ),
  -- Un vencimiento de un gasto fijo se genera una sola vez (aunque se anule).
  CONSTRAINT f7_entries_recurring_once UNIQUE (recurring_id, recurring_due)
);
CREATE INDEX f7_entries_date_idx ON public.f7_finance_entries (entry_date DESC);
CREATE INDEX f7_entries_partner_idx ON public.f7_finance_entries (partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX f7_entries_category_idx ON public.f7_finance_entries (category_id) WHERE category_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Seguridad: solo super admin. RLS activada y forzada, sin acceso para anon.
-- ---------------------------------------------------------------------------

ALTER TABLE public.f7_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f7_partners FORCE ROW LEVEL SECURITY;
ALTER TABLE public.f7_finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f7_finance_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.f7_recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f7_recurring_expenses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.f7_finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f7_finance_entries FORCE ROW LEVEL SECURITY;

-- Socios y categorías: se pueden borrar solo si nadie los usa (las claves foráneas lo exigen).
DROP POLICY IF EXISTS "F7 partners select super admin" ON public.f7_partners;
CREATE POLICY "F7 partners select super admin" ON public.f7_partners
FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "F7 partners insert super admin" ON public.f7_partners;
CREATE POLICY "F7 partners insert super admin" ON public.f7_partners
FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "F7 partners update super admin" ON public.f7_partners;
CREATE POLICY "F7 partners update super admin" ON public.f7_partners
FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "F7 partners delete super admin" ON public.f7_partners;
CREATE POLICY "F7 partners delete super admin" ON public.f7_partners
FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "F7 categories select super admin" ON public.f7_finance_categories;
CREATE POLICY "F7 categories select super admin" ON public.f7_finance_categories
FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "F7 categories insert super admin" ON public.f7_finance_categories;
CREATE POLICY "F7 categories insert super admin" ON public.f7_finance_categories
FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "F7 categories update super admin" ON public.f7_finance_categories;
CREATE POLICY "F7 categories update super admin" ON public.f7_finance_categories
FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "F7 categories delete super admin" ON public.f7_finance_categories;
CREATE POLICY "F7 categories delete super admin" ON public.f7_finance_categories
FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- Gastos fijos y movimientos: sin DELETE (se pausan / se anulan).
DROP POLICY IF EXISTS "F7 recurring select super admin" ON public.f7_recurring_expenses;
CREATE POLICY "F7 recurring select super admin" ON public.f7_recurring_expenses
FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "F7 recurring insert super admin" ON public.f7_recurring_expenses;
CREATE POLICY "F7 recurring insert super admin" ON public.f7_recurring_expenses
FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "F7 recurring update super admin" ON public.f7_recurring_expenses;
CREATE POLICY "F7 recurring update super admin" ON public.f7_recurring_expenses
FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "F7 entries select super admin" ON public.f7_finance_entries;
CREATE POLICY "F7 entries select super admin" ON public.f7_finance_entries
FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "F7 entries insert super admin" ON public.f7_finance_entries;
CREATE POLICY "F7 entries insert super admin" ON public.f7_finance_entries
FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "F7 entries update super admin" ON public.f7_finance_entries;
CREATE POLICY "F7 entries update super admin" ON public.f7_finance_entries
FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Se revoca también a `authenticated` para que los permisos queden exactos
-- (sin DELETE ni TRUNCATE en los libros), no los que dejen los privilegios por defecto.
REVOKE ALL ON public.f7_partners, public.f7_finance_categories, public.f7_recurring_expenses, public.f7_finance_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.f7_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.f7_finance_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.f7_recurring_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.f7_finance_entries TO authenticated;
GRANT ALL ON public.f7_partners, public.f7_finance_categories, public.f7_recurring_expenses, public.f7_finance_entries TO service_role;

-- ---------------------------------------------------------------------------
-- Guardián de los gastos fijos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.f7_recurring_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kind text;
  v_active boolean;
BEGIN
  SELECT kind INTO v_kind FROM public.f7_finance_categories WHERE id = NEW.category_id;
  IF v_kind IS DISTINCT FROM 'gasto' THEN
    RAISE EXCEPTION 'Un gasto fijo necesita una categoría de gasto';
  END IF;

  IF NEW.default_partner_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.default_partner_id IS DISTINCT FROM OLD.default_partner_id) THEN
    SELECT active INTO v_active FROM public.f7_partners WHERE id = NEW.default_partner_id;
    IF v_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'El socio elegido está inactivo';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_at := NULL;
    RETURN NEW;
  END IF;

  -- Sin sesión de usuario (service role, migraciones, borrado de perfiles): no se interviene.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (NEW.created_by IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL) THEN
    RAISE EXCEPTION 'Ese dato del gasto fijo no se puede cambiar';
  END IF;

  IF (NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.frequency IS DISTINCT FROM OLD.frequency)
     AND EXISTS (SELECT 1 FROM public.f7_finance_entries e WHERE e.recurring_id = OLD.id) THEN
    RAISE EXCEPTION 'Este gasto fijo ya generó movimientos: no se puede cambiar la frecuencia ni la fecha de inicio. Pausalo y creá uno nuevo';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.f7_recurring_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER f7_recurring_guard
BEFORE INSERT OR UPDATE ON public.f7_recurring_expenses
FOR EACH ROW EXECUTE FUNCTION public.f7_recurring_guard();

-- ---------------------------------------------------------------------------
-- Guardián de los movimientos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.f7_finance_entries_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Asuncion')::date;
  v_cat_kind text;
  v_active boolean;
  v_receipt_voided timestamptz;
BEGIN
  IF NEW.category_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.category_id IS DISTINCT FROM OLD.category_id) THEN
    SELECT kind INTO v_cat_kind FROM public.f7_finance_categories WHERE id = NEW.category_id;
    IF v_cat_kind IS DISTINCT FROM NEW.kind THEN
      RAISE EXCEPTION 'La categoría no corresponde al tipo de movimiento';
    END IF;
  END IF;

  IF NEW.partner_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.partner_id IS DISTINCT FROM OLD.partner_id) THEN
    SELECT active INTO v_active FROM public.f7_partners WHERE id = NEW.partner_id;
    IF v_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'El socio elegido está inactivo';
    END IF;
  END IF;

  IF NEW.via_partner_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.via_partner_id IS DISTINCT FROM OLD.via_partner_id) THEN
    SELECT active INTO v_active FROM public.f7_partners WHERE id = NEW.via_partner_id;
    IF v_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'El socio elegido está inactivo';
    END IF;
  END IF;

  IF NEW.status = 'pagado' AND NEW.entry_date > v_today THEN
    RAISE EXCEPTION 'La fecha de un movimiento pagado no puede ser futura';
  END IF;

  IF NEW.receipt_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.receipt_id IS DISTINCT FROM OLD.receipt_id) THEN
    SELECT voided_at INTO v_receipt_voided FROM public.subscription_receipts WHERE id = NEW.receipt_id;
    IF v_receipt_voided IS NOT NULL THEN
      RAISE EXCEPTION 'El recibo está anulado: no se puede registrar como ingreso';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := NULL;
    NEW.updated_at := NULL;
    NEW.voided_at := NULL;
    NEW.voided_by := NULL;
    NEW.void_reason := NULL;
    RETURN NEW;
  END IF;

  -- Sin sesión de usuario (service role, migraciones, borrado de perfiles): no se interviene.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.recurring_id IS DISTINCT FROM OLD.recurring_id
     OR NEW.recurring_due IS DISTINCT FROM OLD.recurring_due
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (NEW.created_by IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL) THEN
    RAISE EXCEPTION 'Ese dato de un movimiento no se puede cambiar';
  END IF;

  -- Anulado: no se toca nada (solo se toleran los NULL que dejan los perfiles borrados).
  IF OLD.voided_at IS NOT NULL THEN
    IF (to_jsonb(NEW) - 'created_by' - 'updated_by' - 'voided_by')
       IS DISTINCT FROM (to_jsonb(OLD) - 'created_by' - 'updated_by' - 'voided_by') THEN
      RAISE EXCEPTION 'Un movimiento anulado no se puede modificar';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.receipt_id IS NOT NULL THEN
    IF NEW.receipt_id IS DISTINCT FROM OLD.receipt_id THEN
      RAISE EXCEPTION 'El recibo vinculado no se puede cambiar';
    END IF;
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.fx_rate IS DISTINCT FROM OLD.fx_rate
       OR NEW.entry_date IS DISTINCT FROM OLD.entry_date THEN
      RAISE EXCEPTION 'Este ingreso viene de un recibo: el monto y la fecha no se cambian. Anulalo y volvé a importar el recibo';
    END IF;
  END IF;

  NEW.updated_by := auth.uid();
  NEW.updated_at := now();

  IF NEW.voided_at IS NOT NULL THEN
    IF NEW.void_reason IS NULL OR char_length(btrim(NEW.void_reason)) = 0 THEN
      RAISE EXCEPTION 'Para anular hace falta el motivo';
    END IF;
    NEW.void_reason := btrim(NEW.void_reason);
    NEW.voided_at := now();
    NEW.voided_by := auth.uid();
    -- Libera el recibo para poder registrarlo de nuevo si la anulación fue un error de carga.
    NEW.receipt_id := NULL;
  ELSE
    NEW.voided_by := NULL;
    NEW.void_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.f7_finance_entries_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER f7_finance_entries_guard
BEFORE INSERT OR UPDATE ON public.f7_finance_entries
FOR EACH ROW EXECUTE FUNCTION public.f7_finance_entries_guard();

-- Si se anula un recibo, se anula también el ingreso que se había registrado con él.
CREATE OR REPLACE FUNCTION public.f7_void_entry_on_receipt_void() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.f7_finance_entries
     SET voided_at = now(),
         void_reason = left('Recibo ' || COALESCE(NEW.receipt_number, '') || ' anulado', 300)
   WHERE receipt_id = NEW.id AND voided_at IS NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.f7_void_entry_on_receipt_void() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER f7_void_entry_on_receipt_void
AFTER UPDATE ON public.subscription_receipts
FOR EACH ROW WHEN (OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL)
EXECUTE FUNCTION public.f7_void_entry_on_receipt_void();

-- ---------------------------------------------------------------------------
-- Gastos fijos: vencimientos de una plantilla y generador
-- ---------------------------------------------------------------------------

-- Fechas de vencimiento desde `p_start` hasta `p_until` (y `p_end` si hay).
-- Mensual y anual caen en el mismo día del mes que el inicio; si el mes no
-- tiene ese día (29, 30 o 31) cae el último día del mes.
CREATE OR REPLACE FUNCTION public.f7_recurring_occurrences(
  p_frequency text, p_start date, p_end date, p_until date
) RETURNS TABLE (due date)
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT x.d AS due
    FROM generate_series(0, 599) AS n
   CROSS JOIN LATERAL (
     SELECT CASE
              WHEN p_frequency = 'semanal' THEN p_start + n * 7
              ELSE m.ms + LEAST(EXTRACT(day FROM p_start)::int, m.ms_next - m.ms) - 1
            END AS d
       FROM (
         SELECT (date_trunc('month', p_start::timestamp) + make_interval(months => n * s.step))::date AS ms,
                (date_trunc('month', p_start::timestamp) + make_interval(months => n * s.step + 1))::date AS ms_next
           FROM (SELECT CASE WHEN p_frequency = 'anual' THEN 12 ELSE 1 END AS step) s
       ) m
   ) x
   WHERE x.d <= p_until AND (p_end IS NULL OR x.d <= p_end)
   ORDER BY x.d
$$;

REVOKE ALL ON FUNCTION public.f7_recurring_occurrences(text, date, date, date) FROM PUBLIC, anon, authenticated;

-- Crea los vencimientos que falten (hasta 10 días adelante) como movimientos
-- pendientes. Es idempotente: un vencimiento ya generado (aunque se haya
-- anulado) no se vuelve a crear. Con `p_mark_past_paid` y una plantilla, los
-- vencimientos anteriores a hoy (los "atrasados") se crean directamente como
-- pagados; el de hoy queda pendiente.
CREATE OR REPLACE FUNCTION public.f7_generate_recurring(
  p_template_id uuid DEFAULT NULL,
  p_mark_past_paid boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Asuncion')::date;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.f7_finance_entries (
    kind, entry_date, description, category_id, amount, currency, fx_rate, status,
    partner_id, payment_method, notes, recurring_id, recurring_due
  )
  SELECT 'gasto', o.due, t.name, t.category_id, t.amount, t.currency, t.fx_rate,
         CASE WHEN p_mark_past_paid AND p_template_id IS NOT NULL AND o.due < v_today THEN 'pagado' ELSE 'pendiente' END,
         CASE WHEN pr.active THEN t.default_partner_id ELSE NULL END,
         t.payment_method, t.notes, t.id, o.due
    FROM public.f7_recurring_expenses t
    CROSS JOIN LATERAL public.f7_recurring_occurrences(t.frequency, t.start_date, t.end_date, v_today + 10) AS o
    LEFT JOIN public.f7_partners pr ON pr.id = t.default_partner_id
   WHERE t.active AND (p_template_id IS NULL OR t.id = p_template_id)
  ON CONFLICT (recurring_id, recurring_due) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.f7_generate_recurring(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f7_generate_recurring(uuid, boolean) TO authenticated;

COMMENT ON TABLE public.f7_finance_entries IS 'Libro de finanzas internas de F7 Manager (solo super admin). Se anula, no se borra.';
COMMENT ON TABLE public.f7_recurring_expenses IS 'Gastos fijos de F7: plantillas que generan vencimientos pendientes en f7_finance_entries.';
COMMENT ON TABLE public.f7_partners IS 'Socios de F7 Manager y su porcentaje de utilidad.';
COMMENT ON TABLE public.f7_finance_categories IS 'Categorías de ingreso y de gasto de las finanzas internas de F7.';
