-- Registrar un pago de suscripción en un solo paso (Gestión de empresas > Registrar pago).
--
-- Hasta ahora eran tres pasos manuales y separados: "Pagado" (fechas del plan),
-- "Emitir recibo" (otra pantalla) e "Importar recibos como ingresos" (en Finanzas F7).
-- Si se olvidaba uno, las cuentas no cerraban y no había forma de ver cuál faltaba.
--
-- Esta función los hace juntos, en una sola transacción: o queda todo o no queda nada.
--   1. Actualiza el período de la empresa (plan, ciclo, desde, vence, cliente que paga, reactiva).
--   2. Emite el recibo (la base le asigna el número F7-000X).
--   3. Registra el ingreso en Finanzas F7 vinculado a ese recibo.
--
-- Es SECURITY INVOKER a propósito: corre con los permisos de quien llama, así que cada
-- una de las tres escrituras pasa por las mismas políticas RLS y los mismos triggers que
-- hoy (solo el super admin puede tocar companies.billing, subscription_receipts y f7_*).
-- No agrega ningún permiso nuevo. Además se pide ser super admin de entrada.
--
-- La secuencia de números de recibo no se revierte con la transacción: por eso todo lo que
-- puede fallar (fechas, montos, categoría, socio, duplicado) se valida ANTES de emitir el
-- recibo, y así un error no deja un número "quemado".
--
-- Duplicados: un pago idéntico (misma empresa, mismo período, mismo monto) con un recibo
-- vigente se rechaza, para que un doble clic o dos pestañas no lo registren dos veces.
-- Si fue un error, se anula el recibo y se puede volver a cargar.

CREATE OR REPLACE FUNCTION public.f7_register_subscription_payment(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Asuncion')::date;
  v_company public.companies%ROWTYPE;
  v_receipt public.subscription_receipts%ROWTYPE;
  v_company_id uuid;
  v_plan text;
  v_cycle text;
  v_start date;
  v_end date;
  v_paid_on date;
  v_subtotal numeric;
  v_discount numeric;
  v_amount numeric;
  v_currency text;
  v_fx numeric;
  v_category uuid;
  v_partner uuid;
  v_method text;
  v_mark_paying boolean;
  v_reactivate boolean;
  v_cat_kind text;
  v_cat_active boolean;
  v_partner_active boolean;
  v_dup text;
  v_entry_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos del pago';
  END IF;

  v_company_id := NULLIF(_payload->>'company_id', '')::uuid;
  v_plan := _payload->>'plan_type';
  v_cycle := _payload->>'billing_cycle';
  v_start := NULLIF(_payload->>'period_start', '')::date;
  v_end := NULLIF(_payload->>'period_end', '')::date;
  v_paid_on := NULLIF(_payload->>'payment_date', '')::date;
  v_subtotal := NULLIF(_payload->>'subtotal', '')::numeric;
  v_discount := COALESCE(NULLIF(_payload->>'discount_amount', '')::numeric, 0);
  v_amount := NULLIF(_payload->>'amount', '')::numeric;
  v_currency := _payload->>'currency';
  v_fx := NULLIF(_payload->>'fx_rate', '')::numeric;
  v_category := NULLIF(_payload->>'category_id', '')::uuid;
  v_partner := NULLIF(_payload->>'collected_by', '')::uuid;
  v_method := NULLIF(btrim(COALESCE(_payload->>'payment_method', '')), '');
  v_mark_paying := COALESCE((_payload->>'mark_paying')::boolean, false);
  v_reactivate := COALESCE((_payload->>'reactivate')::boolean, false);

  -- ---------- Validaciones (todas antes de escribir nada) ----------
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Elegí la empresa que pagó';
  END IF;
  IF v_plan IS NULL OR v_plan NOT IN ('starter', 'pro', 'business', 'retail') THEN
    RAISE EXCEPTION 'El plan no es válido';
  END IF;
  IF v_cycle IS NULL OR v_cycle NOT IN ('mensual', 'semestral', 'anual') THEN
    RAISE EXCEPTION 'El ciclo no es válido';
  END IF;
  IF v_start IS NULL OR v_end IS NULL THEN
    RAISE EXCEPTION 'Faltan las fechas del período';
  END IF;
  IF v_end < v_start THEN
    RAISE EXCEPTION 'El vencimiento no puede ser anterior al inicio del período';
  END IF;
  IF v_paid_on IS NULL THEN
    RAISE EXCEPTION 'Falta la fecha de cobro';
  END IF;
  IF v_paid_on > v_today THEN
    RAISE EXCEPTION 'La fecha de cobro no puede ser futura';
  END IF;
  IF v_currency IS NULL OR v_currency NOT IN ('PYG', 'USD') THEN
    RAISE EXCEPTION 'La moneda no es válida';
  END IF;
  IF v_subtotal IS NULL OR v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Poné un precio mayor a cero';
  END IF;
  IF v_discount < 0 OR v_discount >= v_subtotal THEN
    RAISE EXCEPTION 'El descuento tiene que ser menor al precio';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount <> v_subtotal - v_discount THEN
    RAISE EXCEPTION 'El total no coincide con el precio menos el descuento';
  END IF;
  IF v_method IS NULL THEN
    RAISE EXCEPTION 'Elegí el medio de pago';
  END IF;
  IF v_currency = 'USD' THEN
    IF v_fx IS NULL OR v_fx <= 0 THEN
      RAISE EXCEPTION 'Falta el tipo de cambio para registrar el ingreso en dólares';
    END IF;
  ELSE
    v_fx := NULL;
  END IF;

  SELECT kind, active INTO v_cat_kind, v_cat_active FROM public.f7_finance_categories WHERE id = v_category;
  IF NOT FOUND OR v_cat_kind <> 'ingreso' OR v_cat_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Elegí una categoría de ingresos activa';
  END IF;

  IF v_partner IS NOT NULL THEN
    SELECT active INTO v_partner_active FROM public.f7_partners WHERE id = v_partner;
    IF NOT FOUND OR v_partner_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'El socio que cobró está inactivo o ya no existe';
    END IF;
  END IF;

  SELECT * INTO v_company FROM public.companies WHERE id = v_company_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La empresa ya no existe';
  END IF;

  SELECT receipt_number INTO v_dup
    FROM public.subscription_receipts
   WHERE company_id = v_company_id
     AND voided_at IS NULL
     AND period_start = v_start
     AND period_end = v_end
     AND amount = v_amount
     AND currency = v_currency
   LIMIT 1;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'Ese pago ya está registrado (recibo %). Si fue un error, anulá el recibo y volvé a cargarlo', v_dup;
  END IF;

  -- ---------- Escrituras (una transacción: todo o nada) ----------
  UPDATE public.companies
     SET plan_type = v_plan,
         billing_cycle = v_cycle,
         plan_paid_from = v_start,
         plan_expires_at = v_end,
         is_paying = (is_paying OR v_mark_paying),
         is_active = (is_active OR v_reactivate)
   WHERE id = v_company_id;

  INSERT INTO public.subscription_receipts (
    company_id, customer_name, customer_document, customer_email, customer_phone,
    plan_type, billing_cycle, period_start, period_end, payment_date,
    subtotal, discount_amount, discount_note, amount, currency,
    payment_method, payment_reference, description, notes, issuer_name, issuer_details
  ) VALUES (
    v_company_id,
    COALESCE(NULLIF(btrim(COALESCE(_payload->>'customer_name', '')), ''), v_company.name),
    NULLIF(btrim(COALESCE(_payload->>'customer_document', '')), ''),
    NULLIF(btrim(COALESCE(_payload->>'customer_email', '')), ''),
    NULLIF(btrim(COALESCE(_payload->>'customer_phone', '')), ''),
    v_plan, v_cycle, v_start, v_end, v_paid_on,
    v_subtotal, v_discount,
    CASE WHEN v_discount > 0 THEN NULLIF(btrim(COALESCE(_payload->>'discount_note', '')), '') ELSE NULL END,
    v_amount, v_currency,
    v_method,
    NULLIF(btrim(COALESCE(_payload->>'payment_reference', '')), ''),
    COALESCE(NULLIF(btrim(COALESCE(_payload->>'description', '')), ''), 'Suscripción a F7 Manager Pro'),
    NULLIF(btrim(COALESCE(_payload->>'notes', '')), ''),
    COALESCE(NULLIF(btrim(COALESCE(_payload->>'issuer_name', '')), ''), 'F7 Manager Pro'),
    NULLIF(btrim(COALESCE(_payload->>'issuer_details', '')), '')
  )
  RETURNING * INTO v_receipt;

  INSERT INTO public.f7_finance_entries (
    kind, entry_date, description, category_id, amount, currency, fx_rate,
    status, partner_id, payment_method, receipt_id
  ) VALUES (
    'ingreso', v_receipt.payment_date,
    left('Recibo ' || v_receipt.receipt_number || ' · ' || v_receipt.customer_name, 200),
    v_category, v_receipt.amount, v_receipt.currency, v_fx,
    'pagado', v_partner, v_receipt.payment_method, v_receipt.id
  )
  RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object('receipt', to_jsonb(v_receipt), 'entry_id', v_entry_id);

EXCEPTION
  WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Hay un dato del pago que no es válido. Revisá el formulario';
END;
$$;

-- Supabase otorga EXECUTE a anon y authenticated por defecto: se saca explícitamente.
-- (La función igual rechaza a quien no es super admin; esto es la segunda barrera.)
REVOKE ALL ON FUNCTION public.f7_register_subscription_payment(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f7_register_subscription_payment(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f7_register_subscription_payment(jsonb) TO service_role;
