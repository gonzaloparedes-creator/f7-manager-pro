CREATE TABLE public.warranty_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  label text NOT NULL,
  days integer NOT NULL CHECK (days >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_warranty_presets_company ON public.warranty_presets(company_id);

ALTER TABLE public.warranty_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Warranty presets select same company"
  ON public.warranty_presets FOR SELECT TO authenticated
  USING ((company_id = get_user_company(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Warranty presets insert admin same company"
  ON public.warranty_presets FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin(auth.uid()) OR (
      company_id = get_user_company(auth.uid())
      AND has_role(auth.uid(), 'admin'::app_role)
      AND is_company_active(company_id)
    )
  );

CREATE POLICY "Warranty presets update admin same company"
  ON public.warranty_presets FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR (company_id = get_user_company(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (is_super_admin(auth.uid()) OR (company_id = get_user_company(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Warranty presets delete admin same company"
  ON public.warranty_presets FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR (company_id = get_user_company(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)));

-- Seed defaults for all existing companies
INSERT INTO public.warranty_presets (company_id, label, days)
SELECT c.id, v.label, v.days
FROM public.companies c
CROSS JOIN (VALUES ('Sin garantía', 0), ('15 días', 15), ('30 días', 30), ('90 días', 90)) AS v(label, days);

-- Trigger to seed defaults for new companies
CREATE OR REPLACE FUNCTION public.seed_warranty_presets_for_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.warranty_presets (company_id, label, days) VALUES
    (NEW.id, 'Sin garantía', 0),
    (NEW.id, '15 días', 15),
    (NEW.id, '30 días', 30),
    (NEW.id, '90 días', 90);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_warranty_presets
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.seed_warranty_presets_for_company();