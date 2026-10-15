// Garantía de los equipos vendidos (B1 seminuevos): se le da al comprador al
// vender un equipo y se consulta después por IMEI, comprador o número de equipo.
// También cubre las garantías de reparación (órdenes entregadas) para que el
// mostrador tenga un único lugar donde revisar "¿este equipo tiene garantía?".

import { WARRANTY_LEAD_DAYS, elapsedDays, formatDMY, warrantyExpiryDate } from "./postSale";

export const DEFAULT_DEVICE_WARRANTY_DAYS = 30;
export const MAX_WARRANTY_DAYS = 3650;

/**
 * unrecorded = venta anterior a esta función (la garantía no quedó registrada)
 * none       = se vendió explícitamente sin garantía
 * due        = vigente pero vence en WARRANTY_LEAD_DAYS días o menos
 */
export type WarrantyKind = "unrecorded" | "none" | "active" | "due" | "expired";

export interface DeviceWarranty {
  kind: WarrantyKind;
  /** Días que le quedan (0 = vence hoy). Negativo si ya venció. null si no hay garantía. */
  daysLeft: number | null;
  endsAt: Date | null;
}

export function clampWarrantyDays(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_WARRANTY_DAYS, Math.max(0, Math.round(value)));
}

export function pluralDays(n: number): string {
  const abs = Math.abs(n);
  return `${abs} ${abs === 1 ? "día" : "días"}`;
}

export function deviceWarranty(
  startedAt: string,
  warrantyDays: number | null | undefined,
  now: Date
): DeviceWarranty {
  if (warrantyDays === null || warrantyDays === undefined) {
    return { kind: "unrecorded", daysLeft: null, endsAt: null };
  }
  const days = Number(warrantyDays);
  if (!(days > 0)) return { kind: "none", daysLeft: null, endsAt: null };

  const daysLeft = days - elapsedDays(startedAt, now);
  const endsAt = warrantyExpiryDate(startedAt, days);
  if (daysLeft < 0) return { kind: "expired", daysLeft, endsAt };
  if (daysLeft <= WARRANTY_LEAD_DAYS) return { kind: "due", daysLeft, endsAt };
  return { kind: "active", daysLeft, endsAt };
}

export function warrantyStatusLabel(w: DeviceWarranty): string {
  switch (w.kind) {
    case "unrecorded":
      return "Sin garantía registrada";
    case "none":
      return "Sin garantía";
    case "expired":
      return `Vencida hace ${pluralDays(w.daysLeft ?? 0)}`;
    case "due":
      return w.daysLeft === 0 ? "Vence hoy" : `Vence en ${pluralDays(w.daysLeft ?? 0)}`;
    default:
      return `Vigente · quedan ${pluralDays(w.daysLeft ?? 0)}`;
  }
}

/** Línea para el ticket y el comprobante por WhatsApp; null si la venta no registró garantía. */
export function warrantyDocumentLine(
  soldAt: string,
  warrantyDays: number | null | undefined
): string | null {
  if (warrantyDays === null || warrantyDays === undefined) return null;
  const days = Number(warrantyDays);
  if (!(days > 0)) return "Sin garantía";
  return `Garantía: ${pluralDays(days)} (hasta ${formatDMY(warrantyExpiryDate(soldAt, days))})`;
}

export type WarrantyFilter = "all" | "active" | "due" | "expired";

export function matchesWarrantyFilter(w: DeviceWarranty, filter: WarrantyFilter): boolean {
  switch (filter) {
    case "active":
      return w.kind === "active" || w.kind === "due";
    case "due":
      return w.kind === "due";
    case "expired":
      return w.kind === "expired";
    default:
      return true;
  }
}

export interface WarrantyEntry {
  key: string;
  source: "venta" | "reparacion";
  title: string;
  imei: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  /** Fecha de la venta o de la entrega de la reparación. */
  startedAt: string;
  warrantyDays: number | null;
  /** Ticket (venta) o número de orden (reparación). */
  reference: string;
}

const digitsOnly = (s: string) => s.replace(/\D/g, "");

export function matchesWarrantySearch(entry: WarrantyEntry, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const qDigits = digitsOnly(q);
  const text = [entry.title, entry.buyerName, entry.reference].filter(Boolean).join(" ").toLowerCase();
  if (text.includes(q)) return true;
  if (qDigits.length >= 3) {
    if (entry.imei && entry.imei.includes(qDigits)) return true;
    if (entry.buyerPhone && digitsOnly(entry.buyerPhone).includes(qDigits)) return true;
  }
  return false;
}

export interface WarrantySummary {
  active: number;
  due: number;
  expired: number;
}

export function warrantySummary(entries: WarrantyEntry[], now: Date): WarrantySummary {
  const out: WarrantySummary = { active: 0, due: 0, expired: 0 };
  for (const e of entries) {
    const w = deviceWarranty(e.startedAt, e.warrantyDays, now);
    if (w.kind === "active") out.active += 1;
    else if (w.kind === "due") out.due += 1;
    else if (w.kind === "expired") out.expired += 1;
  }
  return out;
}

export interface DeviceSaleRow {
  id: string;
  product_name: string;
  imei: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  warranty_days: number | null;
  sale_group_id: string | null;
}

export function entryFromDeviceSale(row: DeviceSaleRow): WarrantyEntry {
  const ticket = (row.sale_group_id ?? row.id).slice(-6).toUpperCase();
  return {
    key: `venta-${row.id}`,
    source: "venta",
    title: row.product_name,
    imei: row.imei,
    buyerName: row.customer_name,
    buyerPhone: row.customer_phone,
    startedAt: row.created_at,
    warrantyDays: row.warranty_days,
    reference: `Ticket #${ticket}`,
  };
}

export interface RepairOrderRow {
  id: string;
  order_number: string;
  marca: string | null;
  modelo: string | null;
  device_type: string | null;
  imei: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivered_at: string;
  warranty_days: number | null;
}

export function entryFromRepairOrder(row: RepairOrderRow): WarrantyEntry {
  const model = [row.marca, row.modelo].filter(Boolean).join(" ").trim();
  return {
    key: `orden-${row.id}`,
    source: "reparacion",
    title: model || row.device_type || "Equipo",
    imei: row.imei,
    buyerName: row.customer_name,
    buyerPhone: row.customer_phone,
    startedAt: row.delivered_at,
    warrantyDays: row.warranty_days,
    reference: row.order_number,
  };
}
