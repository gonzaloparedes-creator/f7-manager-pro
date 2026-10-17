import type { DeviceIntakeValue } from "@/components/DeviceIntakeFields";

export type ClientLite = { id: string; name: string; phone: string | null; cedula: string | null };

export type OrderFormState = DeviceIntakeValue & {
  customer_name: string;
  customer_phone: string;
  secondary_phone: string;
  secondary_contact_name: string;
  customer_cedula: string;
  terms_accepted: boolean;
  client_signature: string;
};

export const INITIAL_STATE: OrderFormState = {
  customer_name: "",
  customer_phone: "",
  secondary_phone: "",
  secondary_contact_name: "",
  customer_cedula: "",
  device_type: "",
  imei: "",
  marca: "",
  modelo: "",
  assigned_technician_id: "",
  priority: "normal",
  problems: [],
  problem_other: "",
  problem_description: "",
  quote_amount: "",
  deposit_amount: "",
  deposit_payment_method: "Efectivo",
  estimated_delivery_date: undefined,
  device_pin: "",
  device_pattern: [],
  terms_accepted: false,
  client_signature: "",
  accessories: [],
  checklist: {},
  warranty_days: 30,
};

export const STEPS = [
  { key: "cliente", label: "Cliente", title: "¿Quién deja el equipo?", subtitle: "Buscá un cliente que ya tengas o cargá uno nuevo." },
  { key: "equipo", label: "Equipo", title: "¿Qué equipo es y qué le pasa?", subtitle: "Indicá el equipo y marcá los problemas que ves." },
  { key: "ingreso", label: "Ingreso", title: "Estado de ingreso", subtitle: "Fotos, accesorios y acceso al equipo. Todo es opcional." },
  { key: "presupuesto", label: "Presupuesto", title: "Presupuesto y entrega", subtitle: "Cuánto cuesta, cuánto deja de seña y para cuándo está listo." },
  { key: "revision", label: "Revisión", title: "Revisión y firma", subtitle: "Revisá los datos y pedile al cliente que firme." },
] as const;

export const DRAFT_KEY = "f7_order_draft";

export function parseAmount(s: string) {
  const digits = s.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export function formatThousands(s: string) {
  const n = parseAmount(s);
  return n ? n.toLocaleString("es-PY") : "";
}

// Los términos aceptados y la firma son de ESTE momento con ESTE cliente: no
// se guardan en el borrador para que un borrador viejo nunca arranque con el
// "acepto" ya tildado ni con la firma de otra persona.
export function saveDraft(form: OrderFormState, selectedClientId: string | null) {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ form: { ...form, terms_accepted: false, client_signature: "" }, selectedClientId })
    );
  } catch {
    // sin storage o cuota llena: el borrador es solo una comodidad
  }
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* idem */ }
}

export function loadDraft(): { form: OrderFormState; selectedClientId: string | null } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const f = parsed.form as OrderFormState;
    if (!f) return null;
    if (f.estimated_delivery_date) f.estimated_delivery_date = new Date(f.estimated_delivery_date as unknown as string);
    return {
      form: { ...INITIAL_STATE, ...f, terms_accepted: false, client_signature: "" },
      selectedClientId: parsed.selectedClientId ?? null,
    };
  } catch {
    return null;
  }
}

// Un borrador "vale" solo si el usuario llegó a cargar algo propio.
export function draftHasContent(form: OrderFormState) {
  return !!(form.customer_name.trim() || form.customer_phone.trim() || form.device_type.trim() || form.problems.length > 0);
}

export function isClientStepValid(f: OrderFormState) {
  return !!f.customer_name.trim() && !!f.customer_phone.trim();
}

export function isDeviceStepValid(f: OrderFormState) {
  return !!f.device_type.trim() && f.problems.length > 0 && (!f.problems.includes("Otro") || !!f.problem_other.trim());
}

export function isBudgetStepValid(f: OrderFormState) {
  return parseAmount(f.deposit_amount) <= parseAmount(f.quote_amount);
}

export function stepBlocker(step: number, f: OrderFormState): string | null {
  if (step === 0 && !isClientStepValid(f)) {
    if (!f.customer_name.trim() && !f.customer_phone.trim()) return "Completá el nombre y el teléfono para continuar.";
    return !f.customer_name.trim() ? "Falta el nombre del cliente." : "Falta el teléfono del cliente.";
  }
  if (step === 1 && !isDeviceStepValid(f)) {
    if (!f.device_type.trim()) return "Indicá el equipo recibido para continuar.";
    if (f.problems.length === 0) return "Marcá al menos un problema para continuar.";
    return "Describí el problema \"Otro\" para continuar.";
  }
  if (step === 3 && !isBudgetStepValid(f)) return "La seña no puede superar al presupuesto.";
  if (step === 4 && !f.terms_accepted) return "El cliente tiene que aceptar los términos para crear la orden.";
  return null;
}
