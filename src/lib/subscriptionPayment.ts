// Registrar un pago de suscripción en un solo paso (Gestión de empresas > Registrar pago).
// Lógica pura, sin React ni Supabase: qué mostrar en cada tarjeta, los valores por defecto
// del formulario de cobro y el armado (con validación) del pedido que recibe la base.
//
// El pedido lo ejecuta la función f7_register_subscription_payment (migración
// 20261110130000): actualiza el plan de la empresa, emite el recibo y registra el ingreso
// en Finanzas F7, todo en una sola transacción.

import type { Cycle, PlanType } from "@/lib/plans";
import type { PlanExpiryInfo } from "@/lib/planExpiry";
import {
  FX_MAX,
  FX_MIN,
  amountToInput,
  fold,
  parseFxInput,
  type F7Category,
  type F7Partner,
} from "@/lib/f7Finance";
import {
  DEFAULT_ISSUER_NAME,
  PAYMENT_METHODS,
  computeDiscountAmount,
  computeTotal,
  defaultAmount,
  defaultDescription,
  isValidISODate,
  parseMoneyInput,
  type DiscountMode,
  type ReceiptCurrency,
} from "@/lib/subscriptionReceipt";

// ---------- Qué ofrecer en la tarjeta de cada empresa ----------

// none = ya pagó y le falta bastante: no hay nada que cobrar, se muestra la marca "Pagado".
// renew = pagó, pero vence en una semana o ya venció.
// register = todavía no pagó (prueba gratis o sin fechas).
export type PayAction = "none" | "renew" | "register";

export function paymentAction(info: PlanExpiryInfo | null): PayAction {
  if (!info || info.kind !== "paid") return "register";
  return info.tone === "ok" ? "none" : "renew";
}

export const PAY_ACTION_LABEL: Record<Exclude<PayAction, "none">, string> = {
  renew: "Renovar",
  register: "Registrar pago",
};

// ---------- Recibos por empresa (para saber qué períodos tienen su recibo) ----------

export interface CompanyReceiptRow {
  id: string;
  receipt_number: string;
  company_id: string | null;
  payment_date: string;
  period_start: string;
  period_end: string;
  amount: number;
  currency: ReceiptCurrency;
  voided_at: string | null;
  created_at: string;
}

// Recibos vigentes (no anulados) de cada empresa, del más reciente al más viejo.
export function receiptsByCompany(rows: CompanyReceiptRow[]): Map<string, CompanyReceiptRow[]> {
  const map = new Map<string, CompanyReceiptRow[]>();
  for (const row of rows) {
    if (!row.company_id || row.voided_at) continue;
    const list = map.get(row.company_id) ?? [];
    list.push(row);
    map.set(row.company_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  }
  return map;
}

// covered = el período que figura en la empresa tiene un recibo vigente.
// uncovered = figura un pago pero no hay recibo de ese período (fechas cargadas a mano, recibo anulado).
// none = no hay un pago cargado: no corresponde hablar de recibo.
export type ReceiptCoverage = "covered" | "uncovered" | "none";

export function receiptCoverage(info: PlanExpiryInfo | null, receipts: CompanyReceiptRow[] | undefined): ReceiptCoverage {
  if (!info || info.kind !== "paid") return "none";
  return (receipts ?? []).some((r) => r.period_end.slice(0, 10) === info.expiresAt) ? "covered" : "uncovered";
}

// ---------- Datos que ofrece la base para llenar el formulario ----------

export interface PaymentContext {
  categories: F7Category[];
  partners: F7Partner[];
  // Lo último que se usó, para no volver a elegirlo en cada cobro.
  issuerName: string | null;
  issuerDetails: string | null;
  lastMethod: string | null;
  lastCollector: string | null;
  lastFx: string | null;
}

// "Suscripciones" si existe entre las categorías de ingreso activas; si no, la primera.
export function pickDefaultCategory(categories: F7Category[]): string {
  const ingresos = categories.filter((c) => c.kind === "ingreso" && c.active);
  return (ingresos.find((c) => fold(c.name) === "suscripciones") ?? ingresos[0])?.id ?? "";
}

// ---------- Formulario de cobro ----------

export interface CobroState {
  currency: ReceiptCurrency;
  // null = el precio de lista del plan; un texto = lo que escribió.
  amountText: string | null;
  discountMode: DiscountMode;
  discountValue: string;
  discountNote: string;
  paymentDate: string;
  paymentMethod: string;
  paymentReference: string;
  // "" = Caja F7.
  collectedBy: string;
  categoryId: string;
  fxText: string;
  customerDocument: string;
  notes: string;
  issuerName: string;
  issuerDetails: string;
}

// Paraguay paga en guaraníes; el resto de Latinoamérica, en dólares (así se vende en /latam).
export function defaultCurrency(country: string | null | undefined): ReceiptCurrency {
  return !country || country === "PY" ? "PYG" : "USD";
}

export function initialCobro(company: { country?: string | null }, today: string): CobroState {
  return {
    currency: defaultCurrency(company.country),
    amountText: null,
    discountMode: "percent",
    discountValue: "",
    discountNote: "",
    paymentDate: today,
    paymentMethod: PAYMENT_METHODS[0],
    paymentReference: "",
    collectedBy: "",
    categoryId: "",
    fxText: "",
    customerDocument: "",
    notes: "",
    issuerName: DEFAULT_ISSUER_NAME,
    issuerDetails: "",
  };
}

// Completa lo que todavía no se tocó con lo último que se usó (quién cobró, medio de pago,
// tipo de cambio, datos del emisor) y con la categoría de ingresos por defecto.
export function applyContextDefaults(cobro: CobroState, ctx: PaymentContext): CobroState {
  const partnerIsActive = (id: string | null) => !!id && ctx.partners.some((p) => p.id === id && p.active);
  return {
    ...cobro,
    categoryId: cobro.categoryId || pickDefaultCategory(ctx.categories),
    collectedBy: partnerIsActive(ctx.lastCollector) ? (ctx.lastCollector as string) : cobro.collectedBy,
    paymentMethod: ctx.lastMethod && ctx.lastMethod.trim() ? ctx.lastMethod : cobro.paymentMethod,
    fxText: cobro.fxText || ctx.lastFx || "",
    issuerName: ctx.issuerName && ctx.issuerName.trim() ? ctx.issuerName : cobro.issuerName,
    issuerDetails: ctx.issuerDetails ?? cobro.issuerDetails,
  };
}

export interface CobroAmounts {
  // Lo que se muestra en el campo "Precio" (el de lista o el escrito).
  priceText: string;
  listPrice: number;
  subtotal: number;
  discount: number;
  total: number;
}

export function cobroAmounts(cobro: CobroState, plan: PlanType, cycle: Cycle): CobroAmounts {
  const listPrice = defaultAmount(plan, cycle, cobro.currency);
  const priceText = cobro.amountText ?? amountToInput(listPrice, cobro.currency);
  const subtotal = parseMoneyInput(priceText, cobro.currency);
  const discount = Number.isFinite(subtotal) ? computeDiscountAmount(subtotal, cobro.discountMode, cobro.discountValue, cobro.currency) : NaN;
  const total = Number.isFinite(subtotal) && Number.isFinite(discount) ? computeTotal(subtotal, discount, cobro.currency) : NaN;
  return { priceText, listPrice, subtotal, discount, total };
}

// ---------- Pedido a la base ----------

export interface PaymentPayload {
  company_id: string;
  customer_name: string;
  customer_document: string | null;
  plan_type: PlanType;
  billing_cycle: Cycle;
  period_start: string;
  period_end: string;
  payment_date: string;
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
  category_id: string;
  collected_by: string | null;
  fx_rate: number | null;
  mark_paying: boolean;
  reactivate: boolean;
}

export type PaymentErrors = Partial<
  Record<"price" | "discount" | "paymentDate" | "paymentMethod" | "category" | "fx" | "issuer" | "period", string>
>;

export interface PaymentInput {
  company: { id: string; name: string };
  plan: PlanType;
  cycle: Cycle;
  periodStart: string;
  periodEnd: string;
  markPaying: boolean;
  reactivate: boolean;
  cobro: CobroState;
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

export function buildPaymentPayload(input: PaymentInput, today: string): { errors: PaymentErrors; payload: PaymentPayload | null } {
  const { cobro, plan, cycle } = input;
  const errors: PaymentErrors = {};
  const amounts = cobroAmounts(cobro, plan, cycle);

  if (!isValidISODate(input.periodStart) || !isValidISODate(input.periodEnd) || input.periodEnd < input.periodStart) {
    errors.period = "Revisá las fechas del período.";
  }

  if (!Number.isFinite(amounts.subtotal) || amounts.subtotal <= 0) {
    errors.price = "Poné un precio mayor a cero.";
  } else if (!Number.isFinite(amounts.discount) || amounts.discount < 0) {
    errors.discount = "No se entiende el descuento.";
  } else if (amounts.discount >= amounts.subtotal) {
    errors.discount = "El descuento tiene que ser menor al precio.";
  } else if (!Number.isFinite(amounts.total) || amounts.total <= 0) {
    errors.price = "El total tiene que ser mayor a cero.";
  }

  if (!isValidISODate(cobro.paymentDate)) errors.paymentDate = "Fecha de cobro inválida.";
  else if (cobro.paymentDate > today) errors.paymentDate = "La fecha de cobro no puede ser futura.";

  if (!cobro.paymentMethod.trim()) errors.paymentMethod = "Elegí el medio de pago.";
  if (!cobro.categoryId) errors.category = "Elegí la categoría del ingreso.";
  if (!cobro.issuerName.trim()) errors.issuer = "Falta el nombre de quien emite el recibo.";

  let fx: number | null = null;
  if (cobro.currency === "USD") {
    const parsed = parseFxInput(cobro.fxText);
    if (!Number.isFinite(parsed)) errors.fx = "Poné el tipo de cambio del día (guaraníes por dólar, por ejemplo 7.300).";
    else if (parsed < FX_MIN || parsed > FX_MAX) errors.fx = "Ese tipo de cambio no parece de guaraníes por dólar.";
    else fx = parsed;
  }

  if (Object.keys(errors).length > 0) return { errors, payload: null };

  return {
    errors,
    payload: {
      company_id: input.company.id,
      customer_name: input.company.name,
      customer_document: orNull(cobro.customerDocument),
      plan_type: plan,
      billing_cycle: cycle,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      payment_date: cobro.paymentDate,
      subtotal: amounts.subtotal,
      discount_amount: amounts.discount,
      discount_note: amounts.discount > 0 ? orNull(cobro.discountNote) : null,
      amount: amounts.total,
      currency: cobro.currency,
      payment_method: cobro.paymentMethod.trim(),
      payment_reference: orNull(cobro.paymentReference),
      description: defaultDescription(plan, cycle),
      notes: orNull(cobro.notes),
      issuer_name: cobro.issuerName.trim(),
      issuer_details: orNull(cobro.issuerDetails),
      category_id: cobro.categoryId,
      collected_by: cobro.collectedBy || null,
      fx_rate: fx,
      mark_paying: input.markPaying,
      reactivate: input.reactivate,
    },
  };
}
