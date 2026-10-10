import { addDays, format, getDaysInMonth } from "date-fns";
import { es } from "date-fns/locale";

export type RecurringFrequency = "mensual" | "semanal";

export interface RecurringSchedule {
  frequency: RecurringFrequency;
  day_of_month: number | null;
  day_of_week: number | null;
}

export interface RecurringScheduleWithCursor extends RecurringSchedule {
  start_date: string;
  generated_through: string | null;
}

// 0 = domingo … 6 = sábado, igual que Date.getDay() y que la función SQL recurring_expense_is_due.
export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const parseYmd = (s: string) => new Date(`${s}T00:00:00`);

/** Un día 29/30/31 en un mes más corto cae el último día de ese mes. */
export function isDueOn(rule: RecurringSchedule, date: Date): boolean {
  if (rule.frequency === "mensual") {
    if (rule.day_of_month == null) return false;
    return date.getDate() === Math.min(rule.day_of_month, getDaysInMonth(date));
  }
  if (rule.day_of_week == null) return false;
  return date.getDay() === rule.day_of_week;
}

/** Próxima fecha en la que la regla va a generar un gasto (o que está esperando a generarse). */
export function nextDueDate(rule: RecurringScheduleWithCursor): Date {
  const start = parseYmd(rule.start_date);
  const afterCursor = rule.generated_through ? addDays(parseYmd(rule.generated_through), 1) : start;
  let d = afterCursor > start ? afterCursor : start;
  for (let i = 0; i < 400 && !isDueOn(rule, d); i++) d = addDays(d, 1);
  return d;
}

export function describeSchedule(rule: RecurringSchedule): string {
  if (rule.frequency === "mensual") {
    return `El día ${rule.day_of_month} de cada mes`;
  }
  const label = WEEKDAY_OPTIONS.find((w) => w.value === rule.day_of_week)?.label ?? "";
  return `Cada ${label.toLowerCase()}`;
}

export function formatDueDate(d: Date): string {
  return format(d, "d MMM yyyy", { locale: es });
}
