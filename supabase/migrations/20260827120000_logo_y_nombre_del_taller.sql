-- White-label: cada taller puede tener su propio logo, y ese logo + el
-- nombre de la empresa (companies.name, no profiles.business_name — ver
-- comentario más abajo) pasan a mostrarse en vez de la marca F7 Manager Pro
-- en el WhatsApp, el preview del link y la página pública de seguimiento.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url text; -- NULL = usa el logo de F7 por defecto

INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Mismo patrón final que inventory-images (20260601153933_...sql): público
-- para lectura (el bucket público sirve los objetos vía URL directa, no
-- hace falta política de SELECT), escritura scoped por company_id vía
-- (storage.foldername(name))[1]. A diferencia de inventory-images, acá
-- además se exige rol admin — cambiar el logo es una decisión de marca, no
-- una tarea operativa del día a día.
CREATE POLICY "Company logos company admin upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = (public.get_user_company(auth.uid()))::text
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Company logos company admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = (public.get_user_company(auth.uid()))::text
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = (public.get_user_company(auth.uid()))::text
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Company logos company admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = (public.get_user_company(auth.uid()))::text
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- get_tracking_og_info / get_order_by_code / get_order_by_tracking se
-- reconstruyen para traer company_name/company_logo_url (JOIN companies) —
-- hoy no devuelven nada de la empresa. Recordatorio de siempre: el DROP
-- borra los grants existentes, así que se vuelven a declarar explícitamente
-- abajo (mismo descuido que ya reabrió por error get_technical_notes_by_code
-- en 20260824010000 después de haber sido cerrado en 20260728000000).

DROP FUNCTION IF EXISTS public.get_tracking_og_info(text);
CREATE FUNCTION public.get_tracking_og_info(_code text) RETURNS TABLE(
  order_number text, device_type text, status text, company_name text, company_logo_url text
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT o.order_number, o.device_type, o.status, c.name AS company_name, c.logo_url AS company_logo_url
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  WHERE o.tracking_token::text = _code OR upper(o.order_number) = upper(_code)
  ORDER BY o.created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_tracking_og_info(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_tracking_og_info(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tracking_og_info(text) TO service_role;

DROP FUNCTION IF EXISTS public.get_order_by_code(text);
CREATE FUNCTION public.get_order_by_code(_code text) RETURNS TABLE(
  id uuid, order_number text, device_type text, status text, technician_notes text,
  estimated_delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone,
  quote_amount bigint, deposit_amount bigint, cargos_adicionales jsonb,
  problems text[], problem_other text, problem_description text,
  accessories text[], checklist jsonb,
  quote_response text, quote_response_note text, quote_responded_at timestamptz,
  company_name text, company_logo_url text
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
         c.name AS company_name, c.logo_url AS company_logo_url
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
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
  company_name text, company_logo_url text
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
         c.name AS company_name, c.logo_url AS company_logo_url
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  WHERE o.tracking_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(uuid) TO service_role;
