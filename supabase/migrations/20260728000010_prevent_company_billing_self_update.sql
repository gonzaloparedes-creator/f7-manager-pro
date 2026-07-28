-- Fase 0 (auditoría 2026-07-28): la política "Admins update own company" solo
-- restringe QUÉ FILA puede tocar un admin (la suya), no QUÉ COLUMNAS. Como no
-- tiene un WITH CHECK propio, Postgres reutiliza el USING como check, que
-- tampoco limita columnas. Resultado: cualquier admin autenticado puede
-- ejecutar `update({ plan_type: 'pro', is_active: true })` sobre su propia
-- empresa desde la consola del navegador y saltarse el paywall o revertir una
-- suspensión — exactamente el mismo patrón que profiles_prevent_super_admin_escalation
-- ya bloquea para is_super_admin, pero nunca se replicó para billing.
--
-- MasterAdmin.tsx sigue funcionando: is_super_admin(auth.uid()) queda exento.

CREATE FUNCTION public.prevent_company_billing_self_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.plan_type IS DISTINCT FROM OLD.plan_type
      OR NEW.is_active IS DISTINCT FROM OLD.is_active)
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo un super admin puede modificar el plan o el estado de la empresa';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER companies_prevent_billing_self_update
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.prevent_company_billing_self_update();
