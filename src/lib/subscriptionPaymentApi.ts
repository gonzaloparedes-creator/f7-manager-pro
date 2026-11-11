/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/fetchAllPages";
import { amountToInput, friendlyFinanceError, normalizeCategory, normalizePartner } from "@/lib/f7Finance";
import type { CompanyReceiptRow, PaymentContext, PaymentPayload } from "@/lib/subscriptionPayment";
import type { SubscriptionReceipt } from "@/lib/subscriptionReceipt";

// Las tablas f7_* y la función de pago todavía no están en los tipos generados de Supabase.
const db = supabase as any;

// La base devuelve los importes como numéricos; se pasan a número una sola vez, acá.
export function toSubscriptionReceipt(row: any): SubscriptionReceipt {
  const amount = Number(row.amount);
  return {
    ...row,
    amount,
    subtotal: Number(row.subtotal ?? row.amount),
    discount_amount: Number(row.discount_amount ?? 0),
  };
}

export function toCompanyReceiptRow(row: any): CompanyReceiptRow {
  return {
    id: String(row.id),
    receipt_number: String(row.receipt_number),
    company_id: row.company_id ? String(row.company_id) : null,
    payment_date: String(row.payment_date ?? "").slice(0, 10),
    period_start: String(row.period_start ?? "").slice(0, 10),
    period_end: String(row.period_end ?? "").slice(0, 10),
    amount: Number(row.amount ?? 0),
    currency: row.currency === "USD" ? "USD" : "PYG",
    voided_at: row.voided_at ? String(row.voided_at) : null,
    created_at: String(row.created_at ?? ""),
  };
}

// Lo que el formulario de cobro necesita para llenarse solo: categorías de ingreso, socios y
// lo último que se usó (quién cobró, medio de pago, tipo de cambio, datos del emisor).
// Las categorías y los socios son imprescindibles; el historial es una ayuda: si falla, se sigue sin él.
export async function loadPaymentContext(): Promise<PaymentContext> {
  const [categories, partners, lastReceipt, lastEntries] = await Promise.all([
    db.from("f7_finance_categories").select("*").eq("kind", "ingreso").eq("active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }),
    db.from("f7_partners").select("*").eq("active", true).order("created_at", { ascending: true }),
    db.from("subscription_receipts").select("issuer_name, issuer_details").order("created_at", { ascending: false }).limit(1),
    db
      .from("f7_finance_entries")
      .select("partner_id, fx_rate, payment_method")
      .not("receipt_id", "is", null)
      .is("voided_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  for (const res of [categories, partners]) {
    if (res.error) throw res.error;
  }
  const issuer = lastReceipt.error ? null : (lastReceipt.data ?? [])[0];
  const entries: any[] = lastEntries.error ? [] : (lastEntries.data ?? []);
  const fx = entries.find((e) => e.fx_rate != null)?.fx_rate;
  return {
    categories: (categories.data ?? []).map(normalizeCategory),
    partners: (partners.data ?? []).map(normalizePartner),
    issuerName: issuer?.issuer_name ?? null,
    issuerDetails: issuer?.issuer_details ?? null,
    lastMethod: entries[0]?.payment_method ?? null,
    lastCollector: entries[0] ? (entries[0].partner_id ?? "") : null,
    lastFx: fx != null ? amountToInput(Number(fx), "USD") : null,
  };
}

export interface RegisteredPayment {
  receipt: SubscriptionReceipt;
  entryId: string;
}

// Un solo paso en la base: actualiza el plan de la empresa, emite el recibo y registra el
// ingreso en Finanzas F7. Si algo falla no queda nada a medias.
export async function registerSubscriptionPayment(payload: PaymentPayload): Promise<RegisteredPayment> {
  const { data, error } = await db.rpc("f7_register_subscription_payment", { _payload: payload });
  if (error) throw new Error(friendlyFinanceError(error, "No se pudo registrar el pago. Probá de nuevo."));
  if (!data?.receipt) throw new Error("La base no devolvió el recibo. Revisá Recibos antes de volver a intentarlo.");
  return { receipt: toSubscriptionReceipt(data.receipt), entryId: String(data.entry_id ?? "") };
}

export interface PaymentOverview {
  receipts: CompanyReceiptRow[];
  // Recibos que ya tienen su ingreso vigente en Finanzas F7.
  financeLinked: Set<string>;
}

// Para la lista de empresas: qué períodos tienen recibo y cuáles ya están en Finanzas.
export async function loadPaymentOverview(): Promise<PaymentOverview> {
  const [receipts, entries] = await Promise.all([
    fetchAllPages<any>((from, to) =>
      db
        .from("subscription_receipts")
        .select("id, receipt_number, company_id, payment_date, period_start, period_end, amount, currency, voided_at, created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllPages<any>((from, to) =>
      db.from("f7_finance_entries").select("receipt_id").not("receipt_id", "is", null).is("voided_at", null).order("id", { ascending: true }).range(from, to)
    ),
  ]);
  return {
    receipts: receipts.map(toCompanyReceiptRow),
    financeLinked: new Set(entries.map((e) => String(e.receipt_id))),
  };
}
