// Cálculos puros de los reportes avanzados del Bloque B6: punto de equilibrio,
// curva ABC, segmentación RFM y valor de vida del cliente (LTV). Sin acceso a la
// base: reciben filas ya cargadas, así se prueban con datos inventados.
//
// Base de los números (la misma que el resto de Reportes):
//  - Ganancia = lo cobrado menos el costo de lo que se usó o vendió. No descuenta
//    los gastos del negocio: por eso el punto de equilibrio los compara aparte.
//  - Costos fijos = solo los gastos recurrentes activos (alquiler, sueldos, internet…).
//  - Clientes: se miden con las órdenes reales (los presupuestos sin convertir no cuentan).

import { DAY_MS, inRange, orderTotal } from "./reportInsights";

/* ------------------------- Punto de equilibrio ------------------------- */

export const WEEKS_PER_MONTH = 52 / 12;

export interface FixedCostRule {
  amount: number | string;
  frequency: "mensual" | "semanal";
  category: string;
  description: string | null;
}

export interface FixedCostRow {
  label: string;
  monthly: number;
}

/** Cuánto pesa una regla recurrente en un mes típico (una semanal vale 52/12 veces su monto). */
export function monthlyAmount(rule: Pick<FixedCostRule, "amount" | "frequency">): number {
  const amount = Number(rule.amount) || 0;
  return rule.frequency === "semanal" ? amount * WEEKS_PER_MONTH : amount;
}

export function monthlyFixedCosts(rules: FixedCostRule[]): { total: number; rows: FixedCostRow[] } {
  const rows = rules
    .map((r) => ({ label: r.description?.trim() || r.category, monthly: monthlyAmount(r) }))
    .filter((r) => r.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly || a.label.localeCompare(b.label));
  return { total: rows.reduce((s, r) => s + r.monthly, 0), rows };
}

export type BusinessHealth = "saludable" | "atencion" | "critico" | "temprano" | "sin_costos";

export interface BreakEvenInput {
  fixedMonthly: number;
  /** Lo cobrado y lo que costó, del 1.º del mes hasta hoy. */
  monthRevenue: number;
  monthCost: number;
  /** Lo mismo en los últimos 90 días: da un margen más estable que un mes a medias. */
  trailingRevenue: number;
  trailingCost: number;
  dayOfMonth: number;
  daysInMonth: number;
}

export interface BreakEvenResult {
  fixedMonthly: number;
  /** Porcentaje (0–100) de cada guaraní cobrado que queda como ganancia; null si todavía no hay cobros. */
  marginPct: number | null;
  /** Cobros del mes que hacen falta para cubrir los costos fijos; null si no hay margen positivo para calcularlo. */
  breakEvenRevenue: number | null;
  monthRevenue: number;
  monthProfit: number;
  /** Cuánto de los costos fijos ya cubrió la ganancia del mes (puede pasar de 100). */
  coveragePct: number;
  /** Ganancia que falta para cubrir los costos fijos de este mes. */
  remaining: number;
  /** Ganancia con la que cerraría el mes si sigue al ritmo actual; null en los primeros días. */
  projectedProfit: number | null;
  health: BusinessHealth;
}

/** Los primeros días del mes todavía no dicen nada del ritmo. */
export const MIN_DAYS_TO_PROJECT = 7;

export function breakEven(input: BreakEvenInput): BreakEvenResult {
  const { fixedMonthly, monthRevenue, monthCost, trailingRevenue, trailingCost, dayOfMonth, daysInMonth } = input;
  const monthProfit = monthRevenue - monthCost;

  let marginPct: number | null = null;
  if (trailingRevenue > 0) marginPct = ((trailingRevenue - trailingCost) / trailingRevenue) * 100;
  else if (monthRevenue > 0) marginPct = (monthProfit / monthRevenue) * 100;

  const breakEvenRevenue = fixedMonthly > 0 && marginPct !== null && marginPct > 0 ? fixedMonthly / (marginPct / 100) : null;

  const coveragePct = fixedMonthly > 0 ? (monthProfit / fixedMonthly) * 100 : 0;
  const remaining = Math.max(0, fixedMonthly - monthProfit);
  const projectedProfit = dayOfMonth >= MIN_DAYS_TO_PROJECT && daysInMonth > 0 ? (monthProfit / dayOfMonth) * daysInMonth : null;

  let health: BusinessHealth;
  if (fixedMonthly <= 0) health = "sin_costos";
  else if (monthProfit >= fixedMonthly) health = "saludable";
  else if (projectedProfit === null) health = "temprano";
  else if (projectedProfit >= fixedMonthly) health = "saludable";
  else if (projectedProfit >= fixedMonthly * 0.7) health = "atencion";
  else health = "critico";

  return { fixedMonthly, marginPct, breakEvenRevenue, monthRevenue, monthProfit, coveragePct, remaining, projectedProfit, health };
}

/* ------------------------------ Curva ABC ------------------------------ */

export interface AbcSaleRow {
  inventory_item_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number | string | null;
  unit_cost: number | string | null;
  created_at: string;
}

export interface AbcProduct {
  key: string;
  name: string;
  units: number;
  revenue: number;
  profit: number;
}

/** Productos vendidos en el rango, con lo facturado y la ganancia de cada uno. Mismo cálculo que las ventas de Reportes. */
export function aggregateProductSales(sales: AbcSaleRow[], from: Date | null, to: Date | null): AbcProduct[] {
  const map = new Map<string, AbcProduct>();
  for (const s of sales) {
    if (!inRange(s.created_at, from, to)) continue;
    const name = s.product_name?.trim() || "Sin nombre";
    const key = s.inventory_item_id ?? `name:${name}`;
    const revenue = s.quantity * Number(s.unit_price || 0);
    const cost = s.quantity * Number(s.unit_cost || 0);
    const cur = map.get(key) ?? { key, name, units: 0, revenue: 0, profit: 0 };
    cur.units += s.quantity;
    cur.revenue += revenue;
    cur.profit += revenue - cost;
    map.set(key, cur);
  }
  return Array.from(map.values());
}

export type AbcClass = "A" | "B" | "C";

export interface AbcRow extends AbcProduct {
  /** Parte de la facturación total (0–100). */
  sharePct: number;
  /** Facturación acumulada hasta este producto, de mayor a menor (0–100). */
  cumulativePct: number;
  klass: AbcClass;
}

export interface AbcSummary {
  klass: AbcClass;
  products: number;
  productsPct: number;
  revenue: number;
  revenuePct: number;
}

export const ABC_A_LIMIT = 80;
export const ABC_B_LIMIT = 95;

/**
 * Pareto de la facturación: A = los productos que juntan el 80 % de lo vendido,
 * B = los que siguen hasta el 95 %, C = la cola. Un producto cae en A mientras
 * lo acumulado ANTES de sumarlo no llegue al 80 %, así el que cruza el límite
 * también es A.
 */
export function abcCurve(products: AbcProduct[]): { rows: AbcRow[]; summary: AbcSummary[]; totalRevenue: number } {
  const sellers = products.filter((p) => p.revenue > 0).sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
  const totalRevenue = sellers.reduce((s, p) => s + p.revenue, 0);
  let cumulative = 0;
  const rows: AbcRow[] = sellers.map((p) => {
    const before = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
    cumulative += p.revenue;
    const klass: AbcClass = before < ABC_A_LIMIT ? "A" : before < ABC_B_LIMIT ? "B" : "C";
    return {
      ...p,
      sharePct: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
      cumulativePct: totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0,
      klass,
    };
  });
  const summary: AbcSummary[] = (["A", "B", "C"] as const).map((klass) => {
    const group = rows.filter((r) => r.klass === klass);
    const revenue = group.reduce((s, r) => s + r.revenue, 0);
    return {
      klass,
      products: group.length,
      productsPct: rows.length > 0 ? (group.length / rows.length) * 100 : 0,
      revenue,
      revenuePct: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
    };
  });
  return { rows, summary, totalRevenue };
}

/* ------------------------------- Clientes ------------------------------- */

export interface ClientOrderRow {
  id: string;
  client_id: string | null;
  customer_name: string;
  customer_phone: string;
  created_at: string;
  status: string;
  quote_amount: number | null;
  cargos_adicionales: unknown;
}

export interface ClientProfile {
  key: string;
  name: string;
  phone: string;
  /** Visitas: órdenes reales (sin los presupuestos sin convertir). */
  visits: number;
  /** Órdenes ya entregadas: las que dejaron plata. */
  delivered: number;
  /** Lo facturado en las órdenes entregadas. */
  value: number;
  lastOrderAt: string;
  daysSince: number;
  hasOpen: boolean;
}

const CLOSED_STATUSES: readonly string[] = ["entregado", "enviado", "retirado_sin_reparar"];
const PAID_STATUSES: readonly string[] = ["entregado", "enviado"];

// Un teléfono relleno ("000", "1111") no identifica a nadie: agrupar por él
// fusionaría clientes distintos (ver lib/clients.ts). Mismo piso que ahí.
function realPhoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/^595/, "").length >= 6 ? phone : null;
}

function clientKey(o: ClientOrderRow): string {
  return o.client_id ?? (realPhoneKey(o.customer_phone) ? `phone:${o.customer_phone}` : `order:${o.id}`);
}

export function clientProfiles(orders: ClientOrderRow[], now: number = Date.now()): ClientProfile[] {
  const groups = new Map<string, ClientProfile & { latestMs: number }>();
  for (const o of orders) {
    if (o.status === "presupuesto") continue;
    const key = clientKey(o);
    const ms = new Date(o.created_at).getTime();
    const paid = PAID_STATUSES.includes(o.status);
    const open = !CLOSED_STATUSES.includes(o.status);
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        key,
        name: o.customer_name,
        phone: o.customer_phone,
        visits: 1,
        delivered: paid ? 1 : 0,
        value: paid ? orderTotal(o) : 0,
        lastOrderAt: o.created_at,
        daysSince: 0,
        hasOpen: open,
        latestMs: ms,
      });
      continue;
    }
    g.visits += 1;
    if (paid) {
      g.delivered += 1;
      g.value += orderTotal(o);
    }
    g.hasOpen = g.hasOpen || open;
    if (ms > g.latestMs) {
      g.latestMs = ms;
      g.lastOrderAt = o.created_at;
      g.name = o.customer_name;
      g.phone = o.customer_phone;
    }
  }
  return Array.from(groups.values()).map(({ latestMs, ...p }) => ({
    ...p,
    daysSince: Math.max(0, Math.floor((now - latestMs) / DAY_MS)),
  }));
}

/* --------------------------------- RFM --------------------------------- */

export type RfmSegment = "campeones" | "leales" | "nuevos" | "en_riesgo" | "hibernando";

export const RFM_SEGMENTS: readonly RfmSegment[] = ["campeones", "leales", "nuevos", "en_riesgo", "hibernando"];
export const RFM_RECENT_DAYS = 90;
export const RFM_AT_RISK_DAYS = 180;

/**
 * Recencia y frecuencia definen el grupo; el monto se muestra por grupo. Un
 * cliente con una orden abierta cuenta como reciente aunque la haya abierto hace tiempo.
 */
export function rfmSegment(p: Pick<ClientProfile, "visits" | "daysSince" | "hasOpen">): RfmSegment {
  const recency = p.hasOpen ? 0 : p.daysSince;
  if (recency > RFM_AT_RISK_DAYS) return "hibernando";
  if (recency > RFM_RECENT_DAYS) return "en_riesgo";
  if (p.visits >= 3) return "campeones";
  if (p.visits === 2) return "leales";
  return "nuevos";
}

export interface RfmGroup {
  segment: RfmSegment;
  clients: ClientProfile[];
  count: number;
  /** Parte de todos los clientes (0–100). */
  pct: number;
  value: number;
}

export function rfmGroups(profiles: ClientProfile[]): RfmGroup[] {
  const buckets = new Map<RfmSegment, ClientProfile[]>(RFM_SEGMENTS.map((s) => [s, []]));
  for (const p of profiles) buckets.get(rfmSegment(p))!.push(p);
  return RFM_SEGMENTS.map((segment) => {
    const clients = (buckets.get(segment) ?? []).sort(
      (a, b) => b.value - a.value || b.visits - a.visits || a.daysSince - b.daysSince || a.name.localeCompare(b.name),
    );
    return {
      segment,
      clients,
      count: clients.length,
      pct: profiles.length > 0 ? (clients.length / profiles.length) * 100 : 0,
      value: clients.reduce((s, c) => s + c.value, 0),
    };
  });
}

/* --------------------------------- LTV --------------------------------- */

export interface LtvResult {
  /** Clientes con al menos una orden entregada. */
  clients: number;
  totalValue: number;
  /** Lo que dejó en promedio cada cliente en toda su historia. */
  avgValue: number;
  /** Órdenes entregadas por cliente, en promedio. */
  avgOrders: number;
  /** Porcentaje (0–100) de esos clientes que volvieron: dos o más órdenes entregadas. */
  returnRatePct: number;
  /** Cuántos clientes forman el 10 % de arriba (al menos uno) y qué parte de lo facturado aportan. */
  topTenCount: number;
  topTenSharePct: number;
  topClients: ClientProfile[];
}

export function clientLtv(profiles: ClientProfile[], topLimit = 5): LtvResult | null {
  const paying = profiles.filter((p) => p.delivered > 0).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  if (paying.length === 0) return null;
  const totalValue = paying.reduce((s, p) => s + p.value, 0);
  const delivered = paying.reduce((s, p) => s + p.delivered, 0);
  const topTenCount = Math.max(1, Math.ceil(paying.length * 0.1));
  const topTenValue = paying.slice(0, topTenCount).reduce((s, p) => s + p.value, 0);
  return {
    clients: paying.length,
    totalValue,
    avgValue: totalValue / paying.length,
    avgOrders: delivered / paying.length,
    returnRatePct: (paying.filter((p) => p.delivered >= 2).length / paying.length) * 100,
    topTenCount,
    topTenSharePct: totalValue > 0 ? (topTenValue / totalValue) * 100 : 0,
    topClients: paying.slice(0, topLimit),
  };
}
