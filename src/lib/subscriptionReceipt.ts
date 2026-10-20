import { PLAN_LABELS, PRICING, type Cycle, type PlanType } from "@/lib/plans";
import { escapeHtml } from "@/lib/devicePurchaseReceipt";

export type ReceiptCurrency = "PYG" | "USD";

export const CYCLE_LABELS: Record<Cycle, string> = {
  mensual: "Mensual",
  semestral: "Semestral",
  anual: "Anual",
};

export const CYCLE_MONTHS: Record<Cycle, number> = { mensual: 1, semestral: 6, anual: 12 };

export const CURRENCY_LABELS: Record<ReceiptCurrency, string> = {
  PYG: "Guaraníes (Gs.)",
  USD: "Dólares (US$)",
};

export const PAYMENT_METHODS = [
  "Transferencia bancaria",
  "Efectivo",
  "Tarjeta de crédito/débito",
  "Billetera móvil",
  "Giro",
  "Otro",
] as const;

export const DEFAULT_ISSUER_NAME = "F7 Manager Pro";

// Fila de subscription_receipts tal como la devuelve la base.
export interface SubscriptionReceipt {
  id: string;
  receipt_number: string;
  company_id: string | null;
  customer_name: string;
  customer_document: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  plan_type: PlanType;
  billing_cycle: Cycle;
  period_start: string;
  period_end: string;
  payment_date: string;
  // Precio antes del descuento; `amount` es lo que se recibió (subtotal − descuento).
  subtotal: number;
  discount_amount: number;
  discount_note: string | null;
  amount: number;
  currency: ReceiptCurrency;
  payment_method: string;
  payment_reference: string | null;
  description: string;
  notes: string | null;
  issuer_name: string;
  issuer_details: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
}

// Lo que escribe el super admin en el formulario (el resto lo pone la base).
export type ReceiptDraft = Omit<
  SubscriptionReceipt,
  "id" | "receipt_number" | "created_at" | "voided_at" | "void_reason"
>;

// ---------- Fechas (cadenas YYYY-MM-DD, sin zona horaria de por medio) ----------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseISO(iso: string): { y: number; m: number; d: number } | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidISODate(iso: string): boolean {
  return parseISO(iso) !== null;
}

export function todayInAsuncion(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Asuncion",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDaysISO(iso: string, days: number): string {
  const p = parseISO(iso);
  if (!p) return iso;
  return toISO(new Date(Date.UTC(p.y, p.m - 1, p.d + days)));
}

// 31/01 + 1 mes = 28/02 (o 29): nunca se pasa al mes siguiente.
export function addMonthsISO(iso: string, months: number): string {
  const p = parseISO(iso);
  if (!p) return iso;
  const target = p.m - 1 + months;
  const y = p.y + Math.floor(target / 12);
  const m = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return toISO(new Date(Date.UTC(y, m, Math.min(p.d, lastDay))));
}

// El plan rige desde el día que se adquiere hasta el día anterior a la renovación.
export function computePeriodEnd(start: string, cycle: Cycle): string {
  return addDaysISO(addMonthsISO(start, CYCLE_MONTHS[cycle]), -1);
}

export function formatDateISO(iso: string | null | undefined): string {
  const p = iso ? parseISO(iso.slice(0, 10)) : null;
  if (!p) return "";
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`;
}

export function formatIssuedAt(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return formatDateISO(todayInAsuncion(d));
}

// ---------- Montos ----------

export function defaultAmount(plan: PlanType, cycle: Cycle, currency: ReceiptCurrency): number {
  const price = PRICING[plan][cycle];
  return currency === "PYG" ? price.gs : price.usd;
}

// "140.000" / "140000" en guaraníes; "22", "22,50" o "22.5" en dólares.
export function parseMoneyInput(raw: string, currency: ReceiptCurrency): number {
  const text = raw.trim();
  if (!text) return NaN;
  if (currency === "PYG") {
    if (!/^[\d.\s]+$/.test(text)) return NaN;
    return Number(text.replace(/[.\s]/g, ""));
  }
  if (!/^\d+([.,]\d{1,2})?$/.test(text)) return NaN;
  return Number(text.replace(",", "."));
}

// Guaraníes sin decimales; dólares con centavos.
export function roundMoney(value: number, currency: ReceiptCurrency): number {
  if (!Number.isFinite(value)) return NaN;
  return currency === "PYG" ? Math.round(value) : Math.round((value + Number.EPSILON) * 100) / 100;
}

// "10", "12,5" o "7.5" (hasta dos decimales).
export function parsePercentInput(raw: string): number {
  const text = raw.trim();
  if (!/^\d+([.,]\d{1,2})?$/.test(text)) return NaN;
  return Number(text.replace(",", "."));
}

export type DiscountMode = "percent" | "fixed";

// Monto del descuento a partir de lo que se escribió: vacío = sin descuento (0), ilegible = NaN.
export function computeDiscountAmount(
  subtotal: number,
  mode: DiscountMode,
  raw: string,
  currency: ReceiptCurrency
): number {
  if (!raw.trim()) return 0;
  if (mode === "fixed") return parseMoneyInput(raw, currency);
  const percent = parsePercentInput(raw);
  return roundMoney((subtotal * percent) / 100, currency);
}

export function computeTotal(subtotal: number, discount: number, currency: ReceiptCurrency): number {
  return roundMoney(subtotal - discount, currency);
}

export function formatMoney(amount: number, currency: ReceiptCurrency): string {
  if (currency === "PYG") return `Gs. ${Math.round(amount).toLocaleString("es-PY")}`;
  const hasCents = Math.abs(amount - Math.trunc(amount)) > 0.0001;
  return `US$ ${amount.toLocaleString("es-PY", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

const UNITS = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis",
  "veintisiete", "veintiocho", "veintinueve",
];
const TENS: Record<number, string> = {
  3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta", 8: "ochenta", 9: "noventa",
};
const HUNDREDS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

// "uno" → "un" cuando le sigue un sustantivo ("un mil", "veintiún millones").
function apocope(words: string): string {
  return words.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
}

function below1000(n: number): string {
  if (n === 100) return "cien";
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (r) {
    if (r < 30) parts.push(UNITS[r]);
    else {
      const unit = r % 10;
      parts.push(unit ? `${TENS[Math.floor(r / 10)]} y ${UNITS[unit]}` : TENS[Math.floor(r / 10)]);
    }
  }
  return parts.join(" ");
}

function below1000000(n: number, beforeNoun: boolean): string {
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (thousands === 1) parts.push("mil");
  else if (thousands > 1) parts.push(`${apocope(below1000(thousands))} mil`);
  if (rest) parts.push(beforeNoun ? apocope(below1000(rest)) : below1000(rest));
  return parts.join(" ");
}

// Entero no negativo menor a un billón. `beforeNoun` aplica la apócope de "uno".
export function integerToWords(n: number, beforeNoun = false): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e12) return String(n);
  if (n === 0) return "cero";
  const millions = Math.floor(n / 1e6);
  const rest = n % 1e6;
  const parts: string[] = [];
  if (millions === 1) parts.push("un millón");
  else if (millions > 1) parts.push(`${below1000000(millions, true)} millones`);
  if (rest) parts.push(below1000000(rest, beforeNoun));
  return parts.join(" ");
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "Ciento cuarenta mil guaraníes" / "Veintidós dólares estadounidenses con 50/100".
export function amountInWords(amount: number, currency: ReceiptCurrency): string {
  if (!Number.isFinite(amount) || amount < 0) return "";
  const noun = currency === "PYG" ? ["guaraní", "guaraníes"] : ["dólar estadounidense", "dólares estadounidenses"];
  const units = currency === "PYG" ? Math.round(amount) : Math.floor(amount + 1e-9);
  const cents = currency === "PYG" ? 0 : Math.round((amount - units) * 100);
  const words = `${integerToWords(units, true)} ${units === 1 ? noun[0] : noun[1]}`;
  return capitalize(cents > 0 ? `${words} con ${String(cents).padStart(2, "0")}/100` : words);
}

// ---------- Armado del recibo ----------

export function defaultDescription(plan: PlanType, cycle: Cycle): string {
  return `Suscripción a F7 Manager Pro, Plan ${PLAN_LABELS[plan]} (ciclo ${CYCLE_LABELS[cycle].toLowerCase()})`;
}

export type ReceiptErrors = Partial<Record<
  | "customer_name"
  | "subtotal"
  | "discount_amount"
  | "amount"
  | "payment_date"
  | "period_start"
  | "period_end"
  | "payment_method"
  | "description"
  | "issuer_name",
  string
>>;

export function validateDraft(draft: ReceiptDraft, today: string): ReceiptErrors {
  const errors: ReceiptErrors = {};
  if (!draft.customer_name.trim()) errors.customer_name = "Falta el nombre de quien pagó";
  if (!Number.isFinite(draft.subtotal) || draft.subtotal <= 0) {
    errors.subtotal = "Poné un precio mayor a cero";
  } else if (!Number.isFinite(draft.discount_amount) || draft.discount_amount < 0) {
    errors.discount_amount = "No se entiende el descuento";
  } else if (draft.discount_amount >= draft.subtotal) {
    errors.discount_amount = "El descuento tiene que ser menor al precio";
  } else if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
    errors.amount = "Poné un monto mayor a cero";
  } else if (draft.amount !== computeTotal(draft.subtotal, draft.discount_amount, draft.currency)) {
    errors.amount = "El total no coincide con el precio menos el descuento";
  }
  if (!isValidISODate(draft.payment_date)) errors.payment_date = "Fecha de pago inválida";
  else if (draft.payment_date > today) errors.payment_date = "La fecha de pago no puede ser futura";
  if (!isValidISODate(draft.period_start)) errors.period_start = "Fecha de adquisición inválida";
  if (!isValidISODate(draft.period_end)) errors.period_end = "Fecha de vencimiento inválida";
  else if (isValidISODate(draft.period_start) && draft.period_end < draft.period_start) {
    errors.period_end = "No puede ser anterior a la fecha de adquisición";
  }
  if (!draft.payment_method.trim()) errors.payment_method = "Elegí el medio de pago";
  if (!draft.description.trim()) errors.description = "Falta la descripción";
  if (!draft.issuer_name.trim()) errors.issuer_name = "Falta el nombre del emisor";
  return errors;
}

function row(label: string, value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(text)}</td></tr>`;
}

export interface ReceiptHtmlOptions {
  logoUrl?: string;
}

export function buildSubscriptionReceiptHtml(r: SubscriptionReceipt, options: ReceiptHtmlOptions = {}): string {
  const logo = options.logoUrl ?? "/f7-logo.png";
  const voided = Boolean(r.voided_at);
  const hasDiscount = r.discount_amount > 0;
  const issuerLines = (r.issuer_details ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");
  const words = amountInWords(r.amount, r.currency);
  const period =
    r.period_start === r.period_end
      ? formatDateISO(r.period_start)
      : `${formatDateISO(r.period_start)} al ${formatDateISO(r.period_end)}`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(r.receipt_number)}</title><style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
@media screen { body { padding: 12mm; } }
.page { position: relative; padding: 4mm 3mm; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; padding-bottom: 5mm; border-bottom: 3px solid #0e9bb0; }
.brand { display: flex; align-items: center; gap: 5mm; }
.brand img { width: 24mm; height: 24mm; border-radius: 4mm; display: block; }
.brand .name { font-size: 17px; font-weight: 700; }
.brand .details { margin-top: 1mm; font-size: 10.5px; color: #444; line-height: 1.45; }
.num { text-align: right; white-space: nowrap; }
.num .kind { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #0e7a8b; }
.num .value { margin-top: 1mm; font-size: 24px; font-weight: 700; }
.num .muted { margin-top: 1mm; }
.muted { color: #555; font-size: 11px; }
h1 { margin: 7mm 0 1mm; font-size: 15px; text-transform: uppercase; letter-spacing: .05em; }
h2 { margin: 6mm 0 1.5mm; font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: #0e7a8b; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 2mm 0; text-align: left; vertical-align: top; border-bottom: 1px solid #ddd; }
th { width: 55mm; font-weight: 600; color: #333; }
.breakdown { margin-top: 6mm; padding: 2mm 5mm; border: 1px solid #ccd6dd; border-radius: 3mm; }
.breakdown .line { display: flex; justify-content: space-between; gap: 6mm; padding: 1.5mm 0; font-size: 12px; }
.breakdown .line + .line { border-top: 1px solid #e3e9ed; }
.breakdown .discount { color: #0e7a8b; font-weight: 600; }
.breakdown + .amount { margin-top: 3mm; }
.amount { display: flex; justify-content: space-between; align-items: center; gap: 6mm; margin-top: 6mm; padding: 5mm 6mm; border-radius: 3mm; background: #0b1d33; color: #fff; }
.amount .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: #8fd9e6; }
.amount .big { font-size: 26px; font-weight: 700; white-space: nowrap; }
.amount .words { margin-top: 1mm; font-size: 11px; color: #d8e6ee; }
.sign { margin-top: 22mm; display: flex; justify-content: flex-end; }
.sign div { width: 70mm; text-align: center; font-size: 10.5px; color: #333; }
.sign span { display: block; border-top: 1px solid #111; margin-bottom: 1mm; }
.foot { margin-top: 10mm; padding-top: 3mm; border-top: 1px solid #ddd; font-size: 10px; color: #666; text-align: center; }
.void-note { margin-top: 5mm; padding: 3mm 4mm; border: 2px solid #b91c1c; border-radius: 2mm; color: #b91c1c; font-weight: 700; }
.watermark { position: absolute; top: 90mm; left: 0; right: 0; text-align: center; transform: rotate(-22deg); font-size: 96px; font-weight: 800; letter-spacing: .1em; color: rgba(185, 28, 28, .18); pointer-events: none; }
</style></head><body><div class="page">
${voided ? `<div class="watermark">ANULADO</div>` : ""}
<header>
  <div class="brand">
    <img src="${escapeHtml(logo)}" alt="F7 Manager">
    <div>
      <div class="name">${escapeHtml(r.issuer_name)}</div>
      ${issuerLines ? `<div class="details">${issuerLines}</div>` : ""}
    </div>
  </div>
  <div class="num">
    <div class="kind">Recibo</div>
    <div class="value">${escapeHtml(r.receipt_number)}</div>
    <div class="muted">Emitido el ${escapeHtml(formatIssuedAt(r.created_at))}</div>
  </div>
</header>

<h1>Comprobante de pago de suscripción</h1>
<div class="muted">${escapeHtml(r.description)}</div>

${
  hasDiscount
    ? `<div class="breakdown">
  <div class="line"><span>Precio</span><span>${escapeHtml(formatMoney(r.subtotal, r.currency))}</span></div>
  <div class="line discount"><span>Descuento${r.discount_note ? ` · ${escapeHtml(r.discount_note)}` : ""}</span><span>− ${escapeHtml(formatMoney(r.discount_amount, r.currency))}</span></div>
</div>`
    : ""
}
<div class="amount">
  <div>
    <div class="label">${hasDiscount ? "Total recibido" : "Monto recibido"}</div>
    ${words ? `<div class="words">${escapeHtml(words)}</div>` : ""}
  </div>
  <div class="big">${escapeHtml(formatMoney(r.amount, r.currency))}</div>
</div>

<h2>Recibimos de</h2>
<table>
  ${row("Nombre o razón social", r.customer_name)}
  ${row("RUC / Cédula", r.customer_document)}
  ${row("Correo electrónico", r.customer_email)}
  ${row("Teléfono", r.customer_phone)}
</table>

<h2>Detalle del plan</h2>
<table>
  ${row("Plan contratado", `Plan ${PLAN_LABELS[r.plan_type]}`)}
  ${row("Ciclo de facturación", CYCLE_LABELS[r.billing_cycle])}
  ${row("Fecha de adquisición del plan", formatDateISO(r.period_start))}
  ${row("Período cubierto", period)}
  ${row("Fecha de pago", formatDateISO(r.payment_date))}
  ${row("Medio de pago", r.payment_method)}
  ${row("Referencia del pago", r.payment_reference)}
  ${row("Observaciones", r.notes)}
</table>
${
  voided
    ? `<div class="void-note">RECIBO ANULADO el ${escapeHtml(formatIssuedAt(r.voided_at as string))}${r.void_reason ? `. Motivo: ${escapeHtml(r.void_reason)}` : ""}. No tiene validez.</div>`
    : ""
}
<div class="sign"><div><span></span>Firma y aclaración, ${escapeHtml(r.issuer_name)}</div></div>
<div class="foot">${escapeHtml(r.receipt_number)} · Comprobante de pago de suscripción a ${escapeHtml(r.issuer_name)}. Conservá este documento.</div>
</div></body></html>`;
}

// Espera (hasta 3 s) a que carguen las imágenes del documento para que el
// logo no salga vacío al imprimir o al armar el PDF.
export function waitForImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images).map(
    (img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
  );
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 3000));
  return Promise.race([Promise.all(images).then(() => undefined), timeout]);
}

// "Recibo-F7-0001-Servi-Smart.pdf": con el nombre del cliente se reconoce el archivo al mandarlo.
export function receiptPdfFileName(receipt: Pick<SubscriptionReceipt, "receipt_number" | "customer_name">): string {
  const slug = receipt.customer_name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return `Recibo-${receipt.receipt_number}${slug ? `-${slug}` : ""}.pdf`;
}

// Imprime en un iframe aislado (mismo criterio que el comprobante de compra de
// equipos): el trabajo de impresión lleva solo el recibo, sin el CSS de la app.
export function printSubscriptionReceipt(receipt: SubscriptionReceipt, options: ReceiptHtmlOptions = {}): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => iframe.remove();
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) return cleanup();

  doc.open();
  doc.write(buildSubscriptionReceiptHtml(receipt, options));
  doc.close();

  win.addEventListener("afterprint", cleanup, { once: true });
  void waitForImages(doc).then(() => {
    window.setTimeout(() => {
      win.focus();
      win.print();
    }, 150);
  });
  // Respaldo por si el navegador no dispara afterprint (algunos móviles).
  window.setTimeout(cleanup, 60000);
}
