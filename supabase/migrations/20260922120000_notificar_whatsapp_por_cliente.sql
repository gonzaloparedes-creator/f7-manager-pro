-- Permite apagar las notificaciones automáticas de WhatsApp (cambios de
-- estado, orden creada, confirmación de presupuesto) por cliente
-- individual — útil para clientes mayoristas u otros que no quieren
-- recibir esos avisos. Default true para no cambiar el comportamiento de
-- ningún cliente existente.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS notify_whatsapp boolean NOT NULL DEFAULT true;
