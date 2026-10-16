// Lógica pura del canje (B1 seminuevos): el cliente entrega un equipo como parte
// de pago de lo que compra. La venta vale su precio completo; el equipo recibido
// entra al catálogo a su valor de canje y Caja solo cuenta lo que se cobró de verdad.

import { buildDevicePurchaseParams, type DevicePurchaseForm } from "./devicePurchase";

/** Etiqueta del "medio de pago" del equipo recibido; no es plata y no mueve Caja. */
export const TRADE_IN_LABEL = "Canje";

export type DevicePurchaseParams = ReturnType<typeof buildDevicePurchaseParams>;

/** El equipo cargado en el carrito, todavía sin guardar: se registra junto con la venta. */
export interface TradeInDraft {
  form: DevicePurchaseForm;
  params: DevicePurchaseParams;
}

interface SaleAmountRow {
  quantity: number;
  unit_price: number | string | null;
  trade_in_value?: number | string | null;
  reservation_deposit?: number | string | null;
}

/** Lo que hay que cobrar: el total menos el equipo recibido y menos la seña ya cobrada de una reserva. */
export function amountToCollect(total: number, tradeInValue: number, depositValue = 0): number {
  return Math.max(0, total - tradeInValue - depositValue);
}

/** `deposit` es la seña de reservas que ya se cobró: el canje y la seña juntos no pueden superar el total. */
export function validateTradeInValue(value: number, saleTotal: number, deposit = 0): string | null {
  if (!(value > 0)) return "Ingresá cuánto le reconocés por el equipo";
  if (value + deposit > saleTotal) {
    return deposit > 0
      ? "El equipo recibido más la seña superan el total de la venta. Bajá el valor reconocido o agregá más productos al carrito."
      : "El equipo vale más que la venta. Bajá el valor reconocido o agregá más productos al carrito.";
  }
  return null;
}

/**
 * Lo que realmente se cobró de una línea: su precio menos el canje (que se guarda
 * en la primera línea de la venta) y menos la seña de su reserva (que ya se contó
 * en Caja el día que se recibió).
 */
export function netSaleAmount(row: SaleAmountRow): number {
  return (
    row.quantity * Number(row.unit_price || 0) -
    Number(row.trade_in_value || 0) -
    Number(row.reservation_deposit || 0)
  );
}

export function tradeInOfSale(rows: { trade_in_value?: number | string | null }[]): number {
  return rows.reduce((sum, r) => sum + Number(r.trade_in_value || 0), 0);
}

export function depositOfSale(rows: { reservation_deposit?: number | string | null }[]): number {
  return rows.reduce((sum, r) => sum + Number(r.reservation_deposit || 0), 0);
}

export interface TradeInSaleLine {
  inventory_item_id: string;
  quantity: number;
  unit_price: number;
  reservation_id?: string | null;
}

/**
 * Parámetros de la RPC register_sale_with_trade_in. La sucursal del equipo
 * recibido se deja vacía a propósito: la RPC la toma de la venta, así el equipo
 * queda en la misma sucursal donde se hizo el canje.
 */
export function buildTradeInSaleParams(args: {
  saleGroupId: string;
  paymentMethod: string;
  lines: TradeInSaleLine[];
  draft: TradeInDraft;
  warranty?: {
    warranty_days: number | null;
    customer_name: string | null;
    customer_phone: string | null;
  };
}) {
  return {
    sale_group_id: args.saleGroupId,
    payment_method: args.paymentMethod,
    warranty_days: args.warranty?.warranty_days ?? null,
    customer_name: args.warranty?.customer_name ?? null,
    customer_phone: args.warranty?.customer_phone ?? null,
    items: args.lines.map((l) => ({
      inventory_item_id: l.inventory_item_id,
      quantity: l.quantity,
      unit_price: l.unit_price,
      ...(l.reservation_id ? { reservation_id: l.reservation_id } : {}),
    })),
    trade_in: { ...args.draft.params, branch_id: null },
  };
}
