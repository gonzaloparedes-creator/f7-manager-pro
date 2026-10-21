-- Suspensión automática al vencer el plan.
--
-- Diseño: NO se cambia nada en companies ni se programa ningún job. El
-- bloqueo se CALCULA a partir de plan_expires_at (último día cubierto) más
-- unos días de gracia, con la fecha de Asunción:
--
--   acceso hasta  = plan_expires_at + días de gracia   (inclusive)
--   bloqueada     = hoy (Asunción) > plan_expires_at + días de gracia
--
-- companies.is_active sigue siendo el interruptor MANUAL de suspensión
-- (Gestión de empresas). Una empresa sin fecha de vencimiento (NULL) nunca
-- se bloquea por vencimiento: las existentes quedan igual hasta que se les
-- cargue el pago con "Pagado". Renovar = cargar el nuevo período; el acceso
-- vuelve solo, sin reactivar nada a mano.
--
-- is_company_active() es la puerta que ya usan las políticas de INSERT de
-- todas las tablas, así que el bloqueo también se aplica en el servidor y no
-- solo en la pantalla.

-- ============================================================
-- 1. Días de gracia (un único lugar para cambiarlos)
-- ============================================================
CREATE OR REPLACE FUNCTION public.plan_grace_days()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT 3;
$$;

-- ============================================================
-- 2. ¿Venció el plazo (vencimiento + gracia)? Función pura, sin tablas.
-- ============================================================
CREATE OR REPLACE FUNCTION public.plan_is_lapsed(_expires date, _today date, _grace integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT _expires IS NOT NULL AND _today > _expires + GREATEST(COALESCE(_grace, 0), 0);
$$;

-- ============================================================
-- 3. is_company_active: activa Y sin plazo vencido
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_company_active(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT c.is_active
             AND NOT public.plan_is_lapsed(
               c.plan_expires_at,
               (now() AT TIME ZONE 'America/Asuncion')::date,
               public.plan_grace_days()
             )
      FROM public.companies c
      WHERE c.id = _company_id
    ),
    true
  );
$$;

-- ============================================================
-- 4. Estado de acceso de MI empresa (la empresa sale del usuario
--    autenticado: no recibe ningún id, no puede mirar otra empresa)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_company_access()
RETURNS TABLE (
  is_active boolean,
  billing_cycle text,
  plan_paid_from date,
  plan_expires_at date,
  grace_days integer,
  access_until date,
  today date,
  lapsed boolean,
  blocked boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.is_active,
    c.billing_cycle,
    c.plan_paid_from,
    c.plan_expires_at,
    public.plan_grace_days(),
    c.plan_expires_at + public.plan_grace_days(),
    (now() AT TIME ZONE 'America/Asuncion')::date,
    public.plan_is_lapsed(c.plan_expires_at, (now() AT TIME ZONE 'America/Asuncion')::date, public.plan_grace_days()),
    NOT c.is_active
      OR public.plan_is_lapsed(c.plan_expires_at, (now() AT TIME ZONE 'America/Asuncion')::date, public.plan_grace_days())
  FROM public.companies c
  WHERE c.id = public.get_user_company(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.plan_grace_days() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.plan_is_lapsed(date, date, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_company_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_grace_days() TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_is_lapsed(date, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_company_access() TO authenticated;

-- ============================================================
-- 5. Vitrina pública: una empresa con el plazo vencido sale del aire igual
--    que una suspendida (misma definición que 20261017150000, solo cambia
--    el predicado de empresa activa).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_storefront(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'store', public.storefront_store_json(st, c.name, c.logo_url),
    'items', COALESCE(
      (SELECT jsonb_agg(to_jsonb(r) - 'public_description' - 'gallery_images' ORDER BY r.created_at DESC)
       FROM public.storefront_rows(st.company_id, st.show_prices, st.show_stock) r),
      '[]'::jsonb
    )
  )
  FROM public.storefront_settings st
  JOIN public.companies c ON c.id = st.company_id
  WHERE st.slug = lower(btrim(_slug))
    AND st.enabled
    AND public.is_company_active(c.id)
    AND c.plan_type = 'business';
$function$;

CREATE OR REPLACE FUNCTION public.get_storefront_item(_slug text, _item_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH s AS (
    SELECT st.company_id, st.show_prices, st.show_stock,
           public.storefront_store_json(st, c.name, c.logo_url) AS store_json
    FROM public.storefront_settings st
    JOIN public.companies c ON c.id = st.company_id
    WHERE st.slug = lower(btrim(_slug))
      AND st.enabled
      AND public.is_company_active(c.id)
      AND c.plan_type = 'business'
  ),
  rows AS (
    SELECT r.* FROM s, public.storefront_rows(s.company_id, s.show_prices, s.show_stock) r
  ),
  picked AS (
    SELECT * FROM rows WHERE id = _item_id
  )
  SELECT jsonb_build_object(
    'store', s.store_json,
    'item', (SELECT to_jsonb(p) FROM picked p),
    'similar', COALESCE(
      (SELECT jsonb_agg(to_jsonb(x) - 'public_description' - 'gallery_images')
       FROM (
         SELECT r.* FROM rows r, picked p
         WHERE r.id <> p.id AND r.category_id IS NOT DISTINCT FROM p.category_id
         ORDER BY r.created_at DESC
         LIMIT 6
       ) x),
      '[]'::jsonb
    )
  )
  FROM s;
$function$;

CREATE OR REPLACE FUNCTION public.get_storefront_og(_slug text, _item_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH s AS (
    SELECT st.company_id, st.show_prices, st.show_stock, st.tagline, st.banner_url,
           c.name AS company_name, c.logo_url AS company_logo
    FROM public.storefront_settings st
    JOIN public.companies c ON c.id = st.company_id
    WHERE st.slug = lower(btrim(_slug))
      AND st.enabled
      AND public.is_company_active(c.id)
      AND c.plan_type = 'business'
  ),
  picked AS (
    SELECT r.name, r.price, COALESCE(r.image_url, r.gallery_images[1]) AS image_url, r.public_description
    FROM s, public.storefront_rows(s.company_id, s.show_prices, s.show_stock) r
    WHERE _item_id IS NOT NULL AND r.id = _item_id
  )
  SELECT jsonb_build_object(
    'name', s.company_name,
    'logo_url', s.company_logo,
    'banner_url', s.banner_url,
    'tagline', s.tagline,
    'show_prices', s.show_prices,
    'item', (SELECT to_jsonb(p) FROM picked p)
  )
  FROM s;
$function$;
