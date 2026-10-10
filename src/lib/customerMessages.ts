import { supabase } from "@/integrations/supabase/client";
import { normalizedRealPhone } from "@/lib/clients";
import { formatPYG, getDefaultStatusMessage } from "@/lib/orders";

export interface MessageVars {
  cliente: string;
  equipo: string;
  orden: string;
  estado: string;
  link: string;
  taller: string;
  monto: string;
  saldo: string;
  garantia: string;
}

export const MESSAGE_VARIABLES: { key: keyof MessageVars; label: string; example: string }[] = [
  { key: "cliente", label: "Cliente", example: "Juan Pérez" },
  { key: "equipo", label: "Equipo", example: "Celular" },
  { key: "orden", label: "N° de orden", example: "ORD-0001" },
  { key: "estado", label: "Estado", example: "Listo para retirar" },
  { key: "link", label: "Link de seguimiento", example: "https://f7manager.com/tracking/ORD-0001" },
  { key: "taller", label: "Nombre del taller", example: "Tu Taller" },
  { key: "monto", label: "Monto del presupuesto", example: "Gs. 350.000" },
  { key: "saldo", label: "Saldo pendiente", example: "Gs. 200.000" },
  { key: "garantia", label: "Garantía", example: "30 días" },
];

export const PREVIEW_VARS: MessageVars = MESSAGE_VARIABLES.reduce(
  (acc, v) => ({ ...acc, [v.key]: v.example }),
  {} as MessageVars
);

const KNOWN_VARS = new Set<string>(MESSAGE_VARIABLES.map((v) => v.key));

// Las variables conocidas que no tienen valor se reemplazan por vacío; las
// que no existen (un typo del admin, ej. {{clinte}}) se dejan tal cual para
// que se vean en la vista previa en vez de desaparecer en silencio.
export function renderMessage(template: string, vars: Partial<MessageVars>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    KNOWN_VARS.has(key) ? (vars[key as keyof MessageVars] ?? "") : match
  );
}

export type MessageEventKey = "orden_creada" | "presupuesto_creado" | "seguimiento";

export const MESSAGE_EVENTS: Record<MessageEventKey, { label: string; defaultBody: string }> = {
  orden_creada: {
    label: "Orden recibida",
    defaultBody:
      "¡Hola {{cliente}}! Recibimos tu {{equipo}} en {{taller}}. Tu número de orden es *{{orden}}*. Seguí el estado de tu reparación aquí: {{link}} 🔧",
  },
  presupuesto_creado: {
    label: "Presupuesto enviado",
    defaultBody:
      "¡Hola {{cliente}}! Te dejamos el presupuesto para tu {{equipo}}: *{{monto}}*. Podés ver el detalle y responder (aceptar, rechazar o pedir cambios) acá: {{link}} 🔧",
  },
  seguimiento: {
    label: "Link de seguimiento",
    defaultBody:
      "¡Hola {{cliente}}! Podés seguir el estado de tu {{equipo}} (Orden *{{orden}}*) acá: {{link}} 🔧",
  },
};

export type TemplateOverrides = Partial<Record<string, string>>;

export function resolveEventBody(event: MessageEventKey, overrides: TemplateOverrides): string {
  const custom = overrides[event]?.trim();
  return custom || MESSAGE_EVENTS[event].defaultBody;
}

export function resolveStatusBody(
  statusKey: string,
  presets: { key: string; message_template?: string | null }[]
): string {
  const custom = presets.find((p) => p.key === statusKey)?.message_template?.trim();
  return custom || getDefaultStatusMessage(statusKey);
}

export function statusEventKey(statusKey: string) {
  return `estado:${statusKey}`;
}

export function trackingUrl(token: string, origin = window.location.origin) {
  return `${origin}/tracking/${token}`;
}

export interface OrderMessageSource {
  customer_name: string;
  customer_phone: string;
  alternative_phone?: string | null;
  secondary_phone?: string | null;
  device_type: string;
  order_number: string;
  tracking_token: string;
  quote_amount?: number | null;
  deposit_amount?: number | null;
  cargos_adicionales?: { monto: number }[] | null;
  warranty_days?: number | null;
}

// El teléfono al que hay que avisar: el contacto alternativo si la orden
// tiene uno (mismo criterio que usaban las notificaciones automáticas), si
// no el del cliente. Devuelve null si ningún número es real: un relleno
// ("000", "1111") abriría WhatsApp contra un desconocido — el mismo problema
// que ya fusionó clientes distintos.
export function recipientPhone(order: OrderMessageSource): string | null {
  return (
    normalizedRealPhone(order.alternative_phone || order.secondary_phone) ??
    normalizedRealPhone(order.customer_phone)
  );
}

export function buildOrderMessageVars(
  order: OrderMessageSource,
  ctx: { taller: string; estado?: string }
): MessageVars {
  const cargos = (order.cargos_adicionales ?? []).reduce((s, c) => s + Number(c.monto ?? 0), 0);
  const total = Number(order.quote_amount ?? 0) + cargos;
  const saldo = Math.max(0, total - Number(order.deposit_amount ?? 0));
  const days = Number(order.warranty_days ?? 0);
  return {
    cliente: order.customer_name,
    equipo: order.device_type,
    orden: order.order_number,
    estado: ctx.estado ?? "",
    link: trackingUrl(order.tracking_token),
    taller: ctx.taller,
    monto: formatPYG(order.quote_amount),
    saldo: formatPYG(saldo),
    garantia: days > 0 ? `${days} ${days === 1 ? "día" : "días"}` : "sin garantía",
  };
}

export type MessageAction = "opened" | "copied" | "dismissed";

// Best effort, igual que logOrderPayment: el mensaje ya se abrió/copió,
// un fallo al registrarlo no debe frenar ni confundir al usuario. "opened"
// significa que se abrió WhatsApp con el texto cargado — no que el cliente
// lo recibió.
export async function logCustomerMessage(params: {
  companyId: string;
  userId: string;
  orderId: string | null;
  eventKey: string;
  action: MessageAction;
  phone: string | null;
  message: string | null;
}) {
  const { error } = await supabase.from("customer_message_log").insert({
    company_id: params.companyId,
    order_id: params.orderId,
    event_key: params.eventKey,
    action: params.action,
    phone: params.phone,
    message: params.message,
    created_by: params.userId,
  });
  if (error) console.error("No se pudo registrar el mensaje:", error.message);
}
