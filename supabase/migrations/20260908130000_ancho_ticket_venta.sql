-- Ancho de papel configurable para el ticket de venta de Productos (POS).
-- Muchas impresoras térmicas/matriciales usan 58mm en vez de 80mm; forzar
-- 80mm para todas rompía la impresión (texto ilegible por el achicado que
-- hace el driver al encajar un contenido más ancho que el rollo real).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ticket_width_mm smallint NOT NULL DEFAULT 80;
