-- Clasificación de equipo por Marca y Modelo, además de "Equipo"
-- (device_type). Apagado por defecto: orders.marca/modelo son columnas
-- libres que solo se completan si la empresa activa
-- use_device_classification desde Configuración. Marca es una lista
-- configurable (como device_type_presets) para que el reporte agrupe
-- nombres consistentes; Modelo queda como texto libre a propósito, los
-- modelos son casi infinitos y no tiene sentido armar una lista para eso.
--
-- A diferencia de device_type_presets, acá NO se siembra nada por defecto
-- (ni se toca seed_accessory_and_checklist_presets_for_company): las marcas
-- son 100% específicas de cada rubro (celulares vs notebooks vs lo que
-- sea), no hay una lista universal razonable. Cada empresa arma la suya.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS marca text,
  ADD COLUMN IF NOT EXISTS modelo text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS use_device_classification boolean NOT NULL DEFAULT false;

CREATE TABLE public.marca_presets (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  company_id uuid NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (company_id, label)
);

CREATE INDEX idx_marca_presets_company ON public.marca_presets USING btree (company_id);

ALTER TABLE public.marca_presets ENABLE ROW LEVEL SECURITY;

-- Mismo patrón exacto que device_type_presets (20260829120000).
CREATE POLICY "Marca presets select same company" ON public.marca_presets FOR SELECT TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));
CREATE POLICY "Marca presets insert admin same company" ON public.marca_presets FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role) AND public.is_company_active(company_id))));
CREATE POLICY "Marca presets update admin same company" ON public.marca_presets FOR UPDATE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));
CREATE POLICY "Marca presets delete admin same company" ON public.marca_presets FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));

GRANT ALL ON TABLE public.marca_presets TO anon;
GRANT ALL ON TABLE public.marca_presets TO authenticated;
GRANT ALL ON TABLE public.marca_presets TO service_role;
