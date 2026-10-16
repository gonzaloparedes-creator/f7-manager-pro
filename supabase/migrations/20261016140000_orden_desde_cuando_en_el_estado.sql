-- "Hace X días en este estado" para el tablero y las tarjetas de Órdenes.
-- orders.updated_at no sirve para esto: también cambia al cobrar, editar o
-- tocar la prioridad. Se agrega status_changed_at, que mueve un trigger solo
-- cuando cambia el status (cubre cualquier camino que lo cambie: detalle de la
-- orden, tablero, edición, edge functions).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_status_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_touch_status_changed_at ON public.orders;
CREATE TRIGGER trg_orders_touch_status_changed_at
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_status_changed_at();

-- Relleno de las órdenes existentes: desde que arrancó la última racha del
-- estado actual en el historial (las notas y pagos que repiten el mismo
-- estado no reinician el reloj); sin historial, la fecha de creación.
-- Se apagan los triggers de usuario durante el UPDATE: si no, orders_set_updated_at
-- movería el updated_at de todas las órdenes de todas las empresas (que es el
-- orden en que se listan) y validate_order_amounts_trigger podría frenar la
-- migración por una orden vieja con importes inconsistentes.
ALTER TABLE public.orders DISABLE TRIGGER USER;

UPDATE public.orders o
SET status_changed_at = COALESCE((
  SELECT min(h.created_at)
  FROM public.order_status_history h
  WHERE h.order_id = o.id
    AND h.status = o.status
    AND h.created_at > COALESCE((
      SELECT max(h2.created_at)
      FROM public.order_status_history h2
      WHERE h2.order_id = o.id AND h2.status <> o.status
    ), '-infinity'::timestamptz)
), o.created_at);

ALTER TABLE public.orders ENABLE TRIGGER USER;
