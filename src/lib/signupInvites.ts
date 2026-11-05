// Links de alta pagada (migración 20261104120000): el cliente paga por WhatsApp, el super
// admin crea un link de un solo uso y al registrarse con él la empresa nace con el plan
// pagado activo (sin prueba gratis). La garantía de 7 días se cuenta desde el pago.
import { OFFER_GUARANTEE_DAYS } from "@/lib/ofertaOffer";
import { PLAN_LABELS, PRICING, type Cycle, type PlanType } from "@/lib/plans";
import { addDaysISO, CYCLE_LABELS, formatDateISO } from "@/lib/subscriptionReceipt";

export interface SignupInvite {
  id: string;
  code: string;
  plan_type: PlanType;
  billing_cycle: Cycle;
  plan_paid_from: string;
  plan_expires_at: string;
  note: string | null;
  created_at: string;
  used_at: string | null;
  used_company_id: string | null;
  revoked_at: string | null;
  /** Lo que pagó el cliente; vacío = precio del plan. */
  amount_gs: number | null;
  /** Cuándo se le avisó la compra a Meta (función report-purchase). */
  meta_reported_at: string | null;
  meta_report_error: string | null;
}

/** Monto sugerido al crear un link: el precio de lista del plan y ciclo. */
export function defaultInviteAmount(plan: PlanType, cycle: Cycle): number {
  return PRICING[plan][cycle].gs;
}

/** Lo que devuelve get_signup_invite: lo mínimo para la página de registro. */
export interface PublicSignupInvite {
  plan_type: PlanType;
  billing_cycle: Cycle;
  plan_expires_at: string;
  usable: boolean;
}

export type InviteStatus = "pending" | "used" | "revoked" | "expired";

export const INVITE_PATH = "/empezar";

export function inviteUrl(code: string, origin: string): string {
  return `${origin}${INVITE_PATH}/${code}`;
}

export function inviteStatus(
  invite: Pick<SignupInvite, "used_at" | "revoked_at" | "plan_expires_at">,
  today: string,
): InviteStatus {
  if (invite.used_at) return "used";
  if (invite.revoked_at) return "revoked";
  if (invite.plan_expires_at.slice(0, 10) < today) return "expired";
  return "pending";
}

export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  pending: "Sin usar",
  used: "Usado",
  revoked: "Anulado",
  expired: "Vencido",
};

/** Último día de la garantía: 7 días contando el día del pago. */
export function guaranteeEndsAt(paidFrom: string): string {
  return addDaysISO(paidFrom.slice(0, 10), OFFER_GUARANTEE_DAYS - 1);
}

export function invitePlanLine(plan: PlanType, cycle: Cycle): string {
  return `Plan ${PLAN_LABELS[plan]} ${CYCLE_LABELS[cycle].toLowerCase()}`;
}

/** Mensaje listo para mandar por WhatsApp después de recibir el pago. */
export function inviteWhatsAppMessage(
  invite: Pick<SignupInvite, "code" | "plan_type" | "billing_cycle" | "plan_paid_from" | "plan_expires_at">,
  origin: string,
): string {
  return [
    `¡Listo! Ya registramos tu pago del ${invitePlanLine(invite.plan_type, invite.billing_cycle)} de F7 Manager 🙌`,
    "",
    "Creá tu cuenta con este link (es solo para vos, sirve una sola vez):",
    inviteUrl(invite.code, origin),
    "",
    `Tu plan queda activo hasta el ${formatDateISO(invite.plan_expires_at)}. Tenés garantía hasta el ${formatDateISO(
      guaranteeEndsAt(invite.plan_paid_from),
    )}: si no te sirve, te devolvemos todo.`,
    "",
    "Cuando entres, avisame y te ayudo a cargar tu primer equipo.",
  ].join("\n");
}
