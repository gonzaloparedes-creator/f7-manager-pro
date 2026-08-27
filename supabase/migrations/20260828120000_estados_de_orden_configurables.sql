-- Estados de orden configurables por empresa. A diferencia de
-- accessory_presets/problem_presets (etiquetas sueltas), acá "key" es el
-- valor real que se guarda en orders.status y varias claves tienen lógica
-- enganchada (ver comentarios abajo) — por eso 'recibido' y 'entregado'
-- quedan bloqueados (is_locked): no se pueden borrar ni cambiar de key,
-- solo renombrar el label.

CREATE TABLE public.order_status_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, key)
);

CREATE INDEX idx_order_status_presets_company ON public.order_status_presets (company_id, sort_order);

ALTER TABLE public.order_status_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order status presets select same company" ON public.order_status_presets FOR SELECT TO authenticated
  USING ((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Order status presets insert admin same company" ON public.order_status_presets FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR (
    company_id = public.get_user_company(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
    AND public.is_company_active(company_id)
  ));

CREATE POLICY "Order status presets update admin same company" ON public.order_status_presets FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (
    company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role)
  ))
  WITH CHECK (public.is_super_admin(auth.uid()) OR (
    company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role)
  ));

-- Nunca se puede borrar un preset bloqueado (recibido/entregado), ni
-- siquiera saltando la UI — se exige acá, no solo en el frontend.
CREATE POLICY "Order status presets delete admin same company not locked" ON public.order_status_presets FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (
    company_id = public.get_user_company(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
    AND is_locked = false
  ));

GRANT ALL ON TABLE public.order_status_presets TO anon;
GRANT ALL ON TABLE public.order_status_presets TO authenticated;
GRANT ALL ON TABLE public.order_status_presets TO service_role;

-- Un preset bloqueado no puede perder su key ni desbloquearse vía UPDATE
-- directo (que sería la puerta trasera para después borrarlo). Mismo patrón
-- que prevent_company_billing_self_update / prevent_super_admin_self_escalation.
CREATE OR REPLACE FUNCTION public.prevent_locked_status_tampering() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.is_locked AND (NEW.key IS DISTINCT FROM OLD.key OR NEW.is_locked IS DISTINCT FROM OLD.is_locked) THEN
    RAISE EXCEPTION 'No se puede cambiar la clave ni desbloquear un estado protegido';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_locked_status_tampering
  BEFORE UPDATE ON public.order_status_presets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_status_tampering();

-- Se extiende (otra vez) el trigger de siembra que ya corre AFTER INSERT ON
-- companies (accesorios, checklist, problemas) para que además siembre los
-- 6 estados por defecto.
CREATE OR REPLACE FUNCTION public.seed_accessory_and_checklist_presets_for_company() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.accessory_presets (company_id, label) VALUES
    (NEW.id, 'SIM Card'),
    (NEW.id, 'Micro SD'),
    (NEW.id, 'eSIM'),
    (NEW.id, 'Funda/Carcasa');
  INSERT INTO public.checklist_presets (company_id, label) VALUES
    (NEW.id, 'Enciende y carga'),
    (NEW.id, 'Pantalla sin daños visibles'),
    (NEW.id, 'Táctil responde correctamente'),
    (NEW.id, 'Cámaras funcionan'),
    (NEW.id, 'Botones físicos funcionan'),
    (NEW.id, 'Altavoz y micrófono funcionan');
  INSERT INTO public.problem_presets (company_id, label) VALUES
    (NEW.id, 'Display'),
    (NEW.id, 'Glass'),
    (NEW.id, 'Batería'),
    (NEW.id, 'Face ID'),
    (NEW.id, 'No enciende'),
    (NEW.id, 'No carga'),
    (NEW.id, 'Mojado'),
    (NEW.id, 'Sin señal'),
    (NEW.id, 'WiFi / Bluetooth'),
    (NEW.id, 'Cámaras'),
    (NEW.id, 'Audio'),
    (NEW.id, 'Tapa'),
    (NEW.id, 'Watch'),
    (NEW.id, 'Flex'),
    (NEW.id, 'Otro');
  INSERT INTO public.order_status_presets (company_id, key, label, sort_order, is_locked) VALUES
    (NEW.id, 'recibido', 'Recibido', 1, true),
    (NEW.id, 'en_diagnostico', 'En diagnóstico', 2, false),
    (NEW.id, 'en_reparacion', 'En reparación', 3, false),
    (NEW.id, 'listo', 'Listo para retirar', 4, false),
    (NEW.id, 'entregado', 'Entregado', 5, true),
    (NEW.id, 'garantia', 'Garantía', 6, false);
  RETURN NEW;
END;
$$;

-- Empresas que ya existen: mismo default, una sola vez.
INSERT INTO public.order_status_presets (company_id, key, label, sort_order, is_locked)
SELECT c.id, v.key, v.label, v.sort_order, v.is_locked
FROM public.companies c
CROSS JOIN (VALUES
  ('recibido', 'Recibido', 1, true),
  ('en_diagnostico', 'En diagnóstico', 2, false),
  ('en_reparacion', 'En reparación', 3, false),
  ('listo', 'Listo para retirar', 4, false),
  ('entregado', 'Entregado', 5, true),
  ('garantia', 'Garantía', 6, false)
) AS v(key, label, sort_order, is_locked);

-- Snapshot del label vigente al momento del cambio de estado (igual patrón
-- que order_parts.category_name/historical_cost) — filas viejas quedan NULL
-- y el frontend cae al label por defecto.
ALTER TABLE public.order_status_history
  ADD COLUMN IF NOT EXISTS status_label text;

-- Se reconstruyen las 4 RPC públicas de tracking para exponer status_label
-- (mismo checklist de siempre: re-declarar GRANT EXECUTE explícitamente,
-- el DROP los borra).

DROP FUNCTION IF EXISTS public.get_history_by_code(text);
CREATE FUNCTION public.get_history_by_code(_code text) RETURNS TABLE(
  id uuid, status text, note text, created_at timestamp with time zone, image_urls text[], status_label text
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT h.id, h.status, h.note, h.created_at, h.image_urls, COALESCE(h.status_label, h.status)
  FROM public.order_status_history h
  WHERE h.order_id = (SELECT o.id FROM public.get_order_by_code(_code) o)
    AND h.is_internal = false
  ORDER BY h.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_history_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_history_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_history_by_code(text) TO service_role;

DROP FUNCTION IF EXISTS public.get_order_history_by_tracking(uuid);
CREATE FUNCTION public.get_order_history_by_tracking(_token uuid) RETURNS TABLE(
  id uuid, status text, note text, created_at timestamp with time zone, image_urls text[], status_label text
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT h.id, h.status, h.note, h.created_at, h.image_urls, COALESCE(h.status_label, h.status)
  FROM public.order_status_history h
  JOIN public.orders o ON o.id = h.order_id
  WHERE o.tracking_token = _token
    AND h.is_internal = false
  ORDER BY h.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_history_by_tracking(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_history_by_tracking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_history_by_tracking(uuid) TO service_role;

DROP FUNCTION IF EXISTS public.get_order_by_code(text);
CREATE FUNCTION public.get_order_by_code(_code text) RETURNS TABLE(
  id uuid, order_number text, device_type text, status text, technician_notes text,
  estimated_delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone,
  quote_amount bigint, deposit_amount bigint, cargos_adicionales jsonb,
  problems text[], problem_other text, problem_description text,
  accessories text[], checklist jsonb,
  quote_response text, quote_response_note text, quote_responded_at timestamptz,
  company_name text, company_logo_url text, status_label text
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT o.id, o.order_number, o.device_type, o.status, o.technician_notes,
         o.estimated_delivery_date, o.created_at, o.updated_at,
         o.quote_amount, o.deposit_amount, o.cargos_adicionales,
         o.problems, o.problem_other, o.problem_description,
         o.accessories, o.checklist,
         o.quote_response, o.quote_response_note, o.quote_responded_at,
         c.name AS company_name, c.logo_url AS company_logo_url,
         COALESCE(sp.label, o.status) AS status_label
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  LEFT JOIN public.order_status_presets sp ON sp.company_id = o.company_id AND sp.key = o.status
  WHERE upper(o.order_number) = upper(_code)
  ORDER BY o.created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_code(text) TO service_role;

DROP FUNCTION IF EXISTS public.get_order_by_tracking(uuid);
CREATE FUNCTION public.get_order_by_tracking(_token uuid) RETURNS TABLE(
  id uuid, order_number text, device_type text, status text, technician_notes text,
  estimated_delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone,
  quote_amount bigint, deposit_amount bigint, cargos_adicionales jsonb,
  problems text[], problem_other text, problem_description text,
  accessories text[], checklist jsonb,
  quote_response text, quote_response_note text, quote_responded_at timestamptz,
  company_name text, company_logo_url text, status_label text
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT o.id, o.order_number, o.device_type, o.status, o.technician_notes,
         o.estimated_delivery_date, o.created_at, o.updated_at,
         o.quote_amount, o.deposit_amount, o.cargos_adicionales,
         o.problems, o.problem_other, o.problem_description,
         o.accessories, o.checklist,
         o.quote_response, o.quote_response_note, o.quote_responded_at,
         c.name AS company_name, c.logo_url AS company_logo_url,
         COALESCE(sp.label, o.status) AS status_label
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  LEFT JOIN public.order_status_presets sp ON sp.company_id = o.company_id AND sp.key = o.status
  WHERE o.tracking_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO service_role;
