-- Moneda por empresa (Configuración > Perfil > Ubicación y moneda).
--
--   * companies.currency = moneda en la que la empresa ve y escribe sus montos.
--     Hoy PYG (guaraní) o USD (dólar). Los montos se guardan como números enteros
--     y NO se convierten al cambiar de moneda: la moneda solo decide cómo se ven.
--   * Las empresas que ya existen quedan en PYG: cero cambios para ellas.
--   * Las empresas nuevas toman la moneda de su país (PY -> PYG; el resto -> USD
--     mientras no esté cargada su moneda propia). Se resuelve con un trigger
--     BEFORE INSERT sobre companies, sin tocar handle_new_user (el alta de cuentas).
--   * Tres funciones públicas (anon) devuelven solo la moneda del negocio para que
--     la página de seguimiento y la vitrina muestren los montos en esa moneda.
--     Buscan EXACTAMENTE igual que get_order_by_tracking, get_order_by_code y
--     get_storefront, así que no exponen nada que esas funciones no expongan ya.
--     No se modifica ninguna función existente.
--   * currency no es un dato de facturación: el administrador de cada empresa lo
--     cambia con la política que ya existe ("Admins update own company"); no hace
--     falta tocar prevent_company_billing_self_update().
--
-- Para sumar una moneda (ej. BRL): agregarla al CHECK de abajo y a
-- currency_for_country() en una migración nueva, y a src/lib/currency.ts.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PYG';

ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_currency_check;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_currency_check CHECK (currency IN ('PYG', 'USD'));

-- Mismo criterio que currencyForCountry() en src/lib/currency.ts.
CREATE OR REPLACE FUNCTION public.currency_for_country(_country text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN _country = 'PY' THEN 'PYG' ELSE 'USD' END;
$$;

-- Sin DEFAULT: si el INSERT no trae moneda, la elige el trigger según el país.
ALTER TABLE public.companies ALTER COLUMN currency DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.set_company_currency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.currency IS NULL THEN
    NEW.currency := public.currency_for_country(NEW.country);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_company_currency ON public.companies;
CREATE TRIGGER set_company_currency
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_company_currency();

-- ============================================================
-- Funciones públicas: solo devuelven la moneda del negocio
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_company_currency_by_tracking(_token uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.currency
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  WHERE o.tracking_token = _token
  LIMIT 1;
$$;

-- Los links viejos (código ORD-XXXX) se resuelven igual que get_order_by_code.
CREATE OR REPLACE FUNCTION public.get_company_currency_by_code(_code text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.currency
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  WHERE upper(o.order_number) = upper(_code)
  ORDER BY o.created_at ASC
  LIMIT 1;
$$;

-- Misma condición que get_storefront: vitrina activa, empresa activa y plan Business.
CREATE OR REPLACE FUNCTION public.get_storefront_currency(_slug text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.currency
  FROM public.storefront_settings st
  JOIN public.companies c ON c.id = st.company_id
  WHERE st.slug = lower(btrim(_slug))
    AND st.enabled
    AND public.is_company_active(c.id)
    AND c.plan_type = 'business';
$$;

REVOKE ALL ON FUNCTION public.get_company_currency_by_tracking(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_company_currency_by_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_storefront_currency(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_currency_by_tracking(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_currency_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_storefront_currency(text) TO anon, authenticated;
