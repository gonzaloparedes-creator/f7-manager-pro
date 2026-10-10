import { describe, it, expect } from "vitest";
import { describeSchedule, isDueOn, nextDueDate, type RecurringScheduleWithCursor } from "./recurringExpenses";

const day = (s: string) => new Date(`${s}T00:00:00`);
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const monthly = (day_of_month: number): RecurringScheduleWithCursor => ({
  frequency: "mensual",
  day_of_month,
  day_of_week: null,
  start_date: "2026-01-01",
  generated_through: null,
});
const weekly = (day_of_week: number): RecurringScheduleWithCursor => ({
  frequency: "semanal",
  day_of_month: null,
  day_of_week,
  start_date: "2026-01-01",
  generated_through: null,
});

describe("isDueOn", () => {
  it("mensual: cae el día elegido", () => {
    expect(isDueOn(monthly(5), day("2026-10-05"))).toBe(true);
    expect(isDueOn(monthly(5), day("2026-10-06"))).toBe(false);
  });

  it("mensual: el día 31 cae el último día en los meses más cortos", () => {
    expect(isDueOn(monthly(31), day("2027-02-28"))).toBe(true);
    expect(isDueOn(monthly(31), day("2027-02-27"))).toBe(false);
    expect(isDueOn(monthly(31), day("2026-04-30"))).toBe(true);
    expect(isDueOn(monthly(31), day("2026-10-31"))).toBe(true);
  });

  it("mensual: el día 29 respeta los años bisiestos", () => {
    expect(isDueOn(monthly(29), day("2028-02-29"))).toBe(true);
    expect(isDueOn(monthly(29), day("2028-02-28"))).toBe(false);
    expect(isDueOn(monthly(29), day("2027-02-28"))).toBe(true);
  });

  it("semanal: 0 es domingo y 1 es lunes", () => {
    expect(isDueOn(weekly(1), day("2026-10-05"))).toBe(true);
    expect(isDueOn(weekly(1), day("2026-10-06"))).toBe(false);
    expect(isDueOn(weekly(0), day("2026-10-11"))).toBe(true);
  });
});

describe("nextDueDate", () => {
  it("sin nada generado todavía, es la primera fecha que toca desde el inicio", () => {
    expect(ymd(nextDueDate({ ...monthly(5), start_date: "2026-10-10" }))).toBe("2026-11-05");
    expect(ymd(nextDueDate({ ...monthly(15), start_date: "2026-10-10" }))).toBe("2026-10-15");
    expect(ymd(nextDueDate({ ...weekly(1), start_date: "2026-10-10" }))).toBe("2026-10-12");
  });

  it("si la fecha de inicio ya es un día que toca, esa es la primera", () => {
    expect(ymd(nextDueDate({ ...monthly(10), start_date: "2026-10-10" }))).toBe("2026-10-10");
  });

  it("después de generar hasta hoy, salta a la siguiente ocurrencia", () => {
    expect(ymd(nextDueDate({ ...monthly(10), generated_through: "2026-10-10" }))).toBe("2026-11-10");
    expect(ymd(nextDueDate({ ...weekly(6), generated_through: "2026-10-10" }))).toBe("2026-10-17");
  });

  it("un día 31 pasa por los meses cortos sin saltearse el mes", () => {
    expect(ymd(nextDueDate({ ...monthly(31), generated_through: "2026-10-31" }))).toBe("2026-11-30");
    expect(ymd(nextDueDate({ ...monthly(31), generated_through: "2027-01-31" }))).toBe("2027-02-28");
  });
});

describe("describeSchedule", () => {
  it("describe la regla en una frase", () => {
    expect(describeSchedule(monthly(5))).toBe("El día 5 de cada mes");
    expect(describeSchedule(weekly(1))).toBe("Cada lunes");
    expect(describeSchedule(weekly(0))).toBe("Cada domingo");
  });
});
