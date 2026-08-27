-- "Equipo" configurable por empresa: por defecto sigue siendo texto libre
-- (como hoy), pero un taller que solo recepciona un puñado de tipos de
-- equipo puede activar "modo selección" en Configuración y cargar con un
-- clic en vez de escribir a mano cada vez. El campo orders.device_type no
-- cambia (sigue siendo texto libre en la tabla): los presets solo alimentan
-- la UI de carga, así que no hace falta tocar ninguna RPC de tracking.
-- Mismo patrón exacto que problem_presets
-- (20260826150000_problemas_y_terminos_configurables.sql).

CREATE TABLE public.device_type_presets (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  company_id uuid NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_device_type_presets_company ON public.device_type_presets USING btree (company_id);

ALTER TABLE public.device_type_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Device type presets select same company" ON public.device_type_presets FOR SELECT TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));
CREATE POLICY "Device type presets insert admin same company" ON public.device_type_presets FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role) AND public.is_company_active(company_id))));
CREATE POLICY "Device type presets update admin same company" ON public.device_type_presets FOR UPDATE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));
CREATE POLICY "Device type presets delete admin same company" ON public.device_type_presets FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));

GRANT ALL ON TABLE public.device_type_presets TO anon;
GRANT ALL ON TABLE public.device_type_presets TO authenticated;
GRANT ALL ON TABLE public.device_type_presets TO service_role;

-- "Modo selección" está apagado por defecto: el campo Equipo sigue siendo
-- texto libre hasta que el admin lo prenda a propósito en Configuración.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS use_device_type_presets boolean NOT NULL DEFAULT false;

-- Se extiende (otra vez) el trigger de siembra que ya corre AFTER INSERT ON
-- companies — no hace falta un trigger nuevo, ya está enganchado. OJO: acá
-- se recrea la función completa, no solo el INSERT nuevo, porque
-- CREATE OR REPLACE reemplaza el body entero.
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
  INSERT INTO public.device_type_presets (company_id, label) VALUES
    (NEW.id, 'Celular'),
    (NEW.id, 'Tablet'),
    (NEW.id, 'Notebook / Laptop'),
    (NEW.id, 'Smartwatch'),
    (NEW.id, 'Otro');
  RETURN NEW;
END;
$$;

-- Empresas que ya existen: mismo default, una sola vez. El modo sigue en
-- texto libre para todas hasta que un admin lo active manualmente.
INSERT INTO public.device_type_presets (company_id, label)
SELECT c.id, v.label
FROM public.companies c
CROSS JOIN (VALUES
  ('Celular'), ('Tablet'), ('Notebook / Laptop'), ('Smartwatch'), ('Otro')
) AS v(label);
