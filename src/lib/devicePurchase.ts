// Lógica pura de "Comprar a cliente" (B1 seminuevos): validación del formulario,
// armado de los parámetros de la RPC register_device_purchase y resumen del
// estado del equipo. Sin React ni Supabase para poder testearla directo.

import { parseBattery } from "./deviceSpecs";

export type ChecklistStatus = "ok" | "fail";

export interface PurchaseChecklistItem {
  label: string;
  status: ChecklistStatus;
}

export interface DevicePurchaseForm {
  device_name: string;
  imei: string;
  /** Salud de batería en % (texto del input); vacío = no se midió. */
  battery_health: string;
  seller_name: string;
  seller_cedula: string;
  seller_phone: string;
  purchase_price: string;
  selling_price: string;
  payment_method: string;
  reason: string;
  notes: string;
  category_id: string | null;
  branch_id: string | null;
  checklist: Record<string, ChecklistStatus>;
  accessories: string[];
}

export type DevicePurchaseKind = "compra" | "canje" | "piezas";

export interface DevicePurchaseRecord {
  id: string;
  receipt_number: string;
  created_at: string;
  /** "canje" = recibido como parte de pago de una venta; "piezas" = comprado para desarmar (chatarra). */
  kind?: DevicePurchaseKind;
  sale_group_id?: string | null;
  branch_id: string | null;
  device_name: string;
  imei: string | null;
  battery_health?: number | null;
  seller_name: string;
  seller_cedula: string | null;
  seller_phone: string | null;
  purchase_price: number;
  payment_method: string | null;
  reason: string | null;
  checklist: PurchaseChecklistItem[];
  accessories: string[];
  notes: string | null;
}

export function parseGs(s: string): number {
  const digits = s.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export function emptyDevicePurchaseForm(defaultBranchId: string | null = null): DevicePurchaseForm {
  return {
    device_name: "",
    imei: "",
    battery_health: "",
    seller_name: "",
    seller_cedula: "",
    seller_phone: "",
    purchase_price: "",
    selling_price: "",
    payment_method: "",
    reason: "",
    notes: "",
    category_id: null,
    branch_id: defaultBranchId,
    checklist: {},
    accessories: [],
  };
}

// Primer error que impide guardar, o null si el formulario está completo. En un
// canje el equipo no se paga con plata: no hay medio de pago y el valor es el
// descuento que se le reconoce al cliente en su compra. Un equipo para piezas se
// paga igual que una compra, pero el IMEI es opcional (un equipo muy dañado puede
// no tenerlo legible) y no tiene batería: nunca se revende.
export function validateDevicePurchase(form: DevicePurchaseForm, kind: DevicePurchaseKind = "compra"): string | null {
  const canje = kind === "canje";
  const piezas = kind === "piezas";
  if (!form.device_name.trim()) return "Ingresá el nombre del equipo";
  if (!piezas && !form.imei.trim()) return "Ingresá el IMEI (o el número de serie si no tiene)";
  if (!form.seller_name.trim()) return canje ? "Ingresá el nombre del cliente que entrega el equipo" : "Ingresá el nombre de quien vende";
  if (!form.seller_cedula.trim()) return canje ? "Ingresá la cédula del cliente que entrega el equipo" : "Ingresá la cédula de quien vende";
  if (parseGs(form.purchase_price) <= 0) return canje ? "Ingresá cuánto le reconocés por el equipo" : "Ingresá cuánto le pagás por el equipo";
  if (!canje && !form.payment_method.trim()) return "Elegí con qué medio le pagás";
  return piezas ? null : parseBattery(form.battery_health).error;
}

// Un IMEI tiene 15 dígitos y el último es un dígito de control (Luhn). Si el
// valor es solo números pero no cumple, casi seguro es un error de tipeo — un
// aviso, no un bloqueo: hay equipos con otro formato de identificador.
export function imeiWarning(imei: string): string | null {
  const value = imei.trim();
  if (!value || !/^\d+$/.test(value)) return null;
  if (value.length !== 15) return "Un IMEI tiene 15 dígitos. Revisalo (marcá *#06# en el equipo).";
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = Number(value[14 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0 ? null : "Este IMEI no pasa la verificación. Revisá que no haya un dígito mal tipeado.";
}

// El checklist del formulario es un mapa etiqueta -> estado; se guarda como
// lista ordenada según el orden configurado de los ítems, solo con lo que se
// marcó (lo que no se revisó no queda registrado como OK).
export function checklistToList(
  checklist: Record<string, ChecklistStatus>,
  presetOrder: string[]
): PurchaseChecklistItem[] {
  const ordered = presetOrder.filter((label) => checklist[label]);
  const extras = Object.keys(checklist).filter((label) => !presetOrder.includes(label));
  return [...ordered, ...extras].map((label) => ({ label, status: checklist[label] }));
}

export function summarizeChecklist(items: PurchaseChecklistItem[]) {
  const failed = items.filter((i) => i.status === "fail").map((i) => i.label);
  const okLabels = items.filter((i) => i.status === "ok").map((i) => i.label);
  return { okCount: okLabels.length, failCount: failed.length, failed, okLabels };
}

export function buildDevicePurchaseParams(
  form: DevicePurchaseForm,
  checklistOrder: string[],
  kind: DevicePurchaseKind = "compra"
) {
  const piezas = kind === "piezas";
  return {
    device_name: form.device_name.trim(),
    imei: form.imei.trim(),
    battery_health: piezas ? null : parseBattery(form.battery_health).value,
    seller_name: form.seller_name.trim(),
    seller_cedula: form.seller_cedula.trim(),
    seller_phone: form.seller_phone.trim(),
    purchase_price: parseGs(form.purchase_price),
    selling_price: piezas ? 0 : parseGs(form.selling_price),
    payment_method: form.payment_method.trim(),
    reason: form.reason.trim(),
    notes: form.notes.trim(),
    category_id: piezas ? null : form.category_id,
    branch_id: form.branch_id,
    checklist: checklistToList(form.checklist, checklistOrder),
    accessories: form.accessories,
  };
}
