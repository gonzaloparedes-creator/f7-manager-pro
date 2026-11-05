// Evento Purchase para la API de conversiones de Meta, a partir de un link de alta pagada.
// Sin dependencias de Deno a propósito: lo usa la función report-purchase y lo testea
// vitest (src/lib/metaCapi.test.ts). Email, teléfono, nombre y país viajan cifrados
// (SHA-256 de su forma normalizada); Meta nunca los recibe legibles.

/** Precios en guaraníes. Tienen que ser iguales a PRICING de src/lib/plans.ts (lo comprueba un test). */
export const PLAN_PRICES_GS: Record<string, Record<string, number>> = {
  starter: { mensual: 55000, semestral: 295000, anual: 550000 },
  pro: { mensual: 95000, semestral: 510000, anual: 950000 },
  business: { mensual: 140000, semestral: 750000, anual: 1400000 },
  retail: { mensual: 80000, semestral: 430000, anual: 800000 },
};

export interface PurchaseInput {
  code: string;
  usedAt: string;
  planType: string;
  billingCycle: string;
  amountGs: number | null;
  email: string;
  phone: string;
  fullName: string;
  country: string;
}

export function normalizePhone(phone: string, country: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  const py = !country || country.toUpperCase() === "PY";
  if (py && !d.startsWith("595")) {
    if (d.startsWith("0")) d = "595" + d.slice(1);
    else if (d.length === 9 && d.startsWith("9")) d = "595" + d;
  }
  return d;
}

export function normalizeName(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-zñ]/g, "");
}

/** Nombre y apellido. Con 3 palabras no se sabe cuál es el apellido, y entonces no se manda. */
export function splitName(fullName: string): { fn: string; ln: string } {
  const words = (fullName || "").trim().split(/\s+/).filter(Boolean);
  const fn = normalizeName(words[0] ?? "");
  const ln = words.length === 2 ? normalizeName(words[1]) : words.length >= 4 ? normalizeName(words[2]) : "";
  return { fn, ln };
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function purchaseValue(planType: string, billingCycle: string, amountGs: number | null): number {
  if (amountGs != null && amountGs > 0) return amountGs;
  return PLAN_PRICES_GS[planType]?.[billingCycle] ?? 0;
}

export async function buildPurchaseEvent(p: PurchaseInput) {
  const email = (p.email || "").trim().toLowerCase();
  const phone = normalizePhone(p.phone, p.country);
  const { fn, ln } = splitName(p.fullName);
  const country = /^[A-Za-z]{2}$/.test(p.country || "") ? p.country.toLowerCase() : "";

  const user_data: Record<string, string[]> = {};
  if (email) user_data.em = [await sha256Hex(email)];
  if (phone) user_data.ph = [await sha256Hex(phone)];
  if (fn) user_data.fn = [await sha256Hex(fn)];
  if (ln) user_data.ln = [await sha256Hex(ln)];
  if (country) user_data.country = [await sha256Hex(country)];

  return {
    event_name: "Purchase",
    event_time: Math.floor(Date.parse(p.usedAt) / 1000),
    event_id: `alta-${p.code}`,
    action_source: "system_generated",
    user_data,
    custom_data: {
      currency: "PYG",
      value: purchaseValue(p.planType, p.billingCycle, p.amountGs),
      order_id: p.code,
      content_name: `${p.planType} ${p.billingCycle}`,
    },
  };
}
