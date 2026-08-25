-- Accesorios y Checklist de recepción configurables por empresa (antes:
-- 4 checkboxes fijos de accesorios en el código, sin checklist alguno).
-- Mismo patrón que warranty_presets: tabla de presets por empresa +
-- trigger que la siembra sola cuando se crea una empresa nueva.

CREATE TABLE public.accessory_presets (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  company_id uuid NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.checklist_presets (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  company_id uuid NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_accessory_presets_company ON public.accessory_presets USING btree (company_id);
CREATE INDEX idx_checklist_presets_company ON public.checklist_presets USING btree (company_id);

ALTER TABLE public.accessory_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accessory presets select same company" ON public.accessory_presets FOR SELECT TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));
CREATE POLICY "Accessory presets insert admin same company" ON public.accessory_presets FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role) AND public.is_company_active(company_id))));
CREATE POLICY "Accessory presets update admin same company" ON public.accessory_presets FOR UPDATE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));
CREATE POLICY "Accessory presets delete admin same company" ON public.accessory_presets FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));

CREATE POLICY "Checklist presets select same company" ON public.checklist_presets FOR SELECT TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));
CREATE POLICY "Checklist presets insert admin same company" ON public.checklist_presets FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role) AND public.is_company_active(company_id))));
CREATE POLICY "Checklist presets update admin same company" ON public.checklist_presets FOR UPDATE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));
CREATE POLICY "Checklist presets delete admin same company" ON public.checklist_presets FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));

GRANT ALL ON TABLE public.accessory_presets TO anon;
GRANT ALL ON TABLE public.accessory_presets TO authenticated;
GRANT ALL ON TABLE public.accessory_presets TO service_role;
GRANT ALL ON TABLE public.checklist_presets TO anon;
GRANT ALL ON TABLE public.checklist_presets TO authenticated;
GRANT ALL ON TABLE public.checklist_presets TO service_role;

CREATE FUNCTION public.seed_accessory_and_checklist_presets_for_company() RETURNS trigger
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
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_accessory_and_checklist_presets_for_company() FROM PUBLIC;
GRANT ALL ON FUNCTION public.seed_accessory_and_checklist_presets_for_company() TO service_role;

CREATE TRIGGER trg_seed_accessory_checklist_presets AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_accessory_and_checklist_presets_for_company();

-- Empresas que ya existen: mismo default, una sola vez (el trigger de
-- arriba solo corre para empresas creadas de acá en más).
INSERT INTO public.accessory_presets (company_id, label)
SELECT c.id, v.label
FROM public.companies c
CROSS JOIN (VALUES ('SIM Card'), ('Micro SD'), ('eSIM'), ('Funda/Carcasa')) AS v(label);

INSERT INTO public.checklist_presets (company_id, label)
SELECT c.id, v.label
FROM public.companies c
CROSS JOIN (VALUES
  ('Enciende y carga'),
  ('Pantalla sin daños visibles'),
  ('Táctil responde correctamente'),
  ('Cámaras funcionan'),
  ('Botones físicos funcionan'),
  ('Altavoz y micrófono funcionan')
) AS v(label);

-- Snapshot por orden: accesorios entregados (lista de labels, igual que
-- problems text[]) y hallazgos del checklist de recepción
-- ([{label, status: "ok"|"fail"}]). No son referencias en vivo a los
-- presets: si la empresa edita/borra un preset después, las órdenes ya
-- creadas conservan lo que se marcó en su momento.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accessories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]';

UPDATE public.orders
SET accessories = array_remove(ARRAY[
  CASE WHEN has_sim THEN 'SIM Card' END,
  CASE WHEN has_sd THEN 'Micro SD' END,
  CASE WHEN has_esim THEN 'eSIM' END,
  CASE WHEN has_case THEN 'Funda/Carcasa' END
], NULL)
WHERE has_sim OR has_sd OR has_esim OR has_case;
