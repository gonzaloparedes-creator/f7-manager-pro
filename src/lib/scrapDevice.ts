// Lógica pura de la Chatarra (equipos comprados para piezas): qué piezas se le
// sacaron a cada equipo, cuánto de lo pagado ya se asignó a esas piezas y la
// validación al cargar una pieza nueva. Sin React ni Supabase para testearla directo.

import { formatMoney } from "@/lib/currency";
import { parseGs, type DevicePurchaseRecord } from "@/lib/devicePurchase";

export interface ScrapPart {
  id: string;
  purchase_id: string;
  inventory_item_id: string | null;
  part_name: string;
  allocated_cost: number;
  created_at: string;
  /** Stock actual del repuesto; null si el repuesto se borró del inventario. */
  stock: number | null;
}

export interface ScrapDevice {
  purchase: DevicePurchaseRecord;
  parts: ScrapPart[];
  /** Suma de costos asignados a las piezas. */
  allocated: number;
  /** Lo pagado por el equipo que todavía no se asignó a ninguna pieza. */
  unassigned: number;
}

export function buildScrapDevices(purchases: DevicePurchaseRecord[], parts: ScrapPart[]): ScrapDevice[] {
  const byPurchase = new Map<string, ScrapPart[]>();
  for (const part of parts) {
    const list = byPurchase.get(part.purchase_id) ?? [];
    list.push(part);
    byPurchase.set(part.purchase_id, list);
  }
  return purchases
    .filter((p) => p.kind === "piezas")
    .map((purchase) => {
      const own = (byPurchase.get(purchase.id) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const allocated = own.reduce((s, p) => s + Number(p.allocated_cost || 0), 0);
      return {
        purchase,
        parts: own,
        allocated,
        unassigned: Math.max(0, Number(purchase.purchase_price) - allocated),
      };
    })
    .sort((a, b) => b.purchase.created_at.localeCompare(a.purchase.created_at));
}

export function scrapTotals(devices: ScrapDevice[]) {
  return {
    count: devices.length,
    invested: devices.reduce((s, d) => s + Number(d.purchase.purchase_price), 0),
    allocated: devices.reduce((s, d) => s + d.allocated, 0),
    unassigned: devices.reduce((s, d) => s + d.unassigned, 0),
    withoutParts: devices.filter((d) => d.parts.length === 0).length,
    partsCount: devices.reduce((s, d) => s + d.parts.length, 0),
  };
}

export type ScrapTotals = ReturnType<typeof scrapTotals>;

export type PartAvailability ="en_stock" | "usada" | "eliminada";

// El repuesto es un artículo de Inventario: en stock hasta que se usa en una
// reparación (baja el stock) o alguien lo borra de Inventario.
export function partAvailability(part: Pick<ScrapPart, "stock">): PartAvailability {
  if (part.stock === null) return "eliminada";
  return part.stock > 0 ? "en_stock" : "usada";
}

export interface PartInput {
  name: string;
  cost: string;
  selling: string;
}

export function validatePart(input: PartInput, remaining: number): string | null {
  const name = input.name.trim();
  if (!name) return "Ingresá el nombre de la pieza";
  if (name.length > 120) return "El nombre de la pieza es demasiado largo";
  const cost = parseGs(input.cost);
  if (cost > remaining) {
    return remaining > 0
      ? `El costo no puede superar lo que queda por asignar (${formatMoney(remaining)})`
      : "Ya asignaste todo lo que pagaste por este equipo. Cargá la pieza con costo 0.";
  }
  return null;
}

export function buildPartParams(purchaseId: string, input: PartInput) {
  return {
    purchase_id: purchaseId,
    part_name: input.name.trim(),
    allocated_cost: parseGs(input.cost),
    selling_price: parseGs(input.selling),
  };
}
