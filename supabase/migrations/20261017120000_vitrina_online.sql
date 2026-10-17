-- B5: Vitrina online (solo plan Business).
--
-- Cada empresa Business puede publicar una página pública (/v/<slug>) con los
-- productos y equipos que el admin elija. Lo público sale SOLO de dos
-- funciones SECURITY DEFINER con una lista blanca de campos: nada de costos,
-- mínimo de negociación, IMEI, notas internas, código de barras ni sucursal.
-- La empresa se deduce del slug en el servidor; el navegador nunca manda un
-- company_id, así que no hay forma de pedir los datos de otra empresa.
--
--   * storefront_settings: una fila por empresa (slug único global, textos,
--     WhatsApp y dirección públicos, color, si muestra precios / stock).
--   * inventory_items.show_in_storefront: arranca en false. Nada se publica
--     hasta que el admin lo prende producto por producto (o en lote).
--   * inventory_items.public_description: texto pensado para el cliente. Las
--     "notas" de un equipo son internas ("comprado a Juan"), por eso no se usan.

CREATE TABLE public.storefront_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  slug text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  show_prices boolean NOT NULL DEFAULT true,
  show_stock boolean NOT NULL DEFAULT false,
  tagline text,
  whatsapp_phone text,
  address text,
  accent_color text,
  installments_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storefront_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  CONSTRAINT storefront_whatsapp_format CHECK (whatsapp_phone IS NULL OR whatsapp_phone ~ '^[0-9]{8,15}$'),
  CONSTRAINT storefront_accent_format CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT storefront_text_lengths CHECK (
    char_length(coalesce(tagline, '')) <= 120
    AND char_length(coalesce(address, '')) <= 200
    AND char_length(coalesce(installments_text, '')) <= 160
  )
);

CREATE UNIQUE INDEX storefront_settings_slug_unique ON public.storefront_settings (slug);

CREATE TRIGGER storefront_settings_updated_at
BEFORE UPDATE ON public.storefront_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.storefront_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_settings FORCE ROW LEVEL SECURITY;

-- Sin acceso para anon: lo público pasa solo por get_storefront*.
REVOKE ALL ON public.storefront_settings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.storefront_settings TO authenticated;
GRANT ALL ON public.storefront_settings TO service_role;

CREATE POLICY "Storefront settings select same company" ON public.storefront_settings
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Storefront settings insert admin same company" ON public.storefront_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid())
        AND public.has_role(auth.uid(), 'admin'::public.app_role)
        AND public.is_company_active(company_id))
  );

CREATE POLICY "Storefront settings update admin same company" ON public.storefront_settings
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'::public.app_role))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'::public.app_role))
  );

ALTER TABLE public.inventory_items
  ADD COLUMN show_in_storefront boolean NOT NULL DEFAULT false,
  ADD COLUMN public_description text,
  ADD CONSTRAINT inventory_items_public_description_length
    CHECK (public_description IS NULL OR char_length(public_description) <= 600);

CREATE INDEX idx_inventory_items_storefront
  ON public.inventory_items (company_id)
  WHERE show_in_storefront;

-- Publicar en la vitrina es una decisión del admin: un empleado puede editar
-- un producto, pero no prenderlo ni apagarlo en la vitrina ni cambiar su texto
-- público (mismo criterio y mismo hueco cubierto que protect_user_permission_flags).
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
    IF NEW.show_in_storefront OR NEW.public_description IS NOT NULL THEN
      RAISE EXCEPTION 'Solo un administrador puede publicar en la vitrina';
    END IF;
  ELSIF NEW.show_in_storefront IS DISTINCT FROM OLD.show_in_storefront
     OR NEW.public_description IS DISTINCT FROM OLD.public_description THEN
    RAISE EXCEPTION 'Solo un administrador puede publicar en la vitrina';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_items_protect_storefront_fields
BEFORE INSERT OR UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.protect_storefront_item_fields();

-- ¿Está libre el slug? Responde solo sí/no (no revela de quién es). Cuenta como
-- libre si ya es de la empresa que pregunta.
CREATE FUNCTION public.storefront_slug_available(_slug text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.storefront_settings
    WHERE slug = lower(btrim(_slug))
      AND company_id IS DISTINCT FROM public.get_user_company(auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.storefront_slug_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storefront_slug_available(text) TO authenticated;

-- Lo que se ve en la vitrina: stock, precio (si la empresa muestra precios) y
-- sin reserva activa. Función interna: nadie de afuera la llama directo.
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

-- Vitrina completa por slug. Devuelve NULL si el enlace no existe, está
-- apagado, la empresa está inactiva o ya no es Business (el enlace deja de
-- mostrar productos al bajar de plan).
CREATE FUNCTION public.get_storefront(_slug text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'store', jsonb_build_object(
      'slug', st.slug,
      'name', c.name,
      'logo_url', c.logo_url,
      'tagline', st.tagline,
      'whatsapp_phone', st.whatsapp_phone,
      'address', st.address,
      'accent_color', st.accent_color,
      'installments_text', st.installments_text,
      'show_prices', st.show_prices,
      'show_stock', st.show_stock
    ),
    'items', COALESCE(
      (SELECT jsonb_agg(to_jsonb(r) - 'public_description' ORDER BY r.created_at DESC)
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

REVOKE ALL ON FUNCTION public.get_storefront(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront(text) TO anon, authenticated, service_role;

-- Un artículo de la vitrina + hasta 6 parecidos (misma categoría). El artículo
-- se busca DENTRO de la empresa del slug: un id de otra empresa no devuelve nada.
CREATE FUNCTION public.get_storefront_item(_slug text, _item_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH s AS (
    SELECT st.*, c.name AS company_name, c.logo_url AS company_logo
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
    'store', jsonb_build_object(
      'slug', s.slug,
      'name', s.company_name,
      'logo_url', s.company_logo,
      'tagline', s.tagline,
      'whatsapp_phone', s.whatsapp_phone,
      'address', s.address,
      'accent_color', s.accent_color,
      'installments_text', s.installments_text,
      'show_prices', s.show_prices,
      'show_stock', s.show_stock
    ),
    'item', (SELECT to_jsonb(p) FROM picked p),
    'similar', COALESCE(
      (SELECT jsonb_agg(to_jsonb(x) - 'public_description')
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

REVOKE ALL ON FUNCTION public.get_storefront_item(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_item(text, uuid) TO anon, authenticated, service_role;
