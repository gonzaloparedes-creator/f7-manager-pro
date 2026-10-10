import { supabase } from "@/integrations/supabase/client";
import { toWhatsAppPhone } from "@/lib/whatsapp";

export interface TechnicianOrder {
  id: string;
  order_number: string;
  customer_name: string;
  device_type: string;
  assigned_technician_id: string | null;
}

export interface TechnicianRecipient {
  id: string;
  name: string;
  phone: string;
  message: string;
}

export interface TechnicianRecipients {
  recipients: TechnicianRecipient[];
  /** Técnicos asignados que no tienen un teléfono válido en su perfil. */
  withoutPhone: string[];
}

function orderLine(order: TechnicianOrder) {
  const details = [order.customer_name, order.device_type].filter(Boolean).join(" — ");
  return `*${order.order_number}*${details ? ` (${details})` : ""}`;
}

export function buildTechnicianMessage(
  technicianName: string | null,
  orders: TechnicianOrder[],
  origin = window.location.origin
): string {
  const greeting = technicianName ? `¡Hola ${technicianName}!` : "¡Hola!";
  if (orders.length === 1) {
    return `${greeting} 🔧 Se te asignó una nueva orden: ${orderLine(orders[0])}. Entrá a F7 Manager Pro para ver el detalle: ${origin}/ordenes/${orders[0].id}`;
  }
  const lines = orders.map((o) => `• ${orderLine(o)}`).join("\n");
  return `${greeting} 🔧 Se te asignaron ${orders.length} órdenes nuevas:\n${lines}\nEntrá a F7 Manager Pro para ver el detalle: ${origin}/dashboard`;
}

// Arma un mensaje por técnico (un lote con varios equipos para el mismo
// técnico sale en un solo mensaje). `excludeUserId` es quien está operando:
// no tiene sentido avisarle a uno mismo.
export async function loadTechnicianRecipients(
  companyId: string,
  orders: TechnicianOrder[],
  excludeUserId: string | null
): Promise<TechnicianRecipients> {
  const byTechnician = new Map<string, TechnicianOrder[]>();
  for (const order of orders) {
    const techId = order.assigned_technician_id;
    if (!techId || techId === excludeUserId) continue;
    const list = byTechnician.get(techId) ?? [];
    list.push(order);
    byTechnician.set(techId, list);
  }
  if (byTechnician.size === 0) return { recipients: [], withoutPhone: [] };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .eq("company_id", companyId)
    .in("id", [...byTechnician.keys()]);
  if (error) throw error;

  const recipients: TechnicianRecipient[] = [];
  const withoutPhone: string[] = [];
  for (const profile of data ?? []) {
    const name = profile.full_name?.trim() || "";
    const phone = toWhatsAppPhone(profile.phone);
    if (!phone) {
      withoutPhone.push(name || "Un técnico");
      continue;
    }
    recipients.push({
      id: profile.id,
      name: name || "Técnico",
      phone,
      message: buildTechnicianMessage(name || null, byTechnician.get(profile.id) ?? []),
    });
  }
  return { recipients, withoutPhone };
}
