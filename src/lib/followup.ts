import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import { formatDateISO } from "@/lib/subscriptionReceipt";
import { dateInAsuncion, diffDaysISO, type PlanExpiryInfo } from "@/lib/planExpiry";

// A quién se le escribe y por qué: cobro del plan o seguimiento de la prueba gratis.
export type FollowupGroup = "cobro" | "prueba";

export type FollowupSituation =
  | "cobro-por-vencer"
  | "cobro-hoy"
  | "cobro-gracia"
  | "cobro-suspendida"
  | "prueba-en-curso"
  | "prueba-por-terminar"
  | "prueba-gracia"
  | "prueba-suspendida";

// Una prueba recién empezada no se molesta: se le escribe a partir del día 4.
export const TRIAL_MIN_DAYS_BEFORE_CONTACT = 3;
// Una prueba "por terminar" son sus últimos días.
export const TRIAL_ENDING_DAYS = 3;
// Un negocio al que ya se le escribió hace menos de esto pasa al final de la cola.
export const CONTACT_COOLDOWN_DAYS = 3;

export const SITUATION_GROUP: Record<FollowupSituation, FollowupGroup> = {
  "cobro-por-vencer": "cobro",
  "cobro-hoy": "cobro",
  "cobro-gracia": "cobro",
  "cobro-suspendida": "cobro",
  "prueba-en-curso": "prueba",
  "prueba-por-terminar": "prueba",
  "prueba-gracia": "prueba",
  "prueba-suspendida": "prueba",
};

export const SITUATION_LABELS: Record<FollowupSituation, string> = {
  "cobro-por-vencer": "Plan por vencer",
  "cobro-hoy": "Plan vence hoy",
  "cobro-gracia": "Plan vencido (en gracia)",
  "cobro-suspendida": "Plan vencido y suspendido",
  "prueba-en-curso": "Probando el sistema",
  "prueba-por-terminar": "Prueba por terminar",
  "prueba-gracia": "Prueba terminada (en gracia)",
  "prueba-suspendida": "Prueba terminada y suspendida",
};

export const GROUP_LABELS: Record<FollowupGroup, string> = {
  cobro: "Cobro",
  prueba: "Prueba gratis",
};

export interface FollowupCompany {
  id: string;
  name: string;
  plan_type: string;
  is_active: boolean;
  is_paying?: boolean;
  founder_cohort?: boolean;
  admin_name?: string | null;
  admin_phone?: string | null;
  orders_count?: number | null;
  last_order_at?: string | null;
  last_contact_at?: string | null;
  last_contact_kind?: string | null;
}

// Qué mensaje corresponde a esta empresa hoy. null = no hay nada que decirle
// (sin fechas, suspendida a mano, prueba recién empezada, plan al día).
export function followupSituation(
  company: Pick<FollowupCompany, "is_active">,
  info: PlanExpiryInfo | null,
  today: string
): FollowupSituation | null {
  if (!info || !company.is_active) return null;

  if (info.kind === "paid") {
    if (info.phase === "suspended") return "cobro-suspendida";
    if (info.phase === "grace") return "cobro-gracia";
    if (info.daysLeft === 0) return "cobro-hoy";
    if (info.tone === "soon") return "cobro-por-vencer";
    return null;
  }

  if (info.phase === "suspended") return "prueba-suspendida";
  if (info.phase === "grace") return "prueba-gracia";
  if (info.daysLeft <= TRIAL_ENDING_DAYS) return "prueba-por-terminar";
  if (diffDaysISO(info.paidFrom, today) >= TRIAL_MIN_DAYS_BEFORE_CONTACT) return "prueba-en-curso";
  return null;
}

// "Gonzalo Paredes" -> "Gonzalo"; "gonzalo" -> "Gonzalo"; un correo o un número -> "".
export function firstName(fullName: string | null | undefined): string {
  const token = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  if (!token || /[@\d]/.test(token)) return "";
  if (token === token.toLowerCase() || token === token.toUpperCase()) {
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  }
  return token;
}

export function daysPhrase(n: number): string {
  return n === 1 ? "1 día" : `${n} días`;
}

export type TemplateVars = Record<string, string>;

const TEMPLATES: Record<FollowupSituation, string> = {
  "cobro-por-vencer":
    "{{saludo}}, ¿cómo andás? Te escribo de F7 Manager Pro. Ya solo quedan {{dias}} para que venza el plan de {{negocio}} (vence el {{fecha}}). Para que no se corte el acceso, por favor hacé el pago cuando puedas y avisame por acá así lo registro. ¡Gracias!",
  "cobro-hoy":
    "{{saludo}}, ¿cómo andás? Te escribo de F7 Manager Pro. Hoy vence el plan de {{negocio}}. Para que no se corte el acceso, por favor hacé el pago y avisame por acá así lo registro. ¡Gracias!",
  "cobro-gracia":
    "{{saludo}}, ¿cómo andás? Te escribo de F7 Manager Pro. El plan de {{negocio}} venció el {{fecha}}. Todavía tenés acceso hasta el {{acceso}}; pasada esa fecha la cuenta se suspende hasta que se registre el pago. Por favor hacé el pago y avisame por acá así lo registro. ¡Gracias!",
  "cobro-suspendida":
    "{{saludo}}, ¿cómo andás? Te escribo de F7 Manager Pro. El plan de {{negocio}} venció el {{fecha}} y la cuenta quedó en pausa. Tus datos están guardados: apenas hagas el pago y me avises, se reactiva al instante. ¿Lo resolvemos hoy?",
  "prueba-en-curso":
    "{{saludo}}, ¿cómo andás? Soy de F7 Manager Pro. Vi que estás probando el sistema con {{negocio}}. ¿Qué te está pareciendo? ¿Te surgió alguna duda o algo que te gustaría que funcione distinto? Cualquier cosa, escribime por acá.",
  "prueba-por-terminar":
    "{{saludo}}, ¿cómo andás? Soy de F7 Manager Pro. A la prueba gratis de {{negocio}} le quedan {{dias}} (termina el {{fecha}}). ¿Qué te pareció el sistema? ¿Te gustaría seguir con un plan? Si querés te cuento cómo funciona y cuánto sale.",
  "prueba-gracia":
    "{{saludo}}, ¿cómo andás? Soy de F7 Manager Pro. La prueba gratis de {{negocio}} terminó el {{fecha}}, pero todavía tenés acceso hasta el {{acceso}}. ¿Qué te pareció? ¿Te gustaría unirte a F7 Manager Pro? Si te interesa, te paso los planes y dejamos tu cuenta andando con todos tus datos.",
  "prueba-suspendida":
    "{{saludo}}, ¿cómo andás? Soy de F7 Manager Pro. La prueba gratis de {{negocio}} terminó el {{fecha}} y la cuenta quedó en pausa (tus datos están guardados). ¿Qué te pareció el sistema? ¿Te gustaría unirte a F7 Manager Pro? Si te interesa, la reactivamos hoy mismo.",
};

export function renderFollowupTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? "");
}

export function followupTemplate(situation: FollowupSituation): string {
  return TEMPLATES[situation];
}

export function followupVars(company: FollowupCompany, info: PlanExpiryInfo): TemplateVars {
  const name = firstName(company.admin_name);
  return {
    saludo: name ? `Hola ${name}` : "Hola",
    nombre: name,
    negocio: company.name,
    plan: PLAN_LABELS[company.plan_type as PlanType] ?? company.plan_type,
    dias: daysPhrase(Math.max(0, info.daysLeft)),
    fecha: formatDateISO(info.expiresAt),
    acceso: formatDateISO(info.accessUntil),
  };
}

export function buildFollowupMessage(company: FollowupCompany, info: PlanExpiryInfo, situation: FollowupSituation): string {
  return renderFollowupTemplate(followupTemplate(situation), followupVars(company, info));
}

export interface FollowupItem<C extends FollowupCompany = FollowupCompany> {
  company: C;
  info: PlanExpiryInfo;
  situation: FollowupSituation;
  group: FollowupGroup;
  // Ya se le escribió hace poco por este mismo motivo.
  contactedRecently: boolean;
}

export function wasContactedRecently(
  company: Pick<FollowupCompany, "last_contact_at" | "last_contact_kind">,
  group: FollowupGroup,
  today: string
): boolean {
  if (!company.last_contact_at || company.last_contact_kind !== group) return false;
  const days = diffDaysISO(dateInAsuncion(company.last_contact_at), today);
  return days >= 0 && days < CONTACT_COOLDOWN_DAYS;
}

// Los que hay que contactar, lo más urgente primero; los ya contactados al final.
export function buildFollowupQueue<C extends FollowupCompany>(
  rows: { company: C; info: PlanExpiryInfo | null }[],
  today: string
): FollowupItem<C>[] {
  const items: FollowupItem<C>[] = [];
  for (const { company, info } of rows) {
    const situation = followupSituation(company, info, today);
    if (!situation || !info) continue;
    const group = SITUATION_GROUP[situation];
    items.push({ company, info, situation, group, contactedRecently: wasContactedRecently(company, group, today) });
  }
  items.sort((a, b) => {
    if (a.contactedRecently !== b.contactedRecently) return a.contactedRecently ? 1 : -1;
    if (a.info.daysLeft !== b.info.daysLeft) return a.info.daysLeft - b.info.daysLeft;
    if (a.group !== b.group) return a.group === "cobro" ? -1 : 1;
    return a.company.name.localeCompare(b.company.name, "es", { sensitivity: "base" });
  });
  return items;
}
