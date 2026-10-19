import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  commissionAmount,
  dateKey,
  formatDateKey,
  formatPeriod,
  settleWindow,
} from "./commissionSettlements";
import { revenueByStaffId, totalOf } from "./staffRevenue";

const S = (period_from: string, period_to: string, voided_at: string | null = null) => ({ period_from, period_to, voided_at });

describe("fechas", () => {
  it("dateKey usa el día local", () => {
    expect(dateKey(new Date(2026, 9, 5, 23, 59))).toBe("2026-10-05");
    expect(dateKey(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
  it("addDaysToKey cruza meses, años y bisiestos", () => {
    expect(addDaysToKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysToKey("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("formatea período", () => {
    expect(formatDateKey("2026-10-05")).toBe("05/10/2026");
    expect(formatPeriod("2026-10-05", "2026-10-05")).toBe("05/10/2026");
    expect(formatPeriod("2026-10-01", "2026-10-15")).toBe("01/10/2026 – 15/10/2026");
  });
});

describe("commissionAmount", () => {
  it("redondea al guaraní", () => {
    expect(commissionAmount(1_000_000, 10)).toBe(100_000);
    expect(commissionAmount(333_333, 5)).toBe(16_667);
  });
  it("0 si no hay base o porcentaje", () => {
    expect(commissionAmount(0, 10)).toBe(0);
    expect(commissionAmount(500_000, 0)).toBe(0);
    expect(commissionAmount(-5, 10)).toBe(0);
  });
});

describe("settleWindow", () => {
  const today = "2026-10-19";

  it("sin rango (Todo el tiempo) no se liquida", () => {
    expect(settleWindow(null, null, today, [])).toEqual({ status: "no-range", reason: "all" });
  });

  it("un rango que empieza hoy no tiene días cerrados", () => {
    expect(settleWindow("2026-10-19", "2026-10-19", today, [])).toEqual({ status: "no-range", reason: "open" });
    expect(settleWindow("2026-10-20", "2026-10-25", today, [])).toEqual({ status: "no-range", reason: "open" });
  });

  it("rango cerrado entero", () => {
    expect(settleWindow("2026-10-01", "2026-10-15", today, [])).toEqual({
      status: "ok", from: "2026-10-01", to: "2026-10-15", skipsSettled: false, includesToday: false,
    });
  });

  it("un solo día (ayer) es liquidable", () => {
    expect(settleWindow("2026-10-18", "2026-10-18", today, [])).toEqual({
      status: "ok", from: "2026-10-18", to: "2026-10-18", skipsSettled: false, includesToday: false,
    });
  });

  it("si el rango incluye hoy se corta en ayer", () => {
    expect(settleWindow("2026-10-01", "2026-10-31", today, [])).toEqual({
      status: "ok", from: "2026-10-01", to: "2026-10-18", skipsSettled: false, includesToday: true,
    });
  });

  it("salta los días ya liquidados al principio", () => {
    expect(settleWindow("2026-10-01", "2026-10-15", today, [S("2026-09-20", "2026-10-07")])).toEqual({
      status: "ok", from: "2026-10-08", to: "2026-10-15", skipsSettled: true, includesToday: false,
    });
  });

  it("encadena liquidaciones contiguas", () => {
    const list = [S("2026-10-01", "2026-10-05"), S("2026-10-06", "2026-10-10")];
    expect(settleWindow("2026-10-01", "2026-10-15", today, list)).toEqual({
      status: "ok", from: "2026-10-11", to: "2026-10-15", skipsSettled: true, includesToday: false,
    });
  });

  it("se corta antes de la siguiente liquidación", () => {
    expect(settleWindow("2026-10-01", "2026-10-15", today, [S("2026-10-10", "2026-10-12")])).toEqual({
      status: "ok", from: "2026-10-01", to: "2026-10-09", skipsSettled: true, includesToday: false,
    });
  });

  it("todo cubierto", () => {
    expect(settleWindow("2026-10-03", "2026-10-08", today, [S("2026-10-01", "2026-10-10")])).toEqual({ status: "covered" });
  });

  it("cubierto hasta ayer cuando el rango incluye hoy", () => {
    expect(settleWindow("2026-10-01", "2026-10-31", today, [S("2026-10-01", "2026-10-18")])).toEqual({ status: "covered" });
  });

  it("las anuladas no cuentan", () => {
    expect(settleWindow("2026-10-01", "2026-10-10", today, [S("2026-10-01", "2026-10-10", "2026-10-12T10:00:00Z")])).toEqual({
      status: "ok", from: "2026-10-01", to: "2026-10-10", skipsSettled: false, includesToday: false,
    });
  });

  it("no pasa de 366 días", () => {
    const w = settleWindow("2024-01-01", "2026-10-10", today, []);
    expect(w).toMatchObject({ status: "ok", from: "2024-01-01", to: "2025-01-01", skipsSettled: false });
  });
});

describe("revenueByStaffId (regla compartida con Reportes)", () => {
  const d = (s: string) => new Date(s);
  const order = (over: Partial<Parameters<typeof revenueByStaffId>[0][number]>) => ({
    quote_amount: 100_000,
    senia_amount: 0,
    cargos_adicionales: null,
    deposit_date: null,
    final_payment_date: null,
    assigned_technician_id: "t1",
    ...over,
  });

  it("totalOf suma presupuesto y cargos adicionales", () => {
    expect(totalOf({ quote_amount: 100_000, cargos_adicionales: [{ monto: 20_000 }, { monto: "5000" }] })).toBe(125_000);
    expect(totalOf({ quote_amount: null, cargos_adicionales: null })).toBe(0);
  });

  it("seña el día que se cobró y saldo el día de la entrega", () => {
    const o = order({ senia_amount: 40_000, deposit_date: "2026-10-02T12:00:00Z", final_payment_date: "2026-10-09T12:00:00Z" });
    const a = revenueByStaffId([o], [], d("2026-10-01T00:00:00Z"), d("2026-10-05T23:59:59Z"));
    expect(a.get("t1")).toBe(40_000);
    const b = revenueByStaffId([o], [], d("2026-10-06T00:00:00Z"), d("2026-10-12T23:59:59Z"));
    expect(b.get("t1")).toBe(60_000);
    const c = revenueByStaffId([o], [], null, null);
    expect(c.get("t1")).toBe(100_000);
  });

  it("ventas al vendedor y órdenes sin asignar bajo clave vacía", () => {
    const o = order({ assigned_technician_id: null, final_payment_date: "2026-10-03T12:00:00Z" });
    const sale = { quantity: 3, unit_price: 10_000, created_at: "2026-10-03T12:00:00Z", created_by: "v1" };
    const m = revenueByStaffId([o], [sale], d("2026-10-01T00:00:00Z"), d("2026-10-31T23:59:59Z"));
    expect(m.get("")).toBe(100_000);
    expect(m.get("v1")).toBe(30_000);
  });
});
