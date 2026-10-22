/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/fetchAllPages";
import {
  friendlyFinanceError,
  normalizeCategory,
  normalizeEntry,
  normalizePartner,
  normalizeReceipt,
  normalizeRecurring,
  type EntryPayload,
  type F7Category,
  type F7Entry,
  type F7Partner,
  type F7Recurring,
  type PartnerPayload,
  type ReceiptLite,
  type RecurringPayload,
} from "@/lib/f7Finance";

// Las tablas f7_* todavía no están en los tipos generados de Supabase.
const db = supabase as any;

export interface FinanceData {
  partners: F7Partner[];
  categories: F7Category[];
  entries: F7Entry[];
  recurring: F7Recurring[];
  receipts: ReceiptLite[];
}

export const EMPTY_FINANCE_DATA: FinanceData = {
  partners: [],
  categories: [],
  entries: [],
  recurring: [],
  receipts: [],
};

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyFinanceError(error, fallback));
}

const RECEIPT_COLUMNS = "id, receipt_number, customer_name, payment_date, amount, currency, payment_method, description, voided_at";

export async function loadFinanceData(): Promise<{ data: FinanceData; generated: number }> {
  // Crea los gastos fijos que vencen en los próximos días. Si falla, el resto de la pantalla igual carga.
  let generated = 0;
  const gen = await db.rpc("f7_generate_recurring");
  if (!gen.error && typeof gen.data === "number") generated = gen.data;

  const [partners, categories, entries, recurring, receipts] = await Promise.all([
    db.from("f7_partners").select("*").order("created_at", { ascending: true }),
    db.from("f7_finance_categories").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    fetchAllPages<any>((from, to) =>
      db
        .from("f7_finance_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    db.from("f7_recurring_expenses").select("*").order("created_at", { ascending: true }),
    fetchAllPages<any>((from, to) =>
      db
        .from("subscription_receipts")
        .select(RECEIPT_COLUMNS)
        .order("payment_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);

  for (const res of [partners, categories, recurring]) {
    if (res.error) throw res.error;
  }

  return {
    generated,
    data: {
      partners: (partners.data ?? []).map(normalizePartner),
      categories: (categories.data ?? []).map(normalizeCategory),
      entries: entries.map(normalizeEntry),
      recurring: (recurring.data ?? []).map(normalizeRecurring),
      receipts: receipts.map(normalizeReceipt),
    },
  };
}

// ---------- Movimientos ----------

type NewEntry = EntryPayload & { receipt_id?: string | null };

export async function createEntry(payload: NewEntry): Promise<F7Entry> {
  const { data, error } = await db.from("f7_finance_entries").insert(payload).select("*").single();
  if (error) fail(error, "No se pudo guardar el movimiento.");
  return normalizeEntry(data);
}

// Todos los movimientos entran juntos o ninguno (es una sola sentencia).
export async function createEntries(payloads: NewEntry[]): Promise<F7Entry[]> {
  if (payloads.length === 0) return [];
  const { data, error } = await db.from("f7_finance_entries").insert(payloads).select("*");
  if (error) fail(error, "No se pudieron guardar los movimientos.");
  return (data ?? []).map(normalizeEntry);
}

// El tipo de movimiento no se cambia nunca: no se manda.
export async function updateEntry(id: string, payload: EntryPayload): Promise<F7Entry> {
  const patch: Partial<EntryPayload> = { ...payload };
  delete patch.kind;
  const { data, error } = await db.from("f7_finance_entries").update(patch).eq("id", id).select("*").single();
  if (error) fail(error, "No se pudo guardar el movimiento.");
  return normalizeEntry(data);
}

export async function markEntryPaid(id: string, patch: { entry_date: string; payment_method: string | null }): Promise<F7Entry> {
  const { data, error } = await db
    .from("f7_finance_entries")
    .update({ status: "pagado", entry_date: patch.entry_date, payment_method: patch.payment_method })
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail(error, "No se pudo marcar como pagado.");
  return normalizeEntry(data);
}

// Anular es definitivo: la base no deja tocar un movimiento anulado.
export async function voidEntry(id: string, reason: string): Promise<F7Entry> {
  const { data, error } = await db
    .from("f7_finance_entries")
    .update({ voided_at: new Date().toISOString(), void_reason: reason.trim() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail(error, "No se pudo anular el movimiento.");
  return normalizeEntry(data);
}

export async function linkEntryToReceipt(entryId: string, receiptId: string): Promise<F7Entry> {
  const { data, error } = await db.from("f7_finance_entries").update({ receipt_id: receiptId }).eq("id", entryId).select("*").single();
  if (error) fail(error, "No se pudo vincular el ingreso con el recibo.");
  return normalizeEntry(data);
}

// ---------- Gastos fijos ----------

export async function createRecurring(payload: RecurringPayload): Promise<F7Recurring> {
  const { data, error } = await db.from("f7_recurring_expenses").insert(payload).select("*").single();
  if (error) fail(error, "No se pudo guardar el gasto fijo.");
  return normalizeRecurring(data);
}

export async function updateRecurring(id: string, payload: RecurringPayload): Promise<F7Recurring> {
  const { data, error } = await db.from("f7_recurring_expenses").update(payload).eq("id", id).select("*").single();
  if (error) fail(error, "No se pudo guardar el gasto fijo.");
  return normalizeRecurring(data);
}

export async function setRecurringActive(id: string, active: boolean): Promise<F7Recurring> {
  const { data, error } = await db.from("f7_recurring_expenses").update({ active }).eq("id", id).select("*").single();
  if (error) fail(error, "No se pudo cambiar el estado del gasto fijo.");
  return normalizeRecurring(data);
}

// Devuelve cuántos movimientos creó. Con `markPastPaid`, los vencimientos ya pasados quedan como pagados.
export async function generateRecurring(templateId: string | null, markPastPaid = false): Promise<number> {
  const { data, error } = await db.rpc("f7_generate_recurring", {
    p_template_id: templateId,
    p_mark_past_paid: markPastPaid,
  });
  if (error) fail(error, "No se pudieron crear los vencimientos del gasto fijo.");
  return typeof data === "number" ? data : 0;
}

// ---------- Socios ----------

export async function createPartner(payload: PartnerPayload): Promise<F7Partner> {
  const { data, error } = await db.from("f7_partners").insert(payload).select("*").single();
  if (error) fail(error, "No se pudo guardar el socio.");
  return normalizePartner(data);
}

export async function updatePartner(id: string, payload: PartnerPayload): Promise<F7Partner> {
  const { data, error } = await db.from("f7_partners").update(payload).eq("id", id).select("*").single();
  if (error) fail(error, "No se pudo guardar el socio.");
  return normalizePartner(data);
}

export async function deletePartner(id: string): Promise<void> {
  const { error } = await db.from("f7_partners").delete().eq("id", id);
  if (error) fail(error, "No se pudo borrar el socio.");
}

// ---------- Categorías ----------

export async function createCategory(kind: "ingreso" | "gasto", name: string): Promise<F7Category> {
  const { data, error } = await db.from("f7_finance_categories").insert({ kind, name }).select("*").single();
  if (error) fail(error, "No se pudo crear la categoría.");
  return normalizeCategory(data);
}

export async function updateCategory(id: string, patch: { name?: string; active?: boolean }): Promise<F7Category> {
  const { data, error } = await db.from("f7_finance_categories").update(patch).eq("id", id).select("*").single();
  if (error) fail(error, "No se pudo guardar la categoría.");
  return normalizeCategory(data);
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await db.from("f7_finance_categories").delete().eq("id", id);
  if (error) fail(error, "No se pudo borrar la categoría.");
}
