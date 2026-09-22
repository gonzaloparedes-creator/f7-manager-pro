-- Módulo de Gastos: categorías configurables por empresa (mismo patrón que
-- payment_method_presets), el gasto en sí (con soporte contado/crédito), y
-- un ledger append-only de pagos reales contra cada gasto (mismo rol que
-- order_payments para las órdenes) — necesario para que el Cierre de Caja
-- pueda restar los gastos pagados en efectivo del efectivo esperado.

CREATE TABLE public.expense_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX idx_expense_categories_company ON public.expense_categories USING btree (company_id);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expense categories select same company" ON public.expense_categories FOR SELECT TO authenticated USING ((company_id = public.get_user_company(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Expense categories insert admin same company" ON public.expense_categories FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role) AND public.is_company_active(company_id)));
CREATE POLICY "Expense categories delete admin same company" ON public.expense_categories FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()) OR ((company_id = public.get_user_company(auth.uid())) AND public.has_role(auth.uid(), 'admin'::public.app_role)));

GRANT SELECT, INSERT, DELETE ON public.expense_categories TO authenticated;

-- El gasto en sí — dato financiero sensible, admin-only en las 4 acciones
-- (a diferencia de expense_categories, que cualquiera puede ver para el
-- selector). No es append-only: el admin puede corregir/eliminar un gasto
-- cargado mal.
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_type text NOT NULL CHECK (payment_type IN ('contado', 'credito')),
  amount_paid numeric NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  installments_total integer,
  installments_paid integer NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT current_date,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_company_date ON public.expenses (company_id, expense_date DESC);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expenses select tenant admin" ON public.expenses
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Expenses insert tenant admin" ON public.expenses
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.is_company_active(company_id)
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Expenses update tenant admin" ON public.expenses
FOR UPDATE TO authenticated
USING (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Expenses delete tenant admin" ON public.expenses
FOR DELETE TO authenticated
USING (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;

-- Ledger de pagos reales contra un gasto: un gasto "de contado" genera UNA
-- fila acá al crearse (el pago completo); uno "a crédito" arranca sin filas
-- y cada cuota pagada después agrega una. Append-only, mismo patrón que
-- order_payments (con el GRANT incluido desde el principio esta vez).
CREATE TABLE public.expense_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_payments_company_date ON public.expense_payments (company_id, created_at DESC);
ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expense payments select tenant admin" ON public.expense_payments
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Expense payments insert tenant admin" ON public.expense_payments
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND public.is_company_active(company_id)
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Expense payments no update" ON public.expense_payments
AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "Expense payments no delete" ON public.expense_payments
AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

GRANT SELECT, INSERT ON public.expense_payments TO authenticated;

-- Se extiende la misma función de seed que ya crea presets para una
-- empresa nueva (ver 20260907120000_metodos_de_pago_configurables.sql para
-- el body previo).
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
  INSERT INTO public.expense_categories (company_id, label) VALUES
    (NEW.id, 'Repuestos'),
    (NEW.id, 'Mercadería'),
    (NEW.id, 'Alquiler'),
    (NEW.id, 'Sueldos'),
    (NEW.id, 'Servicios'),
    (NEW.id, 'Otros');
  RETURN NEW;
END;
$$;

-- Empresas ya existentes: mismo default.
INSERT INTO public.expense_categories (company_id, label)
SELECT c.id, v.label
FROM public.companies c
CROSS JOIN (VALUES ('Repuestos'), ('Mercadería'), ('Alquiler'), ('Sueldos'), ('Servicios'), ('Otros')) AS v(label);
