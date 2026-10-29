import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatMoney } from "@/lib/currency";
import { warrantyDocumentLine } from "@/lib/deviceWarranty";
import type { TicketSale } from "@/components/SaleTicket";

export function saleTotal(sale: TicketSale): number {
  return sale.items.reduce((sum, item) => sum + item.quantity * Number(item.unit_price || 0), 0);
}

/** Lo que se cobró en el momento: el total menos el equipo recibido y menos la seña de la reserva. */
export function saleToPay(sale: TicketSale): number {
  const tradeIn = sale.trade_in && sale.trade_in.value > 0 ? sale.trade_in.value : 0;
  const deposit = sale.deposit && sale.deposit > 0 ? sale.deposit : 0;
  return Math.max(0, saleTotal(sale) - tradeIn - deposit);
}

function totalLines(sale: TicketSale): string[] {
  const total = saleTotal(sale);
  const tradeIn = sale.trade_in && sale.trade_in.value > 0 ? sale.trade_in : null;
  const deposit = sale.deposit && sale.deposit > 0 ? sale.deposit : 0;
  if (!tradeIn && !deposit) return [`*Total: ${formatMoney(total)}*`];
  return [
    `Subtotal: ${formatMoney(total)}`,
    ...(tradeIn ? [`Equipo recibido (${tradeIn.device_name}): -${formatMoney(tradeIn.value)}`] : []),
    ...(deposit ? [`Seña ya abonada: -${formatMoney(deposit)}`] : []),
    `*A pagar: ${formatMoney(saleToPay(sale))}*`,
  ];
}

// Mismo número de ticket que imprime SaleTicket, para que el comprobante por
// WhatsApp y el de papel se puedan relacionar.
export function buildSaleReceiptMessage(
  sale: TicketSale,
  { businessName, branchName }: { businessName?: string | null; branchName?: string | null }
): string {
  const shop = businessName?.trim() || "F7 Manager Pro";
  const date = format(new Date(sale.created_at), "dd/MM/yy HH:mm", { locale: es });
  const lines = sale.items.flatMap((i) => {
    const warranty = warrantyDocumentLine(sale.created_at, i.warranty_days);
    return [
      `• ${i.quantity} x ${i.product_name} — ${formatMoney(i.quantity * Number(i.unit_price || 0))}`,
      ...(i.imei ? [`   IMEI: ${i.imei}`] : []),
      ...(warranty ? [`   ${warranty}`] : []),
    ];
  });
  const hasWarranty = sale.items.some((i) => Number(i.warranty_days) > 0);
  return [
    `🧾 *Comprobante de venta — ${shop}*${branchName ? ` (${branchName})` : ""}`,
    `Ticket #${sale.id.slice(-6).toUpperCase()} · ${date}`,
    "",
    ...lines,
    "",
    ...totalLines(sale),
    ...(sale.payment_method ? [`Pago: ${sale.payment_method}`] : []),
    ...(hasWarranty ? ["", "Guardá este mensaje: sirve como comprobante de garantía."] : []),
    "",
    "¡Gracias por tu compra!",
  ].join("\n");
}
