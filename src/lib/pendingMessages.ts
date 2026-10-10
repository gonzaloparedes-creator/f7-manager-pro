import { supabase } from "@/integrations/supabase/client";
import { fetchWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import {
  MESSAGE_EVENTS,
  buildOrderMessageVars,
  recipientPhone,
  renderMessage,
  resolveEventBody,
  resolveStatusBody,
  statusEventKey,
  type MessageEventKey,
  type OrderMessageSource,
  type TemplateOverrides,
} from "@/lib/customerMessages";
import { resolveStatusLabel } from "@/lib/orders";

// La cola solo mira lo reciente: un aviso de hace semanas ya no le sirve al
// cliente, y acota cuánto historial hay que leer en cada refresco.
export const QUEUE_WINDOW_DAYS = 7;

const PAGE_SIZE = 1000;
const MAX_PAGES = 5;
const CHUNK_SIZE = 40;

export type PendingKind = "status" | "creation" | "quote_response";

export interface PendingMessage {
  /** `${orderId}:${eventKey}` — estable entre refrescos. */
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  deviceType: string;
  eventKey: string;
  eventLabel: string;
  kind: PendingKind;
  occurredAt: string;
  phone: string;
  message: string;
}

export interface PendingQueue {
  /** La empresa sigue con Evolution: el servidor avisa solo, no hay cola. */
  evolutionActive: boolean;
  items: PendingMessage[];
}

export interface HistoryRow {
  status: string;
  created_at: string;
}

export interface OrderEvent {
  eventKey: string;
  status: string;
  at: string;
}

// Convierte el historial de una orden en los hechos "avisables": la creación,
// la conversión de presupuesto a orden y cada cambio real de estado. Las filas
// que solo agregan una nota repiten el estado anterior y no generan evento.
// `prior` es el estado de la última fila anterior a `rows` (null si `rows`
// arranca en la primera fila de la orden, o sea su creación).
export function deriveOrderEvents(rows: HistoryRow[], prior: string | null): OrderEvent[] {
  const events: OrderEvent[] = [];
  let prev = prior;
  for (const row of rows) {
    if (prev === null) {
      events.push({
        eventKey: row.status === "presupuesto" ? "presupuesto_creado" : "orden_creada",
        status: row.status,
        at: row.created_at,
      });
    } else if (row.status !== prev) {
      events.push({
        eventKey: prev === "presupuesto" && row.status === "recibido" ? "orden_creada" : statusEventKey(row.status),
        status: row.status,
        at: row.created_at,
      });
    }
    prev = row.status;
  }
  return events;
}

// Mismo criterio que el diálogo inmediato: los eventos de creación dependen
// del aviso "orden_creada" y los cambios de estado, del aviso de ese estado.
export function isEventEnabled(event: OrderEvent, prefs: Record<string, boolean>): boolean {
  if (event.eventKey === "orden_creada" || event.eventKey === "presupuesto_creado") {
    return prefs.orden_creada === true;
  }
  return prefs[event.status] === true;
}

type OrderRow = OrderMessageSource & {
  id: string;
  status: string;
  client_id: string | null;
  quote_response: string | null;
  quote_responded_at: string | null;
};

const ORDER_FIELDS =
  "id, status, client_id, order_number, tracking_token, customer_name, customer_phone, alternative_phone, secondary_phone, device_type, quote_amount, deposit_amount, cargos_adicionales, warranty_days, quote_response, quote_responded_at";

const QUOTE_EVENT_BY_RESPONSE: Record<string, MessageEventKey> = {
  aceptado: "presupuesto_aceptado",
  rechazado: "presupuesto_rechazado",
  cambios_solicitados: "presupuesto_cambios",
};

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

async function fetchPaged<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const all: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function fetchPendingMessages(companyId: string): Promise<PendingQueue> {
  const settings = await fetchWhatsAppSettings(companyId);
  if (settings.evolutionActive) return { evolutionActive: true, items: [] };

  const sinceMs = Math.max(
    settings.queueSince ? new Date(settings.queueSince).getTime() : 0,
    Date.now() - QUEUE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const since = new Date(sinceMs).toISOString();

  const [historyRows, quoteOrdersRes, logRows, optedOutRes, templatesRes, companyRes, presetsRes] =
    await Promise.all([
      fetchPaged<{ order_id: string; status: string; created_at: string; orders: OrderRow | OrderRow[] | null }>(
        (from, to) =>
          supabase
            .from("order_status_history")
            .select(`order_id, status, created_at, orders!inner(${ORDER_FIELDS})`)
            .eq("orders.company_id", companyId)
            .gte("created_at", since)
            .order("created_at", { ascending: true })
            .range(from, to) as unknown as PromiseLike<PageResult<{ order_id: string; status: string; created_at: string; orders: OrderRow | OrderRow[] | null }>>
      ),
      supabase
        .from("orders")
        .select(ORDER_FIELDS)
        .eq("company_id", companyId)
        .eq("status", "presupuesto")
        .gte("quote_responded_at", since),
      fetchPaged<{ order_id: string | null; event_key: string; created_at: string }>((from, to) =>
        supabase
          .from("customer_message_log")
          .select("order_id, event_key, created_at")
          .eq("company_id", companyId)
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .range(from, to)
      ),
      supabase.from("clients").select("id").eq("company_id", companyId).eq("notify_whatsapp", false),
      supabase.from("whatsapp_templates").select("event_key, body").eq("company_id", companyId),
      supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
      supabase.from("order_status_presets").select("key, label, message_template").eq("company_id", companyId),
    ]);
  if (quoteOrdersRes.error) throw quoteOrdersRes.error;
  if (optedOutRes.error) throw optedOutRes.error;

  const optedOut = new Set((optedOutRes.data ?? []).map((c) => c.id));
  const overrides: TemplateOverrides = {};
  for (const row of templatesRes.data ?? []) overrides[row.event_key] = row.body;
  const taller = companyRes.data?.name ?? "";
  const presets = presetsRes.data ?? [];

  // order_id|event_key -> instantes en que se abrió/copió/descartó ese aviso.
  const handled = new Map<string, number[]>();
  for (const log of logRows) {
    if (!log.order_id) continue;
    const key = `${log.order_id}|${log.event_key}`;
    const list = handled.get(key) ?? [];
    list.push(new Date(log.created_at).getTime());
    handled.set(key, list);
  }
  const isHandled = (orderId: string, eventKey: string, at: string) => {
    const atMs = new Date(at).getTime();
    return (handled.get(`${orderId}|${eventKey}`) ?? []).some((t) => t >= atMs);
  };

  const orders = new Map<string, OrderRow>();
  const rowsByOrder = new Map<string, HistoryRow[]>();
  for (const row of historyRows) {
    const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
    if (!order) continue;
    orders.set(row.order_id, order);
    const list = rowsByOrder.get(row.order_id) ?? [];
    list.push({ status: row.status, created_at: row.created_at });
    rowsByOrder.set(row.order_id, list);
  }

  // Estado de cada orden justo antes de la ventana: sin él, la primera fila
  // de la ventana no se puede distinguir de la creación de la orden.
  const priorStatus = new Map<string, string>();
  const orderIds = [...rowsByOrder.keys()];
  const priorResults = await Promise.all(
    chunk(orderIds, CHUNK_SIZE).map((ids) =>
      fetchPaged<{ order_id: string; status: string }>((from, to) =>
        supabase
          .from("order_status_history")
          .select("order_id, status")
          .in("order_id", ids)
          .lt("created_at", since)
          .order("created_at", { ascending: false })
          .range(from, to)
      )
    )
  );
  for (const rows of priorResults) {
    for (const row of rows) {
      if (!priorStatus.has(row.order_id)) priorStatus.set(row.order_id, row.status);
    }
  }

  const items: PendingMessage[] = [];

  // Si el cliente ya respondió el presupuesto, avisarle "te dejamos el
  // presupuesto" quedó viejo: lo que corresponde es contestar su respuesta.
  const answeredQuotes = new Set(
    (quoteOrdersRes.data ?? []).filter((o) => o.quote_response).map((o) => o.id)
  );

  const messageFor = (order: OrderRow, status: string, eventKey: string) => {
    const vars = buildOrderMessageVars(order, { taller, estado: resolveStatusLabel(status, presets) });
    const body = eventKey.startsWith("estado:")
      ? resolveStatusBody(status, presets)
      : resolveEventBody(eventKey as MessageEventKey, overrides);
    return renderMessage(body, vars);
  };

  const canReach = (order: OrderRow) =>
    !(order.client_id && optedOut.has(order.client_id)) ? recipientPhone(order) : null;

  for (const [orderId, rows] of rowsByOrder) {
    const order = orders.get(orderId);
    if (!order) continue;
    const events = deriveOrderEvents(rows, priorStatus.get(orderId) ?? null);
    // Solo importa lo último que le pasó a la orden: avisar un estado que ya
    // quedó viejo (ej. "en reparación" cuando ya está lista) confunde.
    const latest = events[events.length - 1];
    if (!latest || !isEventEnabled(latest, settings.prefs)) continue;
    if (latest.eventKey === "presupuesto_creado" && answeredQuotes.has(orderId)) continue;
    if (isHandled(orderId, latest.eventKey, latest.at)) continue;
    const phone = canReach(order);
    if (!phone) continue;
    const isCreation = latest.eventKey === "orden_creada" || latest.eventKey === "presupuesto_creado";
    items.push({
      id: `${orderId}:${latest.eventKey}`,
      orderId,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      deviceType: order.device_type,
      eventKey: latest.eventKey,
      eventLabel: isCreation
        ? MESSAGE_EVENTS[latest.eventKey as MessageEventKey].label
        : resolveStatusLabel(latest.status, presets),
      kind: isCreation ? "creation" : "status",
      occurredAt: latest.at,
      phone,
      message: messageFor(order, latest.status, latest.eventKey),
    });
  }

  for (const order of quoteOrdersRes.data ?? []) {
    const typed = order as unknown as OrderRow;
    const eventKey = typed.quote_response ? QUOTE_EVENT_BY_RESPONSE[typed.quote_response] : undefined;
    if (!eventKey || !typed.quote_responded_at) continue;
    if (isHandled(typed.id, eventKey, typed.quote_responded_at)) continue;
    const phone = canReach(typed);
    if (!phone) continue;
    items.push({
      id: `${typed.id}:${eventKey}`,
      orderId: typed.id,
      orderNumber: typed.order_number,
      customerName: typed.customer_name,
      deviceType: typed.device_type,
      eventKey,
      eventLabel: MESSAGE_EVENTS[eventKey].label,
      kind: "quote_response",
      occurredAt: typed.quote_responded_at,
      phone,
      message: messageFor(typed, typed.status, eventKey),
    });
  }

  items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return { evolutionActive: false, items };
}
