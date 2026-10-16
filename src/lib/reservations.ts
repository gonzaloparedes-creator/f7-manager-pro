// Reservas de equipos con seña (B1 seminuevos). Lógica pura, sin React ni Supabase.
//
// Las fechas de vencimiento son "día calendario" del navegador (yyyy-MM-dd): una
// reserva vencida solo se marca como tal en pantalla; el servidor la sigue
// teniendo como activa (y el equipo apartado) hasta que alguien la venda o la
// cancele.

import { addDays, differenceInCalendarDays, format, parse } from "date-fns";
import { formatPYG } from "@/lib/orders";

export type ReservationStatus = "activa" | "vendida" | "cancelada";

export interface DeviceReservation {
  id: string;
  company_id: string;
  branch_id: string | null;
  receipt_number: string;
  inventory_item_id: string | null;
  device_name: string;
  imei: string | null;
  customer_name: string;
  customer_phone: string | null;
  agreed_price: number | string;
  deposit_amount: number | string;
  deposit_payment_method: string | null;
  expires_on: string;
  notes: string | null;
  status: ReservationStatus;
  refunded_amount: number | string;
  retained_amount: number | string;
  cancel_reason: string | null;
  resolved_at: string | null;
  created_at: string;
}

export const DEFAULT_RESERVATION_DAYS = 3;

export function toYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function defaultExpiry(now: Date = new Date()): string {
  return toYmd(addDays(now, DEFAULT_RESERVATION_DAYS));
}

function parseYmd(ymd: string): Date {
  return parse(ymd, "yyyy-MM-dd", new Date(0));
}

/** Nuevo vencimiento sugerido al extender: 3 días desde el vencimiento actual, o desde hoy si ya venció. */
export function suggestedExtension(expiresOn: string, now: Date = new Date()): string {
  const current = parseYmd(expiresOn);
  const today = parseYmd(toYmd(now));
  return toYmd(addDays(current > today ? current : today, DEFAULT_RESERVATION_DAYS));
}

/** Días que faltan para el vencimiento: 0 = vence hoy, negativo = ya venció. */
export function daysLeft(expiresOn: string, now: Date = new Date()): number {
  return differenceInCalendarDays(parseYmd(expiresOn), now);
}

export function isOverdue(r: Pick<DeviceReservation, "status" | "expires_on">, now: Date = new Date()): boolean {
  return r.status === "activa" && daysLeft(r.expires_on, now) < 0;
}

/** Texto corto del plazo de una reserva activa: "Vence hoy", "Vence en 3 días", "Vencida hace 2 días". */
export function expiryText(expiresOn: string, now: Date = new Date()): string {
  const left = daysLeft(expiresOn, now);
  if (left === 0) return "Vence hoy";
  if (left === 1) return "Vence mañana";
  if (left > 1) return `Vence en ${left} días`;
  if (left === -1) return "Vencida ayer";
  return `Vencida hace ${-left} días`;
}

export function displayDate(ymd: string): string {
  return format(parseYmd(ymd), "dd/MM/yyyy");
}

export function statusLabel(r: Pick<DeviceReservation, "status" | "expires_on">, now: Date = new Date()): string {
  if (r.status === "vendida") return "Vendida";
  if (r.status === "cancelada") return "Cancelada";
  return isOverdue(r, now) ? "Vencida" : "Activa";
}

export function depositOf(r: Pick<DeviceReservation, "deposit_amount">): number {
  return Number(r.deposit_amount || 0);
}

/** Lo que falta cobrar al retirar el equipo: precio acordado menos la seña. */
export function balanceDue(r: Pick<DeviceReservation, "agreed_price" | "deposit_amount">): number {
  return Math.max(0, Number(r.agreed_price || 0) - depositOf(r));
}

// Vacío = 0. Acepta "850000" o "850.000" (punto de miles); cualquier otra cosa
// ("850.5", "-1", "abc") es inválida: Gs. no tiene decimales.
function parseAmount(text: string): number | null {
  const clean = text.trim();
  if (clean === "") return 0;
  if (/^\d+$/.test(clean)) return Number(clean);
  if (/^\d{1,3}(\.\d{3})+$/.test(clean)) return Number(clean.replace(/\./g, ""));
  return null;
}

export interface ReservationDraft {
  customerName: string;
  customerPhone: string;
  agreedPrice: string;
  deposit: string;
  paymentMethod: string;
  expiresOn: string;
  notes: string;
}

export function emptyReservationDraft(sellingPrice: number, now: Date = new Date()): ReservationDraft {
  return {
    customerName: "",
    customerPhone: "",
    agreedPrice: sellingPrice > 0 ? String(Math.round(sellingPrice)) : "",
    deposit: "",
    paymentMethod: "",
    expiresOn: defaultExpiry(now),
    notes: "",
  };
}

export interface ReservationParams {
  inventory_item_id: string;
  customer_name: string;
  customer_phone: string | null;
  agreed_price: number;
  deposit_amount: number;
  payment_method: string | null;
  expires_on: string;
  notes: string | null;
}

export type ParsedReservation =
  | { error: string; params?: undefined }
  | { error: null; params: ReservationParams };

export function parseReservationDraft(
  draft: ReservationDraft,
  inventoryItemId: string,
  now: Date = new Date(),
): ParsedReservation {
  const name = draft.customerName.trim();
  if (!name) return { error: "Ingresá el nombre del cliente" };
  if (name.length > 120) return { error: "El nombre del cliente es demasiado largo" };
  const phone = draft.customerPhone.trim();
  if (phone.length > 40) return { error: "El teléfono es demasiado largo" };

  const price = parseAmount(draft.agreedPrice);
  if (price === null || price <= 0) {
    return { error: "El precio acordado tiene que ser un monto en Gs. mayor a cero, sin decimales" };
  }
  const deposit = parseAmount(draft.deposit);
  if (deposit === null) return { error: "La seña tiene que ser un monto en Gs., sin decimales" };
  if (deposit > price) return { error: "La seña no puede superar el precio acordado" };
  const method = draft.paymentMethod.trim();
  if (deposit > 0 && !method) return { error: "Elegí con qué medio de pago dejó la seña" };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.expiresOn)) return { error: "Elegí hasta cuándo se reserva" };
  if (daysLeft(draft.expiresOn, now) < 0) return { error: "La fecha de vencimiento no puede ser anterior a hoy" };

  const notes = draft.notes.trim();
  if (notes.length > 500) return { error: "Las notas son demasiado largas (máximo 500 caracteres)" };

  return {
    error: null,
    params: {
      inventory_item_id: inventoryItemId,
      customer_name: name,
      customer_phone: phone || null,
      agreed_price: price,
      deposit_amount: deposit,
      payment_method: deposit > 0 ? method : null,
      expires_on: draft.expiresOn,
      notes: notes || null,
    },
  };
}

export interface CancelDraft {
  refund: string;
  method: string;
  reason: string;
}

export interface CancelParams {
  reservation_id: string;
  refund_amount: number;
  refund_method: string | null;
  reason: string | null;
}

export type ParsedCancel =
  | { error: string; params?: undefined; retained?: undefined }
  | { error: null; params: CancelParams; retained: number };

export function parseCancelDraft(draft: CancelDraft, reservationId: string, deposit: number): ParsedCancel {
  const refund = parseAmount(draft.refund);
  if (refund === null) return { error: "El monto a devolver tiene que ser un monto en Gs., sin decimales" };
  if (refund > deposit) return { error: `No podés devolver más que la seña (${formatPYG(deposit)})` };
  const method = draft.method.trim();
  if (refund > 0 && !method) return { error: "Elegí con qué medio de pago se devuelve la seña" };
  const reason = draft.reason.trim();
  if (reason.length > 300) return { error: "El motivo es demasiado largo (máximo 300 caracteres)" };
  return {
    error: null,
    retained: deposit - refund,
    params: {
      reservation_id: reservationId,
      refund_amount: refund,
      refund_method: refund > 0 ? method : null,
      reason: reason || null,
    },
  };
}

/** Línea del carrito que viene de una reserva: la seña ya cobrada y el precio de venta con descuento. */
export interface ReservedSaleLine {
  name: string;
  quantity: number;
  unitPrice: number;
  deposit: number;
}

/** Total de señas que se descuentan en una venta. */
export function totalDeposit(lines: { deposit?: number }[]): number {
  return lines.reduce((sum, l) => sum + (l.deposit ?? 0), 0);
}

/** Una seña no puede ser mayor que lo que se cobra por ese equipo (p. ej. si el descuento del carrito baja el precio). */
export function depositProblem(lines: ReservedSaleLine[]): string | null {
  for (const l of lines) {
    if (l.deposit > l.quantity * l.unitPrice) {
      return `La seña de «${l.name}» (${formatPYG(l.deposit)}) es mayor que su precio de venta. Subí el precio o bajá el descuento.`;
    }
  }
  return null;
}

/** Texto para mandarle al cliente por WhatsApp con el resumen de su reserva. */
export function buildReservationMessage(
  r: DeviceReservation,
  { businessName, branchName }: { businessName?: string | null; branchName?: string | null },
): string {
  const shop = businessName?.trim() || "F7 Manager Pro";
  const deposit = depositOf(r);
  return [
    `📌 *Reserva de equipo — ${shop}*${branchName ? ` (${branchName})` : ""}`,
    `Reserva ${r.receipt_number}`,
    "",
    `Equipo: ${r.device_name}`,
    `Precio acordado: ${formatPYG(Number(r.agreed_price))}`,
    ...(deposit > 0
      ? [`Seña recibida: ${formatPYG(deposit)}`, `Saldo a pagar al retirarlo: ${formatPYG(balanceDue(r))}`]
      : ["Sin seña"]),
    `Te lo guardamos hasta el ${displayDate(r.expires_on)}.`,
    "",
    "¡Gracias!",
  ].join("\n");
}
