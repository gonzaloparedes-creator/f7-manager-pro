-- Bloque 1 (A2 + A3 + A1)
--  A3: prioridad de la orden (baja / normal / alta).
--  A2: motivo cuando una reparación se interrumpe (estado "Retirado sin reparar").
--  A1: ajuste de empresa para exigir caja abierta antes de cobrar.

ALTER TABLE public.orders
  ADD COLUMN priority text NOT NULL DEFAULT 'normal'
    CONSTRAINT orders_priority_check CHECK (priority IN ('baja', 'normal', 'alta')),
  ADD COLUMN interruption_reason text
    CONSTRAINT orders_interruption_reason_check CHECK (
      interruption_reason IS NULL
      OR interruption_reason IN ('placa_danada', 'sin_repuesto', 'cliente_desistio', 'sin_viabilidad', 'otro')
    ),
  ADD COLUMN interrupted_at timestamptz;

ALTER TABLE public.companies
  ADD COLUMN require_open_cash boolean NOT NULL DEFAULT false;
