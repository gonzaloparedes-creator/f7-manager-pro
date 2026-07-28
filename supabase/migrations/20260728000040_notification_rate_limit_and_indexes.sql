-- Fase 1 (auditoría 2026-07-28):
--  1. Tabla de log para rate-limiting server-side de los envíos de WhatsApp
--     (send-order-notification / send-status-notification). Antes no había
--     ningún límite: un usuario autenticado con self-signup automático podía
--     invocar la función indefinidamente.
--  2. Índices en las columnas que ya se usan en casi todas las políticas RLS
--     de orders (assigned_technician_id, current_branch_id) pero que no
--     estaban indexadas — costo creciente por fila a medida que crece el
--     volumen de órdenes.

CREATE TABLE public.notification_send_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX notification_send_log_user_created_idx
  ON public.notification_send_log (user_id, created_at DESC);

ALTER TABLE public.notification_send_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_send_log FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own notification log" ON public.notification_send_log
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users select own notification log" ON public.notification_send_log
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_orders_assigned_technician_id
  ON public.orders (assigned_technician_id);

CREATE INDEX IF NOT EXISTS idx_orders_current_branch_id
  ON public.orders (current_branch_id);
