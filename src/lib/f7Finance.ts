import {
  addDaysISO,
  formatDateISO,
  isValidISODate,
  parseMoneyInput,
  type ReceiptCurrency,
} from "@/lib/subscriptionReceipt";

// Finanzas internas de F7 Manager (solo super admin). Se cuenta cuando se cobra
// o se paga: solo cuentan los movimientos `pagado` y no anulados.

export type Currency = ReceiptCurrency;
export type EntryKind = "ingreso" | "gasto" | "aporte" | "reembolso" | "distribucion";
export type EntryStatus = "pagado" | "pendiente";
export type Frequency = "semanal" | "mensual" | "anual";

export const ENTRY_KINDS: EntryKind[] = ["ingreso", "gasto", "aporte", "reembolso", "distribucion"];

export const KIND_LABELS: Record<EntryKind, string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  aporte: "Aporte",
  reembolso: "Reembolso",
  distribucion: "Retiro de utilidad",
};

export const KIND_HINTS: Record<EntryKind, string> = {
  ingreso: "Entra plata al negocio (suscripciones, instalaciones, capacitaciones...).",
  gasto: "Sale plata del negocio (hosting, publicidad, herramientas...).",
  aporte: "Un socio pone plata en la caja de F7.",
  reembolso: "F7 le devuelve a un socio lo que puso o adelantó.",
  distribucion: "Se le paga a un socio su parte de las ganancias.",
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  semanal: "Cada semana",
  mensual: "Cada mes",
  anual: "Cada año",
};

export const FREQUENCIES: Frequency[] = ["mensual", "semanal", "anual"];

export const MIN_DATE = "2020-01-01";
export const FX_MIN = 1000;
export const FX_MAX = 100000;
export const MAX_AMOUNT = 999_999_999_999;
export const MAX_OCCURRENCES = 600;

export interface F7Partner {
  id: string;
  name: string;
  share_pct: number;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface F7Category {
  id: string;
  kind: "ingreso" | "gasto";
  name: string;
  active: boolean;
  sort_order: number;
}

export interface F7Entry {
  id: string;
  kind: EntryKind;
  entry_date: string;
  description: string;
  category_id: string | null;
  amount: number;
  currency: Currency;
  fx_rate: number | null;
  amount_pyg: number;
  status: EntryStatus;
  partner_id: string | null;
  via_partner_id: string | null;
  payment_method: string | null;
  notes: string | null;
  receipt_id: string | null;
  recurring_id: string | null;
  recurring_due: string | null;
  created_at: string;
  updated_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
}

export interface F7Recurring {
  id: string;
  name: string;
  category_id: string;
  amount: number;
  currency: Currency;
  fx_rate: number | null;
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
  default_partner_id: string | null;
  payment_method: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

// ---------- Filas de la base ----------

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

export function normalizePartner(row: Row): F7Partner {
  return {
    id: str(row.id),
    name: str(row.name),
    share_pct: Number(row.share_pct ?? 0),
    active: row.active !== false,
    notes: strOrNull(row.notes),
    created_at: str(row.created_at),
  };
}

export function normalizeCategory(row: Row): F7Category {
  return {
    id: str(row.id),
    kind: row.kind === "ingreso" ? "ingreso" : "gasto",
    name: str(row.name),
    active: row.active !== false,
    sort_order: Number(row.sort_order ?? 100),
  };
}

export function normalizeEntry(row: Row): F7Entry {
  const currency: Currency = row.currency === "USD" ? "USD" : "PYG";
  return {
    id: str(row.id),
    kind: row.kind as EntryKind,
    entry_date: str(row.entry_date).slice(0, 10),
    description: str(row.description),
    category_id: strOrNull(row.category_id),
    amount: Number(row.amount ?? 0),
    currency,
    fx_rate: numOrNull(row.fx_rate),
    amount_pyg: Number(row.amount_pyg ?? 0),
    status: row.status === "pendiente" ? "pendiente" : "pagado",
    partner_id: strOrNull(row.partner_id),
    via_partner_id: strOrNull(row.via_partner_id),
    payment_method: strOrNull(row.payment_method),
    notes: strOrNull(row.notes),
    receipt_id: strOrNull(row.receipt_id),
    recurring_id: strOrNull(row.recurring_id),
    recurring_due: row.recurring_due ? str(row.recurring_due).slice(0, 10) : null,
    created_at: str(row.created_at),
    updated_at: strOrNull(row.updated_at),
    voided_at: strOrNull(row.voided_at),
    void_reason: strOrNull(row.void_reason),
  };
}

export function normalizeRecurring(row: Row): F7Recurring {
  return {
    id: str(row.id),
    name: str(row.name),
    category_id: str(row.category_id),
    amount: Number(row.amount ?? 0),
    currency: row.currency === "USD" ? "USD" : "PYG",
    fx_rate: numOrNull(row.fx_rate),
    frequency: (row.frequency as Frequency) ?? "mensual",
    start_date: str(row.start_date).slice(0, 10),
    end_date: row.end_date ? str(row.end_date).slice(0, 10) : null,
    default_partner_id: strOrNull(row.default_partner_id),
    payment_method: strOrNull(row.payment_method),
    notes: strOrNull(row.notes),
    active: row.active !== false,
    created_at: str(row.created_at),
  };
}

// ---------- Fechas ----------

const pad = (n: number) => String(n).padStart(2, "0");

function ymd(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return { y, m, d };
}

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function firstOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function lastOfMonth(iso: string): string {
  const p = ymd(iso);
  if (!p) return iso;
  return `${p.y}-${pad(p.m)}-${pad(daysInMonth(p.y, p.m))}`;
}

export function addMonthsToKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = m - 1 + delta;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return `${year}-${pad(month + 1)}`;
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function monthShortLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1] ?? ""} ${String(y).slice(2)}`;
}

// ---------- Períodos ----------

export type PeriodKey = "este_mes" | "mes_pasado" | "este_anio" | "ultimos_12" | "todo" | "personalizado";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "este_mes", label: "Este mes" },
  { key: "mes_pasado", label: "Mes pasado" },
  { key: "este_anio", label: "Este año" },
  { key: "ultimos_12", label: "Últimos 12 meses" },
  { key: "todo", label: "Todo" },
  { key: "personalizado", label: "Elegir fechas" },
];

export interface Period {
  key: PeriodKey;
  from: string | null;
  to: string | null;
}

export const ALL_TIME: Period = { key: "todo", from: null, to: null };

export function resolvePeriod(key: PeriodKey, today: string, custom?: { from: string; to: string }): Period {
  const monthKey = today.slice(0, 7);
  switch (key) {
    case "este_mes":
      return { key, from: `${monthKey}-01`, to: lastOfMonth(`${monthKey}-01`) };
    case "mes_pasado": {
      const prev = addMonthsToKey(monthKey, -1);
      return { key, from: `${prev}-01`, to: lastOfMonth(`${prev}-01`) };
    }
    case "este_anio": {
      const year = today.slice(0, 4);
      return { key, from: `${year}-01-01`, to: `${year}-12-31` };
    }
    case "ultimos_12":
      return { key, from: `${addMonthsToKey(monthKey, -11)}-01`, to: lastOfMonth(`${monthKey}-01`) };
    case "personalizado":
      if (custom && isValidISODate(custom.from) && isValidISODate(custom.to) && custom.from <= custom.to) {
        return { key, from: custom.from, to: custom.to };
      }
      return { key, from: null, to: null };
    default:
      return { key: "todo", from: null, to: null };
  }
}

export function inPeriod(date: string, period: Period): boolean {
  return (period.from == null || date >= period.from) && (period.to == null || date <= period.to);
}

export function describePeriod(period: Period): string {
  if (period.from == null && period.to == null) return "Todo el historial";
  return `${formatDateISO(period.from)} al ${formatDateISO(period.to)}`;
}

// ---------- Montos ----------

// Mismo redondeo que la columna `amount_pyg` de la base: round(monto × cambio), mitad hacia arriba.
export function toPyg(amount: number, currency: Currency, fxRate: number | null): number {
  if (currency !== "USD") return Math.round(amount);
  if (fxRate == null) return NaN;
  const cents = Math.round(amount * 100);
  const rateCents = Math.round(fxRate * 100);
  return Math.floor((cents * rateCents + 5000) / 10000);
}

export function formatGs(value: number): string {
  const rounded = Math.round(value) || 0;
  const text = Math.abs(rounded).toLocaleString("es-PY");
  return rounded < 0 ? `-Gs. ${text}` : `Gs. ${text}`;
}

export function formatPct(value: number): string {
  return `${(Math.round(value * 10) / 10).toLocaleString("es-PY")} %`;
}

export function formatForeign(amount: number): string {
  const hasCents = Math.abs(amount - Math.trunc(amount)) > 0.0001;
  return `US$ ${amount.toLocaleString("es-PY", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatEntryAmount(e: Pick<F7Entry, "amount" | "currency" | "amount_pyg">): { main: string; sub: string | null } {
  if (e.currency === "USD") return { main: formatGs(e.amount_pyg), sub: formatForeign(e.amount) };
  return { main: formatGs(e.amount_pyg), sub: null };
}

// Texto para un campo de monto a partir de un número ("1120000" / "25,5").
export function amountToInput(amount: number, currency: Currency): string {
  if (currency === "PYG") return String(Math.round(amount));
  const text = amount.toFixed(2).replace(/\.?0+$/, "");
  return text.replace(".", ",");
}

// Tipo de cambio: "7300", "7.300", "7300,5" o "7.300,50". Un punto con tres cifras es de miles.
export function parseFxInput(raw: string): number {
  const text = raw.replace(/\s/g, "");
  if (!text) return NaN;
  if (text.includes(",")) {
    if (!/^(\d{1,3}(\.\d{3})+|\d+),\d{1,2}$/.test(text)) return NaN;
    return Number(text.replace(/\./g, "").replace(",", "."));
  }
  if (text.includes(".")) {
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, ""));
    if (/^\d+\.\d{1,2}$/.test(text)) return Number(text);
    return NaN;
  }
  return /^\d+$/.test(text) ? Number(text) : NaN;
}

// ---------- Qué cuenta ----------

export const isVoided = (e: Pick<F7Entry, "voided_at">) => e.voided_at != null;
export const isCounted = (e: Pick<F7Entry, "status" | "voided_at">) => e.status === "pagado" && e.voided_at == null;
export const isPending = (e: Pick<F7Entry, "status" | "voided_at" | "kind">) =>
  e.status === "pendiente" && e.voided_at == null && (e.kind === "ingreso" || e.kind === "gasto");

export type EntryState = "anulado" | "pagado" | "pendiente" | "vencido";

export function entryState(e: Pick<F7Entry, "status" | "voided_at" | "entry_date">, today: string): EntryState {
  if (e.voided_at != null) return "anulado";
  if (e.status === "pagado") return "pagado";
  return e.entry_date < today ? "vencido" : "pendiente";
}

export function stateLabel(e: Pick<F7Entry, "status" | "voided_at" | "entry_date" | "kind">, today: string): string {
  const state = entryState(e, today);
  if (state === "anulado") return "Anulado";
  if (state === "pagado") return e.kind === "ingreso" ? "Cobrado" : "Pagado";
  const base = e.kind === "ingreso" ? "Por cobrar" : "Por pagar";
  return state === "vencido" ? `${base} (vencido)` : base;
}

// ---------- Totales del período ----------

export interface PeriodTotals {
  ingresos: number;
  gastos: number;
  resultado: number;
  margenPct: number | null;
  ingresosCount: number;
  gastosCount: number;
}

export function computeTotals(entries: F7Entry[], period: Period): PeriodTotals {
  let ingresos = 0;
  let gastos = 0;
  let ingresosCount = 0;
  let gastosCount = 0;
  for (const e of entries) {
    if (!isCounted(e) || !inPeriod(e.entry_date, period)) continue;
    if (e.kind === "ingreso") {
      ingresos += e.amount_pyg;
      ingresosCount += 1;
    } else if (e.kind === "gasto") {
      gastos += e.amount_pyg;
      gastosCount += 1;
    }
  }
  const resultado = ingresos - gastos;
  return {
    ingresos,
    gastos,
    resultado,
    margenPct: ingresos > 0 ? (resultado / ingresos) * 100 : null,
    ingresosCount,
    gastosCount,
  };
}

export interface PendingTotals {
  porCobrar: number;
  porCobrarCount: number;
  porCobrarVencido: number;
  porCobrarVencidoCount: number;
  porPagar: number;
  porPagarCount: number;
  porPagarVencido: number;
  porPagarVencidoCount: number;
}

export function computePending(entries: F7Entry[], today: string): PendingTotals {
  const out: PendingTotals = {
    porCobrar: 0,
    porCobrarCount: 0,
    porCobrarVencido: 0,
    porCobrarVencidoCount: 0,
    porPagar: 0,
    porPagarCount: 0,
    porPagarVencido: 0,
    porPagarVencidoCount: 0,
  };
  for (const e of entries) {
    if (!isPending(e)) continue;
    const overdue = e.entry_date < today;
    if (e.kind === "ingreso") {
      out.porCobrar += e.amount_pyg;
      out.porCobrarCount += 1;
      if (overdue) {
        out.porCobrarVencido += e.amount_pyg;
        out.porCobrarVencidoCount += 1;
      }
    } else {
      out.porPagar += e.amount_pyg;
      out.porPagarCount += 1;
      if (overdue) {
        out.porPagarVencido += e.amount_pyg;
        out.porPagarVencidoCount += 1;
      }
    }
  }
  return out;
}

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  total: number;
  pct: number;
  count: number;
}

export function breakdownByCategory(
  entries: F7Entry[],
  kind: "ingreso" | "gasto",
  period: Period,
  categories: Pick<F7Category, "id" | "name">[]
): CategorySlice[] {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const acc = new Map<string | null, { total: number; count: number }>();
  let grand = 0;
  for (const e of entries) {
    if (!isCounted(e) || e.kind !== kind || !inPeriod(e.entry_date, period)) continue;
    const slot = acc.get(e.category_id) ?? { total: 0, count: 0 };
    slot.total += e.amount_pyg;
    slot.count += 1;
    acc.set(e.category_id, slot);
    grand += e.amount_pyg;
  }
  return [...acc.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      name: (categoryId && names.get(categoryId)) || "Sin categoría",
      total: v.total,
      count: v.count,
      pct: grand > 0 ? (v.total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface MonthPoint {
  key: string;
  label: string;
  ingresos: number;
  gastos: number;
  resultado: number;
}

// Los últimos `months` meses terminando en el mes de `today`.
export function monthlySeries(entries: F7Entry[], today: string, months = 6): MonthPoint[] {
  const endKey = today.slice(0, 7);
  const keys = Array.from({ length: months }, (_, i) => addMonthsToKey(endKey, i - (months - 1)));
  const slots = new Map(keys.map((k) => [k, { ingresos: 0, gastos: 0 }]));
  for (const e of entries) {
    if (!isCounted(e) || (e.kind !== "ingreso" && e.kind !== "gasto")) continue;
    const slot = slots.get(e.entry_date.slice(0, 7));
    if (!slot) continue;
    if (e.kind === "ingreso") slot.ingresos += e.amount_pyg;
    else slot.gastos += e.amount_pyg;
  }
  return keys.map((key) => {
    const s = slots.get(key)!;
    return { key, label: monthShortLabel(key), ingresos: s.ingresos, gastos: s.gastos, resultado: s.ingresos - s.gastos };
  });
}

export interface Dues {
  overdue: F7Entry[];
  upcoming: F7Entry[];
}

export function upcomingDues(entries: F7Entry[], today: string, days = 30): Dues {
  const horizon = addDaysISO(today, days);
  const pending = entries
    .filter(isPending)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at));
  return {
    overdue: pending.filter((e) => e.entry_date < today),
    upcoming: pending.filter((e) => e.entry_date >= today && e.entry_date <= horizon),
  };
}

// ---------- Caja y cuentas de los socios ----------

export interface PartnerPosition {
  partnerId: string;
  name: string;
  active: boolean;
  sharePct: number;
  aportes: number;
  adelantos: number;
  cobrado: number;
  reembolsosRecibidos: number;
  pagadoDeSuBolsillo: number;
  // Positivo: F7 le debe. Negativo: tiene plata de F7 en su poder.
  cuenta: number;
  utilidad: number;
  retirado: number;
  pendienteRetiro: number;
  saldoTotal: number;
}

export interface Snapshot {
  caja: number;
  resultadoAcumulado: number;
  totalDistribuido: number;
  sumaCuentas: number;
  // Caja − [(resultado − retiros) + Σ cuentas]; debe ser 0.
  diferencia: number;
  sharesTotal: number;
  partners: PartnerPosition[];
}

export function computeSnapshot(entries: F7Entry[], partners: F7Partner[]): Snapshot {
  const byPartner = new Map<string, PartnerPosition>();
  for (const p of partners) {
    byPartner.set(p.id, {
      partnerId: p.id,
      name: p.name,
      active: p.active,
      sharePct: p.share_pct,
      aportes: 0,
      adelantos: 0,
      cobrado: 0,
      reembolsosRecibidos: 0,
      pagadoDeSuBolsillo: 0,
      cuenta: 0,
      utilidad: 0,
      retirado: 0,
      pendienteRetiro: 0,
      saldoTotal: 0,
    });
  }

  let caja = 0;
  let ingresos = 0;
  let gastos = 0;
  let totalDistribuido = 0;

  for (const e of entries) {
    if (!isCounted(e)) continue;
    const amount = e.amount_pyg;
    const owner = e.partner_id ? byPartner.get(e.partner_id) : undefined;
    const via = e.via_partner_id ? byPartner.get(e.via_partner_id) : undefined;
    switch (e.kind) {
      case "ingreso":
        ingresos += amount;
        if (e.partner_id == null) caja += amount;
        else if (owner) owner.cobrado += amount;
        break;
      case "gasto":
        gastos += amount;
        if (e.partner_id == null) caja -= amount;
        else if (owner) owner.adelantos += amount;
        break;
      case "aporte":
        caja += amount;
        if (owner) owner.aportes += amount;
        break;
      case "reembolso":
        if (owner) owner.reembolsosRecibidos += amount;
        if (e.via_partner_id == null) caja -= amount;
        else if (via) via.pagadoDeSuBolsillo += amount;
        break;
      case "distribucion":
        totalDistribuido += amount;
        if (owner) owner.retirado += amount;
        if (e.via_partner_id == null) caja -= amount;
        else if (via) via.pagadoDeSuBolsillo += amount;
        break;
    }
  }

  const resultadoAcumulado = ingresos - gastos;
  let sumaCuentas = 0;
  let sharesTotal = 0;
  const list: PartnerPosition[] = [];
  for (const p of byPartner.values()) {
    p.cuenta = p.aportes + p.adelantos - p.cobrado - p.reembolsosRecibidos + p.pagadoDeSuBolsillo;
    p.utilidad = Math.round((p.sharePct * resultadoAcumulado) / 100);
    p.pendienteRetiro = p.utilidad - p.retirado;
    p.saldoTotal = p.cuenta + p.pendienteRetiro;
    sumaCuentas += p.cuenta;
    if (p.active) sharesTotal += p.sharePct;
    list.push(p);
  }

  return {
    caja,
    resultadoAcumulado,
    totalDistribuido,
    sumaCuentas,
    diferencia: caja - (resultadoAcumulado - totalDistribuido + sumaCuentas),
    sharesTotal: Math.round(sharesTotal * 100) / 100,
    partners: list,
  };
}

export interface Transfer {
  fromId: string;
  toId: string;
  amount: number;
}

// Quién le transfiere a quién para dejar las cuentas en cero (lo que sobre queda en la caja).
export function suggestSettlements(positions: Pick<PartnerPosition, "partnerId" | "saldoTotal">[]): Transfer[] {
  const debtors = positions
    .filter((p) => p.saldoTotal < 0)
    .map((p) => ({ id: p.partnerId, left: -p.saldoTotal }))
    .sort((a, b) => b.left - a.left);
  const creditors = positions
    .filter((p) => p.saldoTotal > 0)
    .map((p) => ({ id: p.partnerId, left: p.saldoTotal }))
    .sort((a, b) => b.left - a.left);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    out.push({ fromId: debtors[i].id, toId: creditors[j].id, amount });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left <= 0) i += 1;
    if (creditors[j].left <= 0) j += 1;
  }
  return out;
}

export interface SettlementPlan {
  // Lo que F7 le debía a quien recibe (se le devuelve lo que puso o adelantó).
  reembolso: number;
  // El resto es utilidad que retira.
  retiro: number;
}

// Una transferencia entre socios se anota en dos movimientos: primero se salda la cuenta de quien
// recibe (reembolso) y lo que sobra es retiro de utilidad. Nunca se retira más utilidad de la que tiene.
export function planSettlement(
  transfer: Transfer,
  positions: Pick<PartnerPosition, "partnerId" | "cuenta">[]
): SettlementPlan {
  const receiver = positions.find((p) => p.partnerId === transfer.toId);
  const owed = Math.max(0, receiver?.cuenta ?? 0);
  const reembolso = Math.min(transfer.amount, owed);
  return { reembolso, retiro: transfer.amount - reembolso };
}

export function sharesWarning(partners: Pick<F7Partner, "share_pct" | "active">[]): string | null {
  const active = partners.filter((p) => p.active);
  if (active.length === 0) return null;
  const total = Math.round(active.reduce((sum, p) => sum + p.share_pct, 0) * 100) / 100;
  if (total === 100) return null;
  return `Los porcentajes de los socios activos suman ${formatPct(total)}, no 100 %. La utilidad por socio no va a cuadrar.`;
}

// ---------- Nombres y flujo de la plata ----------

export interface Lookups {
  categories: Map<string, F7Category>;
  partners: Map<string, F7Partner>;
}

export function buildLookups(categories: F7Category[], partners: F7Partner[]): Lookups {
  return {
    categories: new Map(categories.map((c) => [c.id, c])),
    partners: new Map(partners.map((p) => [p.id, p])),
  };
}

const CASH = "Caja F7";

export function partnerName(l: Lookups, id: string | null | undefined): string {
  if (!id) return CASH;
  return l.partners.get(id)?.name ?? "Socio";
}

export function categoryName(l: Lookups, id: string | null | undefined): string {
  if (!id) return "";
  return l.categories.get(id)?.name ?? "Sin categoría";
}

// De dónde a dónde se movió la plata, en pocas palabras.
export function flowLabel(e: Pick<F7Entry, "kind" | "partner_id" | "via_partner_id">, l: Lookups): string {
  switch (e.kind) {
    case "ingreso":
      return e.partner_id ? `Cuenta de ${partnerName(l, e.partner_id)}` : CASH;
    case "gasto":
      return e.partner_id ? `${partnerName(l, e.partner_id)} (adelantó)` : CASH;
    case "aporte":
      return `${partnerName(l, e.partner_id)} → ${CASH}`;
    default:
      if (e.via_partner_id && e.via_partner_id === e.partner_id) {
        return `${partnerName(l, e.partner_id)} (sale de su cuenta)`;
      }
      return `${partnerName(l, e.via_partner_id)} → ${partnerName(l, e.partner_id)}`;
  }
}

export function sourceLabel(e: Pick<F7Entry, "receipt_id" | "recurring_id">): string {
  if (e.receipt_id) return "Recibo";
  if (e.recurring_id) return "Gasto fijo";
  return "Manual";
}

// ---------- Filtros y búsqueda de movimientos ----------

export type StatusFilter = "activos" | "pagado" | "pendiente" | "vencido" | "anulado";

export interface EntryFilters {
  kind: EntryKind | "todos";
  status: StatusFilter;
  categoryId: string;
  partnerId: string;
  query: string;
}

export const DEFAULT_FILTERS: EntryFilters = {
  kind: "todos",
  status: "activos",
  categoryId: "todas",
  partnerId: "todos",
  query: "",
};

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
export const fold = (s: string) => s.normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();

export function matchesStatus(e: F7Entry, status: StatusFilter, today: string): boolean {
  const state = entryState(e, today);
  switch (status) {
    case "activos":
      return state !== "anulado";
    case "pagado":
      return state === "pagado";
    case "pendiente":
      return state === "pendiente" || state === "vencido";
    case "vencido":
      return state === "vencido";
    case "anulado":
      return state === "anulado";
  }
}

// Todos los filtros menos el estado; `query` ya viene normalizado con `fold`.
function matchesOtherFilters(e: F7Entry, filters: EntryFilters, query: string, period: Period, l: Lookups): boolean {
  if (!inPeriod(e.entry_date, period)) return false;
  if (filters.kind !== "todos" && e.kind !== filters.kind) return false;
  if (filters.categoryId !== "todas" && e.category_id !== filters.categoryId) return false;
  if (filters.partnerId !== "todos" && e.partner_id !== filters.partnerId && e.via_partner_id !== filters.partnerId) {
    return false;
  }
  if (!query) return true;
  const haystack = fold(
    [
      e.description,
      e.notes ?? "",
      e.payment_method ?? "",
      KIND_LABELS[e.kind],
      categoryName(l, e.category_id),
      e.partner_id ? partnerName(l, e.partner_id) : "",
      e.via_partner_id ? partnerName(l, e.via_partner_id) : "",
      String(e.amount),
    ].join(" ")
  );
  return haystack.includes(query);
}

export function filterEntries(
  entries: F7Entry[],
  filters: EntryFilters,
  period: Period,
  today: string,
  l: Lookups
): F7Entry[] {
  const query = fold(filters.query);
  return entries
    .filter((e) => matchesOtherFilters(e, filters, query, period, l) && matchesStatus(e, filters.status, today))
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at));
}

// Cuántos movimientos hay en cada estado con el resto de los filtros aplicados (el estado elegido no cuenta).
export function countByStatus(
  entries: F7Entry[],
  filters: EntryFilters,
  period: Period,
  today: string,
  l: Lookups
): Record<StatusFilter, number> {
  const query = fold(filters.query);
  const out: Record<StatusFilter, number> = { activos: 0, pagado: 0, pendiente: 0, vencido: 0, anulado: 0 };
  for (const e of entries) {
    if (!matchesOtherFilters(e, filters, query, period, l)) continue;
    (Object.keys(out) as StatusFilter[]).forEach((s) => {
      if (matchesStatus(e, s, today)) out[s] += 1;
    });
  }
  return out;
}

// ---------- Alta y edición de movimientos ----------

export interface EntryDraft {
  kind: EntryKind;
  entry_date: string;
  description: string;
  category_id: string;
  amount: string;
  currency: Currency;
  fx_rate: string;
  status: EntryStatus;
  partner_id: string;
  via_partner_id: string;
  payment_method: string;
  notes: string;
}

export type EntryField = keyof EntryDraft;
export type EntryErrors = Partial<Record<EntryField, string>>;

export interface EntryPayload {
  kind: EntryKind;
  entry_date: string;
  description: string;
  category_id: string | null;
  amount: number;
  currency: Currency;
  fx_rate: number | null;
  status: EntryStatus;
  partner_id: string | null;
  via_partner_id: string | null;
  payment_method: string | null;
  notes: string | null;
}

export interface EntryValidationContext {
  today: string;
  categories: Pick<F7Category, "id" | "kind">[];
  partners: Pick<F7Partner, "id" | "active">[];
  // Al editar, un socio que ya estaba puesto puede seguir aunque se haya desactivado.
  keepPartnerIds?: string[];
}

export function emptyDraft(kind: EntryKind, today: string): EntryDraft {
  return {
    kind,
    entry_date: today,
    description: "",
    category_id: "",
    amount: "",
    currency: "PYG",
    fx_rate: "",
    status: "pagado",
    partner_id: "",
    via_partner_id: "",
    payment_method: "",
    notes: "",
  };
}

export function draftFromEntry(e: F7Entry): EntryDraft {
  return {
    kind: e.kind,
    entry_date: e.entry_date,
    description: e.description,
    category_id: e.category_id ?? "",
    amount: amountToInput(e.amount, e.currency),
    currency: e.currency,
    fx_rate: e.fx_rate == null ? "" : amountToInput(e.fx_rate, "USD"),
    status: e.status,
    partner_id: e.partner_id ?? "",
    via_partner_id: e.via_partner_id ?? "",
    payment_method: e.payment_method ?? "",
    notes: e.notes ?? "",
  };
}

export function validateEntryDraft(
  draft: EntryDraft,
  ctx: EntryValidationContext
): { errors: EntryErrors; payload: EntryPayload | null } {
  const errors: EntryErrors = {};
  const isLedger = draft.kind === "ingreso" || draft.kind === "gasto";
  const status: EntryStatus = isLedger ? draft.status : "pagado";

  const description = draft.description.trim();
  if (!description) errors.description = "Poné una descripción.";
  else if (description.length > 200) errors.description = "Máximo 200 caracteres.";

  if (!isValidISODate(draft.entry_date) || draft.entry_date < MIN_DATE) {
    errors.entry_date = "Elegí una fecha válida (desde 2020).";
  } else if (status === "pagado" && draft.entry_date > ctx.today) {
    errors.entry_date = isLedger
      ? "Un movimiento pagado no puede tener fecha futura. Si todavía no se pagó, dejalo como pendiente."
      : "La fecha no puede ser futura.";
  }

  const amount = parseMoneyInput(draft.amount, draft.currency);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount =
      draft.currency === "USD"
        ? "Poné un monto mayor a 0 (hasta 2 decimales, por ejemplo 25 o 22,50)."
        : "Poné un monto mayor a 0, sin decimales.";
  } else if (amount > MAX_AMOUNT) {
    errors.amount = "El monto es demasiado grande.";
  }

  let fxRate: number | null = null;
  if (draft.currency === "USD") {
    const fx = parseFxInput(draft.fx_rate);
    if (!Number.isFinite(fx)) errors.fx_rate = "Poné el tipo de cambio del día (guaraníes por dólar, por ejemplo 7.300).";
    else if (fx < FX_MIN || fx > FX_MAX) errors.fx_rate = "Ese tipo de cambio no parece de guaraníes por dólar.";
    else fxRate = fx;
  }

  let categoryId: string | null = null;
  if (isLedger) {
    const category = ctx.categories.find((c) => c.id === draft.category_id);
    if (!draft.category_id) errors.category_id = "Elegí una categoría.";
    else if (!category || category.kind !== draft.kind) errors.category_id = "Esa categoría no corresponde al tipo de movimiento.";
    else categoryId = category.id;
  }

  const keep = ctx.keepPartnerIds ?? [];
  const partnerOk = (id: string) => {
    const p = ctx.partners.find((x) => x.id === id);
    return !!p && (p.active || keep.includes(id));
  };

  let partnerId: string | null = null;
  if (draft.partner_id) {
    if (!partnerOk(draft.partner_id)) errors.partner_id = "Ese socio no está disponible (está inactivo).";
    else partnerId = draft.partner_id;
  } else if (!isLedger) {
    errors.partner_id = "Elegí el socio.";
  }

  let viaPartnerId: string | null = null;
  if (draft.kind === "reembolso" || draft.kind === "distribucion") {
    if (draft.via_partner_id) {
      if (!partnerOk(draft.via_partner_id)) errors.via_partner_id = "Ese socio no está disponible (está inactivo).";
      else if (draft.kind === "reembolso" && draft.via_partner_id === draft.partner_id) {
        errors.via_partner_id = "Un socio no se reembolsa con su propio bolsillo. Elegí otro o la caja.";
      } else viaPartnerId = draft.via_partner_id;
    }
  }

  const paymentMethod = draft.payment_method.trim();
  if (paymentMethod.length > 80) errors.payment_method = "Máximo 80 caracteres.";
  const notes = draft.notes.trim();
  if (notes.length > 1000) errors.notes = "Máximo 1000 caracteres.";

  if (Object.keys(errors).length > 0) return { errors, payload: null };

  return {
    errors,
    payload: {
      kind: draft.kind,
      entry_date: draft.entry_date,
      description,
      category_id: categoryId,
      amount: draft.currency === "USD" ? Math.round(amount * 100) / 100 : Math.round(amount),
      currency: draft.currency,
      fx_rate: fxRate,
      status,
      partner_id: partnerId,
      via_partner_id: viaPartnerId,
      payment_method: paymentMethod || null,
      notes: notes || null,
    },
  };
}

// ---------- Atajos de socios y liquidación ----------

type PartnerShortcutKind = "aporte" | "reembolso" | "distribucion";

// Formulario ya armado para los botones de cada socio: sugiere cuánto y de dónde sale la plata.
export function shortcutDraft(
  kind: PartnerShortcutKind,
  position: Pick<PartnerPosition, "partnerId" | "name" | "cuenta" | "pendienteRetiro">,
  today: string
): EntryDraft {
  const draft = emptyDraft(kind, today);
  draft.partner_id = position.partnerId;
  if (kind === "aporte") {
    draft.description = `Aporte de ${position.name}`;
  } else if (kind === "reembolso") {
    const owed = Math.max(0, position.cuenta);
    draft.description = `Reembolso a ${position.name}`;
    draft.amount = owed > 0 ? amountToInput(owed, "PYG") : "";
  } else {
    const pending = Math.max(0, position.pendienteRetiro);
    draft.description = `Retiro de utilidad de ${position.name}`;
    draft.amount = pending > 0 ? amountToInput(pending, "PYG") : "";
    // Si ya tiene plata de F7 en su poder, se retira de ahí; si no, de la caja.
    draft.via_partner_id = position.cuenta < 0 ? position.partnerId : "";
  }
  return draft;
}

// Los movimientos (uno o dos) que anotan una transferencia entre socios, pagada del bolsillo de quien transfiere.
export function settlementDrafts(
  transfer: Transfer,
  positions: Pick<PartnerPosition, "partnerId" | "name" | "cuenta">[],
  today: string
): EntryDraft[] {
  const plan = planSettlement(transfer, positions);
  const nameOf = (id: string) => positions.find((p) => p.partnerId === id)?.name ?? "socio";
  const to = nameOf(transfer.toId);
  const from = nameOf(transfer.fromId);
  const out: EntryDraft[] = [];
  if (plan.reembolso > 0) {
    const draft = emptyDraft("reembolso", today);
    draft.partner_id = transfer.toId;
    draft.via_partner_id = transfer.fromId;
    draft.amount = amountToInput(plan.reembolso, "PYG");
    draft.description = `Reembolso a ${to} (pagó ${from})`;
    out.push(draft);
  }
  if (plan.retiro > 0) {
    const draft = emptyDraft("distribucion", today);
    draft.partner_id = transfer.toId;
    draft.via_partner_id = transfer.fromId;
    draft.amount = amountToInput(plan.retiro, "PYG");
    draft.description = `Retiro de utilidad de ${to} (pagó ${from})`;
    out.push(draft);
  }
  return out;
}

// ---------- Gastos fijos ----------

// Vencimientos desde `start` hasta `until` (y `end`). Mensual y anual caen el mismo día
// del mes que el inicio; si el mes no lo tiene, el último día. Igual que f7_recurring_occurrences.
export function recurringOccurrences(frequency: Frequency, start: string, end: string | null, until: string): string[] {
  const s = ymd(start);
  if (!s || !ymd(until)) return [];
  const step = frequency === "anual" ? 12 : 1;
  const out: string[] = [];
  for (let n = 0; n < MAX_OCCURRENCES; n++) {
    let due: string;
    if (frequency === "semanal") {
      due = addDaysISO(start, n * 7);
    } else {
      const total = s.m - 1 + n * step;
      const y = s.y + Math.floor(total / 12);
      const m = (total % 12) + 1;
      due = `${y}-${pad(m)}-${pad(Math.min(s.d, daysInMonth(y, m)))}`;
    }
    if (due > until || (end != null && due > end)) break;
    out.push(due);
  }
  return out;
}

export function nextDue(
  t: Pick<F7Recurring, "frequency" | "start_date" | "end_date" | "active">,
  today: string
): string | null {
  if (!t.active) return null;
  const list = recurringOccurrences(t.frequency, t.start_date, t.end_date, addDaysISO(today, 400));
  return list.find((d) => d >= today) ?? null;
}

const PER_MONTH: Record<Frequency, number> = { semanal: 52 / 12, mensual: 1, anual: 1 / 12 };

export function monthlyEquivalent(amountPyg: number, frequency: Frequency): number {
  return Math.round(amountPyg * PER_MONTH[frequency]);
}

export function recurringPyg(t: Pick<F7Recurring, "amount" | "currency" | "fx_rate">): number {
  return toPyg(t.amount, t.currency, t.fx_rate);
}

export function monthlyFixedCost(templates: F7Recurring[], today: string): number {
  return templates
    .filter((t) => t.active && (t.end_date == null || t.end_date >= today))
    .reduce((sum, t) => sum + monthlyEquivalent(recurringPyg(t), t.frequency), 0);
}

export interface RecurringDraft {
  name: string;
  category_id: string;
  amount: string;
  currency: Currency;
  fx_rate: string;
  frequency: Frequency;
  start_date: string;
  end_date: string;
  default_partner_id: string;
  payment_method: string;
  notes: string;
}

export type RecurringField = keyof RecurringDraft;
export type RecurringErrors = Partial<Record<RecurringField, string>>;

export interface RecurringPayload {
  name: string;
  category_id: string;
  amount: number;
  currency: Currency;
  fx_rate: number | null;
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
  default_partner_id: string | null;
  payment_method: string | null;
  notes: string | null;
}

export function emptyRecurringDraft(today: string): RecurringDraft {
  return {
    name: "",
    category_id: "",
    amount: "",
    currency: "PYG",
    fx_rate: "",
    frequency: "mensual",
    start_date: today,
    end_date: "",
    default_partner_id: "",
    payment_method: "",
    notes: "",
  };
}

export function recurringDraftFrom(t: F7Recurring): RecurringDraft {
  return {
    name: t.name,
    category_id: t.category_id,
    amount: amountToInput(t.amount, t.currency),
    currency: t.currency,
    fx_rate: t.fx_rate == null ? "" : amountToInput(t.fx_rate, "USD"),
    frequency: t.frequency,
    start_date: t.start_date,
    end_date: t.end_date ?? "",
    default_partner_id: t.default_partner_id ?? "",
    payment_method: t.payment_method ?? "",
    notes: t.notes ?? "",
  };
}

export function validateRecurringDraft(
  draft: RecurringDraft,
  ctx: Pick<EntryValidationContext, "categories" | "partners" | "keepPartnerIds">
): { errors: RecurringErrors; payload: RecurringPayload | null } {
  const errors: RecurringErrors = {};

  const name = draft.name.trim();
  if (!name) errors.name = "Poné un nombre (por ejemplo Supabase).";
  else if (name.length > 120) errors.name = "Máximo 120 caracteres.";

  const category = ctx.categories.find((c) => c.id === draft.category_id);
  if (!draft.category_id) errors.category_id = "Elegí una categoría.";
  else if (!category || category.kind !== "gasto") errors.category_id = "Elegí una categoría de gasto.";

  const amount = parseMoneyInput(draft.amount, draft.currency);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount =
      draft.currency === "USD"
        ? "Poné un monto mayor a 0 (hasta 2 decimales)."
        : "Poné un monto mayor a 0, sin decimales.";
  } else if (amount > MAX_AMOUNT) {
    errors.amount = "El monto es demasiado grande.";
  }

  let fxRate: number | null = null;
  if (draft.currency === "USD") {
    const fx = parseFxInput(draft.fx_rate);
    if (!Number.isFinite(fx)) errors.fx_rate = "Poné el tipo de cambio estimado (guaraníes por dólar).";
    else if (fx < FX_MIN || fx > FX_MAX) errors.fx_rate = "Ese tipo de cambio no parece de guaraníes por dólar.";
    else fxRate = fx;
  }

  if (!isValidISODate(draft.start_date) || draft.start_date < MIN_DATE) {
    errors.start_date = "Elegí una fecha de inicio válida (desde 2020).";
  }
  let endDate: string | null = null;
  if (draft.end_date) {
    if (!isValidISODate(draft.end_date)) errors.end_date = "Fecha de fin inválida.";
    else if (isValidISODate(draft.start_date) && draft.end_date < draft.start_date) {
      errors.end_date = "El fin no puede ser anterior al inicio.";
    } else endDate = draft.end_date;
  }

  const keep = ctx.keepPartnerIds ?? [];
  let defaultPartner: string | null = null;
  if (draft.default_partner_id) {
    const p = ctx.partners.find((x) => x.id === draft.default_partner_id);
    if (!p || (!p.active && !keep.includes(p.id))) errors.default_partner_id = "Ese socio no está disponible (está inactivo).";
    else defaultPartner = p.id;
  }

  const paymentMethod = draft.payment_method.trim();
  if (paymentMethod.length > 80) errors.payment_method = "Máximo 80 caracteres.";
  const notes = draft.notes.trim();
  if (notes.length > 1000) errors.notes = "Máximo 1000 caracteres.";

  if (Object.keys(errors).length > 0) return { errors, payload: null };

  return {
    errors,
    payload: {
      name,
      category_id: draft.category_id,
      amount: draft.currency === "USD" ? Math.round(amount * 100) / 100 : Math.round(amount),
      currency: draft.currency,
      fx_rate: fxRate,
      frequency: draft.frequency,
      start_date: draft.start_date,
      end_date: endDate,
      default_partner_id: defaultPartner,
      payment_method: paymentMethod || null,
      notes: notes || null,
    },
  };
}

// Cuántos vencimientos ya pasados generaría una plantilla nueva (para avisar antes de crearla).
export function pastDueCount(
  t: Pick<RecurringPayload, "frequency" | "start_date" | "end_date">,
  today: string
): number {
  return recurringOccurrences(t.frequency, t.start_date, t.end_date, addDaysISO(today, -1)).length;
}

// El generador crea los vencimientos hasta 10 días adelante.
export const GENERATE_AHEAD_DAYS = 10;

// Vencimientos de la plantilla que todavía no tienen movimiento (los que el generador crearía ahora).
// Al reanudar una plantilla pausada, son los que quedaron sin generar durante la pausa.
export function missingDues(
  t: Pick<F7Recurring, "id" | "frequency" | "start_date" | "end_date">,
  entries: Pick<F7Entry, "recurring_id" | "recurring_due">[],
  today: string
): string[] {
  const existing = new Set<string>();
  for (const e of entries) if (e.recurring_id === t.id && e.recurring_due) existing.add(e.recurring_due);
  return recurringOccurrences(t.frequency, t.start_date, t.end_date, addDaysISO(today, GENERATE_AHEAD_DAYS)).filter(
    (due) => !existing.has(due)
  );
}

// ---------- Socios ----------

export interface PartnerDraft {
  name: string;
  share_pct: string;
  active: boolean;
  notes: string;
}

export interface PartnerPayload {
  name: string;
  share_pct: number;
  active: boolean;
  notes: string | null;
}

export function validatePartnerDraft(
  draft: PartnerDraft,
  existing: Pick<F7Partner, "id" | "name">[],
  selfId: string | null
): { errors: Partial<Record<keyof PartnerDraft, string>>; payload: PartnerPayload | null } {
  const errors: Partial<Record<keyof PartnerDraft, string>> = {};
  const name = draft.name.trim();
  if (!name) errors.name = "Poné el nombre del socio.";
  else if (name.length > 80) errors.name = "Máximo 80 caracteres.";
  else if (existing.some((p) => p.id !== selfId && fold(p.name) === fold(name))) {
    errors.name = "Ya hay un socio con ese nombre.";
  }

  const raw = draft.share_pct.trim();
  const pct = /^\d+([.,]\d{1,2})?$/.test(raw) ? Number(raw.replace(",", ".")) : NaN;
  if (!Number.isFinite(pct)) errors.share_pct = "Poné un porcentaje (por ejemplo 50 o 33,33).";
  else if (pct > 100) errors.share_pct = "El porcentaje no puede pasar de 100.";

  const notes = draft.notes.trim();
  if (notes.length > 500) errors.notes = "Máximo 500 caracteres.";

  if (Object.keys(errors).length > 0) return { errors, payload: null };
  return { errors, payload: { name, share_pct: pct, active: draft.active, notes: notes || null } };
}

export interface CategoryNameCheck {
  ok: boolean;
  message?: string;
  name: string;
}

export function validateCategoryName(
  raw: string,
  kind: "ingreso" | "gasto",
  existing: Pick<F7Category, "kind" | "name">[]
): CategoryNameCheck {
  const name = raw.trim();
  if (!name) return { ok: false, name, message: "Poné un nombre." };
  if (name.length > 60) return { ok: false, name, message: "Máximo 60 caracteres." };
  if (existing.some((c) => c.kind === kind && fold(c.name) === fold(name))) {
    return { ok: false, name, message: "Ya existe una categoría con ese nombre." };
  }
  return { ok: true, name };
}

// ---------- Recibos de suscripción -> ingresos ----------

export interface ReceiptLite {
  id: string;
  receipt_number: string;
  customer_name: string;
  payment_date: string;
  amount: number;
  currency: Currency;
  payment_method: string | null;
  description: string | null;
  voided_at: string | null;
}

export function normalizeReceipt(row: Row): ReceiptLite {
  return {
    id: str(row.id),
    receipt_number: str(row.receipt_number),
    customer_name: str(row.customer_name),
    payment_date: str(row.payment_date).slice(0, 10),
    amount: Number(row.amount ?? 0),
    currency: row.currency === "USD" ? "USD" : "PYG",
    payment_method: strOrNull(row.payment_method),
    description: strOrNull(row.description),
    voided_at: strOrNull(row.voided_at),
  };
}

// Recibos vigentes que todavía no tienen su ingreso registrado.
export function unregisteredReceipts(receipts: ReceiptLite[], entries: F7Entry[]): ReceiptLite[] {
  const linked = new Set(entries.filter((e) => e.receipt_id && !e.voided_at).map((e) => e.receipt_id as string));
  return receipts
    .filter((r) => !r.voided_at && !linked.has(r.id))
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date) || b.receipt_number.localeCompare(a.receipt_number));
}

// Ingresos cargados a mano del mismo día, monto y moneda: probablemente son este recibo.
export function findLinkCandidates(receipt: ReceiptLite, entries: F7Entry[]): F7Entry[] {
  return entries.filter(
    (e) =>
      e.kind === "ingreso" &&
      !e.voided_at &&
      !e.receipt_id &&
      e.entry_date === receipt.payment_date &&
      e.currency === receipt.currency &&
      Math.abs(e.amount - receipt.amount) < 0.005
  );
}

export function buildReceiptImportPayload(
  receipt: ReceiptLite,
  opts: { categoryId: string; partnerId: string; fxRate: string; today: string; categories: EntryValidationContext["categories"]; partners: EntryValidationContext["partners"] }
): { errors: EntryErrors; payload: (EntryPayload & { receipt_id: string }) | null } {
  const description = `Recibo ${receipt.receipt_number} · ${receipt.customer_name}`.slice(0, 200);
  const draft: EntryDraft = {
    kind: "ingreso",
    entry_date: receipt.payment_date,
    description,
    category_id: opts.categoryId,
    amount: amountToInput(receipt.amount, receipt.currency),
    currency: receipt.currency,
    fx_rate: opts.fxRate,
    status: receipt.payment_date > opts.today ? "pendiente" : "pagado",
    partner_id: opts.partnerId,
    via_partner_id: "",
    payment_method: receipt.payment_method ?? "",
    notes: "",
  };
  const { errors, payload } = validateEntryDraft(draft, {
    today: opts.today,
    categories: opts.categories,
    partners: opts.partners,
  });
  return { errors, payload: payload ? { ...payload, receipt_id: receipt.id } : null };
}

// ---------- Exportar a Excel (CSV) ----------

const CSV_SEP = ";";

function csvText(value: string | null | undefined): string {
  let text = (value ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`;
  if (/[;"]/.test(text) || text !== text.trim()) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

const csvNumber = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

export const CSV_HEADERS = [
  "Fecha",
  "Tipo",
  "Estado",
  "Descripción",
  "Categoría",
  "Monto",
  "Moneda",
  "Tipo de cambio",
  "Monto en Gs.",
  "Cuenta / socio",
  "Forma de pago",
  "Origen",
  "Notas",
  "Motivo de anulación",
];

export function entriesToCsv(entries: F7Entry[], l: Lookups, today: string): string {
  const rows = entries.map((e) =>
    [
      csvText(formatDateISO(e.entry_date)),
      csvText(KIND_LABELS[e.kind]),
      csvText(stateLabel(e, today)),
      csvText(e.description),
      csvText(categoryName(l, e.category_id)),
      csvNumber(e.amount),
      csvText(e.currency),
      csvNumber(e.fx_rate),
      csvNumber(e.amount_pyg),
      csvText(flowLabel(e, l)),
      csvText(e.payment_method),
      csvText(sourceLabel(e)),
      csvText(e.notes),
      csvText(e.void_reason),
    ].join(CSV_SEP)
  );
  // BOM para que Excel respete las tildes.
  return `\uFEFF${[CSV_HEADERS.join(CSV_SEP), ...rows].join("\r\n")}\r\n`;
}

export function csvFileName(period: Period, today: string): string {
  const from = period.from ?? "inicio";
  const to = period.to ?? today;
  return `finanzas-f7_${from}_${to}.csv`;
}

// ---------- Errores de la base ----------

// Los textos que levantan las reglas de la base ya están en castellano: se muestran tal cual.
export function friendlyFinanceError(error: unknown, fallback = "No se pudo completar la acción. Probá de nuevo."): string {
  const e = (error ?? {}) as { message?: unknown; details?: unknown; code?: unknown };
  const message = typeof e.message === "string" ? e.message : typeof error === "string" ? error : "";
  const details = typeof e.details === "string" ? e.details : "";
  const code = typeof e.code === "string" ? e.code : "";
  const text = `${message} ${details}`;

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(text)) {
    return "No hay conexión con el servidor. Revisá tu internet y probá de nuevo.";
  }
  if (code === "PGRST301" || /\bjwt\b/i.test(message)) return "Tu sesión venció. Volvé a iniciar sesión.";
  if (code === "P0001" && message) return message;
  if (code === "23505") {
    if (/receipt_id_key/.test(text)) return "Ese recibo ya está registrado como ingreso.";
    if (/f7_entries_recurring_once/.test(text)) return "Ese vencimiento del gasto fijo ya existe.";
    if (/f7_partners_name_key/.test(text)) return "Ya hay un socio con ese nombre.";
    if (/f7_finance_categories_name_key/.test(text)) return "Ya existe una categoría con ese nombre.";
    return "Ya existe un registro igual.";
  }
  if (code === "23503") {
    if (/^update or delete/i.test(message)) return "No se puede borrar: ya se usa en movimientos. Mejor desactivalo.";
    return "Algo de lo que elegiste ya no existe. Actualizá la pantalla y probá de nuevo.";
  }
  if (code === "23514") return "Hay un dato que no es válido. Revisá el formulario.";
  if (code === "42501" || /row-level security|permission denied|no autorizado/i.test(message)) {
    return "No tenés permiso para hacer esto.";
  }
  return fallback;
}
