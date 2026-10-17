-- B5 (segunda entrega): la vitrina se vuelve de la marca del negocio.
--
--   * Sellos propios: franja bajo la portada y bloque en la página del artículo
--     ("Garantía escrita", "Envíos a todo el país"...). Arrancan VACÍOS: los
--     escribe el administrador, la plataforma no inventa ninguna promesa.
--   * "Qué incluye": lista de textos cortos para la página del artículo.
--   * Redes sociales, banner de portada, buscador y pie de página con texto propio.
--   * Galería de fotos por artículo (inventory_items.gallery_images, hasta 5 más
--     la foto principal).
--   * get_storefront_og: datos mínimos para armar la vista previa del enlace
--     (WhatsApp, Instagram, etc.) sin bajar el catálogo entero.
--
-- Todo lo público sigue saliendo solo de funciones SECURITY DEFINER con lista
-- blanca y con el mismo candado (plan Business + empresa activa + vitrina
-- encendida). Las imágenes solo pueden apuntar al Storage de la propia empresa.

-- ---------- Validaciones reutilizables ----------

CREATE FUNCTION public.storefront_valid_seals(_v jsonb, _max integer)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _v IS NULL OR jsonb_typeof(_v) <> 'array' THEN false
    WHEN jsonb_array_length(_v) > _max THEN false
    ELSE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_v) e
      WHERE jsonb_typeof(e) <> 'object'
         OR jsonb_typeof(e -> 'title') IS DISTINCT FROM 'string'
         OR char_length(btrim(e ->> 'title')) NOT BETWEEN 1 AND 40
         OR char_length(coalesce(e ->> 'subtitle', '')) > 80
         OR coalesce(e ->> 'icon', '') !~ '^[a-z0-9-]{1,20}$'
    )
  END;
$$;

CREATE FUNCTION public.storefront_valid_text_list(_v jsonb, _max integer, _len integer)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _v IS NULL OR jsonb_typeof(_v) <> 'array' THEN false
    WHEN jsonb_array_length(_v) > _max THEN false
    ELSE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_v) e
      WHERE jsonb_typeof(e) <> 'string'
         OR char_length(btrim(e #>> '{}')) NOT BETWEEN 1 AND _len
    )
  END;
$$;

CREATE FUNCTION public.storefront_valid_gallery(_company_id uuid, _urls text[])
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM unnest(_urls) u
    WHERE u IS NULL
       OR u !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/inventory-images/' || _company_id::text || '/[^[:space:]]+$')
  );
$$;

-- ---------- Ajustes de la vitrina ----------

ALTER TABLE public.storefront_settings
  ADD COLUMN banner_url text,
  ADD COLUMN search_placeholder text,
  ADD COLUMN footer_text text,
  ADD COLUMN instagram_url text,
  ADD COLUMN facebook_url text,
  ADD COLUMN tiktok_url text,
  ADD COLUMN youtube_url text,
  ADD COLUMN website_url text,
  ADD COLUMN seals jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN product_seals jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN includes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT storefront_new_text_lengths CHECK (
    char_length(coalesce(search_placeholder, '')) <= 60
    AND char_length(coalesce(footer_text, '')) <= 240
  ),
  ADD CONSTRAINT storefront_banner_own_storage CHECK (
    banner_url IS NULL
    OR banner_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/company-logos/' || company_id::text || '/[^[:space:]]+$')
  ),
  ADD CONSTRAINT storefront_social_urls CHECK (
    (instagram_url IS NULL OR (char_length(instagram_url) <= 200 AND instagram_url ~ '^https://([a-z0-9-]+\.)*instagram\.com/[^[:space:]]+$'))
    AND (facebook_url IS NULL OR (char_length(facebook_url) <= 200 AND facebook_url ~ '^https://([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me)/[^[:space:]]+$'))
    AND (tiktok_url IS NULL OR (char_length(tiktok_url) <= 200 AND tiktok_url ~ '^https://([a-z0-9-]+\.)*tiktok\.com/[^[:space:]]+$'))
    AND (youtube_url IS NULL OR (char_length(youtube_url) <= 200 AND youtube_url ~ '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be)/[^[:space:]]+$'))
    AND (website_url IS NULL OR (char_length(website_url) <= 200 AND website_url ~ '^https://[^[:space:]]+\.[^[:space:]]+$'))
  ),
  ADD CONSTRAINT storefront_seals_valid CHECK (public.storefront_valid_seals(seals, 6)),
  ADD CONSTRAINT storefront_product_seals_valid CHECK (public.storefront_valid_seals(product_seals, 4)),
  ADD CONSTRAINT storefront_includes_valid CHECK (public.storefront_valid_text_list(includes, 8, 40));

-- ---------- Galería por artículo ----------

ALTER TABLE public.inventory_items
  ADD COLUMN gallery_images text[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT inventory_items_gallery_limit CHECK (cardinality(gallery_images) <= 5),
  ADD CONSTRAINT inventory_items_gallery_own_storage CHECK (public.storefront_valid_gallery(company_id, gallery_images));

-- La galería es de la vitrina: mismo criterio que show_in_storefront y la
-- descripción pública (solo un administrador la cambia).
CREATE OR REPLACE FUNCTION public.protect_storefront_item_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.show_in_storefront
       OR NEW.public_description IS NOT NULL
       OR cardinality(NEW.gallery_images) > 0 THEN
      RAISE EXCEPTION 'Solo un administrador puede publicar en la vitrina';
    END IF;
  ELSIF NEW.show_in_storefront IS DISTINCT FROM OLD.show_in_storefront
     OR NEW.public_description IS DISTINCT FROM OLD.public_description
     OR NEW.gallery_images IS DISTINCT FROM OLD.gallery_images THEN
    RAISE EXCEPTION 'Solo un administrador puede publicar en la vitrina';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------- Funciones públicas ----------

-- Cambia la forma de lo que devuelve (suma la galería): se recrea. Es interna.
DROP FUNCTION public.storefront_rows(uuid, boolean, boolean);

CREATE FUNCTION public.storefront_rows(_company_id uuid, _show_prices boolean, _show_stock boolean)
RETURNS TABLE(
  id uuid,
  name text,
  price numeric,
  image_url text,
  category_id uuid,
  category text,
  is_device boolean,
  battery_health smallint,
  stock integer,
  public_description text,
  gallery_images text[],
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT i.id,
         i.name,
         CASE WHEN _show_prices THEN i.selling_price END,
         i.image_url,
         i.category_id,
         c.name,
         i.is_device,
         CASE WHEN i.is_device THEN i.battery_health END,
         CASE WHEN _show_stock AND NOT i.is_device THEN i.stock END,
         i.public_description,
         i.gallery_images,
         i.created_at
  FROM public.inventory_items i
  LEFT JOIN public.inventory_categories c ON c.id = i.category_id AND c.company_id = i.company_id
  WHERE i.company_id = _company_id
    AND i.is_for_sale
    AND i.show_in_storefront
    AND i.stock > 0
    AND (NOT _show_prices OR i.selling_price > 0)
    AND NOT EXISTS (
      SELECT 1 FROM public.device_reservations r
      WHERE r.inventory_item_id = i.id AND r.status = 'activa'
    )
  ORDER BY i.created_at DESC
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.storefront_rows(uuid, boolean, boolean) FROM PUBLIC, anon, authenticated;

-- Los datos públicos del negocio, en un solo lugar (lista blanca).
CREATE FUNCTION public.storefront_store_json(_st public.storefront_settings, _name text, _logo text)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'slug', _st.slug,
    'name', _name,
    'logo_url', _logo,
    'tagline', _st.tagline,
    'whatsapp_phone', _st.whatsapp_phone,
    'address', _st.address,
    'accent_color', _st.accent_color,
    'installments_text', _st.installments_text,
    'show_prices', _st.show_prices,
    'show_stock', _st.show_stock,
    'banner_url', _st.banner_url,
    'search_placeholder', _st.search_placeholder,
    'footer_text', _st.footer_text,
    'socials', jsonb_build_object(
      'instagram', _st.instagram_url,
      'facebook', _st.facebook_url,
      'tiktok', _st.tiktok_url,
      'youtube', _st.youtube_url,
      'website', _st.website_url
    ),
    'seals', _st.seals,
    'product_seals', _st.product_seals,
    'includes', _st.includes
  );
$$;

REVOKE ALL ON FUNCTION public.storefront_store_json(public.storefront_settings, text, text) FROM PUBLIC, anon, authenticated;

-- Vitrina completa por slug. En el listado no viaja la descripción ni la
-- galería (solo se piden al abrir un artículo).
CREATE OR REPLACE FUNCTION public.get_storefront(_slug text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    AND c.is_active
    AND c.plan_type = 'business';
$$;

CREATE OR REPLACE FUNCTION public.get_storefront_item(_slug text, _item_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH s AS (
    SELECT st.company_id, st.show_prices, st.show_stock,
           public.storefront_store_json(st, c.name, c.logo_url) AS store_json
    FROM public.storefront_settings st
    JOIN public.companies c ON c.id = st.company_id
    WHERE st.slug = lower(btrim(_slug))
      AND st.enabled
      AND c.is_active
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
$$;

-- Vista previa del enlace: lo mínimo para el título, la descripción y la foto.
-- Mismo candado que el resto; si el artículo no se ve, devuelve solo la tienda.
CREATE FUNCTION public.get_storefront_og(_slug text, _item_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH s AS (
    SELECT st.company_id, st.show_prices, st.show_stock, st.tagline, st.banner_url,
           c.name AS company_name, c.logo_url AS company_logo
    FROM public.storefront_settings st
    JOIN public.companies c ON c.id = st.company_id
    WHERE st.slug = lower(btrim(_slug))
      AND st.enabled
      AND c.is_active
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
$$;

REVOKE ALL ON FUNCTION public.get_storefront_og(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_og(text, uuid) TO anon, authenticated, service_role;
