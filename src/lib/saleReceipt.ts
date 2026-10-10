import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatPYG } from "@/lib/orders";
import type { TicketSale } from "@/components/SaleTicket";

export function saleTotal(sale: TicketSale): number {
  return sale.items.reduce((sum, item) => sum + item.quantity * Number(item.unit_price || 0), 0);
}

// Mismo número de ticket que imprime SaleTicket, para que el comprobante por
// WhatsApp y el de papel se puedan relacionar.
export function buildSaleReceiptMessage(
  sale: TicketSale,
  { businessName, branchName }: { businessName?: string | null; branchName?: string | null }
): string {
  const shop = businessName?.trim() || "F7 Manager Pro";
  const date = format(new Date(sale.created_at), "dd/MM/yy HH:mm", { locale: es });
  const lines = sale.items.map(
    (i) => `• ${i.quantity} x ${i.product_name} — ${formatPYG(i.quantity * Number(i.unit_price || 0))}`
  );
  return [
    `🧾 *Comprobante de venta — ${shop}*${branchName ? ` (${branchName})` : ""}`,
    `Ticket #${sale.id.slice(-6).toUpperCase()} · ${date}`,
    "",
    ...lines,
    "",
    `*Total: ${formatPYG(saleTotal(sale))}*`,
    ...(sale.payment_method ? [`Pago: ${sale.payment_method}`] : []),
    "",
    "¡Gracias por tu compra!",
  ].join("\n");
}
