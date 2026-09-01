-- Cada estado configurable ya tiene su propia fila por empresa en
-- order_status_presets — se le agrega el texto del mensaje de WhatsApp que
-- se manda al cliente cuando una orden pasa a ese estado. NULL significa
-- "seguir usando el mensaje predeterminado" (hoy hardcodeado en el edge
-- function send-status-notification) — cero cambio de comportamiento para
-- quien nunca lo toque.
ALTER TABLE public.order_status_presets
  ADD COLUMN IF NOT EXISTS message_template text;
