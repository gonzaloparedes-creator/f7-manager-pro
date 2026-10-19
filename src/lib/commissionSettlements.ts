export interface CommissionSettlement {
  id: string;
  user_id: string | null;
  user_name: string;
  period_from: string;
  period_to: string;
  base_amount: number;
  rate: number;
  amount: number;
  notes: string | null;
  created_at: string;
  voided_at: string | null;
}

/** Fecha local como "yyyy-MM-dd" (las liquidaciones se guardan por día, no por hora). */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** "2026-10-05" → "05/10/2026" */
export function formatDateKey(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export function formatPeriod(from: string, to: string): string {
  return from === to ? formatDateKey(from) : `${formatDateKey(from)} – ${formatDateKey(to)}`;
}

export function commissionAmount(base: number, rate: number): number {
  if (!(base > 0) || !(rate > 0)) return 0;
  return Math.round((base * rate) / 100);
}

export type SettleWindow =
  | { status: "no-range"; reason: "all" | "open" }
  | { status: "covered" }
  | {
      status: "ok";
      from: string;
      to: string;
      /** El rango elegido toca días que ya estaban liquidados (se saltean). */
      skipsSettled: boolean;
      includesToday: boolean;
    };

/**
 * Qué se puede liquidar dentro del rango elegido en Reportes. Solo cuentan los días
 * cerrados (hasta ayer) y los que no están ya cubiertos por una liquidación vigente de
 * la misma persona. Devuelve el primer tramo libre y continuo: si queda más después,
 * se liquida en una segunda vuelta.
 *
 * `from`/`to` null = "Todo el tiempo": no se liquida un rango sin límites.
 */
export function settleWindow(
  from: string | null,
  to: string | null,
  today: string,
  settlements: Pick<CommissionSettlement, "period_from" | "period_to" | "voided_at">[],
): SettleWindow {
  if (!from || !to) return { status: "no-range", reason: "all" };
  const yesterday = addDaysToKey(today, -1);
  if (from > yesterday) return { status: "no-range", reason: "open" };

  const includesToday = to >= today;
  const cappedTo = to < yesterday ? to : yesterday;

  const active = settlements
    .filter((s) => !s.voided_at)
    .map((s) => ({ from: s.period_from, to: s.period_to }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

  let start = from;
  for (let moved = true; moved; ) {
    moved = false;
    for (const s of active) {
      if (s.from <= start && start <= s.to) {
        start = addDaysToKey(s.to, 1);
        moved = true;
      }
    }
  }
  if (start > cappedTo) return { status: "covered" };

  let end = cappedTo;
  const maxEnd = addDaysToKey(start, 366);
  if (end > maxEnd) end = maxEnd;
  for (const s of active) {
    if (s.from > start && addDaysToKey(s.from, -1) < end) end = addDaysToKey(s.from, -1);
  }

  return {
    status: "ok",
    from: start,
    to: end,
    skipsSettled: active.some((s) => s.from <= cappedTo && s.to >= from),
    includesToday,
  };
}
