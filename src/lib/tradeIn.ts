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
}

export function amountToCollect(total: number, tradeInValue: number): number {
  return Math.max(0, total - tradeInValue);
}

export function validateTradeInValue(value: number, saleTotal: number): string | null {
  if (!(value > 0)) return "Ingresá cuánto le reconocés por el equipo";
  if (value > saleTotal) {
    return "El equipo vale más que la venta. Bajá el valor reconocido o agregá más productos al carrito.";
  }
  return null;
}

/** Lo que realmente se cobró de una línea: su precio menos el canje (que se guarda en la primera línea de la venta). */
export function netSaleAmount(row: SaleAmountRow): number {
  return row.quantity * Number(row.unit_price || 0) - Number(row.trade_in_value || 0);
}

export function tradeInOfSale(rows: { trade_in_value?: number | string | null }[]): number {
  return rows.reduce((sum, r) => sum + Number(r.trade_in_value || 0), 0);
}

export interface TradeInSaleLine {
  inventory_item_id: string;
  quantity: number;
  unit_price: number;
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
}) {
  return {
    sale_group_id: args.saleGroupId,
    payment_method: args.paymentMethod,
    items: args.lines.map((l) => ({
      inventory_item_id: l.inventory_item_id,
      quantity: l.quantity,
      unit_price: l.unit_price,
    })),
    trade_in: { ...args.draft.params, branch_id: null },
  };
}
