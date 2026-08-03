-- Panel de Fundadores: hoy no hay forma de aislar qué empresas son parte
-- del Programa Fundadores (quedan mezcladas con cualquier otra empresa), ni
-- de distinguir "tiene acceso a Business" (plan_type) de "está pagando de
-- verdad" — son cosas distintas mientras dure el trial gratis de 60 días.
--
-- founder_cohort: marca manual (super admin) de que la empresa entró al
-- programa. founder_cohort_at: cuándo se la marcó, para poder ordenar/
-- filtrar por antigüedad en el programa (el conteo real de los 60 días no
-- sale de acá, sale de la actividad real de la empresa — ver Panel).
-- is_paying: si ya confirmó el pago (mensual o anual) al cierre del
-- programa. Nada de esto se lee para dar o quitar funciones — es
-- puramente informativo para el seguimiento del lanzamiento.

ALTER TABLE public.companies
  ADD COLUMN founder_cohort boolean NOT NULL DEFAULT false,
  ADD COLUMN founder_cohort_at timestamptz,
  ADD COLUMN is_paying boolean NOT NULL DEFAULT false;

CREATE INDEX idx_companies_founder_cohort ON public.companies(founder_cohort) WHERE founder_cohort;

-- Mismo criterio que plan_type/is_active (Fase 0, companies_prevent_billing_self_update):
-- son campos operativos del dueño de la plataforma, no algo que una empresa
-- deba poder tocar sobre sí misma vía la política "Admins update own company".
CREATE OR REPLACE FUNCTION public.prevent_company_billing_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.plan_type IS DISTINCT FROM OLD.plan_type
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
      OR NEW.founder_cohort IS DISTINCT FROM OLD.founder_cohort
      OR NEW.founder_cohort_at IS DISTINCT FROM OLD.founder_cohort_at
      OR NEW.is_paying IS DISTINCT FROM OLD.is_paying)
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo un super admin puede modificar el plan, el estado o los datos del programa de fundadores';
  END IF;
  RETURN NEW;
END;
$$;
