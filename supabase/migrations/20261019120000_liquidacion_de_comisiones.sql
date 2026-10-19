-- Bloque 3 (B7): liquidación de comisiones.
--
-- Hasta ahora las comisiones solo se calculaban al vuelo en Reportes: nada
-- quedaba registrado, así que no había forma de saber qué período ya se le
-- pagó a cada técnico/vendedor. Esta tabla guarda una "liquidación" por
-- persona y período: lo atribuido, el porcentaje de ese momento y el monto.
--
-- Reglas (todas por trigger, no solo por la pantalla):
--  * Solo el administrador de la empresa lee o escribe.
--  * Solo se liquidan días ya cerrados (hasta ayer, hora de Paraguay): así lo
--    atribuido a esos días ya no puede cambiar por un cobro nuevo.
--  * Dos liquidaciones vigentes de la misma persona no pueden superponerse.
--  * Una liquidación no se edita ni se borra: solo se anula (queda el rastro).

CREATE TABLE public.commission_settlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Nombre al momento de liquidar: el historial sigue legible si la persona se va.
  user_name text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  base_amount numeric NOT NULL CHECK (base_amount >= 0),
  rate numeric NOT NULL CHECK (rate >= 0 AND rate <= 100),
  amount numeric NOT NULL CHECK (amount >= 0),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  voided_at timestamp with time zone,
  voided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT commission_settlements_period_check
    CHECK (period_to >= period_from AND period_to - period_from <= 366),
  CONSTRAINT commission_settlements_amount_matches_rate
    CHECK (abs(amount - base_amount * rate / 100) <= 1)
);

CREATE INDEX idx_commission_settlements_person
  ON public.commission_settlements (company_id, user_id, period_from);
CREATE INDEX idx_commission_settlements_company_created
  ON public.commission_settlements (company_id, created_at DESC);

ALTER TABLE public.commission_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_settlements FORCE ROW LEVEL SECURITY;

CREATE POLICY "Commission settlements select tenant admin" ON public.commission_settlements
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Commission settlements insert tenant admin" ON public.commission_settlements
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.is_company_active(company_id)
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Sin política de DELETE: no se borra. UPDATE solo existe para anular
-- (el trigger de abajo rechaza cualquier otro cambio).
CREATE POLICY "Commission settlements void tenant admin" ON public.commission_settlements
FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

REVOKE ALL ON public.commission_settlements FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.commission_settlements TO authenticated;
GRANT ALL ON public.commission_settlements TO service_role;

CREATE OR REPLACE FUNCTION public.commission_settlements_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Asuncion')::date;
  v_name text;
BEGIN
  -- Sin sesión de usuario (service role, migraciones, borrado de perfiles): no se interviene.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NULL THEN
      RAISE EXCEPTION 'Falta indicar a quién se le liquida';
    END IF;
    IF NEW.period_to >= v_today THEN
      RAISE EXCEPTION 'Solo se pueden liquidar días ya cerrados (hasta ayer)';
    END IF;

    SELECT full_name INTO v_name
    FROM public.profiles
    WHERE id = NEW.user_id AND company_id = NEW.company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Esa persona no pertenece a esta empresa';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.commission_settlements s
      WHERE s.company_id = NEW.company_id
        AND s.user_id = NEW.user_id
        AND s.voided_at IS NULL
        AND daterange(s.period_from, s.period_to, '[]') && daterange(NEW.period_from, NEW.period_to, '[]')
    ) THEN
      RAISE EXCEPTION 'Esa persona ya tiene una liquidación que se superpone con ese período';
    END IF;

    NEW.user_name := COALESCE(NULLIF(btrim(v_name), ''), NULLIF(btrim(NEW.user_name), ''), 'Usuario');
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.voided_at := NULL;
    NEW.voided_by := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: lo único que cambia es la anulación (y que un perfil borrado quede en NULL).
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.user_name IS DISTINCT FROM OLD.user_name
     OR NEW.period_from IS DISTINCT FROM OLD.period_from
     OR NEW.period_to IS DISTINCT FROM OLD.period_to
     OR NEW.base_amount IS DISTINCT FROM OLD.base_amount
     OR NEW.rate IS DISTINCT FROM OLD.rate
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL)
     OR (NEW.created_by IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Una liquidación no se puede editar: solo se puede anular';
  END IF;

  IF OLD.voided_at IS NOT NULL THEN
    IF NEW.voided_at IS DISTINCT FROM OLD.voided_at
       OR (NEW.voided_by IS DISTINCT FROM OLD.voided_by AND NEW.voided_by IS NOT NULL) THEN
      RAISE EXCEPTION 'Esta liquidación ya estaba anulada';
    END IF;
  ELSIF NEW.voided_at IS NOT NULL THEN
    NEW.voided_at := now();
    NEW.voided_by := auth.uid();
  ELSE
    NEW.voided_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.commission_settlements_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER commission_settlements_guard
BEFORE INSERT OR UPDATE ON public.commission_settlements
FOR EACH ROW EXECUTE FUNCTION public.commission_settlements_guard();
