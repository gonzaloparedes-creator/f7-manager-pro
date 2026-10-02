-- Caja virtual (banco/transferencias/tarjeta) además de la caja física
-- (efectivo). Es opt-in por empresa: con virtual_cash_enabled = false todo
-- queda exactamente como hoy (solo se reconcilia el efectivo). Cuando el
-- admin lo activa, la Apertura pide también el saldo virtual con el que se
-- arranca y el Cierre reconcilia cada caja por separado.
--
-- Qué entra en cada caja no se configura: "Efectivo" es la caja física y
-- cualquier otro medio de pago (transferencia, tarjeta, QR, etc.) es la
-- caja virtual — mismo criterio que isCashLabel() ya usa hoy en el cierre.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS virtual_cash_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.cash_openings
  ADD COLUMN IF NOT EXISTS opening_virtual numeric NOT NULL DEFAULT 0;

-- Nullable a propósito: contar el saldo real del banco al cierre es opcional
-- (el saldo del banco puede incluir movimientos ajenos a F7), así que sin
-- saldo ingresado no hay diferencia virtual que guardar.
ALTER TABLE public.cash_closings
  ADD COLUMN IF NOT EXISTS expected_virtual numeric,
  ADD COLUMN IF NOT EXISTS counted_virtual numeric,
  ADD COLUMN IF NOT EXISTS difference_virtual numeric;
