import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatAmount, formatMoney } from "@/lib/currency";
import { warrantyDocumentLine } from "@/lib/deviceWarranty";
import { saleToPay, saleTotal } from "@/lib/saleReceipt";
import { discountOf, lineListPrice, listTotalOf } from "@/lib/saleDiscount";
import { ticketNumber } from "@/lib/ticketNumber";
import type { TicketSale } from "@/components/SaleTicket";

// Lo que dice el ticket de venta, fila por fila, sin nada de dibujo: el canvas de
// SaleTicket.tsx solo decide tamaños y posiciones. Separado así para poder probar
// el contenido (qué sale, en qué orden) sin un navegador.

export type TicketTextSize = "header" | "body" | "small" | "total";

export type TicketRow =
  /** Texto centrado (nombre del negocio, sucursal, agradecimiento). */
  | { kind: "center"; text: string; size: TicketTextSize }
  /** Texto a la izquierda que, si es largo, sigue en la línea de abajo. */
  | { kind: "text"; text: string; size: TicketTextSize }
  /** Dos textos en la misma línea: uno a la izquierda y otro a la derecha. */
  | { kind: "pair"; left: string; right: string; size: TicketTextSize }
  | { kind: "dashed" }
  | { kind: "gap"; mm: number };

/** Espacio mínimo entre lo de la izquierda y lo de la derecha de una fila: más o menos un carácter. */
export function minRowGap(fontSizePx: number): number {
  return Math.round(fontSizePx * 0.6);
}

/**
 * ¿Entran los dos textos de una fila en la misma línea sin tocarse? En un papel de 58 mm
 * (unos 48 mm imprimibles) muchas filas no entran; cuando no entran, el de la derecha baja
 * a su propia línea en vez de dibujarse encima del de la izquierda.
 */
export function rowFits(leftWidth: number, rightWidth: number, lineWidth: number, fontSizePx: number): boolean {
  return leftWidth + rightWidth + minRowGap(fontSizePx) <= lineWidth;
}

/**
 * Parte un texto en líneas que no pasen de `maxWidth`, cortando entre palabras. `measure`
 * dice cuánto ocupa un texto (en el ticket, ctx.measureText con la letra ya elegida).
 *
 * No pierde texto: la última línea siempre se incluye (antes se descartaba cuando el texto
 * se partía, y salían cortados nombres de producto, la fecha de la garantía y los nombres
 * de clientes largos). Una palabra más ancha que el papel entero —un código largo sin
 * espacios— se corta por letras en vez de salirse. Siempre devuelve al menos una línea.
 */
export function wrapTextToWidth(measure: (text: string) => number, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  const flush = () => {
    if (current) lines.push(current);
    current = "";
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const joined = current ? `${current} ${word}` : word;
    if (measure(joined) <= maxWidth) {
      current = joined;
      continue;
    }
    flush();
    if (measure(word) <= maxWidth) {
      current = word;
      continue;
    }
    for (const letter of Array.from(word)) {
      if (current && measure(current + letter) > maxWidth) flush();
      current += letter;
    }
  }
  flush();
  return lines.length > 0 ? lines : [""];
}

export function buildTicketRows(sale: TicketSale, shopName: string, branchName?: string | null): TicketRow[] {
  const rows: TicketRow[] = [];

  rows.push({ kind: "center", text: shopName, size: "header" });
  if (branchName) rows.push({ kind: "center", text: branchName, size: "small" });
  rows.push({ kind: "center", text: "Comprobante de venta", size: "small" });
  rows.push({ kind: "gap", mm: 1 });
  rows.push({ kind: "dashed" });

  // El número arriba y la fecha con la hora abajo, cada uno en su línea: juntos en una
  // sola fila no entran en un papel de 58 mm y se imprimen uno encima del otro.
  rows.push({ kind: "text", text: `Ticket #${ticketNumber(sale.id)}`, size: "small" });
  rows.push({ kind: "text", text: format(new Date(sale.created_at), "dd/MM/yy HH:mm", { locale: es }), size: "small" });
  const buyerName = sale.customer_name?.trim();
  if (buyerName) rows.push({ kind: "text", text: `Cliente: ${buyerName}`, size: "small" });
  rows.push({ kind: "dashed" });

  let hasWarranty = false;
  for (const item of sale.items) {
    rows.push({ kind: "text", text: item.product_name, size: "body" });
    if (item.imei) rows.push({ kind: "text", text: `IMEI ${item.imei}`, size: "small" });
    const warrantyLine = warrantyDocumentLine(sale.created_at, item.warranty_days);
    if (warrantyLine) {
      rows.push({ kind: "text", text: warrantyLine, size: "small" });
      if (Number(item.warranty_days) > 0) hasWarranty = true;
    }
    // A precio de lista (el que el dueño ve en el catálogo y en el carrito); el descuento, si
    // lo hubo, se muestra aparte en los totales. Sin el símbolo de la moneda: repetido en cada
    // precio ocupaba la mitad de la línea. La moneda figura una sola vez, en el total.
    const unit = lineListPrice(item);
    rows.push({
      kind: "pair",
      left: `${item.quantity} x ${formatAmount(unit)}`,
      right: formatAmount(item.quantity * unit),
      size: "body",
    });
    rows.push({ kind: "gap", mm: 0.8 });
  }
  rows.push({ kind: "dashed" });

  const discount = discountOf(sale.items);
  const tradeInValue = sale.trade_in && sale.trade_in.value > 0 ? sale.trade_in.value : 0;
  const depositValue = sale.deposit && sale.deposit > 0 ? sale.deposit : 0;
  const hasAdjustments = tradeInValue > 0 || depositValue > 0;
  if (discount > 0 || hasAdjustments) {
    // Subtotal a precio de lista, y de ahí se resta cada cosa: descuento, canje, seña.
    rows.push({ kind: "pair", left: "Subtotal", right: formatMoney(listTotalOf(sale.items)), size: "body" });
    if (discount > 0) rows.push({ kind: "pair", left: "Descuento", right: `-${formatMoney(discount)}`, size: "body" });
    if (tradeInValue > 0 && sale.trade_in) {
      rows.push({ kind: "text", text: `Equipo recibido: ${sale.trade_in.device_name}`, size: "small" });
      rows.push({ kind: "pair", left: "Canje", right: `-${formatMoney(tradeInValue)}`, size: "body" });
    }
    if (depositValue > 0) rows.push({ kind: "pair", left: "Seña abonada", right: `-${formatMoney(depositValue)}`, size: "body" });
    rows.push({ kind: "pair", left: hasAdjustments ? "A PAGAR" : "TOTAL", right: formatMoney(saleToPay(sale)), size: "total" });
  } else {
    rows.push({ kind: "pair", left: "TOTAL", right: formatMoney(saleTotal(sale)), size: "total" });
  }
  rows.push({ kind: "pair", left: "Pago", right: sale.payment_method || "—", size: "small" });
  rows.push({ kind: "dashed" });
  if (hasWarranty) rows.push({ kind: "text", text: "Conserve este ticket: es su comprobante de garantía.", size: "small" });
  rows.push({ kind: "center", text: "¡Gracias por su compra!", size: "small" });
  rows.push({ kind: "gap", mm: 1 });

  return rows;
}
