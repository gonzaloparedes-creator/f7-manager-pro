ALTER TABLE public.order_parts
  ADD COLUMN IF NOT EXISTS historical_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS historical_selling_price numeric NOT NULL DEFAULT 0;

-- Backfill from current inventory item values for existing rows
UPDATE public.order_parts op
SET historical_cost = COALESCE(ii.cost_price, 0),
    historical_selling_price = COALESCE(ii.selling_price, 0)
FROM public.inventory_items ii
WHERE op.inventory_item_id = ii.id
  AND (op.historical_cost = 0 AND op.historical_selling_price = 0);