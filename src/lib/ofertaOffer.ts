export const OFFER_GUARANTEE_DAYS = 7;

// Fecha límite REAL del precio congelado, a las 23:59 de Paraguay (UTC-3).
// Al pasar, la página deja de mostrar urgencia y precio congelado por sí sola.
export const OFFER_DEADLINE = "2026-10-31T23:59:59-03:00";

const DAY_MS = 24 * 60 * 60 * 1000;

export type OfferStatus =
  | { active: false }
  | { active: true; deadlineLabel: string; daysLeft: number; lastDay: boolean; urgencyText: string };

export function formatDeadline(deadline: string): string {
  return new Date(deadline).toLocaleDateString("es-PY", {
    day: "numeric",
    month: "long",
    timeZone: "America/Asuncion",
  });
}

export function offerStatus(now: Date, deadline: string = OFFER_DEADLINE): OfferStatus {
  const msLeft = new Date(deadline).getTime() - now.getTime();
  if (!Number.isFinite(msLeft) || msLeft <= 0) return { active: false };

  const lastDay = msLeft <= DAY_MS;
  const daysLeft = Math.ceil(msLeft / DAY_MS);
  const urgencyText = lastDay ? "Termina hoy" : `Quedan ${daysLeft} días`;

  return { active: true, deadlineLabel: formatDeadline(deadline), daysLeft, lastDay, urgencyText };
}
