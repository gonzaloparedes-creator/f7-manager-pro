// Reporte completo de una orden: todo lo que se hizo, listo para imprimir o guardar como PDF.
// Lógica pura + impresión en un iframe aislado, sin React ni Supabase (mismo criterio que
// el dossier de equipos, lib/deviceDossier.ts).
//
// Dos versiones:
//  - "cliente": lo mismo que el cliente ya puede ver en su link de seguimiento (historial
//    visible, notas técnicas, fotos), más lo económico de SU orden. Nunca notas internas,
//    costos, ganancia ni quién hizo cada cosa.
//  - "interno": además los movimientos internos del historial, quién hizo cada cosa, el
//    teléfono y la cédula, y, solo si quien imprime puede ver costos, costo y ganancia.
// En ninguna va el PIN ni el patrón de desbloqueo del equipo.

import { formatMoney } from "@/lib/currency";
import { escapeHtml } from "@/lib/devicePurchaseReceipt";
import { receiptWarranty } from "@/lib/receiptWarranty";

export type OrderReportVariant = "cliente" | "interno";

export interface OrderReportOrder {
  order_number: string;
  created_at: string;
  status_label: string;
  customer_name: string;
  customer_phone: string | null;
  customer_cedula: string | null;
  device_type: string;
  marca: string | null;
  modelo: string | null;
  imei: string | null;
  problems: string[];
  problem_other: string | null;
  problem_description: string | null;
  accessories: string[];
  checklist: { label: string; status: "ok" | "fail" }[];
  received_by_name: string | null;
  assigned_technician_name: string | null;
  branch_name: string | null;
  priority_label: string | null;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
  warranty_days: number | null;
  quote_amount: number;
  original_quote_amount: number | null;
  deposit_amount: number;
  cargos_adicionales: { motivo: string; monto: number }[];
  quote_response_label: string | null;
  quote_response_note: string | null;
  quote_responded_at: string | null;
  interruption_reason: string | null;
  photos: string[];
  financial_documents: { name: string; uploaded_at: string }[];
}

export interface OrderReportHistoryEntry {
  status_label: string;
  note: string | null;
  created_at: string;
  is_internal: boolean;
  image_urls: string[];
}

export interface OrderReportNote {
  note: string;
  created_at: string;
  author: string | null;
}

export interface OrderReportPart {
  name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  details: string | null;
  supplier: string | null;
}

export interface OrderReportPayment {
  amount: number;
  method: string | null;
  created_at: string;
  author: string | null;
}

export interface OrderReportData {
  order: OrderReportOrder;
  history: OrderReportHistoryEntry[];
  notes: OrderReportNote[];
  parts: OrderReportPart[];
  payments: OrderReportPayment[];
}

export interface OrderReportOptions {
  variant: OrderReportVariant;
  businessName: string | null;
  /** Solo cuenta en la versión interna: quien no ve costos no los recibe en el papel. */
  canViewCosts: boolean;
  now?: Date;
}

const num = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Las fechas sueltas ("2026-10-25") se leen como locales: con `new Date("2026-10-25")` en
// Paraguay (UTC-3) saldría el día anterior.
function formatDay(value: string): string {
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export interface OrderReportTotals {
  quote: number;
  cargos: number;
  total: number;
  paid: number;
  balance: number;
}

// Mismas cuentas que la pantalla de la orden: total = presupuesto + cargos adicionales.
export function orderReportTotals(
  order: Pick<OrderReportOrder, "quote_amount" | "deposit_amount" | "cargos_adicionales">,
): OrderReportTotals {
  const quote = num(order.quote_amount);
  const cargos = order.cargos_adicionales.reduce((s, c) => s + num(c.monto), 0);
  const total = quote + cargos;
  const paid = num(order.deposit_amount);
  return { quote, cargos, total, paid, balance: Math.max(0, total - paid) };
}

export interface OrderReportProfit {
  partsPrice: number;
  partsCost: number;
  profit: number;
  marginPct: number | null;
}

// Misma cuenta que OrderPartsSection: ganancia = total que paga el cliente - costo de repuestos.
export function orderReportProfit(total: number, parts: OrderReportPart[]): OrderReportProfit {
  const partsPrice = parts.reduce((s, p) => s + num(p.unit_price) * num(p.quantity), 0);
  const partsCost = parts.reduce((s, p) => s + num(p.unit_cost) * num(p.quantity), 0);
  const profit = total - partsCost;
  return { partsPrice, partsCost, profit, marginPct: total > 0 ? Math.round((profit / total) * 100) : null };
}

export function warrantyLine(order: Pick<OrderReportOrder, "warranty_days" | "delivered_at" | "estimated_delivery_date">): string {
  const w = receiptWarranty(order);
  if (w.kind === "none") return "Sin garantía";
  if (!w.endsOn) return `${w.daysLabel} desde la entrega`;
  return w.estimated ? `${w.daysLabel}, hasta el ${w.endsOn} (estimado)` : `${w.daysLabel}, hasta el ${w.endsOn}`;
}

function row(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function rowHtml(label: string, valueHtml: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${valueHtml}</td></tr>`;
}

function section(title: string, inner: string): string {
  return inner.trim() ? `<h2>${escapeHtml(title)}</h2>${inner}` : "";
}

function thumbs(urls: string[], cls = "thumbs"): string {
  const safe = urls.filter((u) => /^https?:\/\//i.test(u));
  if (safe.length === 0) return "";
  return `<div class="${cls}">${safe.map((u) => `<img src="${escapeHtml(u)}" alt="">`).join("")}</div>`;
}

function listText(values: string[]): string {
  return values.map((v) => v.trim()).filter(Boolean).join(", ");
}

function equipmentSection(o: OrderReportOrder): string {
  const failure = [listText(o.problems), o.problem_other?.trim() ?? ""].filter(Boolean).join(", ");
  const checklist = o.checklist.length
    ? `<ul class="checks">${o.checklist
        .map((c) => `<li class="${c.status === "ok" ? "ok" : "fail"}"><span>${c.status === "ok" ? "OK" : "Falla"}</span> ${escapeHtml(c.label)}</li>`)
        .join("")}</ul>`
    : "";
  return section(
    "Equipo y falla",
    `<table>
      ${row("Equipo", o.device_type)}
      ${row("Marca", o.marca)}
      ${row("Modelo", o.modelo)}
      ${row("IMEI / serie", o.imei)}
      ${row("Falla reportada", failure)}
      ${o.problem_description?.trim() ? rowHtml("Descripción", `<span class="pre">${escapeHtml(o.problem_description.trim())}</span>`) : ""}
      ${row("Accesorios entregados", listText(o.accessories))}
      ${checklist ? rowHtml("Chequeo al recibir", checklist) : ""}
    </table>`,
  );
}

function datesSection(o: OrderReportOrder, interno: boolean): string {
  return section(
    "Fechas y responsables",
    `<table>
      ${row("Ingreso", formatDateTime(o.created_at))}
      ${row("Recibido por", o.received_by_name)}
      ${interno ? row("Técnico asignado", o.assigned_technician_name) : ""}
      ${interno ? row("Sucursal", o.branch_name) : ""}
      ${interno ? row("Prioridad", o.priority_label) : ""}
      ${row("Entrega estimada", o.estimated_delivery_date ? formatDay(o.estimated_delivery_date) : null)}
      ${row("Entregado", o.delivered_at ? formatDateTime(o.delivered_at) : null)}
      ${row("Garantía", warrantyLine(o))}
      ${interno ? row("Motivo de interrupción", o.interruption_reason) : ""}
    </table>`,
  );
}

function historySection(history: OrderReportHistoryEntry[], interno: boolean): string {
  const visible = history
    .filter((h) => interno || !h.is_internal)
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (visible.length === 0) return "";
  const items = visible
    .map((h) => {
      const tag = interno && h.is_internal ? ` <span class="tag-int">interno</span>` : "";
      return `<li><div class="when">${escapeHtml(formatDateTime(h.created_at))}</div><div><strong>${escapeHtml(h.status_label)}</strong>${tag}${
        h.note?.trim() ? `<div class="pre muted">${escapeHtml(h.note.trim())}</div>` : ""
      }${thumbs(h.image_urls, "thumbs sm")}</div></li>`;
    })
    .join("");
  return section("Historial de la orden", `<ol class="timeline">${items}</ol>`);
}

function notesSection(notes: OrderReportNote[], interno: boolean): string {
  if (notes.length === 0) return "";
  const items = notes
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(
      (n) =>
        `<li><div class="when">${escapeHtml(formatDateTime(n.created_at))}${
          interno && n.author ? `<div>${escapeHtml(n.author)}</div>` : ""
        }</div><div class="pre">${escapeHtml(n.note)}</div></li>`,
    )
    .join("");
  return section("Notas técnicas", `<ol class="timeline">${items}</ol>`);
}

function partsSection(parts: OrderReportPart[], interno: boolean, showCosts: boolean): string {
  if (parts.length === 0) return "";
  const head = `<tr><th>Repuesto</th><th class="r">Cant.</th>${showCosts ? '<th class="r">Costo</th><th class="r">Precio</th>' : ""}</tr>`;
  const rows = parts
    .map((p) => {
      const extra = [p.details?.trim(), interno && p.supplier?.trim() ? `Proveedor: ${p.supplier.trim()}` : ""].filter(Boolean).join(" · ");
      return `<tr><td>${escapeHtml(p.name)}${extra ? `<div class="muted">${escapeHtml(extra)}</div>` : ""}</td><td class="r">${escapeHtml(num(p.quantity))}</td>${
        showCosts
          ? `<td class="r">${escapeHtml(formatMoney(num(p.unit_cost)))}</td><td class="r">${escapeHtml(formatMoney(num(p.unit_price)))}</td>`
          : ""
      }</tr>`;
    })
    .join("");
  return section("Repuestos usados", `<table class="grid">${head}${rows}</table>`);
}

function moneySection(o: OrderReportOrder, t: OrderReportTotals, interno: boolean, showCosts: boolean, parts: OrderReportPart[]): string {
  const cargos = o.cargos_adicionales
    .filter((c) => num(c.monto) !== 0)
    .map((c) => row(`Cargo: ${c.motivo || "adicional"}`, formatMoney(num(c.monto))))
    .join("");
  const original = interno && o.original_quote_amount !== null && num(o.original_quote_amount) > 0 && num(o.original_quote_amount) !== t.quote
    ? row("Presupuesto original", formatMoney(num(o.original_quote_amount)))
    : "";
  const profit = showCosts
    ? (() => {
        const p = orderReportProfit(t.total, parts);
        return `${row("Costo de repuestos", formatMoney(p.partsCost))}${row(
          "Ganancia de la orden",
          `${formatMoney(p.profit)}${p.marginPct === null ? "" : ` (${p.marginPct}%)`}`,
        )}`;
      })()
    : "";
  return section(
    "Cuentas",
    `<table>
      ${original}
      ${row("Presupuesto", formatMoney(t.quote))}
      ${cargos}
      ${row("Total", formatMoney(t.total))}
      ${row("Pagado", formatMoney(t.paid))}
      ${row("Saldo", formatMoney(t.balance))}
      ${profit}
    </table>`,
  );
}

function paymentsSection(payments: OrderReportPayment[], interno: boolean): string {
  if (payments.length === 0) return "";
  const rows = payments
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(
      (p) =>
        `<tr><td>${escapeHtml(formatDateTime(p.created_at))}</td><td>${escapeHtml(p.method ?? "—")}${
          interno && p.author ? ` <span class="muted">· ${escapeHtml(p.author)}</span>` : ""
        }</td><td class="r">${escapeHtml(formatMoney(num(p.amount)))}</td></tr>`,
    )
    .join("");
  return section("Pagos registrados", `<table class="grid"><tr><th>Fecha</th><th>Medio</th><th class="r">Monto</th></tr>${rows}</table>`);
}

function quoteResponseSection(o: OrderReportOrder): string {
  if (!o.quote_response_label) return "";
  return section(
    "Respuesta al presupuesto",
    `<table>
      ${row("Respuesta del cliente", o.quote_response_label)}
      ${row("Cuándo", o.quote_responded_at ? formatDateTime(o.quote_responded_at) : null)}
      ${o.quote_response_note?.trim() ? rowHtml("Comentario", `<span class="pre">${escapeHtml(o.quote_response_note.trim())}</span>`) : ""}
    </table>`,
  );
}

function documentsSection(o: OrderReportOrder): string {
  if (o.financial_documents.length === 0) return "";
  return section(
    "Documentos adjuntos",
    `<table>${o.financial_documents
      .map((d) => row(d.name, d.uploaded_at ? `cargado el ${formatDateTime(d.uploaded_at)}` : "cargado"))
      .join("")}</table>`,
  );
}

export function buildOrderReportHtml(data: OrderReportData, options: OrderReportOptions): string {
  const now = options.now ?? new Date();
  const interno = options.variant === "interno";
  const showCosts = interno && options.canViewCosts;
  const o = data.order;
  const totals = orderReportTotals(o);

  const identity = interno
    ? `<table>
        ${row("Cliente", o.customer_name)}
        ${row("Teléfono", o.customer_phone)}
        ${row("Cédula", o.customer_cedula)}
      </table>`
    : `<table>${row("Cliente", o.customer_name)}</table>`;

  const body = [
    section("Cliente", identity),
    equipmentSection(o),
    datesSection(o, interno),
    quoteResponseSection(o),
    historySection(data.history, interno),
    notesSection(data.notes, interno),
    partsSection(data.parts, interno, showCosts),
    moneySection(o, totals, interno, showCosts, data.parts),
    paymentsSection(data.payments, interno),
    documentsSection(o),
    o.photos.length ? section("Fotos de recepción", thumbs(o.photos, "thumbs lg")) : "",
  ].join("\n");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(`Reporte ${o.order_number}`)}</title><style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; border-bottom: 2px solid #111; padding-bottom: 3mm; }
.biz { font-size: 14px; font-weight: 700; }
h1 { margin: 2mm 0 0; font-size: 22px; line-height: 1.2; }
h2 { margin: 6mm 0 1.5mm; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #444; break-after: avoid; }
.tag { text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #444; }
.tag strong { display: block; font-size: 12px; color: ${interno ? "#b00020" : "#111"}; }
.status { margin-top: 4mm; padding: 2mm 3mm; border: 1px solid #999; border-radius: 2mm; font-weight: 600; }
.muted { color: #555; font-size: 11px; }
.pre { white-space: pre-wrap; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 1.4mm 0; text-align: left; vertical-align: top; border-bottom: 1px solid #ddd; }
table:not(.grid) th { width: 55mm; font-weight: 600; color: #333; }
table.grid th { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #444; }
.r { text-align: right; white-space: nowrap; padding-left: 3mm; }
tr { break-inside: avoid; }
.timeline { list-style: none; margin: 0; padding: 0; }
.timeline li { display: flex; gap: 5mm; padding: 1.6mm 0; border-bottom: 1px solid #ddd; break-inside: avoid; }
.timeline .when { width: 36mm; flex: none; color: #555; font-size: 11px; }
.tag-int { display: inline-block; margin-left: 2mm; padding: 0 1.5mm; border: 1px solid #b00020; border-radius: 1mm; color: #b00020; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
.checks { list-style: none; margin: 0; padding: 0; columns: 2; }
.checks li { padding: .4mm 0; }
.checks span { display: inline-block; min-width: 9mm; font-weight: 700; font-size: 10px; }
.checks .fail span { color: #b00020; }
.thumbs { display: flex; flex-wrap: wrap; gap: 2mm; margin-top: 1.5mm; }
.thumbs img { width: 30mm; height: 30mm; object-fit: cover; border: 1px solid #ccc; }
.thumbs.sm img { width: 22mm; height: 22mm; }
.thumbs.lg img { width: 42mm; height: 42mm; }
footer { margin-top: 8mm; font-size: 10px; color: #555; }
</style></head><body>
<header>
  <div>
    <div class="biz">${escapeHtml(options.businessName || "Reporte de la orden")}</div>
    <h1>Orden ${escapeHtml(o.order_number)}</h1>
  </div>
  <div class="tag">${interno ? "<strong>Uso interno</strong>Reporte completo de la orden" : "Reporte de la orden"}<div>${escapeHtml(formatDateTime(now.toISOString()))}</div></div>
</header>
<div class="status">Estado actual: ${escapeHtml(o.status_label)}</div>
${body}
<footer>${
    interno
      ? `Documento de uso interno: incluye los movimientos internos de la orden${showCosts ? ", costos y ganancia" : ""}. No se entrega al cliente.`
      : `Reporte generado el ${escapeHtml(formatDateTime(now.toISOString()))}, con el estado de la orden a esa fecha.`
  }</footer>
</body></html>`;
}

function imagesLoaded(doc: Document, timeoutMs: number): Promise<void> {
  const pending = Array.from(doc.images).filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let left = pending.length;
    const done = () => {
      if (--left <= 0) resolve();
    };
    pending.forEach((img) => {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
    window.setTimeout(resolve, timeoutMs);
  });
}

// Imprime en un iframe aislado (mismo criterio que el ticket, el comprobante y el dossier).
// Espera las fotos antes de abrir el diálogo, o saldrían en blanco.
export function printOrderReport(data: OrderReportData, options: OrderReportOptions): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => iframe.remove();
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) return cleanup();

  doc.open();
  doc.write(buildOrderReportHtml(data, options));
  doc.close();

  win.addEventListener("afterprint", cleanup, { once: true });
  void imagesLoaded(doc, 6000).then(() => {
    win.focus();
    win.print();
  });
  window.setTimeout(cleanup, 120000);
}
