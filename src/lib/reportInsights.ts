// Cálculos puros de los reportes "baratos" del Bloque 1 (A5): dinero parado,
// reposición, top de servicios, entregas a tiempo, tiempo por etapa y
// clientes que no volvieron. Sin acceso a la base: reciben las filas ya
// cargadas, así se prueban con datos inventados.

export const DAY_MS = 86_400_000;

export const STAGE_ORDER = [
  "presupuesto",
  "recibido",
  "en_diagnostico",
  "en_reparacion",
  "listo",
  "enviado",
  "entregado",
  "garantia",
  "retirado_sin_reparar",
] as const;

const TERMINAL_STAGES: readonly string[] = ["entregado", "enviado", "retirado_sin_reparar"];

const stockValue = (i: { stock: number; cost_price: number | null }) =>
  Number(i.stock || 0) * Number(i.cost_price || 0);

/* ------------------------------ Inventario ------------------------------ */

export interface StockItem {
  id: string;
  name: string;
  stock: number;
  min_stock_alert: number;
  cost_price: number | null;
  created_at: string;
  branch_id: string | null;
  category_id: string | null;
}

export interface IdleStockRow extends StockItem {
  value: number;
  idleDays: number;
  /** true si no hay ninguna salida registrada y el artículo es más viejo que el historial consultado. */
  idleDaysIsMinimum: boolean;
}

/**
 * Artículos con stock que no tuvieron movimiento en `days` días. Movimiento =
 * la última vez que se usó en una orden o se vendió, o el día que se cargó el
 * artículo si nunca salió.
 */
export function findIdleStock(
  items: StockItem[],
  lastUsedAt: Map<string, number>,
  days: number,
  historyDays: number,
  now: number = Date.now(),
): { rows: IdleStockRow[]; totalValue: number } {
  const cutoff = now - days * DAY_MS;
  const rows: IdleStockRow[] = [];
  for (const item of items) {
    if (!(item.stock > 0)) continue;
    const created = new Date(item.created_at).getTime();
    const used = lastUsedAt.get(item.id);
    const lastMovement = Math.max(created, used ?? 0);
    if (lastMovement >= cutoff) continue;
    const idleDays = Math.floor((now - lastMovement) / DAY_MS);
    rows.push({
      ...item,
      value: stockValue(item),
      idleDays,
      idleDaysIsMinimum: used === undefined && idleDays >= historyDays,
    });
  }
  rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  return { rows, totalValue: rows.reduce((s, r) => s + r.value, 0) };
}

export interface ReorderRow extends StockItem {
  status: "agotado" | "bajo";
}

/** Mismo criterio que la alerta de Inventario: stock igual o menor al mínimo. */
export function findReorder(items: StockItem[]): ReorderRow[] {
  const rows: ReorderRow[] = [];
  for (const item of items) {
    if (item.stock > item.min_stock_alert) continue;
    rows.push({ ...item, status: item.stock <= 0 ? "agotado" : "bajo" });
  }
  rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === "agotado" ? -1 : 1;
    return a.stock - a.min_stock_alert - (b.stock - b.min_stock_alert) || a.name.localeCompare(b.name);
  });
  return rows;
}

export function reorderListText(rows: ReorderRow[]): string {
  return rows
    .map((r) => `${r.name} — stock ${r.stock}, mínimo ${r.min_stock_alert}${r.status === "agotado" ? " (agotado)" : ""}`)
    .join("\n");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface CountSheetRow {
  name: string;
  category: string;
  branch: string | null;
  stock: number;
}

/** Hoja imprimible para contar el stock físico y compararlo con el del sistema. */
export function buildCountSheetHtml(params: {
  title: string;
  subtitle: string;
  rows: CountSheetRow[];
  showBranch: boolean;
}): string {
  const { title, subtitle, rows, showBranch } = params;
  const body = rows
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.category)}</td>
        ${showBranch ? `<td>${escapeHtml(r.branch ?? "—")}</td>` : ""}
        <td class="num">${r.stock}</td>
        <td class="box"></td>
        <td class="box"></td>
      </tr>`,
    )
    .join("");
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; color: #111; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: #555; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; }
  td.num, th.num { text-align: right; width: 90px; }
  td.box { width: 90px; }
  tr { page-break-inside: avoid; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(subtitle)}</p>
<table>
  <thead><tr>
    <th>Artículo</th><th>Categoría</th>${showBranch ? "<th>Sucursal</th>" : ""}
    <th class="num">En sistema</th><th class="num">Contado</th><th class="num">Diferencia</th>
  </tr></thead>
  <tbody>${body}</tbody>
</table>
</body></html>`;
}

/* -------------------------------- Órdenes ------------------------------- */

export interface OrderInsightRow {
  id: string;
  client_id: string | null;
  customer_name: string;
  customer_phone: string;
  created_at: string;
  status: string;
  problems: string[] | null;
  quote_amount: number | null;
  cargos_adicionales: unknown;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
}

export function orderTotal(o: Pick<OrderInsightRow, "quote_amount" | "cargos_adicionales">): number {
  const extras = Array.isArray(o.cargos_adicionales)
    ? o.cargos_adicionales.reduce((s: number, c: { monto?: unknown } | null) => s + (Number(c?.monto) || 0), 0)
    : 0;
  return Number(o.quote_amount ?? 0) + extras;
}

export function inRange(iso: string | null, from: Date | null, to: Date | null): boolean {
  if (!iso) return false;
  if (!from || !to) return true;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export interface ServiceRow {
  name: string;
  count: number;
  avgTicket: number;
}

/** Problemas/servicios más frecuentes entre las órdenes creadas en el rango (los presupuestos sin convertir no cuentan). */
export function topServices(orders: OrderInsightRow[], from: Date | null, to: Date | null, limit = 8): ServiceRow[] {
  const map = new Map<string, { count: number; ticketSum: number; ticketN: number }>();
  for (const o of orders) {
    if (o.status === "presupuesto" || !inRange(o.created_at, from, to)) continue;
    const total = orderTotal(o);
    const seen = new Set<string>();
    for (const raw of o.problems ?? []) {
      const name = String(raw ?? "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const entry = map.get(name) ?? { count: 0, ticketSum: 0, ticketN: 0 };
      entry.count += 1;
      if (total > 0) {
        entry.ticketSum += total;
        entry.ticketN += 1;
      }
      map.set(name, entry);
    }
  }
  return Array.from(map.entries())
    .map(([name, e]) => ({ name, count: e.count, avgTicket: e.ticketN > 0 ? e.ticketSum / e.ticketN : 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export interface OnTimeResult {
  /** Entregas del período que tenían fecha prometida. */
  withDate: number;
  onTime: number;
  late: number;
  /** Entregas del período sin fecha prometida (no entran en el porcentaje). */
  withoutDate: number;
  /** Retraso promedio, en días, de las entregas tardías. */
  avgLateDays: number;
  pct: number | null;
}

/** Entregas (estado "Entregado") del rango: ¿se entregó el día prometido o antes? */
export function onTimeDelivery(orders: OrderInsightRow[], from: Date | null, to: Date | null): OnTimeResult {
  let onTime = 0;
  let late = 0;
  let withoutDate = 0;
  let lateDaysSum = 0;
  for (const o of orders) {
    if (o.status !== "entregado" || !inRange(o.delivered_at, from, to)) continue;
    if (!o.estimated_delivery_date) {
      withoutDate += 1;
      continue;
    }
    const delivered = localDateKey(o.delivered_at as string);
    const promised = o.estimated_delivery_date.slice(0, 10);
    if (delivered <= promised) {
      onTime += 1;
    } else {
      late += 1;
      lateDaysSum += dayNumber(delivered) - dayNumber(promised);
    }
  }
  const withDate = onTime + late;
  return {
    withDate,
    onTime,
    late,
    withoutDate,
    avgLateDays: late > 0 ? lateDaysSum / late : 0,
    pct: withDate > 0 ? Math.round((onTime / withDate) * 100) : null,
  };
}

export interface HistoryRow {
  order_id: string;
  status: string;
  created_at: string;
}

export interface StageStat {
  status: string;
  /** Órdenes distintas que pasaron por la etapa. */
  orders: number;
  /** Días promedio que se quedó una orden en la etapa; null si la etapa es final o ninguna salió todavía. */
  avgDays: number | null;
}

/**
 * Tiempo promedio por etapa a partir del historial de estados. Las notas y
 * pagos que repiten el estado actual no cortan la etapa; la etapa en la que
 * está hoy cada orden no cuenta porque todavía no terminó.
 */
export function stageDurations(history: HistoryRow[]): StageStat[] {
  const byOrder = new Map<string, HistoryRow[]>();
  for (const h of history) {
    const list = byOrder.get(h.order_id) ?? [];
    list.push(h);
    byOrder.set(h.order_id, list);
  }
  const stats = new Map<string, { orders: Set<string>; sum: number; samples: number }>();
  const entry = (status: string) => {
    let e = stats.get(status);
    if (!e) {
      e = { orders: new Set(), sum: 0, samples: 0 };
      stats.set(status, e);
    }
    return e;
  };

  for (const [orderId, rows] of byOrder) {
    const sorted = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const visits: { status: string; start: number }[] = [];
    for (const r of sorted) {
      if (visits.length > 0 && visits[visits.length - 1].status === r.status) continue;
      visits.push({ status: r.status, start: new Date(r.created_at).getTime() });
    }
    visits.forEach((v, i) => {
      const e = entry(v.status);
      e.orders.add(orderId);
      if (i < visits.length - 1 && !TERMINAL_STAGES.includes(v.status)) {
        e.sum += visits[i + 1].start - v.start;
        e.samples += 1;
      }
    });
  }

  const rank = (status: string) => {
    const i = (STAGE_ORDER as readonly string[]).indexOf(status);
    return i === -1 ? STAGE_ORDER.length : i;
  };
  return Array.from(stats.entries())
    .map(([status, e]) => ({
      status,
      orders: e.orders.size,
      avgDays: e.samples > 0 ? e.sum / e.samples / DAY_MS : null,
    }))
    .sort((a, b) => rank(a.status) - rank(b.status) || a.status.localeCompare(b.status));
}

export interface LapsedClient {
  key: string;
  name: string;
  phone: string;
  lastOrderAt: string;
  daysSince: number;
  orders: number;
}

/**
 * Clientes con al menos una orden real cuya última orden fue hace más de
 * `days` días y que no tienen ninguna orden abierta. Los presupuestos sin
 * convertir no cuentan como visita.
 */
export function lapsedClients(orders: OrderInsightRow[], days = 90, now: number = Date.now()): LapsedClient[] {
  const cutoff = now - days * DAY_MS;
  const closed: readonly string[] = ["entregado", "enviado", "retirado_sin_reparar"];
  const groups = new Map<string, { latest: OrderInsightRow; latestMs: number; count: number; hasOpen: boolean }>();
  for (const o of orders) {
    if (o.status === "presupuesto") continue;
    const key = o.client_id ?? `phone:${o.customer_phone}`;
    const ms = new Date(o.created_at).getTime();
    const g = groups.get(key);
    const open = !closed.includes(o.status);
    if (!g) {
      groups.set(key, { latest: o, latestMs: ms, count: 1, hasOpen: open });
    } else {
      g.count += 1;
      g.hasOpen = g.hasOpen || open;
      if (ms > g.latestMs) {
        g.latest = o;
        g.latestMs = ms;
      }
    }
  }
  const out: LapsedClient[] = [];
  for (const [key, g] of groups) {
    if (g.hasOpen || g.latestMs >= cutoff) continue;
    out.push({
      key,
      name: g.latest.customer_name,
      phone: g.latest.customer_phone,
      lastOrderAt: g.latest.created_at,
      daysSince: Math.floor((now - g.latestMs) / DAY_MS),
      orders: g.count,
    });
  }
  return out.sort((a, b) => a.daysSince - b.daysSince);
}

export function formatDaysAmount(days: number): string {
  if (days < 1 / 24) return "menos de 1 h";
  if (days < 1) return `${Math.round(days * 24)} h`;
  const rounded = Math.round(days * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1).replace(".", ",")} ${rounded === 1 ? "día" : "días"}`;
}
