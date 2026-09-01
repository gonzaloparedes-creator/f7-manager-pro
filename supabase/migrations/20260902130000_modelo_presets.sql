-- Modelo pasa de texto libre a lista configurable, igual que Marca y
-- Equipo (mismo pedido del usuario: "quiero que el campo modelo pueda
-- también cargar opciones para seleccionar al igual que equipo y marca").
-- Es una lista propia e independiente (no depende de qué Marca esté
-- seleccionada) — mismo patrón chip+"Otro" que Marca ya usa.
--
-- Sin sembrado por defecto, igual que marca_presets: los modelos son
-- 100% específicos de cada rubro, cada empresa arma la suya.

CREATE TABLE public.modelo_presets (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  company_id uuid NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (company_id, label)
);

CREATE INDEX idx_modelo_presets_company ON public.modelo_presets USING btree (company_id);

ALTER TABLE public.modelo_presets ENABLE ROW LEVEL SECURITY;

-- Mismo patrón exacto que marca_presets (20260902120000).
CREATE POLICY "Modelo presets select same company" ON public.modelo_presets FOR SELECT TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));
CREATE POLICY "Modelo presets insert admin same company" ON public.modelo_presets FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role) AND public.is_company_active(company_id))));
CREATE POLICY "Modelo presets update admin same company" ON public.modelo_presets FOR UPDATE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));
CREATE POLICY "Modelo presets delete admin same company" ON public.modelo_presets FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));

GRANT ALL ON TABLE public.modelo_presets TO anon;
GRANT ALL ON TABLE public.modelo_presets TO authenticated;
GRANT ALL ON TABLE public.modelo_presets TO service_role;
