-- WhatsApp seguro (Bloque 0): el envío pasa de Evolution API/Baileys
-- (conexión no oficial por QR, con riesgo de baneo del número del taller) a
-- un flujo semiautomático — F7 arma el mensaje y el empleado lo abre en
-- WhatsApp con un toque (wa.me). Esta migración agrega lo que ese flujo
-- necesita; no toca nada de Evolution (las columnas y funciones viejas
-- siguen funcionando hasta el apagado, para las empresas que todavía
-- tienen WhatsApp conectado).

-- 1. Registro de lo que se hizo con cada mensaje sugerido. Es honesto a
-- propósito: "opened" significa que se abrió WhatsApp con el texto
-- cargado, NO que el cliente lo recibió — F7 ya no puede saberlo.
-- Append-only (igual que order_payments / cash_closings): sirve de
-- historial y para calcular la cola de "mensajes pendientes".
CREATE TABLE public.customer_message_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('opened', 'copied', 'dismissed')),
  phone text,
  message text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_message_log_company_order
  ON public.customer_message_log (company_id, order_id, created_at DESC);
CREATE INDEX idx_customer_message_log_company_created
  ON public.customer_message_log (company_id, created_at DESC);

ALTER TABLE public.customer_message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_message_log FORCE ROW LEVEL SECURITY;

CREATE POLICY "Message log select same company" ON public.customer_message_log
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR company_id = public.get_user_company(auth.uid())
);

-- El EXISTS sobre orders respeta el RLS de quien inserta (un encargado
-- restringido a su sucursal no puede registrar mensajes de una orden que
-- no ve).
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
);

CREATE POLICY "Message log no update" ON public.customer_message_log
AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "Message log no delete" ON public.customer_message_log
AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

GRANT SELECT, INSERT ON public.customer_message_log TO authenticated;

-- 2. Textos personalizados por empresa para cada evento (orden creada,
-- presupuesto, etc.). Los textos por defecto viven en el código; acá solo
-- se guardan los que el admin editó. Los mensajes de cambio de estado
-- siguen en order_status_presets.message_template.
CREATE TABLE public.whatsapp_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 1500),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (company_id, event_key)
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY "WhatsApp templates select same company" ON public.whatsapp_templates
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR company_id = public.get_user_company(auth.uid())
);

CREATE POLICY "WhatsApp templates insert admin" ON public.whatsapp_templates
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND public.is_company_active(company_id)
);

CREATE POLICY "WhatsApp templates update admin" ON public.whatsapp_templates
FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND public.is_company_active(company_id)
);

CREATE POLICY "WhatsApp templates delete admin" ON public.whatsapp_templates
FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Branch restricted no templates insert" ON public.whatsapp_templates
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT (SELECT public.is_branch_restricted(auth.uid())));

CREATE POLICY "Branch restricted no templates update" ON public.whatsapp_templates
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (NOT (SELECT public.is_branch_restricted(auth.uid())))
WITH CHECK (NOT (SELECT public.is_branch_restricted(auth.uid())));

CREATE POLICY "Branch restricted no templates delete" ON public.whatsapp_templates
AS RESTRICTIVE FOR DELETE TO authenticated
USING (NOT (SELECT public.is_branch_restricted(auth.uid())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;

-- 3. Preferencias de "sugerirme avisar" a nivel EMPRESA. Hasta ahora vivían
-- en profiles.notification_preferences (del usuario que conectó el QR, que
-- ya no existe en el flujo nuevo). Se copian de ahí para que cada empresa
-- conserve lo que ya tenía configurado.
ALTER TABLE public.companies
  ADD COLUMN whatsapp_notify_prefs jsonb NOT NULL
    DEFAULT '{"orden_creada": true, "recibido": true, "en_diagnostico": false, "en_reparacion": false, "listo": true, "enviado": true, "entregado": false}'::jsonb,
  ADD COLUMN whatsapp_queue_since timestamp with time zone NOT NULL DEFAULT now();

UPDATE public.companies c
SET whatsapp_notify_prefs = c.whatsapp_notify_prefs || p.notification_preferences
FROM (
  SELECT DISTINCT ON (company_id) company_id, notification_preferences
  FROM public.profiles
  WHERE company_id IS NOT NULL
    AND notification_preferences IS NOT NULL
    AND jsonb_typeof(notification_preferences) = 'object'
  ORDER BY company_id, whatsapp_connected DESC, created_at ASC
) p
WHERE p.company_id = c.id;

-- 4. whatsapp_queue_since marca desde cuándo la cola de "mensajes
-- pendientes" cuenta eventos. Mientras una empresa tiene Evolution
-- conectado, el servidor avisa solo y no hay nada pendiente; cuando se
-- desconecta (a mano o porque se cayó la sesión) arranca la cola desde
-- ese momento, así no aparece de golpe todo lo que Evolution ya mandó.
CREATE FUNCTION public.bump_whatsapp_queue_since()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE company_id = NEW.company_id AND whatsapp_connected = true
  ) THEN
    UPDATE public.companies
    SET whatsapp_queue_since = now()
    WHERE id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_bump_whatsapp_queue_since
AFTER UPDATE OF whatsapp_connected ON public.profiles
FOR EACH ROW
WHEN (OLD.whatsapp_connected = true AND NEW.whatsapp_connected = false)
EXECUTE FUNCTION public.bump_whatsapp_queue_since();
