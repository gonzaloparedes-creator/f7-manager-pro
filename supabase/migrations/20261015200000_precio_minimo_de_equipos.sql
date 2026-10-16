-- B1 seminuevos, parte 7: precio mínimo de negociación de cada equipo.
--
-- inventory_items.min_price: hasta cuánto está dispuesto a bajar el negocio el
-- precio de venta de este equipo. Es un dato interno: no se muestra en la
-- tarjeta, en la lista de WhatsApp, en el ticket ni en ningún comprobante, y en
-- el detalle del equipo aparece tapado hasta que quien vende lo destapa.
-- NULL = sin mínimo definido. Se guarda NULL (nunca 0) cuando no hay mínimo.
--
-- Es solo un aviso al vender: la base no impide vender por debajo. Una columna
-- es lo mismo que cost_price en cuanto a quién la lee (el personal con acceso a
-- Productos), porque la política de lectura de inventory_items es por empresa.

ALTER TABLE public.inventory_items
  ADD COLUMN min_price numeric
    CONSTRAINT inventory_items_min_price_positive CHECK (min_price IS NULL OR min_price > 0);
