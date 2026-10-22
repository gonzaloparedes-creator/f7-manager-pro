import { formatDMY, warrantyExpiryDate } from "./postSale";

export type ReceiptWarranty =
  | { kind: "none" }
  | {
      kind: "days";
      days: number;
      daysLabel: string;
      /** dd/MM/yyyy, o null si todavía no hay forma de saber cuándo se entrega */
      endsOn: string | null;
      /** true cuando la fecha sale de la entrega estimada y no de la entrega real */
      estimated: boolean;
    };

interface ReceiptWarrantyInput {
  warranty_days?: number | null;
  delivered_at?: string | null;
  estimated_delivery_date?: string | null;
}

// La garantía corre desde la entrega, no desde la recepción. Con la orden ya
// entregada la fecha es exacta; al crearla solo se puede estimar con la
// "entrega estimada" (si la cargaron).
export function receiptWarranty(order: ReceiptWarrantyInput): ReceiptWarranty {
  const days = Math.floor(Number(order.warranty_days ?? 0));
  if (!Number.isFinite(days) || days <= 0) return { kind: "none" };

  const daysLabel = `${days} ${days === 1 ? "día" : "días"}`;

  if (order.delivered_at) {
    const end = warrantyExpiryDate(order.delivered_at, days);
    if (!Number.isNaN(end.getTime())) {
      return { kind: "days", days, daysLabel, endsOn: formatDMY(end), estimated: false };
    }
  }

  if (order.estimated_delivery_date) {
    const end = warrantyExpiryDate(`${order.estimated_delivery_date}T00:00:00`, days);
    if (!Number.isNaN(end.getTime())) {
      return { kind: "days", days, daysLabel, endsOn: formatDMY(end), estimated: true };
    }
  }

  return { kind: "days", days, daysLabel, endsOn: null, estimated: true };
}
