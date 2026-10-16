import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import type { DevicePurchaseRecord } from "@/lib/devicePurchase";
import { buildScrapDevices, scrapTotals, type ScrapPart } from "@/lib/scrapDevice";

const PURCHASE_COLUMNS =
  "id, receipt_number, created_at, branch_id, device_name, imei, battery_health, seller_name, seller_cedula, seller_phone, purchase_price, payment_method, reason, checklist, accessories, notes, kind, sale_group_id";

const LIMIT = 200;

/**
 * Chatarra de la empresa: equipos comprados para piezas y las piezas que se les
 * sacaron. Se lee todo acá (las compras y las piezas se crean solo por RPC).
 */
export function useScrapDevices() {
  const { companyId } = useCompany();
  const [purchases, setPurchases] = useState<DevicePurchaseRecord[]>([]);
  const [parts, setParts] = useState<ScrapPart[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!companyId) return;
    const [pur, par] = await Promise.all([
      (supabase as any)
        .from("device_purchases")
        .select(PURCHASE_COLUMNS)
        .eq("company_id", companyId)
        .eq("kind", "piezas")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      (supabase as any)
        .from("device_parts")
        .select("id, purchase_id, inventory_item_id, part_name, allocated_cost, created_at, inventory_items(stock)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true })
        .limit(LIMIT * 20),
    ]);
    // Si falla una consulta no se pisa lo que ya había: mejor datos viejos que una lista vacía engañosa.
    if (pur.error || par.error) return;
    setPurchases(((pur.data ?? []) as DevicePurchaseRecord[]).map((p) => ({ ...p, purchase_price: Number(p.purchase_price) })));
    setParts(
      ((par.data ?? []) as any[]).map((r) => ({
        id: r.id,
        purchase_id: r.purchase_id,
        inventory_item_id: r.inventory_item_id,
        part_name: r.part_name,
        allocated_cost: Number(r.allocated_cost),
        created_at: r.created_at,
        // Sin repuesto enlazado (se borró de Inventario) no hay stock que mostrar.
        stock: r.inventory_items ? Number(r.inventory_items.stock) : null,
      }))
    );
    setLoaded(true);
  }, [companyId]);

  useEffect(() => { void reload(); }, [reload]);

  const devices = useMemo(() => buildScrapDevices(purchases, parts), [purchases, parts]);
  const totals = useMemo(() => scrapTotals(devices), [devices]);

  return { devices, totals, loaded, reload };
}
