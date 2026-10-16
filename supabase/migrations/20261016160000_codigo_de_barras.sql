-- B3: código de barras por producto + etiquetas imprimibles.
--
-- Cada artículo de inventory_items (repuestos y productos de venta) puede
-- tener UN código de barras: el que trae de fábrica (EAN/UPC, que se escanea o
-- se tipea) o uno propio generado por el sistema. Los lectores USB/Bluetooth
-- escriben como un teclado, así que el código solo necesita ser único dentro
-- de la empresa para que escanearlo encuentre exactamente un artículo.

ALTER TABLE public.inventory_items
  ADD COLUMN barcode text;

-- Solo ASCII imprimible sin espacios (lo que Code128 puede dibujar y un lector
-- escribe sin sorpresas de teclado); largo razonable para una etiqueta de 60 mm.
ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_barcode_format
  CHECK (barcode IS NULL OR barcode ~ '^[!-~]{1,64}$');

-- Único por empresa (dos empresas pueden tener el mismo código de fábrica);
-- los artículos sin código no compiten entre sí.
CREATE UNIQUE INDEX inventory_items_company_barcode_unique
  ON public.inventory_items (company_id, barcode)
  WHERE barcode IS NOT NULL;

ALTER TABLE public.companies
  ADD COLUMN barcode_seq integer NOT NULL DEFAULT 0;

-- Código propio: "2" + 9 dígitos (10 dígitos en total). No es un largo de EAN/UPC
-- (8, 12, 13), así que no se pisa con un código de fábrica. SECURITY DEFINER
-- porque el UPDATE sobre companies está reservado a admins; el chequeo
-- explícito de "misma empresa que el que llama" reemplaza esa protección (mismo
-- patrón que next_device_purchase_number). Salta cualquier código que la
-- empresa ya tenga cargado a mano.
CREATE FUNCTION public.next_barcode(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next integer;
  _code text;
  _tries integer := 0;
BEGIN
  IF _company_id IS DISTINCT FROM public.get_user_company(auth.uid())
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  LOOP
    _tries := _tries + 1;
    IF _tries > 50 THEN
      RAISE EXCEPTION 'No se pudo generar un código de barras libre';
    END IF;

    UPDATE public.companies
    SET barcode_seq = barcode_seq + 1
    WHERE id = _company_id
    RETURNING barcode_seq INTO _next;

    IF _next IS NULL THEN
      RAISE EXCEPTION 'Empresa % no encontrada', _company_id;
    END IF;

    _code := '2' || lpad(_next::text, 9, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.inventory_items
      WHERE company_id = _company_id AND barcode = _code
    );
  END LOOP;

  RETURN _code;
END;
$$;

REVOKE ALL ON FUNCTION public.next_barcode(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_barcode(uuid) TO authenticated;
