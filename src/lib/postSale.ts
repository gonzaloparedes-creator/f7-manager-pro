// Lógica pura de la lista "Para contactar hoy" (post-venta): pedir reseña,
// avisar que una garantía está por vencer y saludar en el cumpleaños. No
// toca la base ni el DOM, así se puede probar con fechas fijas; la consulta
// y el armado de los mensajes viven en pendingMessages.ts.

export type PostSaleKind = "review" | "warranty" | "birthday";

export type PostSaleEventKey = "postventa_resena" | "postventa_garantia" | "postventa_cumple";

export const POST_SALE_EVENT: Record<PostSaleKind, PostSaleEventKey> = {
  review: "postventa_resena",
  warranty: "postventa_garantia",
  birthday: "postventa_cumple",
};

export const POST_SALE_EVENT_KEYS: PostSaleEventKey[] = Object.values(POST_SALE_EVENT);

export function isPostSaleEventKey(key: string): key is PostSaleEventKey {
  return (POST_SALE_EVENT_KEYS as string[]).includes(key);
}

// Reseña: se pide a los 3 días de la entrega (que ya haya probado el equipo)
// y deja de sugerirse a los 7 (después ya es raro pedirla).
export const REVIEW_MIN_DAYS = 3;
export const REVIEW_MAX_DAYS = 7;
// Garantía: se avisa los últimos 3 días antes de que venza.
export const WARRANTY_LEAD_DAYS = 3;
// Cumpleaños: el día y hasta 2 días después, por si nadie abrió F7 ese día.
export const BIRTHDAY_GRACE_DAYS = 2;
// A un mismo teléfono no se le pide reseña más de una vez por mes, aunque
// haya traído más equipos.
export const REVIEW_COOLDOWN_DAYS = 30;
// Cuánto historial de mensajes de post-venta hace falta leer para decidir
// qué ya se atendió (el más largo es el período de espera de las reseñas).
export const POST_SALE_LOG_LOOKBACK_DAYS = REVIEW_COOLDOWN_DAYS + 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PostSaleSettings {
  review: boolean;
  warranty: boolean;
  birthday: boolean;
  reviewUrl: string | null;
}

export const DEFAULT_POST_SALE_SETTINGS: PostSaleSettings = {
  review: false,
  warranty: false,
  birthday: false,
  reviewUrl: null,
};

// Pedir reseña sin tener a dónde mandarla no tiene sentido: el switch queda
// prendido pero la sección no aparece hasta que se cargue el link.
export function reviewRequestsActive(s: PostSaleSettings): boolean {
  return s.review && !!s.reviewUrl?.trim();
}

export function postSaleActive(s: PostSaleSettings): boolean {
  return reviewRequestsActive(s) || s.warranty || s.birthday;
}

// Días completos transcurridos (mismo criterio que la etiqueta de garantía
// de la orden, así los números nunca se contradicen).
export function elapsedDays(since: string | Date, now: Date): number {
  return Math.floor((now.getTime() - new Date(since).getTime()) / DAY_MS);
}

export function isReviewDue(deliveredAt: string, now: Date): boolean {
  const days = elapsedDays(deliveredAt, now);
  return days >= REVIEW_MIN_DAYS && days <= REVIEW_MAX_DAYS;
}

// null si la orden no tiene garantía.
export function warrantyDaysLeft(
  deliveredAt: string,
  warrantyDays: number | null | undefined,
  now: Date
): number | null {
  const wd = Number(warrantyDays ?? 0);
  if (!(wd > 0)) return null;
  return wd - elapsedDays(deliveredAt, now);
}

export function isWarrantyDue(
  deliveredAt: string,
  warrantyDays: number | null | undefined,
  now: Date
): boolean {
  const left = warrantyDaysLeft(deliveredAt, warrantyDays, now);
  return left !== null && left >= 0 && left <= WARRANTY_LEAD_DAYS;
}

export function warrantyExpiryDate(deliveredAt: string, warrantyDays: number): Date {
  const d = new Date(deliveredAt);
  d.setDate(d.getDate() + warrantyDays);
  return d;
}

export function formatDMY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export interface BirthdayOccurrence {
  /** Medianoche local del día del cumpleaños (el más reciente que ya pasó o es hoy). */
  start: Date;
  /** 0 = hoy. */
  daysAgo: number;
}

// `birthDate` es un "YYYY-MM-DD" (columna date): el año solo importa para
// saber si alguna vez fue 29/02. Los nacidos el 29/02 se saludan el 28/02
// en los años que no son bisiestos.
export function lastBirthday(birthDate: string, now: Date): BirthdayOccurrence | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  for (const year of [now.getFullYear(), now.getFullYear() - 1]) {
    const d = month === 2 && day === 29 && !isLeap(year) ? 28 : day;
    const occUtc = Date.UTC(year, month - 1, d);
    if (occUtc <= todayUtc) {
      return { start: new Date(year, month - 1, d), daysAgo: Math.round((todayUtc - occUtc) / DAY_MS) };
    }
  }
  return null;
}

export function birthdayDue(birthDate: string, now: Date): BirthdayOccurrence | null {
  const occ = lastBirthday(birthDate, now);
  return occ && occ.daysAgo <= BIRTHDAY_GRACE_DAYS ? occ : null;
}

export interface PostSaleLogRow {
  order_id: string | null;
  client_id: string | null;
  event_key: string;
  action: string;
  phone: string | null;
  created_at: string;
}

export const phoneKey = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "");

export interface DeliveredOrder {
  orderId: string;
  deliveredAt: string;
  /** Teléfono ya validado (no es un relleno). */
  phone: string;
  warrantyDays: number;
}

export interface OrderGroup<T extends DeliveredOrder> {
  /** La entrega más reciente del grupo: de ahí salen los datos del mensaje. */
  primary: T;
  /** Todas las órdenes del grupo (incluye `primary`), la más reciente primero. */
  orders: T[];
}

function groupOrders<T extends DeliveredOrder>(orders: T[], keyOf: (o: T) => string): OrderGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const o of orders) {
    const key = keyOf(o);
    const list = byKey.get(key) ?? [];
    list.push(o);
    byKey.set(key, list);
  }
  const deliveredMs = (o: T) => new Date(o.deliveredAt).getTime();
  return [...byKey.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => deliveredMs(b) - deliveredMs(a));
      return { primary: sorted[0], orders: sorted };
    })
    .sort((a, b) => deliveredMs(b.primary) - deliveredMs(a.primary));
}

const handledOrderIds = (log: PostSaleLogRow[], eventKey: PostSaleEventKey) =>
  new Set(log.filter((l) => l.event_key === eventKey && l.order_id).map((l) => l.order_id as string));

// Reseñas pendientes: entregas dentro de la ventana, que no se hayan
// atendido ya, a teléfonos a los que no se les pidió reseña hace poco. Varias
// entregas al mismo teléfono (un lote, o un cliente que volvió) son un solo
// pedido.
export function pickReviewGroups<T extends DeliveredOrder>(
  orders: T[],
  log: PostSaleLogRow[],
  now: Date
): OrderGroup<T>[] {
  const handled = handledOrderIds(log, POST_SALE_EVENT.review);
  const cooldownFrom = now.getTime() - REVIEW_COOLDOWN_DAYS * DAY_MS;
  // Descartar sí cuenta como atendido, pero no como "ya le pedimos reseña":
  // el cliente nunca recibió nada.
  const recentlyAsked = new Set(
    log
      .filter(
        (l) =>
          l.event_key === POST_SALE_EVENT.review &&
          (l.action === "opened" || l.action === "copied") &&
          new Date(l.created_at).getTime() >= cooldownFrom
      )
      .map((l) => phoneKey(l.phone))
      .filter(Boolean)
  );
  const open = orders.filter(
    (o) => isReviewDue(o.deliveredAt, now) && !handled.has(o.orderId) && !recentlyAsked.has(phoneKey(o.phone))
  );
  return groupOrders(open, (o) => phoneKey(o.phone));
}

// Garantías por vencer: una por orden, salvo las que vencen el mismo día para
// el mismo teléfono (un lote entregado junto), que van en un solo mensaje.
export function pickWarrantyGroups<T extends DeliveredOrder>(
  orders: T[],
  log: PostSaleLogRow[],
  now: Date
): OrderGroup<T>[] {
  const handled = handledOrderIds(log, POST_SALE_EVENT.warranty);
  const open = orders.filter(
    (o) => isWarrantyDue(o.deliveredAt, o.warrantyDays, now) && !handled.has(o.orderId)
  );
  return groupOrders(
    open,
    (o) => `${phoneKey(o.phone)}|${formatDMY(warrantyExpiryDate(o.deliveredAt, o.warrantyDays))}`
  );
}

export interface BirthdayCandidate {
  id: string;
  birthDate: string;
}

export function pickBirthdays<C extends BirthdayCandidate>(
  clients: C[],
  log: PostSaleLogRow[],
  now: Date
): { client: C; occurrence: BirthdayOccurrence }[] {
  const out: { client: C; occurrence: BirthdayOccurrence }[] = [];
  for (const client of clients) {
    const occurrence = birthdayDue(client.birthDate, now);
    if (!occurrence) continue;
    // Atendido = hay un registro de este cumpleaños (de este año), no uno viejo.
    const startMs = occurrence.start.getTime();
    const handled = log.some(
      (l) =>
        l.client_id === client.id &&
        l.event_key === POST_SALE_EVENT.birthday &&
        new Date(l.created_at).getTime() >= startMs
    );
    if (!handled) out.push({ client, occurrence });
  }
  return out;
}

// "Celular", "Notebook" -> "Celular y Notebook"; repetidos se cuentan una vez.
export function joinDistinct(values: string[]): string {
  const unique = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  if (unique.length <= 1) return unique[0] ?? "";
  return `${unique.slice(0, -1).join(", ")} y ${unique[unique.length - 1]}`;
}
