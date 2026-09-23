-- "Orden creada" es un evento aparte de los cambios de estado (envía un
-- WhatsApp distinto, desde send-order-notification en vez de
-- send-status-notification) pero hasta ahora no tenía su propio interruptor
-- en Configuración → Notificaciones — el mensaje salía siempre, sin
-- importar lo que el admin hubiera desactivado ahí. Se agrega la clave
-- "orden_creada" con default true (así ninguna empresa existente deja de
-- recibirlo de un día para el otro) y se hace backfill de las que ya
-- tenían el JSON guardado sin esta clave.
--
-- Mismo patrón ya usado para agregar "enviado"
-- (20260830120000_estado_enviado_y_fix_seed.sql) — si en el futuro se
-- agrega otra clave nueva a notification_preferences, hay que repetir este
-- mismo ALTER COLUMN + UPDATE, si no todas las empresas existentes dejan de
-- recibir ese aviso hasta que alguien reabra Configuración y lo re-guarde.
ALTER TABLE public.profiles
  ALTER COLUMN notification_preferences
  SET DEFAULT '{"orden_creada": true, "recibido": true, "en_diagnostico": false, "en_reparacion": false, "listo": true, "enviado": true, "entregado": false}'::jsonb;

UPDATE public.profiles
SET notification_preferences = notification_preferences || '{"orden_creada": true}'::jsonb
WHERE NOT (notification_preferences ? 'orden_creada');
