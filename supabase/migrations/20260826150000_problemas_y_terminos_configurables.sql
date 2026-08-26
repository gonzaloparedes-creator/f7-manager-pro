-- "Problemas detectados" configurables por empresa (antes: PROBLEM_OPTIONS
-- hardcodeado en src/lib/orders.ts, igual para todas las empresas). Mismo
-- patrón exacto que accessory_presets/checklist_presets
-- (20260824020000_accesorios_y_checklist_configurables.sql).

CREATE TABLE public.problem_presets (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  company_id uuid NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_problem_presets_company ON public.problem_presets USING btree (company_id);

ALTER TABLE public.problem_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Problem presets select same company" ON public.problem_presets FOR SELECT TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));
CREATE POLICY "Problem presets insert admin same company" ON public.problem_presets FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role) AND public.is_company_active(company_id))));
CREATE POLICY "Problem presets update admin same company" ON public.problem_presets FOR UPDATE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));
CREATE POLICY "Problem presets delete admin same company" ON public.problem_presets FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));

GRANT ALL ON TABLE public.problem_presets TO anon;
GRANT ALL ON TABLE public.problem_presets TO authenticated;
GRANT ALL ON TABLE public.problem_presets TO service_role;

-- Se extiende el trigger de siembra que ya corre AFTER INSERT ON companies
-- (no hace falta un trigger nuevo, ya está enganchado).
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
  RETURN NEW;
END;
$$;

-- Empresas que ya existen: mismo default, una sola vez.
INSERT INTO public.problem_presets (company_id, label)
SELECT c.id, v.label
FROM public.companies c
CROSS JOIN (VALUES
  ('Display'), ('Glass'), ('Batería'), ('Face ID'), ('No enciende'),
  ('No carga'), ('Mojado'), ('Sin señal'), ('WiFi / Bluetooth'), ('Cámaras'),
  ('Audio'), ('Tapa'), ('Watch'), ('Flex'), ('Otro')
) AS v(label);

-- Términos del servicio personalizables por empresa. NULL = usar el texto
-- por defecto (DEFAULT_SERVICE_TERMS en src/lib/orders.ts), que a partir de
-- ahora usa el placeholder {{garantia_dias}} en vez de "30 (treinta) días"
-- fijo, para reflejar la garantía real elegida en cada orden.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS service_terms_template text;
