// Dossier por equipo (B1 seminuevos): ficha imprimible / PDF de un celular.
// Lógica pura + impresión en un iframe aislado, sin React ni Supabase.
//
// Dos versiones: "cliente" (para mostrar o mandar: foto, precio, IMEI, batería; nunca
// costos, origen, notas ni historial) e "interno" (costos, ganancia, estado e historial).
// En ninguna va el mínimo de negociación: es un dato que se destapa a propósito en pantalla.

import { formatMoney } from "@/lib/currency";
import { escapeHtml } from "@/lib/devicePurchaseReceipt";
import { daysInStock, daysInStockLabel } from "@/lib/deviceStock";
import { originLabel, parseBattery } from "@/lib/deviceSpecs";
import { displayDate } from "@/lib/reservations";

export type DossierVariant = "cliente" | "interno";

export interface DossierDevice {
  name: string;
  imei: string | null;
  battery_health: number | null;
  origin: string | null;
  selling_price: number | string;
  cost_price: number | string;
  purchase_cost: number | string;
  repair_cost: number | string;
  repair_details: string | null;
  notes: string | null;
  image_url: string | null;
  stock: number;
  created_at: string | null;
}

export interface DossierPurchase {
  receipt_number: string;
  kind: "compra" | "canje";
  created_at: string;
  purchase_price: number | string;
}

export interface DossierReservation {
  receipt_number: string;
  customer_name: string;
  status: "activa" | "vendida" | "cancelada";
  created_at: string;
  resolved_at: string | null;
  agreed_price: number | string;
  deposit_amount: number | string;
  refunded_amount: number | string;
  retained_amount: number | string;
  expires_on: string;
}

export interface DossierSale {
  created_at: string;
  quantity: number;
  unit_price: number | string;
  unit_cost: number | string;
  payment_method: string | null;
  warranty_days: number | null;
  customer_name: string | null;
  reservation_deposit: number | string | null;
}

export interface DossierHistory {
  purchases: DossierPurchase[];
  reservations: DossierReservation[];
  sales: DossierSale[];
}

export interface DossierOptions {
  variant: DossierVariant;
  businessName: string | null;
  branchName: string | null;
  categoryLabel: string | null;
  now?: Date;
}

export interface DossierEvent {
  at: string;
  title: string;
  detail: string | null;
}

const num = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function warrantyText(days: number | null): string {
  if (days === null) return "Sin garantía registrada";
  if (days <= 0) return "Sin garantía";
  return `${days} día${days === 1 ? "" : "s"} de garantía`;
}

export function buildDossierEvents(device: DossierDevice, history: DossierHistory): DossierEvent[] {
  const events: DossierEvent[] = [];
  if (device.created_at) events.push({ at: device.created_at, title: "Ingresó al catálogo", detail: null });

  for (const p of history.purchases) {
    events.push(
      p.kind === "canje"
        ? { at: p.created_at, title: `Recibido en canje · ${p.receipt_number}`, detail: `Valor reconocido ${formatMoney(num(p.purchase_price))}` }
        : { at: p.created_at, title: `Comprado a un cliente · ${p.receipt_number}`, detail: `Pagado ${formatMoney(num(p.purchase_price))}` },
    );
  }

  for (const r of history.reservations) {
    const deposit = num(r.deposit_amount);
    events.push({
      at: r.created_at,
      title: `Reservado · ${r.receipt_number}`,
      detail: `Para ${r.customer_name} · precio acordado ${formatMoney(num(r.agreed_price))} · ${deposit > 0 ? `seña ${formatMoney(deposit)}` : "sin seña"}`,
    });
    if (r.status === "cancelada" && r.resolved_at) {
      events.push({
        at: r.resolved_at,
        title: `Reserva cancelada · ${r.receipt_number}`,
        detail: `Devuelto ${formatMoney(num(r.refunded_amount))} · retenido ${formatMoney(num(r.retained_amount))}`,
      });
    }
  }

  for (const s of history.sales) {
    const deposit = num(s.reservation_deposit);
    const parts = [
      `${formatMoney(num(s.unit_price))}${s.payment_method ? ` (${s.payment_method})` : ""}`,
      s.customer_name ? `a ${s.customer_name}` : null,
      warrantyText(s.warranty_days),
      deposit > 0 ? `seña ya abonada ${formatMoney(deposit)}` : null,
    ].filter(Boolean);
    events.push({ at: s.created_at, title: "Vendido", detail: parts.join(" · ") });
  }

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export interface DossierFinance {
  purchaseCost: number;
  repairCost: number;
  totalCost: number;
  listPrice: number;
  estimatedProfit: number;
  estimatedMarginPct: number | null;
  sold: { price: number; cost: number; profit: number; marginPct: number | null } | null;
}

export function dossierFinance(device: DossierDevice, history: DossierHistory): DossierFinance {
  const totalCost = num(device.cost_price);
  const listPrice = num(device.selling_price);
  const lastSale = history.sales.length ? history.sales[history.sales.length - 1] : null;
  const sold = lastSale
    ? (() => {
        const price = num(lastSale.unit_price) * (lastSale.quantity || 1);
        const cost = num(lastSale.unit_cost) * (lastSale.quantity || 1);
        return { price, cost, profit: price - cost, marginPct: price > 0 ? Math.round(((price - cost) / price) * 100) : null };
      })()
    : null;
  return {
    purchaseCost: num(device.purchase_cost),
    repairCost: num(device.repair_cost),
    totalCost,
    listPrice,
    estimatedProfit: listPrice - totalCost,
    estimatedMarginPct: listPrice > 0 ? Math.round(((listPrice - totalCost) / listPrice) * 100) : null,
    sold,
  };
}

export function dossierStatusText(device: DossierDevice, history: DossierHistory, now: Date = new Date()): string {
  const active = history.reservations.find((r) => r.status === "activa");
  if (device.stock > 0 && active) return `Reservado para ${active.customer_name} · vence ${displayDate(active.expires_on)}`;
  if (device.stock > 0) {
    const days = daysInStock(device.created_at, now);
    return days === null ? "En stock" : `En stock · ${daysInStockLabel(days)}`;
  }
  const lastSale = history.sales.length ? history.sales[history.sales.length - 1] : null;
  if (lastSale) {
    const days = daysInStock(device.created_at, new Date(lastSale.created_at));
    const tardo = days === null ? "" : days === 0 ? " · se vendió el mismo día que ingresó" : ` · tardó ${days} día${days === 1 ? "" : "s"} en venderse`;
    return `Vendido el ${formatDate(lastSale.created_at)}${tardo}`;
  }
  return "Sin stock";
}

function row(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function rowHtml(label: string, valueHtml: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${valueHtml}</td></tr>`;
}

function photoBlock(device: DossierDevice): string {
  return device.image_url
    ? `<div class="photo"><img src="${escapeHtml(device.image_url)}" alt=""></div>`
    : "";
}

function customerBody(device: DossierDevice): string {
  const battery = parseBattery(device.battery_health).value;
  return `${photoBlock(device)}
  <h2>Detalle del equipo</h2>
  <table>
    ${row("IMEI", device.imei)}
    ${row("Batería", battery === null ? null : `${battery}%`)}
  </table>
  <div class="price-box"><span>Precio</span><strong>${escapeHtml(formatMoney(num(device.selling_price)))}</strong></div>`;
}

function internalBody(device: DossierDevice, history: DossierHistory, options: DossierOptions): string {
  const now = options.now ?? new Date();
  const finance = dossierFinance(device, history);
  const battery = parseBattery(device.battery_health).value;
  const events = buildDossierEvents(device, history);
  const margin = (pct: number | null) => (pct === null ? "" : ` (${pct}%)`);

  const costRows = [
    finance.purchaseCost > 0 ? row("Costo de compra", formatMoney(finance.purchaseCost)) : "",
    finance.repairCost > 0 ? row("Reparaciones", formatMoney(finance.repairCost)) : "",
    row("Costo total", formatMoney(finance.totalCost)),
    row("Precio de venta (lista)", formatMoney(finance.listPrice)),
    row("Ganancia estimada a precio de lista", `${formatMoney(finance.estimatedProfit)}${margin(finance.estimatedMarginPct)}`),
  ].join("");

  const soldRows = finance.sold
    ? `${row("Vendido por", formatMoney(finance.sold.price))}${row("Ganancia real", `${formatMoney(finance.sold.profit)}${margin(finance.sold.marginPct)}`)}`
    : "";

  const timeline = events.length
    ? `<h2>Historial</h2>
  <ol class="timeline">${events
    .map(
      (e) =>
        `<li><div class="when">${escapeHtml(formatDateTime(e.at))}</div><div><strong>${escapeHtml(e.title)}</strong>${
          e.detail ? `<div class="muted">${escapeHtml(e.detail)}</div>` : ""
        }</div></li>`,
    )
    .join("")}</ol>`
    : "";

  return `<div class="status">${escapeHtml(dossierStatusText(device, history, now))}</div>
  ${photoBlock(device)}
  <h2>Identificación</h2>
  <table>
    ${row("IMEI", device.imei)}
    ${row("Batería", battery === null ? null : `${battery}%`)}
    ${row("Origen", originLabel(device.origin))}
    ${row("Categoría", options.categoryLabel)}
    ${row("Sucursal", options.branchName)}
  </table>
  <h2>Finanzas</h2>
  <table>${costRows}${soldRows}</table>
  ${
    device.repair_details || device.notes
      ? `<h2>Repuestos y notas</h2><table>${device.repair_details ? rowHtml("Repuestos", escapeHtml(device.repair_details)) : ""}${
          device.notes ? rowHtml("Notas", `<span class="pre">${escapeHtml(device.notes)}</span>`) : ""
        }</table>`
      : ""
  }
  ${timeline}`;
}

export function buildDossierHtml(device: DossierDevice, history: DossierHistory, options: DossierOptions): string {
  const now = options.now ?? new Date();
  const interno = options.variant === "interno";
  const business = [options.businessName, options.branchName].filter(Boolean).join(" · ");
  const body = interno ? internalBody(device, history, options) : customerBody(device);

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(device.name)}</title><style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; border-bottom: 2px solid #111; padding-bottom: 3mm; }
.biz { font-size: 14px; font-weight: 700; }
h1 { margin: 2mm 0 0; font-size: 22px; line-height: 1.2; }
h2 { margin: 6mm 0 1.5mm; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #444; }
.tag { text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #444; white-space: nowrap; }
.tag strong { display: block; font-size: 12px; color: ${interno ? "#b00020" : "#111"}; }
.status { margin-top: 4mm; padding: 2mm 3mm; border: 1px solid #999; border-radius: 2mm; font-weight: 600; }
.photo { margin-top: 4mm; text-align: center; }
.photo img { max-width: 100%; max-height: 95mm; object-fit: contain; }
.muted { color: #555; font-size: 11px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 1.4mm 0; text-align: left; vertical-align: top; border-bottom: 1px solid #ddd; }
th { width: 55mm; font-weight: 600; color: #333; }
.pre { white-space: pre-wrap; }
.price-box { display: flex; justify-content: space-between; align-items: center; margin-top: 6mm; padding: 4mm 5mm; border: 2px solid #111; border-radius: 2mm; }
.price-box span { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
.price-box strong { font-size: 26px; }
.timeline { list-style: none; margin: 0; padding: 0; }
.timeline li { display: flex; gap: 5mm; padding: 1.6mm 0; border-bottom: 1px solid #ddd; break-inside: avoid; }
.timeline .when { width: 36mm; flex: none; color: #555; font-size: 11px; }
footer { margin-top: 8mm; font-size: 10px; color: #555; }
</style></head><body>
<header>
  <div>
    <div class="biz">${escapeHtml(business || "Ficha de equipo")}</div>
    <h1>${escapeHtml(device.name)}</h1>
  </div>
  <div class="tag">${interno ? "<strong>Uso interno</strong>Dossier del equipo" : "Ficha del equipo"}<div>${escapeHtml(formatDate(now))}</div></div>
</header>
${body}
<footer>${
    interno
      ? "Documento interno: contiene costos y ganancias. No se entrega al cliente."
      : `Información vigente al ${escapeHtml(formatDate(now))}. El precio y la disponibilidad pueden cambiar sin previo aviso.`
  }</footer>
</body></html>`;
}

function imagesLoaded(doc: Document, timeoutMs: number): Promise<void> {
  const pending = Array.from(doc.images).filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let left = pending.length;
    const done = () => { if (--left <= 0) resolve(); };
    pending.forEach((img) => {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
    window.setTimeout(resolve, timeoutMs);
  });
}

// Imprime en un iframe aislado (mismo criterio que el ticket y el comprobante de
// compra). Espera la foto antes de abrir el diálogo, o saldría en blanco.
export function printDossier(device: DossierDevice, history: DossierHistory, options: DossierOptions): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => iframe.remove();
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) return cleanup();

  doc.open();
  doc.write(buildDossierHtml(device, history, options));
  doc.close();

  win.addEventListener("afterprint", cleanup, { once: true });
  void imagesLoaded(doc, 4000).then(() => {
    win.focus();
    win.print();
  });
  window.setTimeout(cleanup, 60000);
}
