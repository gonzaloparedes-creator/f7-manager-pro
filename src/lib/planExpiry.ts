import type { Cycle } from "@/lib/plans";
import {
  addDaysISO,
  computePeriodEnd,
  formatDateISO,
  isValidISODate,
  todayInAsuncion,
} from "@/lib/subscriptionReceipt";

// Cuántos días antes del vencimiento la barra pasa a naranja y se avisa.
export const EXPIRY_WARNING_DAYS = 7;

// Mientras no se sepa el valor real (lo define la base: plan_grace_days()).
export const DEFAULT_GRACE_DAYS = 3;

export type ExpiryTone = "ok" | "soon" | "expired";

// active = plan vigente; grace = venció pero todavía hay acceso; suspended = acceso cortado.
export type ExpiryPhase = "active" | "grace" | "suspended";

// Duración por defecto de la prueba gratis (el valor real lo define la base: trial_default_days()).
export const DEFAULT_TRIAL_DAYS = 14;

// paid = hay un pago cargado; trial = solo prueba gratis.
export type ExpiryKind = "paid" | "trial";

// Lo que guarda companies: el período vigente (último pago registrado).
export interface PlanPeriodRow {
  billing_cycle: string | null;
  plan_paid_from: string | null;
  plan_expires_at: string | null;
}

// Período pago + prueba gratis. created_at puede ser una fecha (YYYY-MM-DD) o un timestamp.
export interface CompanyPeriodRow extends PlanPeriodRow {
  trial_ends_at?: string | null;
  created_at?: string | null;
}

export interface PlanExpiryInfo {
  kind: ExpiryKind;
  // null en la prueba gratis (no tiene ciclo de cobro).
  cycle: Cycle | null;
  // Inicio del período: fecha de pago, o de alta en la prueba.
  paidFrom: string;
  expiresAt: string;
  // 0 = vence hoy (último día cubierto); negativo = ya venció.
  daysLeft: number;
  totalDays: number;
  // Tiempo que queda del período, 0–100: la barra "se vacía" hasta el vencimiento.
  remainingPct: number;
  tone: ExpiryTone;
  headline: string;
  graceDays: number;
  // Último día con acceso: vencimiento + días de gracia (inclusive).
  accessUntil: string;
  // Días hasta el último día de acceso (0 = hoy es el último); negativo = ya suspendida.
  daysToSuspension: number;
  phase: ExpiryPhase;
}

const DAY_MS = 86_400_000;

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

// Días de calendario entre dos fechas YYYY-MM-DD (to − from).
export function diffDaysISO(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

function isCycle(value: string | null): value is Cycle {
  return value === "mensual" || value === "semestral" || value === "anual";
}

export function expiryHeadline(daysLeft: number, kind: ExpiryKind = "paid"): string {
  const trial = kind === "trial";
  if (daysLeft > 1) return `Quedan ${daysLeft} días`;
  if (daysLeft === 1) return "Queda 1 día";
  if (daysLeft === 0) return trial ? "Termina hoy" : "Vence hoy";
  const verb = trial ? "Terminó" : "Venció";
  if (daysLeft === -1) return `${verb} ayer`;
  return `${verb} hace ${Math.abs(daysLeft)} días`;
}

export function expiryTone(daysLeft: number): ExpiryTone {
  if (daysLeft < 0) return "expired";
  if (daysLeft <= EXPIRY_WARNING_DAYS) return "soon";
  return "ok";
}

export function expiryPhase(daysLeft: number, daysToSuspension: number): ExpiryPhase {
  if (daysLeft >= 0) return "active";
  return daysToSuspension >= 0 ? "grace" : "suspended";
}

// "Hoy es tu último día de acceso" / "Mañana es tu último día de acceso" / "Acceso hasta el 27/10/2026".
export function accessHeadline(daysToSuspension: number, accessUntil: string): string {
  if (daysToSuspension < 0) return "Cuenta suspendida";
  if (daysToSuspension === 0) return "Hoy es tu último día de acceso";
  if (daysToSuspension === 1) return "Mañana es tu último día de acceso";
  return `Acceso hasta el ${formatDateISO(accessUntil)}`;
}

// Fecha de Asunción de un timestamp ("2026-10-21T01:30:00Z" -> "2026-10-20"); una fecha sola queda igual.
export function dateInAsuncion(value: string): string {
  if (value.length <= 10) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : todayInAsuncion(parsed);
}

export type PaidExpiryInfo = PlanExpiryInfo & { kind: "paid"; cycle: Cycle };

function buildInfo(
  kind: ExpiryKind,
  cycle: Cycle | null,
  paidFrom: string,
  expiresAt: string,
  today: string,
  graceDays: number
): PlanExpiryInfo {
  const daysLeft = diffDaysISO(today, expiresAt);
  const totalDays = diffDaysISO(paidFrom, expiresAt) + 1;
  const remainingPct = Math.min(100, Math.max(0, Math.round(((daysLeft + 1) / totalDays) * 100)));
  const grace = Math.max(0, Math.floor(graceDays));
  const accessUntil = addDaysISO(expiresAt, grace);
  const daysToSuspension = diffDaysISO(today, accessUntil);

  return {
    kind,
    cycle,
    paidFrom,
    expiresAt,
    daysLeft,
    totalDays,
    remainingPct,
    tone: expiryTone(daysLeft),
    headline: expiryHeadline(daysLeft, kind),
    graceDays: grace,
    accessUntil,
    daysToSuspension,
    phase: expiryPhase(daysLeft, daysToSuspension),
  };
}

// null = la empresa todavía no tiene un pago registrado.
export function planExpiryInfo(
  row: PlanPeriodRow,
  today: string = todayInAsuncion(),
  graceDays: number = DEFAULT_GRACE_DAYS
): PaidExpiryInfo | null {
  const { billing_cycle, plan_paid_from, plan_expires_at } = row;
  if (!isCycle(billing_cycle) || !plan_paid_from || !plan_expires_at) return null;
  const paidFrom = plan_paid_from.slice(0, 10);
  const expiresAt = plan_expires_at.slice(0, 10);
  if (!isValidISODate(paidFrom) || !isValidISODate(expiresAt) || expiresAt < paidFrom) return null;
  return buildInfo("paid", billing_cycle, paidFrom, expiresAt, today, graceDays) as PaidExpiryInfo;
}

// null = la empresa no tiene una fecha de fin de prueba.
export function trialExpiryInfo(
  row: Pick<CompanyPeriodRow, "trial_ends_at" | "created_at">,
  today: string = todayInAsuncion(),
  graceDays: number = DEFAULT_GRACE_DAYS
): PlanExpiryInfo | null {
  if (!row.trial_ends_at) return null;
  const endsAt = row.trial_ends_at.slice(0, 10);
  if (!isValidISODate(endsAt)) return null;
  const created = row.created_at ? dateInAsuncion(row.created_at) : null;
  const startedAt =
    created && isValidISODate(created) && created <= endsAt
      ? created
      : addDaysISO(endsAt, -(DEFAULT_TRIAL_DAYS - 1));
  return buildInfo("trial", null, startedAt, endsAt, today, graceDays);
}

// Lo que rige el acceso de la empresa: el pago cargado y, si no hay, la prueba gratis.
export function companyExpiryInfo(
  row: CompanyPeriodRow,
  today: string = todayInAsuncion(),
  graceDays: number = DEFAULT_GRACE_DAYS
): PlanExpiryInfo | null {
  return planExpiryInfo(row, today, graceDays) ?? trialExpiryInfo(row, today, graceDays);
}

// Vencimiento que propone el formulario "Pagado": fecha de pago + ciclo.
export function suggestedExpiry(paidFrom: string, cycle: Cycle): string {
  return computePeriodEnd(paidFrom, cycle);
}

// Primer día de una renovación "a continuación": el día después de que vence
// el período actual; si ya venció (o no hay), arranca hoy.
export function renewalStart(currentExpiresAt: string | null | undefined, today: string = todayInAsuncion()): string {
  const current = currentExpiresAt?.slice(0, 10);
  if (current && isValidISODate(current) && current >= today) return addDaysISO(current, 1);
  return today;
}

// "Hoy", "Ayer", "Hace 12 días", "Hace 3 meses", "Hace 1 año y 2 meses".
export function timeSinceLabel(iso: string, today: string = todayInAsuncion()): string {
  const days = diffDaysISO(iso.slice(0, 10), today);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 60) return `Hace ${days} días`;
  const [fy, fm, fd] = iso.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const months = (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
  if (months < 12) return `Hace ${months} meses`;
  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  const yearsText = years === 1 ? "1 año" : `${years} años`;
  if (restMonths === 0) return `Hace ${yearsText}`;
  return `Hace ${yearsText} y ${restMonths} ${restMonths === 1 ? "mes" : "meses"}`;
}

export type ExpiryFilter = "todas" | "por-vencer" | "vencidas" | "al-dia" | "en-prueba" | "sin-pago";

// vencidas / por-vencer / al-dia hablan de planes pagos; las pruebas gratis van aparte
// ("en-prueba") y "sin-pago" es lo que no tiene ni pago ni prueba cargados.
export function matchesExpiryFilter(info: PlanExpiryInfo | null, filter: ExpiryFilter): boolean {
  switch (filter) {
    case "todas":
      return true;
    case "sin-pago":
      return info === null;
    case "en-prueba":
      return info?.kind === "trial";
    case "vencidas":
      return info?.kind === "paid" && info.tone === "expired";
    case "por-vencer":
      return info?.kind === "paid" && info.tone === "soon";
    case "al-dia":
      return info?.kind === "paid" && info.tone === "ok";
  }
}

// Orden para "los que más urgen primero": vencidas (las más atrasadas
// primero), luego por vencer, luego al día; sin pago al final.
export function expirySortKey(info: PlanExpiryInfo | null): number {
  return info ? info.daysLeft : Number.POSITIVE_INFINITY;
}
