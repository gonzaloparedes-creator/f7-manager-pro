import { supabase } from "@/integrations/supabase/client";
import { fetchWhatsAppSettings, type WhatsAppSettings } from "@/hooks/useWhatsAppSettings";
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
import { normalizedRealPhone } from "@/lib/clients";
import {
  POST_SALE_EVENT,
  POST_SALE_EVENT_KEYS,
  POST_SALE_LOG_LOOKBACK_DAYS,
  REVIEW_MAX_DAYS,
  REVIEW_MIN_DAYS,
  WARRANTY_LEAD_DAYS,
  elapsedDays,
  formatDMY,
  isWarrantyDue,
  joinDistinct,
  phoneKey,
  pickBirthdays,
  pickReviewGroups,
  pickWarrantyGroups,
  postSaleActive,
  reviewRequestsActive,
  warrantyDaysLeft,
  warrantyExpiryDate,
  type DeliveredOrder,
  type PostSaleKind,
  type PostSaleLogRow,
} from "@/lib/postSale";

// La cola solo mira lo reciente: un aviso de hace semanas ya no le sirve al
// cliente, y acota cuánto historial hay que leer en cada refresco.
export const QUEUE_WINDOW_DAYS = 7;

const PAGE_SIZE = 1000;
const MAX_PAGES = 5;
const CHUNK_SIZE = 40;

export type PendingKind = "status" | "creation" | "quote_response" | PostSaleKind;

export const POST_SALE_KINDS: PendingKind[] = ["review", "warranty", "birthday"];

export interface PendingMessage {
  /** Estable entre refrescos: `${orderId}:${eventKey}` (en post-venta, el teléfono o el cliente). */
  id: string;
  /** null en los saludos de cumpleaños, que no tienen orden. */
  orderId: string | null;
  /** Post-venta que cubre varias órdenes (un lote): el registro se escribe una vez por cada una. */
  orderIds?: string[];
  /** Solo en cumpleaños: el registro apunta al cliente. */
  clientId: string | null;
  orderNumber: string | null;
  customerName: string;
  deviceType: string | null;
  eventKey: string;
  eventLabel: string;
  kind: PendingKind;
  /** Cuándo pasó (avisos) o desde cuándo corresponde contactar (post-venta). */
  occurredAt: string;
  /** Contexto en texto para la lista de post-venta ("Entregado hace 4 días"). */
  detail?: string;
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
  "id, status, client_id, order_number, tracking_token, customer_name, customer_phone, alternative_phone, secondary_phone, device_type, marca, modelo, quote_amount, deposit_amount, cargos_adicionales, warranty_days, quote_response, quote_responded_at";

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

async function fetchOrderEventItems(companyId: string, settings: WhatsAppSettings): Promise<PendingMessage[]> {
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
      clientId: null,
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
      clientId: null,
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

  return items;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Cuánto atrás se buscan entregas con garantía vigente: cubre garantías de
// hasta 6 meses (las del taller son de 15 a 90 días).
const WARRANTY_LOOKBACK_DAYS = 181;
// La lista de candidatos a garantía / cumpleaños cambia de a poco: no hace
// falta releerla en cada refresco de la cola (cada 90 s).
const CANDIDATES_TTL_MS = 10 * 60 * 1000;

const candidatesCache = new Map<string, { at: number; value: Promise<unknown> }>();

function cachedCandidates<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = candidatesCache.get(key);
  if (hit && Date.now() - hit.at < CANDIDATES_TTL_MS) return hit.value as Promise<T>;
  const value = load();
  candidatesCache.set(key, { at: Date.now(), value });
  value.catch(() => candidatesCache.delete(key));
  return value;
}

// Se llama después de cambiar algo que altera esos candidatos (ej. cargar un
// cumpleaños) para que la lista lo refleje enseguida.
export function clearPostSaleCache() {
  candidatesCache.clear();
}

type DeliveredRow = OrderMessageSource & {
  id: string;
  client_id: string | null;
  delivered_at: string;
};

const DELIVERED_FIELDS =
  "id, client_id, order_number, tracking_token, customer_name, customer_phone, alternative_phone, secondary_phone, device_type, quote_amount, deposit_amount, cargos_adicionales, warranty_days, delivered_at";

type DeliveredCandidate = DeliveredOrder & { row: DeliveredRow };

function toCandidate(row: DeliveredRow, optedOut: Set<string>): DeliveredCandidate | null {
  if (row.client_id && optedOut.has(row.client_id)) return null;
  const phone = recipientPhone(row);
  if (!phone) return null;
  return {
    orderId: row.id,
    deliveredAt: row.delivered_at,
    phone,
    warrantyDays: Number(row.warranty_days ?? 0),
    row,
  };
}

const agoText = (days: number) => (days <= 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`);

const iso = (ms: number) => new Date(ms).toISOString();

type BirthdayClientRow = { id: string; name: string; phone: string | null; birth_date: string | null };

async function fetchPostSaleItems(companyId: string, settings: WhatsAppSettings): Promise<PendingMessage[]> {
  const ps = settings.postSale;
  if (!settings.postSaleAvailable || !postSaleActive(ps)) return [];

  const now = new Date();
  const nowMs = now.getTime();
  const wantReview = reviewRequestsActive(ps);
  const reviewUrl = ps.reviewUrl?.trim() ?? "";
  const needsOrders = wantReview || ps.warranty;

  const [logRows, optedOutRes, templatesRes, companyRes, reviewRows, warrantyRows, birthdayClients] =
    await Promise.all([
      fetchPaged<PostSaleLogRow>((from, to) =>
        supabase
          .from("customer_message_log")
          .select("order_id, client_id, event_key, action, phone, created_at")
          .eq("company_id", companyId)
          .in("event_key", POST_SALE_EVENT_KEYS)
          .gte("created_at", iso(nowMs - POST_SALE_LOG_LOOKBACK_DAYS * DAY_MS))
          .order("created_at", { ascending: true })
          .range(from, to)
      ),
      needsOrders
        ? supabase.from("clients").select("id").eq("company_id", companyId).eq("notify_whatsapp", false)
        : Promise.resolve({ data: [] as { id: string }[], error: null }),
      supabase.from("whatsapp_templates").select("event_key, body").eq("company_id", companyId),
      supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
      wantReview
        ? supabase
            .from("orders")
            .select(DELIVERED_FIELDS)
            .eq("company_id", companyId)
            .eq("status", "entregado")
            .gt("delivered_at", iso(nowMs - (REVIEW_MAX_DAYS + 1) * DAY_MS))
            .lte("delivered_at", iso(nowMs - REVIEW_MIN_DAYS * DAY_MS))
            .then((res) => {
              if (res.error) throw res.error;
              return (res.data ?? []) as unknown as DeliveredRow[];
            })
        : Promise.resolve([] as DeliveredRow[]),
      ps.warranty ? fetchWarrantyDueRows(companyId, now) : Promise.resolve([] as DeliveredRow[]),
      ps.birthday
        ? cachedCandidates(`${companyId}:birthdays`, () =>
            fetchPaged<BirthdayClientRow>((from, to) =>
              supabase
                .from("clients")
                .select("id, name, phone, birth_date")
                .eq("company_id", companyId)
                .eq("notify_whatsapp", true)
                .not("birth_date", "is", null)
                .range(from, to)
            )
          )
        : Promise.resolve([] as BirthdayClientRow[]),
    ]);
  if (optedOutRes.error) throw optedOutRes.error;

  const optedOut = new Set((optedOutRes.data ?? []).map((c) => c.id));
  const overrides: TemplateOverrides = {};
  for (const row of templatesRes.data ?? []) overrides[row.event_key] = row.body;
  const taller = companyRes.data?.name ?? "";
  const items: PendingMessage[] = [];

  const reviewCandidates = reviewRows.flatMap((r) => toCandidate(r, optedOut) ?? []);
  for (const group of pickReviewGroups(reviewCandidates, logRows, now)) {
    const primary = group.primary.row;
    const vars = {
      ...buildOrderMessageVars(primary, { taller }),
      equipo: joinDistinct(group.orders.map((o) => o.row.device_type)),
      orden: group.orders.map((o) => o.row.order_number).join(", "),
      resena: reviewUrl,
    };
    items.push({
      id: `${phoneKey(group.primary.phone)}:${POST_SALE_EVENT.review}`,
      orderId: primary.id,
      orderIds: group.orders.map((o) => o.orderId),
      clientId: null,
      orderNumber: vars.orden,
      customerName: primary.customer_name,
      deviceType: vars.equipo,
      eventKey: POST_SALE_EVENT.review,
      eventLabel: MESSAGE_EVENTS.postventa_resena.label,
      kind: "review",
      occurredAt: iso(new Date(group.primary.deliveredAt).getTime() + REVIEW_MIN_DAYS * DAY_MS),
      detail: `Entregado ${agoText(elapsedDays(group.primary.deliveredAt, now))}`,
      phone: group.primary.phone,
      message: renderMessage(resolveEventBody("postventa_resena", overrides), vars),
    });
  }

  const warrantyCandidates = warrantyRows.flatMap((r) => toCandidate(r, optedOut) ?? []);
  for (const group of pickWarrantyGroups(warrantyCandidates, logRows, now)) {
    const primary = group.primary.row;
    const expiry = warrantyExpiryDate(group.primary.deliveredAt, group.primary.warrantyDays);
    const left = warrantyDaysLeft(group.primary.deliveredAt, group.primary.warrantyDays, now) ?? 0;
    const vars = {
      ...buildOrderMessageVars(primary, { taller }),
      equipo: joinDistinct(group.orders.map((o) => o.row.device_type)),
      orden: group.orders.map((o) => o.row.order_number).join(", "),
      vencimiento: formatDMY(expiry),
    };
    const leftText = left <= 0 ? "hoy" : left === 1 ? "mañana" : `en ${left} días`;
    items.push({
      id: `${primary.id}:${POST_SALE_EVENT.warranty}`,
      orderId: primary.id,
      orderIds: group.orders.map((o) => o.orderId),
      clientId: null,
      orderNumber: vars.orden,
      customerName: primary.customer_name,
      deviceType: vars.equipo,
      eventKey: POST_SALE_EVENT.warranty,
      eventLabel: MESSAGE_EVENTS.postventa_garantia.label,
      kind: "warranty",
      occurredAt: iso(expiry.getTime() - WARRANTY_LEAD_DAYS * DAY_MS),
      detail: `Garantía vence ${leftText} (${vars.vencimiento})`,
      phone: group.primary.phone,
      message: renderMessage(resolveEventBody("postventa_garantia", overrides), vars),
    });
  }

  const reachableClients = birthdayClients.flatMap((c) => {
    const phone = normalizedRealPhone(c.phone);
    return phone && c.birth_date ? [{ id: c.id, name: c.name, phone, birthDate: c.birth_date }] : [];
  });
  for (const { client, occurrence } of pickBirthdays(reachableClients, logRows, now)) {
    items.push({
      id: `${client.id}:${POST_SALE_EVENT.birthday}`,
      orderId: null,
      clientId: client.id,
      orderNumber: null,
      customerName: client.name,
      deviceType: null,
      eventKey: POST_SALE_EVENT.birthday,
      eventLabel: MESSAGE_EVENTS.postventa_cumple.label,
      kind: "birthday",
      occurredAt: occurrence.start.toISOString(),
      detail:
        occurrence.daysAgo === 0
          ? "Cumple hoy"
          : occurrence.daysAgo === 1
            ? "Cumplió ayer"
            : `Cumplió hace ${occurrence.daysAgo} días`,
      phone: client.phone,
      message: renderMessage(resolveEventBody("postventa_cumple", overrides), { cliente: client.name, taller }),
    });
  }

  return items;
}

// Dos pasos para no traer las órdenes completas de seis meses: primero solo
// id / entrega / días de garantía (cacheado), y de ahí las que vencen en los
// próximos días con todos los campos.
async function fetchWarrantyDueRows(companyId: string, now: Date): Promise<DeliveredRow[]> {
  const light = await cachedCandidates(`${companyId}:warranty`, () =>
    fetchPaged<{ id: string; delivered_at: string | null; warranty_days: number | null }>((from, to) =>
      supabase
        .from("orders")
        .select("id, delivered_at, warranty_days")
        .eq("company_id", companyId)
        .eq("status", "entregado")
        .gt("warranty_days", 0)
        .gte("delivered_at", iso(now.getTime() - WARRANTY_LOOKBACK_DAYS * DAY_MS))
        .range(from, to)
    )
  );
  const dueIds = light
    .filter((r) => r.delivered_at && isWarrantyDue(r.delivered_at, r.warranty_days, now))
    .map((r) => r.id);
  const pages = await Promise.all(
    chunk(dueIds, CHUNK_SIZE).map(async (ids) => {
      const { data, error } = await supabase
        .from("orders")
        .select(DELIVERED_FIELDS)
        .eq("company_id", companyId)
        .eq("status", "entregado")
        .in("id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as DeliveredRow[];
    })
  );
  return pages.flat();
}

export async function fetchPendingMessages(companyId: string): Promise<PendingQueue> {
  const settings = await fetchWhatsAppSettings(companyId);
  // Con Evolution conectado el servidor ya avisa solo los cambios de estado:
  // no hay cola de eso. La post-venta no la manda nadie, así que se calcula igual.
  const [orderItems, postSaleItems] = await Promise.all([
    settings.evolutionActive ? Promise.resolve([] as PendingMessage[]) : fetchOrderEventItems(companyId, settings),
    fetchPostSaleItems(companyId, settings),
  ]);
  const items = [...orderItems, ...postSaleItems];
  items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return { evolutionActive: settings.evolutionActive, items };
}
