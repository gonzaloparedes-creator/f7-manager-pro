-- Métodos de pago de la seña/saldo configurables por empresa (antes: 3
-- chips fijos en el código — Efectivo, Transferencia, Otro — sin tarjeta de
-- débito/crédito ni forma de agregar los propios). Mismo patrón que
-- accessory_presets/checklist_presets: tabla por empresa + seed automático.

CREATE TABLE public.payment_method_presets (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  company_id uuid NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_payment_method_presets_company ON public.payment_method_presets USING btree (company_id);

ALTER TABLE public.payment_method_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payment method presets select same company" ON public.payment_method_presets FOR SELECT TO authenticated USING (((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid())));
CREATE POLICY "Payment method presets insert admin same company" ON public.payment_method_presets FOR INSERT TO authenticated WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role) AND public.is_company_active(company_id))));
CREATE POLICY "Payment method presets update admin same company" ON public.payment_method_presets FOR UPDATE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));
CREATE POLICY "Payment method presets delete admin same company" ON public.payment_method_presets FOR DELETE TO authenticated USING ((public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role))));

GRANT ALL ON TABLE public.payment_method_presets TO anon;
GRANT ALL ON TABLE public.payment_method_presets TO authenticated;
GRANT ALL ON TABLE public.payment_method_presets TO service_role;

-- Se extiende la misma función de seed que ya crea accesorios/checklist/
-- problemas/tipos de equipo/estados para una empresa nueva (ver
-- 20260830120000_estado_enviado_y_fix_seed.sql para el body previo).
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
  INSERT INTO public.order_status_presets (company_id, key, label, sort_order, is_locked) VALUES
    (NEW.id, 'recibido', 'Recibido', 1, true),
    (NEW.id, 'en_diagnostico', 'En diagnóstico', 2, false),
    (NEW.id, 'en_reparacion', 'En reparación', 3, false),
    (NEW.id, 'listo', 'Listo para retirar', 4, false),
    (NEW.id, 'enviado', 'Enviado', 5, false),
    (NEW.id, 'entregado', 'Entregado', 6, true),
    (NEW.id, 'garantia', 'Garantía', 7, false),
    (NEW.id, 'retirado_sin_reparar', 'Retirado sin reparar', 8, false);
  INSERT INTO public.payment_method_presets (company_id, label) VALUES
    (NEW.id, 'Efectivo'),
    (NEW.id, 'Transferencia'),
    (NEW.id, 'Tarjeta de débito'),
    (NEW.id, 'Tarjeta de crédito');
  RETURN NEW;
END;
$$;

-- Empresas ya existentes: mismo default.
INSERT INTO public.payment_method_presets (company_id, label)
SELECT c.id, v.label
FROM public.companies c
CROSS JOIN (VALUES ('Efectivo'), ('Transferencia'), ('Tarjeta de débito'), ('Tarjeta de crédito')) AS v(label);

-- "Retirado sin reparar": se agrega al final de la lista de estados de cada
-- empresa existente (después de lo que tengan como último, sea "Garantía"
-- u otro orden que ya hayan personalizado) — no hace falta correr todo lo
-- de después como sí hizo falta con "Enviado" (esa iba en el medio).
INSERT INTO public.order_status_presets (company_id, key, label, sort_order, is_locked)
SELECT c.id, 'retirado_sin_reparar', 'Retirado sin reparar', COALESCE(MAX(sp.sort_order), 0) + 1, false
FROM public.companies c
LEFT JOIN public.order_status_presets sp ON sp.company_id = c.id
GROUP BY c.id
ON CONFLICT (company_id, key) DO NOTHING;
