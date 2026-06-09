ALTER TABLE public.order_parts ALTER COLUMN inventory_item_id DROP NOT NULL;
ALTER TABLE public.order_parts ADD COLUMN IF NOT EXISTS supplier_name text;
ALTER TABLE public.order_parts ADD COLUMN IF NOT EXISTS part_details text;