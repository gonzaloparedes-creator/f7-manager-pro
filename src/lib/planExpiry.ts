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

// Lo que guarda companies: el período vigente (último pago registrado).
export interface PlanPeriodRow {
  billing_cycle: string | null;
  plan_paid_from: string | null;
  plan_expires_at: string | null;
}

export interface PlanExpiryInfo {
  cycle: Cycle;
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

export function expiryHeadline(daysLeft: number): string {
  if (daysLeft > 1) return `Quedan ${daysLeft} días`;
  if (daysLeft === 1) return "Queda 1 día";
  if (daysLeft === 0) return "Vence hoy";
  if (daysLeft === -1) return "Venció ayer";
  return `Venció hace ${Math.abs(daysLeft)} días`;
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

// null = la empresa todavía no tiene un pago registrado.
export function planExpiryInfo(
  row: PlanPeriodRow,
  today: string = todayInAsuncion(),
  graceDays: number = DEFAULT_GRACE_DAYS
): PlanExpiryInfo | null {
  const { billing_cycle, plan_paid_from, plan_expires_at } = row;
  if (!isCycle(billing_cycle) || !plan_paid_from || !plan_expires_at) return null;
  const paidFrom = plan_paid_from.slice(0, 10);
  const expiresAt = plan_expires_at.slice(0, 10);
  if (!isValidISODate(paidFrom) || !isValidISODate(expiresAt) || expiresAt < paidFrom) return null;

  const daysLeft = diffDaysISO(today, expiresAt);
  const totalDays = diffDaysISO(paidFrom, expiresAt) + 1;
  const remainingPct = Math.min(100, Math.max(0, Math.round(((daysLeft + 1) / totalDays) * 100)));
  const grace = Math.max(0, Math.floor(graceDays));
  const accessUntil = addDaysISO(expiresAt, grace);
  const daysToSuspension = diffDaysISO(today, accessUntil);

  return {
    cycle: billing_cycle,
    paidFrom,
    expiresAt,
    daysLeft,
    totalDays,
    remainingPct,
    tone: expiryTone(daysLeft),
    headline: expiryHeadline(daysLeft),
    graceDays: grace,
    accessUntil,
    daysToSuspension,
    phase: expiryPhase(daysLeft, daysToSuspension),
  };
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

export type ExpiryFilter = "todas" | "por-vencer" | "vencidas" | "al-dia" | "sin-pago";

export function matchesExpiryFilter(info: PlanExpiryInfo | null, filter: ExpiryFilter): boolean {
  switch (filter) {
    case "todas":
      return true;
    case "sin-pago":
      return info === null;
    case "vencidas":
      return info?.tone === "expired";
    case "por-vencer":
      return info?.tone === "soon";
    case "al-dia":
      return info?.tone === "ok";
  }
}

// Orden para "los que más urgen primero": vencidas (las más atrasadas
// primero), luego por vencer, luego al día; sin pago al final.
export function expirySortKey(info: PlanExpiryInfo | null): number {
  return info ? info.daysLeft : Number.POSITIVE_INFINITY;
}
