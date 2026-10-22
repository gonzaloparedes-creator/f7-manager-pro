import { useRef } from "react";
import type { EntryDraft, EntryKind, F7Entry, F7Partner, F7Recurring, Period, PeriodKey, Transfer } from "@/lib/f7Finance";

// Radix no admite "" como valor de un ítem: así se representa "Caja F7" / "sin especificar".
export const NONE = "__none__";

// Estilo de la etiqueta de cada tipo de movimiento.
export const KIND_BADGE: Record<EntryKind, string> = {
  ingreso: "border-primary/40 bg-primary/10 text-primary",
  gasto: "border-destructive/40 bg-destructive/10 text-destructive",
  aporte: "border-secondary/40 bg-secondary/10 text-secondary",
  reembolso: "border-border bg-muted/40 text-foreground",
  distribucion: "border-border bg-muted/40 text-foreground",
};

// Conserva el último valor mientras el diálogo termina de cerrarse (evita que parpadee vacío).
export function useSticky<T>(value: T | null): T | null {
  const ref = useRef<T | null>(value);
  if (value !== null) ref.current = value;
  return ref.current;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Días de calendario desde `from` hasta `to` (negativo si `to` ya pasó). Ambas en AAAA-MM-DD.
export function daysUntil(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

// "hoy", "mañana", "en 5 días", "hace 3 días".
export function relativeDays(from: string, to: string): string {
  const n = daysUntil(from, to);
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  if (n === -1) return "ayer";
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}

export function downloadTextFile(fileName: string, text: string, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// El período elegido arriba de Resumen y Movimientos (el mismo para las dos pestañas).
export interface PeriodControl {
  key: PeriodKey;
  custom: { from: string; to: string };
  period: Period;
  setKey: (key: PeriodKey) => void;
  setCustom: (custom: { from: string; to: string }) => void;
}

// Todo lo que las pestañas le piden a la pantalla (abrir diálogos).
export interface FinanceActions {
  newEntry: (draft: EntryDraft) => void;
  editEntry: (entry: F7Entry) => void;
  payEntry: (entry: F7Entry) => void;
  voidEntry: (entry: F7Entry) => void;
  importReceipts: () => void;
  newRecurring: () => void;
  editRecurring: (template: F7Recurring) => void;
  toggleRecurring: (template: F7Recurring) => void;
  newPartner: () => void;
  editPartner: (partner: F7Partner) => void;
  settle: (transfer: Transfer) => void;
  goToPending: () => void;
}
