import { formatPYG } from "@/lib/orders";
import { summarizeChecklist, type DevicePurchaseRecord } from "@/lib/devicePurchase";

export interface PurchaseReceiptOptions {
  businessName: string | null;
  branchName: string | null;
}

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function copy(record: DevicePurchaseRecord, options: PurchaseReceiptOptions, copyLabel: string): string {
  const status = summarizeChecklist(record.checklist);
  const when = new Date(record.created_at).toLocaleString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const business = [options.businessName, options.branchName].filter(Boolean).join(" · ");
  const canje = record.kind === "canje";

  const condition = record.checklist.length
    ? `<tr><th>Estado</th><td>${
        status.failCount
          ? `Con fallas: ${escapeHtml(status.failed.join(", "))}`
          : "Sin fallas detectadas"
      }${status.okCount ? `<div class="muted">Funciona: ${escapeHtml(status.okLabels.join(", "))}</div>` : ""}</td></tr>`
    : "";

  return `<section class="copy">
  <header>
    <div>
      <div class="biz">${escapeHtml(business || "Comprobante")}</div>
      <h1>${canje ? "Comprobante de equipo recibido en canje" : "Comprobante de compra de equipo"}</h1>
    </div>
    <div class="num">
      <div class="num-value">${escapeHtml(record.receipt_number)}</div>
      <div class="muted">${escapeHtml(when)}</div>
      <div class="tag">${escapeHtml(copyLabel)}</div>
    </div>
  </header>

  <h2>Equipo</h2>
  <table>
    ${row("Equipo", record.device_name)}
    ${row("IMEI / N° de serie", record.imei)}
    ${condition}
    ${row("Accesorios entregados", record.accessories.join(", "))}
    ${row(canje ? "Motivo del canje" : "Motivo de la venta", record.reason)}
    ${row("Observaciones", record.notes)}
  </table>

  <h2>${canje ? "Cliente que entrega el equipo" : "Vendedor"}</h2>
  <table>
    ${row("Nombre", record.seller_name)}
    ${row("Cédula", record.seller_cedula)}
    ${row("Teléfono", record.seller_phone)}
  </table>

  <h2>${canje ? "Valor del canje" : "Pago"}</h2>
  <table>
    ${
      canje
        ? `${row("Valor reconocido", formatPYG(record.purchase_price))}
    ${row("Forma de pago", "Descontado del precio de la venta")}`
        : `${row("Monto pagado", formatPYG(record.purchase_price))}
    ${row("Medio de pago", record.payment_method)}`
    }
  </table>

  <p class="decl">${
    canje
      ? `El cliente declara ser el legítimo propietario del equipo descripto, que lo entrega libre de
  reclamos, deudas, bloqueos y de todo reporte de robo o hurto, y que los datos consignados son verdaderos.
  Acepta que el valor indicado se descuente del precio de su compra, a su entera conformidad.`
      : `El vendedor declara ser el legítimo propietario del equipo descripto, que lo vende libre de
  reclamos, deudas, bloqueos y de todo reporte de robo o hurto, y que los datos consignados son verdaderos.
  Recibe el monto indicado a su entera conformidad.`
  }</p>

  <div class="sign">
    <div><span></span>${canje ? "Firma del cliente" : "Firma del vendedor"}</div>
    <div><span></span>Firma de la tienda</div>
  </div>
</section>`;
}

export function buildPurchaseReceiptHtml(record: DevicePurchaseRecord, options: PurchaseReceiptOptions): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(record.receipt_number)}</title><style>
@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 11px; }
.copy { height: 135mm; padding: 2mm 3mm; overflow: hidden; }
.copy + .copy { border-top: 1px dashed #888; margin-top: 4mm; padding-top: 6mm; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; border-bottom: 2px solid #111; padding-bottom: 3mm; }
.biz { font-size: 13px; font-weight: 700; }
h1 { margin: 1mm 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
h2 { margin: 4mm 0 1mm; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #444; }
.num { text-align: right; white-space: nowrap; }
.num-value { font-size: 16px; font-weight: 700; }
.tag { margin-top: 1mm; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #444; }
.muted { color: #555; font-size: 10px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 1mm 0; text-align: left; vertical-align: top; border-bottom: 1px solid #ddd; }
th { width: 38mm; font-weight: 600; color: #333; }
.decl { margin: 4mm 0 0; font-size: 10px; line-height: 1.4; }
.sign { display: flex; gap: 14mm; margin-top: 12mm; }
.sign div { flex: 1; text-align: center; font-size: 10px; color: #333; }
.sign span { display: block; border-top: 1px solid #111; margin-bottom: 1mm; }
</style></head><body>${copy(record, options, record.kind === "canje" ? "Copia del cliente" : "Copia del vendedor")}${copy(record, options, "Copia de la tienda")}</body></html>`;
}

// Imprime en un iframe aislado (mismo criterio que el ticket de venta): el
// trabajo de impresión lleva solo el comprobante, sin el CSS de la app.
export function printPurchaseReceipt(record: DevicePurchaseRecord, options: PurchaseReceiptOptions): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => iframe.remove();
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) return cleanup();

  doc.open();
  doc.write(buildPurchaseReceiptHtml(record, options));
  doc.close();

  win.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => {
    win.focus();
    win.print();
  }, 150);
  // Respaldo por si el navegador no dispara afterprint (algunos móviles).
  window.setTimeout(cleanup, 60000);
}
