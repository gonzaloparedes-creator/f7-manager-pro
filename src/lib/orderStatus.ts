import { supabase } from "@/integrations/supabase/client";
import { fetchWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import {
  buildOrderMessageVars,
  notifyMessageQueueChanged,
  recipientPhone,
  renderMessage,
  resolveStatusBody,
  statusEventKey,
  type OrderMessageSource,
} from "@/lib/customerMessages";
import { interruptionReasonLabel, resolveStatusLabel } from "@/lib/orders";

export const INTERRUPTED_STATUS = "retirado_sin_reparar";

type StatusPreset = { key: string; label: string; message_template?: string | null };

export interface StatusChangeOrder {
  id: string;
  status: string;
  interrupted_at?: string | null;
  interruption_reason?: string | null;
}

// Cambio de estado compartido por el detalle de la orden y el tablero: mismo
// update, mismo historial, mismo aviso a la cola de mensajes. delivered_at y la
// garantía los mueve un trigger de la base, no hace falta replicarlos acá.
export async function changeOrderStatus(params: {
  order: StatusChangeOrder;
  newStatus: string;
  presets: StatusPreset[];
  note?: string;
  noteVisible?: boolean;
  imageUrls?: string[];
  interruptionReason?: string;
}): Promise<void> {
  const { order, newStatus, presets, note = "", noteVisible = true, imageUrls = [], interruptionReason = "" } = params;
  const interrupting = newStatus === INTERRUPTED_STATUS;
  if (interrupting && !interruptionReason) throw new Error("Falta el motivo de la interrupción.");
  const statusLabel = resolveStatusLabel(newStatus, presets);

  const { error } = await supabase
    .from("orders")
    .update({
      status: newStatus,
      ...(note && noteVisible ? { technician_notes: note } : {}),
      interruption_reason: interrupting ? interruptionReason : null,
      interrupted_at: interrupting
        ? (order.status === newStatus && order.interrupted_at ? order.interrupted_at : new Date().toISOString())
        : null,
    })
    .eq("id", order.id);
  if (error) throw error;

  await supabase.from("order_status_history").insert({
    order_id: order.id, status: newStatus, status_label: statusLabel,
    note: note || null, is_internal: !noteVisible,
    image_urls: imageUrls,
  });

  if (interrupting && (newStatus !== order.status || interruptionReason !== (order.interruption_reason ?? ""))) {
    try {
      await supabase.from("order_status_history").insert({
        order_id: order.id, status: newStatus, status_label: statusLabel,
        note: `Reparación interrumpida · motivo: ${interruptionReasonLabel(interruptionReason)}`,
        is_internal: true, image_urls: [],
      });
    } catch (e) {
      console.warn("Failed to log interruption reason", e);
    }
  }

  notifyMessageQueueChanged();
}

export interface StatusNotice {
  eventKey: string;
  message: string;
  phone: string;
}

export type NoticeOrder = OrderMessageSource & { client_notify_whatsapp?: boolean };

async function sendLegacyStatusNotification(order: NoticeOrder, newStatus: string, imageUrls: string[]) {
  try {
    await supabase.functions.invoke("send-status-notification", {
      body: {
        customer_name: order.customer_name,
        customer_phone: order.alternative_phone || order.customer_phone,
        device_type: order.device_type,
        order_number: order.order_number,
        order_code: order.tracking_token,
        new_status: newStatus,
        app_origin: window.location.origin,
        image_urls: imageUrls,
      },
    });
  } catch (e) { console.warn(e); }
}

// Las empresas que todavía tienen Evolution conectado siguen recibiendo el
// aviso automático del servidor (hasta el apagado); el resto recibe una
// sugerencia para abrir WhatsApp con un toque (devuelta acá, la muestra quien
// llama). null = no hay nada que mostrar.
export async function resolveStatusNotice(params: {
  companyId: string | null;
  order: NoticeOrder;
  newStatus: string;
  presets: StatusPreset[];
  businessName: string | null;
  imageUrls?: string[];
}): Promise<StatusNotice | null> {
  const { companyId, order, newStatus, presets, businessName, imageUrls = [] } = params;
  if (!companyId) {
    await sendLegacyStatusNotification(order, newStatus, imageUrls);
    return null;
  }
  let settings;
  try {
    settings = await fetchWhatsAppSettings(companyId);
  } catch (e) {
    console.warn(e);
    await sendLegacyStatusNotification(order, newStatus, imageUrls);
    return null;
  }
  if (settings.evolutionActive) {
    await sendLegacyStatusNotification(order, newStatus, imageUrls);
    return null;
  }
  if (settings.prefs[newStatus] !== true) return null;
  if (order.client_notify_whatsapp === false) return null;
  const phone = recipientPhone(order);
  if (!phone) return null;
  const vars = buildOrderMessageVars(order, {
    taller: businessName ?? "",
    estado: resolveStatusLabel(newStatus, presets),
  });
  return {
    eventKey: statusEventKey(newStatus),
    message: renderMessage(resolveStatusBody(newStatus, presets), vars),
    phone,
  };
}
