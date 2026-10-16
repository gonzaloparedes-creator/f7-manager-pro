// Panel de Equipos (resumen): indicadores, avisos y filtros del catálogo para los
// equipos del negocio. Lógica pura, sin React ni Supabase.

import { isStaleDevice, STALE_DEVICE_DAYS } from "@/lib/deviceStock";
import { isOverdue, type DeviceReservation } from "@/lib/reservations";

export type CatalogFilter = "all" | "low" | "stale" | "no_photo" | "no_price" | "no_imei";

export const CATALOG_FILTER_LABEL: Record<Exclude<CatalogFilter, "all">, string> = {
  low: "sin / bajo stock",
  stale: `equipos detenidos ${STALE_DEVICE_DAYS}+ días`,
  no_photo: "equipos sin foto",
  no_price: "equipos sin precio de venta",
  no_imei: "equipos sin IMEI",
};

export const CATALOG_FILTER_EMPTY: Record<Exclude<CatalogFilter, "all">, string> = {
  low: "Ningún producto con bajo o sin stock.",
  stale: `Ningún equipo detenido ${STALE_DEVICE_DAYS}+ días.`,
  no_photo: "Todos los equipos en stock tienen foto.",
  no_price: "Todos los equipos en stock tienen precio de venta.",
  no_imei: "Todos los equipos en stock tienen IMEI cargado.",
};

export interface HubItem {
  id: string;
  is_device: boolean;
  stock: number;
  cost_price: number | string | null;
  selling_price: number | string | null;
  image_url: string | null;
  imei: string | null;
  created_at?: string | null;
}

const inStock = (i: HubItem) => i.is_device && i.stock > 0;

// Los tres avisos de "datos que faltan" solo miran equipos que están en stock:
// un equipo ya vendido sin foto no le importa a nadie.
export function matchesDataFilter(item: HubItem, filter: "no_photo" | "no_price" | "no_imei"): boolean {
  if (!inStock(item)) return false;
  if (filter === "no_photo") return !item.image_url;
  if (filter === "no_price") return Number(item.selling_price || 0) <= 0;
  return !item.imei || !item.imei.trim();
}

export interface HubSale {
  quantity: number;
  unit_price: number | string;
  /** Costo del equipo al venderlo; null en ventas viejas que no lo guardaron. */
  unit_cost: number | string | null;
}

export interface HubKpis {
  inStock: { count: number; cost: number };
  forSale: { count: number; potential: number };
  reserved: { count: number; deposits: number };
  soldMonth: { count: number; revenue: number; profit: number; profitComplete: boolean };
}

export function hubKpis(input: {
  items: HubItem[];
  activeReservations: Pick<DeviceReservation, "inventory_item_id" | "deposit_amount">[];
  monthSales: HubSale[];
}): HubKpis {
  const devices = input.items.filter(inStock);
  const deviceIds = new Set(devices.map((d) => d.id));
  const reservedIds = new Set(
    input.activeReservations.map((r) => r.inventory_item_id).filter((id): id is string => !!id && deviceIds.has(id))
  );
  const reserved = input.activeReservations.filter((r) => r.inventory_item_id && deviceIds.has(r.inventory_item_id));
  const forSale = devices.filter((d) => !reservedIds.has(d.id) && Number(d.selling_price || 0) > 0);

  let revenue = 0;
  let profit = 0;
  let count = 0;
  let profitComplete = true;
  for (const s of input.monthSales) {
    const price = Number(s.unit_price || 0);
    count += s.quantity;
    revenue += s.quantity * price;
    if (s.unit_cost === null || s.unit_cost === undefined) profitComplete = false;
    else profit += s.quantity * (price - Number(s.unit_cost));
  }

  return {
    inStock: { count: devices.length, cost: devices.reduce((s, d) => s + d.stock * Number(d.cost_price || 0), 0) },
    forSale: { count: forSale.length, potential: forSale.reduce((s, d) => s + d.stock * Number(d.selling_price || 0), 0) },
    reserved: { count: reserved.length, deposits: reserved.reduce((s, r) => s + Number(r.deposit_amount || 0), 0) },
    soldMonth: { count, revenue, profit, profitComplete },
  };
}

export type HubAlertTarget =
  | { tab: "catalogo"; filter: Exclude<CatalogFilter, "all"> }
  | { tab: "reservas" }
  | { tab: "chatarra" };

export interface HubAlert {
  key: string;
  count: number;
  text: string;
  target: HubAlertTarget;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function buildDeviceAlerts(input: {
  items: HubItem[];
  activeReservations: Pick<DeviceReservation, "status" | "expires_on">[];
  scrapWithoutParts: number;
  canViewStock: boolean;
  now?: Date;
}): HubAlert[] {
  const now = input.now ?? new Date();
  const alerts: HubAlert[] = [];

  const noPhoto = input.items.filter((i) => matchesDataFilter(i, "no_photo")).length;
  if (noPhoto > 0) {
    alerts.push({
      key: "no_photo",
      count: noPhoto,
      text: `${noPhoto} ${plural(noPhoto, "equipo en stock sin foto", "equipos en stock sin foto")}`,
      target: { tab: "catalogo", filter: "no_photo" },
    });
  }

  const noPrice = input.items.filter((i) => matchesDataFilter(i, "no_price")).length;
  if (noPrice > 0) {
    alerts.push({
      key: "no_price",
      count: noPrice,
      text: `${noPrice} ${plural(noPrice, "equipo en stock sin precio de venta", "equipos en stock sin precio de venta")}`,
      target: { tab: "catalogo", filter: "no_price" },
    });
  }

  const noImei = input.items.filter((i) => matchesDataFilter(i, "no_imei")).length;
  if (noImei > 0) {
    alerts.push({
      key: "no_imei",
      count: noImei,
      text: `${noImei} ${plural(noImei, "equipo en stock sin IMEI cargado", "equipos en stock sin IMEI cargado")}`,
      target: { tab: "catalogo", filter: "no_imei" },
    });
  }

  if (input.canViewStock) {
    const stale = input.items.filter((i) => isStaleDevice(i, now)).length;
    if (stale > 0) {
      alerts.push({
        key: "stale",
        count: stale,
        text: `${stale} ${plural(stale, "equipo lleva", "equipos llevan")} ${STALE_DEVICE_DAYS}+ días sin venderse`,
        target: { tab: "catalogo", filter: "stale" },
      });
    }
  }

  const overdue = input.activeReservations.filter((r) => isOverdue(r, now)).length;
  if (overdue > 0) {
    alerts.push({
      key: "overdue_reservations",
      count: overdue,
      text: `${overdue} ${plural(overdue, "reserva vencida sin resolver", "reservas vencidas sin resolver")}`,
      target: { tab: "reservas" },
    });
  }

  if (input.scrapWithoutParts > 0) {
    const n = input.scrapWithoutParts;
    alerts.push({
      key: "scrap_without_parts",
      count: n,
      text: `${n} ${plural(n, "equipo de chatarra sin piezas cargadas", "equipos de chatarra sin piezas cargadas")}`,
      target: { tab: "chatarra" },
    });
  }

  return alerts;
}

// El panel de equipos solo tiene sentido para un negocio que ya trabaja con equipos.
export function hasDeviceActivity(input: { items: { is_device: boolean }[]; purchaseCount: number; reservationCount: number }): boolean {
  return input.items.some((i) => i.is_device) || input.purchaseCount > 0 || input.reservationCount > 0;
}

export function monthStartIso(now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}
