import { describe, expect, it } from "vitest";
import {
  ALL_TIME,
  CSV_HEADERS,
  DEFAULT_FILTERS,
  GENERATE_AHEAD_DAYS,
  addMonthsToKey,
  amountToInput,
  breakdownByCategory,
  buildLookups,
  buildReceiptImportPayload,
  categoryName,
  computePending,
  computeSnapshot,
  computeTotals,
  countByStatus,
  csvFileName,
  describePeriod,
  draftFromEntry,
  emptyDraft,
  emptyRecurringDraft,
  entriesToCsv,
  entryState,
  filterEntries,
  findLinkCandidates,
  firstOfMonth,
  flowLabel,
  formatEntryAmount,
  formatForeign,
  formatGs,
  formatPct,
  friendlyFinanceError,
  inPeriod,
  isCounted,
  isPending,
  lastOfMonth,
  missingDues,
  monthShortLabel,
  monthlyEquivalent,
  monthlyFixedCost,
  monthlySeries,
  nextDue,
  normalizeCategory,
  normalizeEntry,
  normalizePartner,
  normalizeReceipt,
  normalizeRecurring,
  parseFxInput,
  partnerName,
  pastDueCount,
  planSettlement,
  recurringDraftFrom,
  recurringOccurrences,
  resolvePeriod,
  settlementDrafts,
  sharesWarning,
  shortcutDraft,
  sourceLabel,
  stateLabel,
  suggestSettlements,
  toPyg,
  unregisteredReceipts,
  upcomingDues,
  validateCategoryName,
  validateEntryDraft,
  validatePartnerDraft,
  validateRecurringDraft,
  type EntryKind,
  type EntryValidationContext,
  type F7Category,
  type F7Entry,
  type F7Partner,
  type F7Recurring,
  type ReceiptLite,
} from "@/lib/f7Finance";

const TODAY = "2026-10-22";

let seq = 0;
function entry(kind: EntryKind, amountPyg: number, extra: Partial<F7Entry> = {}): F7Entry {
  seq += 1;
  return {
    id: `e${seq}`,
    kind,
    entry_date: "2026-10-05",
    description: `mov ${seq}`,
    category_id: null,
    amount: amountPyg,
    currency: "PYG",
    fx_rate: null,
    amount_pyg: amountPyg,
    status: "pagado",
    partner_id: null,
    via_partner_id: null,
    payment_method: null,
    notes: null,
    receipt_id: null,
    recurring_id: null,
    recurring_due: null,
    created_at: `2026-10-05T10:00:${String(seq % 60).padStart(2, "0")}Z`,
    updated_at: null,
    voided_at: null,
    void_reason: null,
    ...extra,
  };
}

const GONZALO: F7Partner = { id: "g", name: "Gonzalo", share_pct: 50, active: true, notes: null, created_at: "2026-10-01T00:00:00Z" };
const MATIAS: F7Partner = { id: "m", name: "Matías", share_pct: 50, active: true, notes: null, created_at: "2026-10-01T00:00:00Z" };

const CATS: F7Category[] = [
  { id: "ci1", kind: "ingreso", name: "Instalación y configuración", active: true, sort_order: 20 },
  { id: "cg1", kind: "gasto", name: "Base de datos (Supabase)", active: true, sort_order: 10 },
  { id: "cg2", kind: "gasto", name: "Publicidad (Meta Ads)", active: true, sort_order: 40 },
];
const LOOKUPS = buildLookups(CATS, [GONZALO, MATIAS]);

// Ejemplo del plan: dos socios al 50 %. Todo lo cobrado entró a la cuenta de Gonzalo
// y los dos gastos se pagaron con la tarjeta de Matías.
function planEntries(): F7Entry[] {
  return [
    entry("ingreso", 1_120_000, { entry_date: "2026-10-03", partner_id: "g", category_id: "ci1" }),
    entry("ingreso", 900_000, { entry_date: "2026-10-10", partner_id: "g", category_id: "ci1" }),
    entry("gasto", 182_500, {
      entry_date: "2026-10-01",
      partner_id: "m",
      category_id: "cg1",
      amount: 25,
      currency: "USD",
      fx_rate: 7300,
    }),
    entry("gasto", 500_000, { entry_date: "2026-10-15", partner_id: "m", category_id: "cg2" }),
  ];
}

const byId = (snap: ReturnType<typeof computeSnapshot>, id: string) => snap.partners.find((p) => p.partnerId === id)!;

describe("montos", () => {
  it("convierte a guaraníes con el mismo redondeo que la base (mitad hacia arriba)", () => {
    expect(toPyg(1_120_000, "PYG", null)).toBe(1_120_000);
    expect(toPyg(25, "USD", 7300)).toBe(182_500);
    expect(toPyg(20.5, "USD", 7345.5)).toBe(150_583);
    expect(toPyg(0.5, "USD", 7301)).toBe(3651);
    expect(toPyg(0.01, "USD", 7300)).toBe(73);
    expect(toPyg(19.99, "USD", 7300.5)).toBe(145_937);
    expect(toPyg(1234.5, "PYG", null)).toBe(1235);
  });

  it("un dólar sin tipo de cambio no se puede convertir", () => {
    expect(toPyg(25, "USD", null)).toBeNaN();
  });

  it("formatea guaraníes, negativos y dólares", () => {
    expect(formatGs(1_120_000)).toBe("Gs. 1.120.000");
    expect(formatGs(-1_351_250)).toBe("-Gs. 1.351.250");
    expect(formatGs(0)).toBe("Gs. 0");
    expect(formatGs(-0.4)).toBe("Gs. 0");
    expect(formatForeign(25)).toBe("US$ 25");
    expect(formatForeign(25.5)).toBe("US$ 25,50");
    expect(formatPct(50)).toBe("50 %");
    expect(formatPct(33.33)).toBe("33,3 %");
  });

  it("muestra el monto original debajo cuando es en dólares", () => {
    expect(formatEntryAmount({ amount: 1_120_000, currency: "PYG", amount_pyg: 1_120_000 })).toEqual({
      main: "Gs. 1.120.000",
      sub: null,
    });
    expect(formatEntryAmount({ amount: 25, currency: "USD", amount_pyg: 182_500 })).toEqual({
      main: "Gs. 182.500",
      sub: "US$ 25",
    });
  });

  it("devuelve el monto como texto editable", () => {
    expect(amountToInput(1_120_000, "PYG")).toBe("1120000");
    expect(amountToInput(25, "USD")).toBe("25");
    expect(amountToInput(25.5, "USD")).toBe("25,5");
    expect(amountToInput(100, "USD")).toBe("100");
    expect(amountToInput(10.05, "USD")).toBe("10,05");
    expect(amountToInput(0.5, "USD")).toBe("0,5");
  });

  it("lee el tipo de cambio con puntos de miles o coma decimal", () => {
    expect(parseFxInput("7300")).toBe(7300);
    expect(parseFxInput("7.300")).toBe(7300);
    expect(parseFxInput("7300,5")).toBe(7300.5);
    expect(parseFxInput("7.300,50")).toBe(7300.5);
    expect(parseFxInput("7300.5")).toBe(7300.5);
    expect(parseFxInput(" 7 300 ")).toBe(7300);
    expect(parseFxInput("")).toBeNaN();
    expect(parseFxInput("abc")).toBeNaN();
    expect(parseFxInput("7,300,5")).toBeNaN();
    expect(parseFxInput("73.00.0")).toBeNaN();
  });
});

describe("fechas y períodos", () => {
  it("calcula primer y último día del mes, también en año bisiesto", () => {
    expect(firstOfMonth("2026-10-22")).toBe("2026-10-01");
    expect(lastOfMonth("2026-10-22")).toBe("2026-10-31");
    expect(lastOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(lastOfMonth("2028-02-10")).toBe("2028-02-29");
  });

  it("suma y resta meses a una clave AAAA-MM", () => {
    expect(addMonthsToKey("2026-01", -1)).toBe("2025-12");
    expect(addMonthsToKey("2026-12", 1)).toBe("2027-01");
    expect(addMonthsToKey("2026-10", -11)).toBe("2025-11");
    expect(addMonthsToKey("2026-03", -14)).toBe("2025-01");
    expect(monthShortLabel("2026-10")).toBe("oct 26");
    expect(monthShortLabel("2026-01")).toBe("ene 26");
  });

  it("resuelve los períodos con la fecha de hoy", () => {
    expect(resolvePeriod("este_mes", TODAY)).toEqual({ key: "este_mes", from: "2026-10-01", to: "2026-10-31" });
    expect(resolvePeriod("mes_pasado", TODAY)).toEqual({ key: "mes_pasado", from: "2026-09-01", to: "2026-09-30" });
    expect(resolvePeriod("este_anio", TODAY)).toEqual({ key: "este_anio", from: "2026-01-01", to: "2026-12-31" });
    expect(resolvePeriod("ultimos_12", TODAY)).toEqual({ key: "ultimos_12", from: "2025-11-01", to: "2026-10-31" });
    expect(resolvePeriod("todo", TODAY)).toEqual(ALL_TIME);
  });

  it("el mes pasado de enero es diciembre del año anterior", () => {
    expect(resolvePeriod("mes_pasado", "2026-01-15")).toEqual({ key: "mes_pasado", from: "2025-12-01", to: "2025-12-31" });
    expect(resolvePeriod("este_mes", "2028-02-10")).toEqual({ key: "este_mes", from: "2028-02-01", to: "2028-02-29" });
  });

  it("acepta fechas personalizadas solo si son válidas y están en orden", () => {
    expect(resolvePeriod("personalizado", TODAY, { from: "2026-03-01", to: "2026-03-31" })).toEqual({
      key: "personalizado",
      from: "2026-03-01",
      to: "2026-03-31",
    });
    expect(resolvePeriod("personalizado", TODAY, { from: "2026-04-01", to: "2026-03-31" })).toEqual({
      key: "personalizado",
      from: null,
      to: null,
    });
    expect(resolvePeriod("personalizado", TODAY, { from: "2026-02-30", to: "2026-03-31" }).from).toBeNull();
  });

  it("incluye los dos extremos del período", () => {
    const p = resolvePeriod("este_mes", TODAY);
    expect(inPeriod("2026-10-01", p)).toBe(true);
    expect(inPeriod("2026-10-31", p)).toBe(true);
    expect(inPeriod("2026-09-30", p)).toBe(false);
    expect(inPeriod("2026-11-01", p)).toBe(false);
    expect(inPeriod("2019-01-01", ALL_TIME)).toBe(true);
  });

  it("describe el período", () => {
    expect(describePeriod(ALL_TIME)).toBe("Todo el historial");
    expect(describePeriod(resolvePeriod("este_mes", TODAY))).toBe("01/10/2026 al 31/10/2026");
  });
});

describe("qué movimientos cuentan", () => {
  it("solo cuentan los pagados y no anulados", () => {
    expect(isCounted(entry("gasto", 1))).toBe(true);
    expect(isCounted(entry("gasto", 1, { status: "pendiente" }))).toBe(false);
    expect(isCounted(entry("gasto", 1, { voided_at: "2026-10-06T00:00:00Z" }))).toBe(false);
  });

  it("solo los ingresos y gastos pendientes son por cobrar o por pagar", () => {
    expect(isPending(entry("ingreso", 1, { status: "pendiente" }))).toBe(true);
    expect(isPending(entry("gasto", 1, { status: "pendiente" }))).toBe(true);
    expect(isPending(entry("gasto", 1))).toBe(false);
    expect(isPending(entry("gasto", 1, { status: "pendiente", voided_at: "2026-10-06T00:00:00Z" }))).toBe(false);
    expect(isPending(entry("aporte", 1, { status: "pendiente" }))).toBe(false);
  });

  it("clasifica el estado de cada movimiento", () => {
    expect(entryState(entry("gasto", 1, { voided_at: "x" }), TODAY)).toBe("anulado");
    expect(entryState(entry("gasto", 1), TODAY)).toBe("pagado");
    expect(entryState(entry("gasto", 1, { status: "pendiente", entry_date: "2026-10-22" }), TODAY)).toBe("pendiente");
    expect(entryState(entry("gasto", 1, { status: "pendiente", entry_date: "2026-10-21" }), TODAY)).toBe("vencido");
  });

  it("rotula cobrado/pagado y por cobrar/por pagar", () => {
    expect(stateLabel(entry("ingreso", 1), TODAY)).toBe("Cobrado");
    expect(stateLabel(entry("gasto", 1), TODAY)).toBe("Pagado");
    expect(stateLabel(entry("aporte", 1), TODAY)).toBe("Pagado");
    expect(stateLabel(entry("ingreso", 1, { status: "pendiente", entry_date: "2026-10-30" }), TODAY)).toBe("Por cobrar");
    expect(stateLabel(entry("gasto", 1, { status: "pendiente", entry_date: "2026-10-30" }), TODAY)).toBe("Por pagar");
    expect(stateLabel(entry("gasto", 1, { status: "pendiente", entry_date: "2026-10-01" }), TODAY)).toBe("Por pagar (vencido)");
    expect(stateLabel(entry("ingreso", 1, { status: "pendiente", entry_date: "2026-10-01" }), TODAY)).toBe("Por cobrar (vencido)");
    expect(stateLabel(entry("gasto", 1, { voided_at: "x" }), TODAY)).toBe("Anulado");
  });
});

describe("resultado del período", () => {
  it("suma ingresos y gastos del ejemplo del plan", () => {
    const totals = computeTotals(planEntries(), resolvePeriod("este_mes", TODAY));
    expect(totals.ingresos).toBe(2_020_000);
    expect(totals.gastos).toBe(682_500);
    expect(totals.resultado).toBe(1_337_500);
    expect(totals.ingresosCount).toBe(2);
    expect(totals.gastosCount).toBe(2);
    expect(totals.margenPct).toBeCloseTo(66.2128, 3);
  });

  it("no cuenta aportes, reembolsos ni retiros como ingreso o gasto", () => {
    const entries = [
      ...planEntries(),
      entry("aporte", 5_000_000, { partner_id: "m" }),
      entry("reembolso", 682_500, { partner_id: "m", via_partner_id: "g" }),
      entry("distribucion", 668_750, { partner_id: "g", via_partner_id: "g" }),
    ];
    const totals = computeTotals(entries, ALL_TIME);
    expect(totals.ingresos).toBe(2_020_000);
    expect(totals.gastos).toBe(682_500);
  });

  it("ignora pendientes, anulados y lo que está fuera del período", () => {
    const entries = [
      entry("ingreso", 300_000),
      entry("ingreso", 999_999, { status: "pendiente" }),
      entry("gasto", 999_999, { voided_at: "2026-10-06T00:00:00Z" }),
      entry("gasto", 999_999, { entry_date: "2026-09-30" }),
      entry("gasto", 100_000),
    ];
    const totals = computeTotals(entries, resolvePeriod("este_mes", TODAY));
    expect(totals.ingresos).toBe(300_000);
    expect(totals.gastos).toBe(100_000);
    expect(totals.resultado).toBe(200_000);
  });

  it("sin ingresos no hay margen", () => {
    expect(computeTotals([entry("gasto", 100)], ALL_TIME).margenPct).toBeNull();
    expect(computeTotals([], ALL_TIME)).toMatchObject({ ingresos: 0, gastos: 0, resultado: 0 });
  });
});

describe("por cobrar y por pagar", () => {
  it("separa lo vencido de lo que todavía no venció", () => {
    const pending = computePending(
      [
        entry("ingreso", 300_000, { status: "pendiente", entry_date: "2026-10-30" }),
        entry("ingreso", 150_000, { status: "pendiente", entry_date: "2026-10-10" }),
        entry("gasto", 100_000, { status: "pendiente", entry_date: "2026-10-20" }),
        entry("gasto", 50_000, { status: "pendiente", entry_date: "2026-11-05" }),
        entry("gasto", 999_999, { status: "pendiente", entry_date: "2026-10-01", voided_at: "x" }),
        entry("gasto", 999_999),
      ],
      TODAY
    );
    expect(pending).toEqual({
      porCobrar: 450_000,
      porCobrarCount: 2,
      porCobrarVencido: 150_000,
      porCobrarVencidoCount: 1,
      porPagar: 150_000,
      porPagarCount: 2,
      porPagarVencido: 100_000,
      porPagarVencidoCount: 1,
    });
  });

  it("lo que vence hoy todavía no está vencido", () => {
    const pending = computePending([entry("gasto", 10, { status: "pendiente", entry_date: TODAY })], TODAY);
    expect(pending.porPagar).toBe(10);
    expect(pending.porPagarVencido).toBe(0);
  });

  it("lista lo vencido y lo que vence en los próximos 30 días, ordenado por fecha", () => {
    const entries = [
      entry("gasto", 1, { status: "pendiente", entry_date: "2026-11-21", description: "borde" }),
      entry("gasto", 1, { status: "pendiente", entry_date: "2026-11-22", description: "fuera" }),
      entry("ingreso", 1, { status: "pendiente", entry_date: "2026-10-22", description: "hoy" }),
      entry("gasto", 1, { status: "pendiente", entry_date: "2026-10-20", description: "vencido" }),
      entry("gasto", 1, { status: "pendiente", entry_date: "2026-10-25", voided_at: "x", description: "anulado" }),
      entry("gasto", 1, { description: "pagado" }),
    ];
    const dues = upcomingDues(entries, TODAY, 30);
    expect(dues.overdue.map((e) => e.description)).toEqual(["vencido"]);
    expect(dues.upcoming.map((e) => e.description)).toEqual(["hoy", "borde"]);
  });
});

describe("desgloses y serie mensual", () => {
  it("agrupa los gastos por categoría, de mayor a menor, con su porcentaje", () => {
    const entries = [
      entry("gasto", 500_000, { category_id: "cg2" }),
      entry("gasto", 182_500, { category_id: "cg1" }),
      entry("gasto", 17_500, { category_id: "cg1" }),
      entry("gasto", 100_000, { category_id: null }),
      entry("gasto", 999_999, { category_id: "cg1", status: "pendiente" }),
      entry("gasto", 999_999, { category_id: "cg1", entry_date: "2026-09-30" }),
      entry("ingreso", 999_999, { category_id: "ci1" }),
    ];
    const slices = breakdownByCategory(entries, "gasto", resolvePeriod("este_mes", TODAY), CATS);
    expect(slices.map((s) => [s.name, s.total, s.count])).toEqual([
      ["Publicidad (Meta Ads)", 500_000, 1],
      ["Base de datos (Supabase)", 200_000, 2],
      ["Sin categoría", 100_000, 1],
    ]);
    expect(slices[0].pct).toBeCloseTo(62.5, 5);
    expect(slices.reduce((sum, s) => sum + s.pct, 0)).toBeCloseTo(100, 5);
  });

  it("arma los últimos meses con ingresos, gastos y resultado", () => {
    const entries = [
      entry("ingreso", 100, { entry_date: "2026-08-15" }),
      entry("gasto", 40, { entry_date: "2026-09-02" }),
      entry("ingreso", 200, { entry_date: "2026-10-03" }),
      entry("gasto", 50, { entry_date: "2026-10-20" }),
      entry("ingreso", 999, { entry_date: "2026-10-04", status: "pendiente" }),
      entry("gasto", 999, { entry_date: "2026-10-04", voided_at: "x" }),
      entry("aporte", 999, { entry_date: "2026-10-04" }),
      entry("ingreso", 999, { entry_date: "2026-07-31" }),
    ];
    expect(monthlySeries(entries, TODAY, 3)).toEqual([
      { key: "2026-08", label: "ago 26", ingresos: 100, gastos: 0, resultado: 100 },
      { key: "2026-09", label: "sep 26", ingresos: 0, gastos: 40, resultado: -40 },
      { key: "2026-10", label: "oct 26", ingresos: 200, gastos: 50, resultado: 150 },
    ]);
    expect(monthlySeries([], TODAY, 12)).toHaveLength(12);
  });
});

describe("caja y cuentas de los socios", () => {
  it("el ejemplo del plan: caja en cero, cuentas y utilidad por socio", () => {
    const snap = computeSnapshot(planEntries(), [GONZALO, MATIAS]);
    expect(snap.caja).toBe(0);
    expect(snap.resultadoAcumulado).toBe(1_337_500);
    expect(snap.totalDistribuido).toBe(0);
    expect(snap.sumaCuentas).toBe(-1_337_500);
    expect(snap.diferencia).toBe(0);
    expect(snap.sharesTotal).toBe(100);

    const g = byId(snap, "g");
    const m = byId(snap, "m");
    expect(g.cobrado).toBe(2_020_000);
    expect(g.cuenta).toBe(-2_020_000);
    expect(m.adelantos).toBe(682_500);
    expect(m.cuenta).toBe(682_500);
    expect(g.utilidad).toBe(668_750);
    expect(m.utilidad).toBe(668_750);
    expect(g.pendienteRetiro).toBe(668_750);
    expect(g.saldoTotal).toBe(-1_351_250);
    expect(m.saldoTotal).toBe(1_351_250);
    expect(g.saldoTotal + m.saldoTotal).toBe(snap.caja);
  });

  it("sugiere una sola transferencia de Gonzalo a Matías", () => {
    const snap = computeSnapshot(planEntries(), [GONZALO, MATIAS]);
    expect(suggestSettlements(snap.partners)).toEqual([{ fromId: "g", toId: "m", amount: 1_351_250 }]);
  });

  it("saldar con un reembolso deja en cero la cuenta de quien adelantó", () => {
    const entries = [...planEntries(), entry("reembolso", 682_500, { entry_date: "2026-10-20", partner_id: "m", via_partner_id: "g" })];
    const snap = computeSnapshot(entries, [GONZALO, MATIAS]);
    expect(byId(snap, "m").cuenta).toBe(0);
    expect(byId(snap, "g").cuenta).toBe(-1_337_500);
    expect(snap.caja).toBe(0);
    expect(snap.diferencia).toBe(0);
  });

  it("con los retiros de utilidad todo queda en cero", () => {
    const entries = [
      ...planEntries(),
      entry("reembolso", 682_500, { partner_id: "m", via_partner_id: "g" }),
      entry("distribucion", 668_750, { partner_id: "m", via_partner_id: "g" }),
      entry("distribucion", 668_750, { partner_id: "g", via_partner_id: "g" }),
    ];
    const snap = computeSnapshot(entries, [GONZALO, MATIAS]);
    expect(snap.caja).toBe(0);
    expect(snap.totalDistribuido).toBe(1_337_500);
    expect(snap.sumaCuentas).toBe(0);
    expect(snap.diferencia).toBe(0);
    for (const p of snap.partners) {
      expect(p.cuenta).toBe(0);
      expect(p.pendienteRetiro).toBe(0);
      expect(p.saldoTotal).toBe(0);
    }
    expect(suggestSettlements(snap.partners)).toEqual([]);
  });

  it("aportes, cobros a la cuenta de F7, reembolsos y retiros por caja cuadran con la identidad", () => {
    const entries = [
      entry("aporte", 5_000_000, { partner_id: "m" }),
      entry("ingreso", 2_000_000),
      entry("gasto", 1_000_000),
      entry("reembolso", 1_000_000, { partner_id: "m" }),
      entry("distribucion", 300_000, { partner_id: "g" }),
    ];
    const snap = computeSnapshot(entries, [GONZALO, MATIAS]);
    expect(snap.caja).toBe(4_700_000);
    expect(snap.resultadoAcumulado).toBe(1_000_000);
    expect(snap.totalDistribuido).toBe(300_000);
    expect(byId(snap, "m").cuenta).toBe(4_000_000);
    expect(byId(snap, "g").cuenta).toBe(0);
    expect(byId(snap, "g").retirado).toBe(300_000);
    expect(byId(snap, "g").pendienteRetiro).toBe(200_000);
    expect(snap.diferencia).toBe(0);
  });

  it("los pendientes y los anulados no mueven la caja ni las cuentas", () => {
    const base = computeSnapshot(planEntries(), [GONZALO, MATIAS]);
    const noisy = computeSnapshot(
      [
        ...planEntries(),
        entry("aporte", 9_999_999, { partner_id: "m", voided_at: "2026-10-06T00:00:00Z" }),
        entry("gasto", 8_888_888, { status: "pendiente", partner_id: "m" }),
        entry("ingreso", 7_777_777, { status: "pendiente" }),
      ],
      [GONZALO, MATIAS]
    );
    expect(noisy).toEqual(base);
  });

  it("si hay pérdida, la utilidad de cada socio es negativa", () => {
    const snap = computeSnapshot([entry("ingreso", 100_000), entry("gasto", 300_000)], [GONZALO, MATIAS]);
    expect(snap.resultadoAcumulado).toBe(-200_000);
    expect(byId(snap, "g").utilidad).toBe(-100_000);
    expect(snap.diferencia).toBe(0);
  });

  it("redondea la utilidad por socio y la identidad sigue en cero", () => {
    const partners: F7Partner[] = [
      { ...GONZALO, id: "a", share_pct: 33.33 },
      { ...GONZALO, id: "b", share_pct: 33.33 },
      { ...GONZALO, id: "c", share_pct: 33.34 },
    ];
    const snap = computeSnapshot([entry("ingreso", 1_000_001)], partners);
    expect(byId(snap, "a").utilidad).toBe(333_300);
    expect(byId(snap, "b").utilidad).toBe(333_300);
    expect(byId(snap, "c").utilidad).toBe(333_400);
    expect(snap.sharesTotal).toBe(100);
    expect(snap.diferencia).toBe(0);
  });

  it("avisa cuando los porcentajes de los socios activos no suman 100", () => {
    expect(sharesWarning([GONZALO, MATIAS])).toBeNull();
    expect(sharesWarning([])).toBeNull();
    expect(sharesWarning([GONZALO, { ...MATIAS, share_pct: 40 }])).toContain("90 %");
    expect(sharesWarning([GONZALO, { ...MATIAS, share_pct: 50, active: false }])).toContain("50 %");
    expect(sharesWarning([{ ...GONZALO, share_pct: 100 }, { ...MATIAS, share_pct: 50, active: false }])).toBeNull();
  });

  it("reparte las transferencias entre varios socios", () => {
    const transfers = suggestSettlements([
      { partnerId: "A", saldoTotal: -300 },
      { partnerId: "B", saldoTotal: -100 },
      { partnerId: "C", saldoTotal: 250 },
      { partnerId: "D", saldoTotal: 150 },
    ]);
    expect(transfers).toEqual([
      { fromId: "A", toId: "C", amount: 250 },
      { fromId: "A", toId: "D", amount: 50 },
      { fromId: "B", toId: "D", amount: 100 },
    ]);
  });

  it("si no cuadra, solo transfiere lo que puede compensar", () => {
    expect(
      suggestSettlements([
        { partnerId: "g", saldoTotal: -500 },
        { partnerId: "m", saldoTotal: 200 },
      ])
    ).toEqual([{ fromId: "g", toId: "m", amount: 200 }]);
    expect(suggestSettlements([])).toEqual([]);
  });

  it("una liquidación se anota en dos movimientos y deja a los dos socios en cero", () => {
    const partners = [GONZALO, MATIAS];
    const snap = computeSnapshot(planEntries(), partners);
    const [transfer] = suggestSettlements(snap.partners);
    expect(planSettlement(transfer, snap.partners)).toEqual({ reembolso: 682_500, retiro: 668_750 });

    const drafts = settlementDrafts(transfer, snap.partners, TODAY);
    expect(drafts.map((d) => [d.kind, d.partner_id, d.via_partner_id, d.amount, d.entry_date])).toEqual([
      ["reembolso", "m", "g", "682500", TODAY],
      ["distribucion", "m", "g", "668750", TODAY],
    ]);
    expect(drafts[0].description).toBe("Reembolso a Matías (pagó Gonzalo)");
    expect(drafts[1].description).toBe("Retiro de utilidad de Matías (pagó Gonzalo)");

    const created = drafts.map((d) => {
      const { errors, payload } = validateEntryDraft(d, { today: TODAY, categories: CATS, partners });
      expect(errors).toEqual({});
      return entry(payload!.kind, payload!.amount, { partner_id: payload!.partner_id, via_partner_id: payload!.via_partner_id });
    });
    const after = computeSnapshot([...planEntries(), ...created], partners);
    expect(byId(after, "g").saldoTotal).toBe(0);
    expect(byId(after, "m").saldoTotal).toBe(0);
    expect(after.caja).toBe(0);
    expect(after.diferencia).toBe(0);
    expect(suggestSettlements(after.partners)).toEqual([]);
  });

  it("si quien recibe no tiene nada que se le deba, todo es retiro de utilidad", () => {
    expect(planSettlement({ fromId: "g", toId: "m", amount: 400 }, [{ partnerId: "m", cuenta: -50 }])).toEqual({ reembolso: 0, retiro: 400 });
    expect(planSettlement({ fromId: "g", toId: "m", amount: 400 }, [{ partnerId: "m", cuenta: 0 }])).toEqual({ reembolso: 0, retiro: 400 });
    expect(planSettlement({ fromId: "g", toId: "x", amount: 400 }, [{ partnerId: "m", cuenta: 900 }])).toEqual({ reembolso: 0, retiro: 400 });
  });

  it("si la transferencia es menor a lo que se le debe, es solo reembolso", () => {
    expect(planSettlement({ fromId: "g", toId: "m", amount: 250 }, [{ partnerId: "m", cuenta: 300 }])).toEqual({ reembolso: 250, retiro: 0 });
    expect(planSettlement({ fromId: "g", toId: "m", amount: 400 }, [{ partnerId: "m", cuenta: 300 }])).toEqual({ reembolso: 300, retiro: 100 });
  });

  it("nunca retira más utilidad de la que el socio tiene", () => {
    const partners = [GONZALO, MATIAS];
    const scenarios: F7Entry[][] = [
      planEntries(),
      [entry("aporte", 5_000_000, { partner_id: "m" }), entry("ingreso", 2_000_000, { partner_id: "g" }), entry("gasto", 3_000_000)],
      [entry("ingreso", 900_000, { partner_id: "g" }), entry("gasto", 100_000, { partner_id: "m" }), entry("aporte", 50_000, { partner_id: "m" })],
      [entry("ingreso", 1_000_001, { partner_id: "m" }), entry("gasto", 333_333, { partner_id: "g" })],
    ];
    for (const entries of scenarios) {
      const snap = computeSnapshot(entries, partners);
      for (const transfer of suggestSettlements(snap.partners)) {
        const plan = planSettlement(transfer, snap.partners);
        const receiver = byId(snap, transfer.toId);
        expect(plan.reembolso + plan.retiro).toBe(transfer.amount);
        expect(plan.reembolso).toBeGreaterThanOrEqual(0);
        expect(plan.retiro).toBeGreaterThanOrEqual(0);
        expect(plan.retiro).toBeLessThanOrEqual(Math.max(0, receiver.pendienteRetiro));

        const created = settlementDrafts(transfer, snap.partners, TODAY).map((d) => {
          const { payload } = validateEntryDraft(d, { today: TODAY, categories: CATS, partners });
          return entry(payload!.kind, payload!.amount, { partner_id: payload!.partner_id, via_partner_id: payload!.via_partner_id });
        });
        const after = computeSnapshot([...entries, ...created], partners);
        expect(byId(after, transfer.fromId).saldoTotal).toBe(byId(snap, transfer.fromId).saldoTotal + transfer.amount);
        expect(byId(after, transfer.toId).saldoTotal).toBe(byId(snap, transfer.toId).saldoTotal - transfer.amount);
        expect(after.diferencia).toBe(0);
      }
    }
  });

  it("con pérdida y plata puesta por un socio, la liquidación es solo un reembolso", () => {
    const entries = [
      entry("aporte", 5_000_000, { partner_id: "m" }),
      entry("ingreso", 2_000_000, { partner_id: "g" }),
      entry("gasto", 3_000_000),
    ];
    const snap = computeSnapshot(entries, [GONZALO, MATIAS]);
    expect(snap.caja).toBe(2_000_000);
    expect(byId(snap, "g").saldoTotal).toBe(-2_500_000);
    expect(byId(snap, "m").saldoTotal).toBe(4_500_000);
    const [transfer] = suggestSettlements(snap.partners);
    expect(transfer).toEqual({ fromId: "g", toId: "m", amount: 2_500_000 });
    expect(planSettlement(transfer, snap.partners)).toEqual({ reembolso: 2_500_000, retiro: 0 });
    expect(settlementDrafts(transfer, snap.partners, TODAY).map((d) => d.kind)).toEqual(["reembolso"]);
  });
});

describe("atajos de cada socio", () => {
  const snap = computeSnapshot(planEntries(), [GONZALO, MATIAS]);
  const ctx = { today: TODAY, categories: CATS, partners: [GONZALO, MATIAS] };

  it("aporte: arranca con el socio y la descripción, sin monto", () => {
    const d = shortcutDraft("aporte", byId(snap, "m"), TODAY);
    expect(d).toMatchObject({ kind: "aporte", partner_id: "m", description: "Aporte de Matías", amount: "", via_partner_id: "", entry_date: TODAY });
  });

  it("reembolso: sugiere lo que F7 le debe, sacado de la caja", () => {
    const d = shortcutDraft("reembolso", byId(snap, "m"), TODAY);
    expect(d).toMatchObject({ kind: "reembolso", partner_id: "m", amount: "682500", via_partner_id: "", description: "Reembolso a Matías" });
    expect(validateEntryDraft(d, ctx).errors).toEqual({});
  });

  it("reembolso: si F7 no le debe nada, no sugiere monto", () => {
    expect(shortcutDraft("reembolso", byId(snap, "g"), TODAY).amount).toBe("");
  });

  it("retiro: sugiere la utilidad pendiente; si tiene plata de F7 en su poder, sale de su bolsillo", () => {
    const g = shortcutDraft("distribucion", byId(snap, "g"), TODAY);
    expect(g).toMatchObject({ kind: "distribucion", partner_id: "g", amount: "668750", via_partner_id: "g" });
    expect(validateEntryDraft(g, ctx).errors).toEqual({});
    const m = shortcutDraft("distribucion", byId(snap, "m"), TODAY);
    expect(m).toMatchObject({ partner_id: "m", amount: "668750", via_partner_id: "" });
  });

  it("retiro: con pérdida o sin utilidad pendiente no sugiere monto", () => {
    expect(shortcutDraft("distribucion", { partnerId: "m", name: "Matías", cuenta: 0, pendienteRetiro: -100 }, TODAY).amount).toBe("");
    expect(shortcutDraft("distribucion", { partnerId: "m", name: "Matías", cuenta: 0, pendienteRetiro: 0 }, TODAY).amount).toBe("");
  });
});

describe("nombres y flujo de la plata", () => {
  it("nombra al socio o la caja", () => {
    expect(partnerName(LOOKUPS, "g")).toBe("Gonzalo");
    expect(partnerName(LOOKUPS, null)).toBe("Caja F7");
    expect(partnerName(LOOKUPS, "zzz")).toBe("Socio");
    expect(categoryName(LOOKUPS, "cg1")).toBe("Base de datos (Supabase)");
    expect(categoryName(LOOKUPS, null)).toBe("");
    expect(categoryName(LOOKUPS, "zzz")).toBe("Sin categoría");
  });

  it("explica de dónde a dónde se movió cada tipo de movimiento", () => {
    expect(flowLabel(entry("ingreso", 1, { partner_id: "g" }), LOOKUPS)).toBe("Cuenta de Gonzalo");
    expect(flowLabel(entry("ingreso", 1), LOOKUPS)).toBe("Caja F7");
    expect(flowLabel(entry("gasto", 1, { partner_id: "m" }), LOOKUPS)).toBe("Matías (adelantó)");
    expect(flowLabel(entry("gasto", 1), LOOKUPS)).toBe("Caja F7");
    expect(flowLabel(entry("aporte", 1, { partner_id: "m" }), LOOKUPS)).toBe("Matías → Caja F7");
    expect(flowLabel(entry("reembolso", 1, { partner_id: "m", via_partner_id: "g" }), LOOKUPS)).toBe("Gonzalo → Matías");
    expect(flowLabel(entry("reembolso", 1, { partner_id: "m" }), LOOKUPS)).toBe("Caja F7 → Matías");
    expect(flowLabel(entry("distribucion", 1, { partner_id: "g", via_partner_id: "g" }), LOOKUPS)).toBe(
      "Gonzalo (sale de su cuenta)"
    );
  });

  it("dice de dónde viene cada movimiento", () => {
    expect(sourceLabel({ receipt_id: "r", recurring_id: null })).toBe("Recibo");
    expect(sourceLabel({ receipt_id: null, recurring_id: "t" })).toBe("Gasto fijo");
    expect(sourceLabel({ receipt_id: null, recurring_id: null })).toBe("Manual");
  });
});

describe("filtros de movimientos", () => {
  const period = resolvePeriod("este_mes", TODAY);
  const list = [
    entry("ingreso", 300_000, { entry_date: "2026-10-04", description: "Instalación en Seven Store", category_id: "ci1", partner_id: "g" }),
    entry("gasto", 182_500, { entry_date: "2026-10-01", description: "Supabase", category_id: "cg1", partner_id: "m" }),
    entry("gasto", 50_000, { entry_date: "2026-10-30", status: "pendiente", description: "Dominio", category_id: "cg1" }),
    entry("gasto", 70_000, { entry_date: "2026-10-10", status: "pendiente", description: "Vercel", category_id: "cg1" }),
    entry("gasto", 99_000, {
      entry_date: "2026-10-12",
      description: "Cargado dos veces",
      category_id: "cg1",
      voided_at: "2026-10-13T00:00:00Z",
      void_reason: "Duplicado",
    }),
    entry("reembolso", 100_000, { entry_date: "2026-10-20", partner_id: "m", via_partner_id: "g", description: "Devolución" }),
    entry("ingreso", 10_000, { entry_date: "2026-09-15", description: "Septiembre", category_id: "ci1" }),
  ];
  const run = (patch: Partial<typeof DEFAULT_FILTERS>) =>
    filterEntries(list, { ...DEFAULT_FILTERS, ...patch }, period, TODAY, LOOKUPS).map((e) => e.description);

  it("por defecto muestra los movimientos del período sin los anulados, del más nuevo al más viejo", () => {
    expect(run({})).toEqual(["Dominio", "Devolución", "Vercel", "Instalación en Seven Store", "Supabase"]);
  });

  it("filtra por estado", () => {
    expect(run({ status: "pagado" })).toEqual(["Devolución", "Instalación en Seven Store", "Supabase"]);
    expect(run({ status: "pendiente" })).toEqual(["Dominio", "Vercel"]);
    expect(run({ status: "vencido" })).toEqual(["Vercel"]);
    expect(run({ status: "anulado" })).toEqual(["Cargado dos veces"]);
  });

  it("filtra por tipo, categoría y socio (también si es quien pagó)", () => {
    expect(run({ kind: "gasto" })).toEqual(["Dominio", "Vercel", "Supabase"]);
    expect(run({ categoryId: "ci1" })).toEqual(["Instalación en Seven Store"]);
    expect(run({ partnerId: "g" })).toEqual(["Devolución", "Instalación en Seven Store"]);
    expect(run({ partnerId: "m" })).toEqual(["Devolución", "Supabase"]);
  });

  it("busca sin distinguir tildes ni mayúsculas, también en categoría, socio y monto", () => {
    expect(run({ query: "INSTALACION" })).toEqual(["Instalación en Seven Store"]);
    expect(run({ query: "supabase" })).toEqual(["Dominio", "Vercel", "Supabase"]);
    expect(run({ query: "matias" })).toEqual(["Devolución", "Supabase"]);
    expect(run({ query: "100000" })).toEqual(["Devolución"]);
    expect(run({ query: "nada que ver" })).toEqual([]);
  });

  it("cuenta cuántos hay en cada estado dentro del período", () => {
    expect(countByStatus(list, DEFAULT_FILTERS, period, TODAY, LOOKUPS)).toEqual({
      activos: 5,
      pagado: 3,
      pendiente: 2,
      vencido: 1,
      anulado: 1,
    });
  });

  it("los contadores de estado respetan tipo, categoría, socio y búsqueda, pero no el estado elegido", () => {
    const gastos = countByStatus(list, { ...DEFAULT_FILTERS, kind: "gasto" }, period, TODAY, LOOKUPS);
    expect(gastos).toEqual({ activos: 3, pagado: 1, pendiente: 2, vencido: 1, anulado: 1 });
    const elegido = countByStatus(list, { ...DEFAULT_FILTERS, kind: "gasto", status: "pendiente" }, period, TODAY, LOOKUPS);
    expect(elegido).toEqual(gastos);
    expect(countByStatus(list, { ...DEFAULT_FILTERS, query: "nada que ver" }, period, TODAY, LOOKUPS)).toEqual({
      activos: 0,
      pagado: 0,
      pendiente: 0,
      vencido: 0,
      anulado: 0,
    });
  });
});

describe("alta y edición de movimientos", () => {
  const ctx: EntryValidationContext = {
    today: TODAY,
    categories: [
      { id: "cg", kind: "gasto" },
      { id: "ci", kind: "ingreso" },
    ],
    partners: [
      { id: "g", active: true },
      { id: "m", active: true },
      { id: "x", active: false },
    ],
  };

  it("arma el movimiento de un gasto en dólares", () => {
    const { errors, payload } = validateEntryDraft(
      {
        ...emptyDraft("gasto", TODAY),
        description: "  Supabase  ",
        category_id: "cg",
        amount: "25",
        currency: "USD",
        fx_rate: "7.300",
        partner_id: "m",
        payment_method: " Tarjeta ",
      },
      ctx
    );
    expect(errors).toEqual({});
    expect(payload).toEqual({
      kind: "gasto",
      entry_date: TODAY,
      description: "Supabase",
      category_id: "cg",
      amount: 25,
      currency: "USD",
      fx_rate: 7300,
      status: "pagado",
      partner_id: "m",
      via_partner_id: null,
      payment_method: "Tarjeta",
      notes: null,
    });
  });

  it("un ingreso en guaraníes acepta puntos de miles y no lleva tipo de cambio", () => {
    const { payload } = validateEntryDraft(
      { ...emptyDraft("ingreso", TODAY), description: "Plan Pro", category_id: "ci", amount: "1.120.000", fx_rate: "7300" },
      ctx
    );
    expect(payload?.amount).toBe(1_120_000);
    expect(payload?.fx_rate).toBeNull();
    expect(payload?.partner_id).toBeNull();
  });

  it("pide descripción, monto y categoría en un gasto vacío", () => {
    const { errors, payload } = validateEntryDraft(emptyDraft("gasto", TODAY), ctx);
    expect(payload).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(["amount", "category_id", "description"]);
  });

  it("pide el socio en aportes, reembolsos y retiros", () => {
    for (const kind of ["aporte", "reembolso", "distribucion"] as const) {
      const { errors } = validateEntryDraft({ ...emptyDraft(kind, TODAY), description: "x", amount: "1000" }, ctx);
      expect(Object.keys(errors)).toEqual(["partner_id"]);
    }
  });

  it("un movimiento pagado no puede tener fecha futura, uno pendiente sí", () => {
    const draft = { ...emptyDraft("gasto", TODAY), description: "Dominio", category_id: "cg", amount: "50000", entry_date: "2026-10-23" };
    expect(validateEntryDraft(draft, ctx).errors.entry_date).toContain("pendiente");
    expect(validateEntryDraft({ ...draft, status: "pendiente" }, ctx).payload?.status).toBe("pendiente");
    const aporte = { ...emptyDraft("aporte", TODAY), description: "x", amount: "1", partner_id: "g", entry_date: "2026-10-23" };
    expect(validateEntryDraft(aporte, ctx).errors.entry_date).toBe("La fecha no puede ser futura.");
  });

  it("rechaza fechas inválidas o anteriores a 2020", () => {
    const base = { ...emptyDraft("gasto", TODAY), description: "x", category_id: "cg", amount: "1" };
    expect(validateEntryDraft({ ...base, entry_date: "2026-02-30" }, ctx).errors.entry_date).toBeDefined();
    expect(validateEntryDraft({ ...base, entry_date: "2019-12-31" }, ctx).errors.entry_date).toBeDefined();
    expect(validateEntryDraft({ ...base, entry_date: "2020-01-01" }, ctx).errors.entry_date).toBeUndefined();
  });

  it("en dólares exige un tipo de cambio razonable", () => {
    const base = { ...emptyDraft("gasto", TODAY), description: "x", category_id: "cg", amount: "25", currency: "USD" as const };
    expect(validateEntryDraft(base, ctx).errors.fx_rate).toBeDefined();
    expect(validateEntryDraft({ ...base, fx_rate: "5" }, ctx).errors.fx_rate).toContain("no parece");
    expect(validateEntryDraft({ ...base, fx_rate: "7300" }, ctx).errors.fx_rate).toBeUndefined();
  });

  it("valida el monto según la moneda", () => {
    const base = { ...emptyDraft("gasto", TODAY), description: "x", category_id: "cg" };
    expect(validateEntryDraft({ ...base, amount: "0" }, ctx).errors.amount).toBeDefined();
    expect(validateEntryDraft({ ...base, amount: "12,5" }, ctx).errors.amount).toBeDefined();
    expect(validateEntryDraft({ ...base, amount: "1000000000000" }, ctx).errors.amount).toContain("demasiado grande");
    expect(validateEntryDraft({ ...base, amount: "1.500", currency: "USD", fx_rate: "7300" }, ctx).errors.amount).toBeDefined();
    expect(validateEntryDraft({ ...base, amount: "22,50", currency: "USD", fx_rate: "7300" }, ctx).payload?.amount).toBe(22.5);
  });

  it("la categoría tiene que ser del mismo tipo", () => {
    const base = { ...emptyDraft("ingreso", TODAY), description: "x", amount: "1000" };
    expect(validateEntryDraft({ ...base, category_id: "cg" }, ctx).errors.category_id).toContain("no corresponde");
    expect(validateEntryDraft({ ...base, category_id: "zzz" }, ctx).errors.category_id).toBeDefined();
    expect(validateEntryDraft({ ...base, category_id: "ci" }, ctx).errors.category_id).toBeUndefined();
  });

  it("aporte, reembolso y retiro siempre quedan pagados y sin categoría", () => {
    const { payload } = validateEntryDraft(
      { ...emptyDraft("aporte", TODAY), description: "Capital inicial", amount: "5000000", partner_id: "m", status: "pendiente", category_id: "cg" },
      ctx
    );
    expect(payload?.status).toBe("pagado");
    expect(payload?.category_id).toBeNull();
  });

  it("un reembolso no puede salir del bolsillo del mismo socio; sin 'por medio de' sale de la caja", () => {
    const base = { ...emptyDraft("reembolso", TODAY), description: "Devolución", amount: "682500", partner_id: "m" };
    expect(validateEntryDraft({ ...base, via_partner_id: "m" }, ctx).errors.via_partner_id).toContain("propio bolsillo");
    expect(validateEntryDraft({ ...base, via_partner_id: "g" }, ctx).payload?.via_partner_id).toBe("g");
    expect(validateEntryDraft(base, ctx).payload?.via_partner_id).toBeNull();
    const retiro = { ...emptyDraft("distribucion", TODAY), description: "Retiro", amount: "668750", partner_id: "g", via_partner_id: "g" };
    expect(validateEntryDraft(retiro, ctx).payload?.via_partner_id).toBe("g");
  });

  it("no deja elegir un socio inactivo salvo que ya estuviera en el movimiento", () => {
    const draft = { ...emptyDraft("gasto", TODAY), description: "x", category_id: "cg", amount: "1", partner_id: "x" };
    expect(validateEntryDraft(draft, ctx).errors.partner_id).toContain("inactivo");
    expect(validateEntryDraft(draft, { ...ctx, keepPartnerIds: ["x"] }).payload?.partner_id).toBe("x");
  });

  it("limita el largo de la descripción, la forma de pago y las notas", () => {
    const base = { ...emptyDraft("gasto", TODAY), description: "x", category_id: "cg", amount: "1" };
    expect(validateEntryDraft({ ...base, description: "a".repeat(201) }, ctx).errors.description).toBeDefined();
    expect(validateEntryDraft({ ...base, payment_method: "a".repeat(81) }, ctx).errors.payment_method).toBeDefined();
    expect(validateEntryDraft({ ...base, notes: "a".repeat(1001) }, ctx).errors.notes).toBeDefined();
    expect(validateEntryDraft({ ...base, description: "a".repeat(200) }, ctx).errors.description).toBeUndefined();
  });

  it("vuelve a armar el borrador de un movimiento existente sin perder datos", () => {
    const original = entry("gasto", 182_500, {
      entry_date: "2026-10-01",
      description: "Supabase",
      category_id: "cg",
      amount: 25.5,
      currency: "USD",
      fx_rate: 7300,
      partner_id: "m",
      payment_method: "Tarjeta",
      notes: "plan Pro",
    });
    const draft = draftFromEntry(original);
    expect(draft.amount).toBe("25,5");
    expect(draft.fx_rate).toBe("7300");
    const { payload } = validateEntryDraft(draft, ctx);
    expect(payload).toMatchObject({
      kind: "gasto",
      entry_date: "2026-10-01",
      description: "Supabase",
      category_id: "cg",
      amount: 25.5,
      currency: "USD",
      fx_rate: 7300,
      partner_id: "m",
      payment_method: "Tarjeta",
      notes: "plan Pro",
    });
  });
});

describe("gastos fijos", () => {
  // Valores sacados de f7_recurring_occurrences en una base PostgreSQL real.
  it("mensual: el día 31 cae el último día de cada mes", () => {
    expect(recurringOccurrences("mensual", "2026-01-31", null, "2026-06-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
    ]);
    expect(recurringOccurrences("mensual", "2026-12-31", null, "2027-03-31")).toEqual([
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("mensual: respeta el día, el límite y la fecha de fin", () => {
    expect(recurringOccurrences("mensual", "2026-01-15", null, "2026-04-20")).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
    expect(recurringOccurrences("mensual", "2026-03-10", "2026-05-10", "2026-12-31")).toEqual([
      "2026-03-10",
      "2026-04-10",
      "2026-05-10",
    ]);
    expect(recurringOccurrences("mensual", "2026-10-22", null, "2026-11-01")).toEqual(["2026-10-22"]);
    expect(recurringOccurrences("mensual", "2026-10-22", null, "2026-10-21")).toEqual([]);
  });

  it("anual: el 29 de febrero pasa al 28 los años sin bisiesto", () => {
    expect(recurringOccurrences("anual", "2024-02-29", null, "2028-12-31")).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
    expect(recurringOccurrences("anual", "2026-10-22", null, "2029-10-30")).toEqual([
      "2026-10-22",
      "2027-10-22",
      "2028-10-22",
      "2029-10-22",
    ]);
  });

  it("semanal: cada 7 días hasta el límite o el fin", () => {
    expect(recurringOccurrences("semanal", "2026-10-05", null, "2026-11-08")).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
      "2026-11-02",
    ]);
    expect(recurringOccurrences("semanal", "2026-10-05", "2026-10-19", "2026-12-31")).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
    ]);
  });

  it("nunca genera más de 600 vencimientos", () => {
    const weekly = recurringOccurrences("semanal", "2020-01-01", null, "2060-01-01");
    expect(weekly).toHaveLength(600);
    expect(weekly[599]).toBe("2031-06-25");
    const monthly = recurringOccurrences("mensual", "2020-01-01", null, "2090-01-01");
    expect(monthly).toHaveLength(600);
    expect(monthly[599]).toBe("2069-12-01");
  });

  it("calcula el próximo vencimiento, contando el de hoy", () => {
    const monthly = { frequency: "mensual" as const, start_date: "2026-01-31", end_date: null, active: true };
    expect(nextDue(monthly, TODAY)).toBe("2026-10-31");
    expect(nextDue({ ...monthly, active: false }, TODAY)).toBeNull();
    expect(nextDue({ ...monthly, end_date: "2026-09-30" }, TODAY)).toBeNull();
    expect(nextDue({ frequency: "semanal", start_date: "2026-10-05", end_date: null, active: true }, TODAY)).toBe("2026-10-26");
    expect(nextDue({ frequency: "anual", start_date: TODAY, end_date: null, active: true }, TODAY)).toBe(TODAY);
  });

  it("cuenta cuántos vencimientos ya pasados generaría una plantilla nueva", () => {
    const t = { frequency: "mensual" as const, end_date: null };
    expect(pastDueCount({ ...t, start_date: "2026-08-15" }, TODAY)).toBe(3);
    expect(pastDueCount({ ...t, start_date: TODAY }, TODAY)).toBe(0);
    expect(pastDueCount({ ...t, start_date: "2026-12-01" }, TODAY)).toBe(0);
  });

  it("detecta los vencimientos que todavía no tienen movimiento, hasta 10 días adelante", () => {
    const t = { id: "t1", frequency: "mensual" as const, start_date: "2026-07-31", end_date: null };
    const generated = [
      { recurring_id: "t1", recurring_due: "2026-07-31" },
      { recurring_id: "t1", recurring_due: "2026-08-31" },
      { recurring_id: "otra", recurring_due: "2026-09-30" },
      { recurring_id: null, recurring_due: null },
    ];
    // Jul y ago ya existen; faltan sep y oct (el 31 de octubre está a 9 días de hoy, así que entra).
    expect(missingDues(t, generated, TODAY)).toEqual(["2026-09-30", "2026-10-31"]);
    expect(missingDues(t, [], "2026-07-20")).toEqual([]);
    expect(missingDues(t, [], "2026-07-21")).toEqual(["2026-07-31"]);
    expect(missingDues({ ...t, end_date: "2026-08-31" }, generated, TODAY)).toEqual([]);
    expect(GENERATE_AHEAD_DAYS).toBe(10);
  });

  it("pasa cada frecuencia a su equivalente mensual", () => {
    expect(monthlyEquivalent(100_000, "mensual")).toBe(100_000);
    expect(monthlyEquivalent(1_200_000, "anual")).toBe(100_000);
    expect(monthlyEquivalent(100_000, "semanal")).toBe(433_333);
  });

  it("suma el costo fijo mensual de las plantillas activas, en guaraníes", () => {
    const base = {
      category_id: "cg1",
      start_date: "2026-01-01",
      end_date: null,
      default_partner_id: null,
      payment_method: null,
      notes: null,
      created_at: "2026-10-01T00:00:00Z",
    };
    const templates: F7Recurring[] = [
      { ...base, id: "t1", name: "Supabase", amount: 25, currency: "USD", fx_rate: 7300, frequency: "mensual", active: true },
      { ...base, id: "t2", name: "Dominio", amount: 150_000, currency: "PYG", fx_rate: null, frequency: "anual", active: true },
      { ...base, id: "t3", name: "Pausado", amount: 999_999, currency: "PYG", fx_rate: null, frequency: "mensual", active: false },
    ];
    expect(monthlyFixedCost(templates, "2026-10-22")).toBe(195_000);
  });

  it("no cuenta los gastos fijos activos que ya terminaron, pero sí el que termina hoy o más adelante", () => {
    const base = {
      category_id: "cg1",
      start_date: "2026-01-01",
      default_partner_id: null,
      payment_method: null,
      notes: null,
      created_at: "2026-10-01T00:00:00Z",
      amount: 100_000,
      currency: "PYG" as const,
      fx_rate: null,
      frequency: "mensual" as const,
      active: true,
    };
    const templates: F7Recurring[] = [
      { ...base, id: "t1", name: "Sin fin", end_date: null },
      { ...base, id: "t2", name: "Termina hoy", end_date: "2026-10-22" },
      { ...base, id: "t3", name: "Termina en un mes", end_date: "2026-11-22" },
      { ...base, id: "t4", name: "Terminó ayer", end_date: "2026-10-21" },
    ];
    expect(monthlyFixedCost(templates, "2026-10-22")).toBe(300_000);
    expect(monthlyFixedCost(templates, "2026-10-23")).toBe(200_000);
  });

  const ctx = {
    categories: [
      { id: "cg", kind: "gasto" as const },
      { id: "ci", kind: "ingreso" as const },
    ],
    partners: [
      { id: "m", active: true },
      { id: "x", active: false },
    ],
  };
  const valid = {
    ...emptyRecurringDraft("2026-10-01"),
    name: " Supabase ",
    category_id: "cg",
    amount: "25",
    currency: "USD" as const,
    fx_rate: "7300",
    default_partner_id: "m",
  };

  it("valida la plantilla de un gasto fijo", () => {
    const { errors, payload } = validateRecurringDraft(valid, ctx);
    expect(errors).toEqual({});
    expect(payload).toEqual({
      name: "Supabase",
      category_id: "cg",
      amount: 25,
      currency: "USD",
      fx_rate: 7300,
      frequency: "mensual",
      start_date: "2026-10-01",
      end_date: null,
      default_partner_id: "m",
      payment_method: null,
      notes: null,
    });
  });

  it("rechaza plantillas incompletas o incoherentes", () => {
    expect(validateRecurringDraft({ ...valid, name: " " }, ctx).errors.name).toBeDefined();
    expect(validateRecurringDraft({ ...valid, category_id: "ci" }, ctx).errors.category_id).toContain("gasto");
    expect(validateRecurringDraft({ ...valid, category_id: "" }, ctx).errors.category_id).toBeDefined();
    expect(validateRecurringDraft({ ...valid, fx_rate: "" }, ctx).errors.fx_rate).toBeDefined();
    expect(validateRecurringDraft({ ...valid, amount: "0" }, ctx).errors.amount).toBeDefined();
    expect(validateRecurringDraft({ ...valid, end_date: "2026-09-30" }, ctx).errors.end_date).toContain("anterior");
    expect(validateRecurringDraft({ ...valid, start_date: "2019-01-01" }, ctx).errors.start_date).toBeDefined();
    expect(validateRecurringDraft({ ...valid, default_partner_id: "x" }, ctx).errors.default_partner_id).toContain("inactivo");
    expect(validateRecurringDraft({ ...valid, default_partner_id: "x" }, { ...ctx, keepPartnerIds: ["x"] }).payload).not.toBeNull();
  });

  it("vuelve a armar el borrador de una plantilla existente", () => {
    const template = normalizeRecurring({
      id: "t1",
      name: "Meta Ads",
      category_id: "cg",
      amount: "500000.00",
      currency: "PYG",
      fx_rate: null,
      frequency: "semanal",
      start_date: "2026-10-05",
      end_date: "2026-12-31",
      default_partner_id: "m",
      payment_method: "Tarjeta",
      notes: null,
      active: true,
      created_at: "2026-10-01T00:00:00Z",
    });
    const { payload } = validateRecurringDraft(recurringDraftFrom(template), ctx);
    expect(payload).toMatchObject({
      name: "Meta Ads",
      amount: 500_000,
      frequency: "semanal",
      end_date: "2026-12-31",
      default_partner_id: "m",
      payment_method: "Tarjeta",
    });
  });
});

describe("socios y categorías", () => {
  const existing = [
    { id: "g", name: "Gonzalo" },
    { id: "m", name: "Matías" },
  ];

  it("valida un socio nuevo", () => {
    const { errors, payload } = validatePartnerDraft({ name: " Lucía ", share_pct: "33,33", active: true, notes: "" }, existing, null);
    expect(errors).toEqual({});
    expect(payload).toEqual({ name: "Lucía", share_pct: 33.33, active: true, notes: null });
  });

  it("rechaza nombres repetidos sin importar tildes o mayúsculas, salvo el propio", () => {
    const draft = { name: "matias", share_pct: "50", active: true, notes: "" };
    expect(validatePartnerDraft(draft, existing, null).errors.name).toContain("Ya hay");
    expect(validatePartnerDraft(draft, existing, "m").errors.name).toBeUndefined();
  });

  it("valida nombre y porcentaje", () => {
    expect(validatePartnerDraft({ name: "", share_pct: "50", active: true, notes: "" }, existing, null).errors.name).toBeDefined();
    expect(validatePartnerDraft({ name: "A".repeat(81), share_pct: "50", active: true, notes: "" }, existing, null).errors.name).toBeDefined();
    expect(validatePartnerDraft({ name: "Ana", share_pct: "101", active: true, notes: "" }, existing, null).errors.share_pct).toBeDefined();
    expect(validatePartnerDraft({ name: "Ana", share_pct: "abc", active: true, notes: "" }, existing, null).errors.share_pct).toBeDefined();
    expect(validatePartnerDraft({ name: "Ana", share_pct: "0", active: true, notes: "" }, existing, null).payload?.share_pct).toBe(0);
    expect(validatePartnerDraft({ name: "Ana", share_pct: "100", active: true, notes: "" }, existing, null).payload?.share_pct).toBe(100);
  });

  it("valida el nombre de una categoría dentro de su tipo", () => {
    const cats = [{ kind: "gasto" as const, name: "Dominio" }];
    expect(validateCategoryName("  Hosting  ", "gasto", cats)).toEqual({ ok: true, name: "Hosting" });
    expect(validateCategoryName("dominio", "gasto", cats).ok).toBe(false);
    expect(validateCategoryName("dominio", "ingreso", cats).ok).toBe(true);
    expect(validateCategoryName("   ", "gasto", cats).ok).toBe(false);
    expect(validateCategoryName("a".repeat(61), "gasto", cats).ok).toBe(false);
  });
});

describe("recibos de suscripción", () => {
  const receipt = (extra: Partial<ReceiptLite> = {}): ReceiptLite => ({
    id: "r1",
    receipt_number: "F7-0001",
    customer_name: "Servi Smart",
    payment_date: "2026-10-03",
    amount: 1_120_000,
    currency: "PYG",
    payment_method: "Transferencia bancaria",
    description: null,
    voided_at: null,
    ...extra,
  });

  it("lista los recibos vigentes sin ingreso registrado, el más nuevo primero", () => {
    const receipts = [
      receipt({ id: "r1", receipt_number: "F7-0001", payment_date: "2026-10-03" }),
      receipt({ id: "r2", receipt_number: "F7-0002", payment_date: "2026-10-10" }),
      receipt({ id: "r3", receipt_number: "F7-0003", payment_date: "2026-10-11", voided_at: "x" }),
      receipt({ id: "r4", receipt_number: "F7-0004", payment_date: "2026-10-10" }),
    ];
    const entries = [
      entry("ingreso", 1, { receipt_id: "r2" }),
      entry("ingreso", 1, { receipt_id: "r4", voided_at: "x" }),
    ];
    expect(unregisteredReceipts(receipts, entries).map((r) => r.id)).toEqual(["r4", "r1"]);
  });

  it("encuentra ingresos manuales que probablemente son el mismo recibo", () => {
    const entries = [
      entry("ingreso", 1_120_000, { entry_date: "2026-10-03", description: "igual" }),
      entry("ingreso", 1_120_000, { entry_date: "2026-10-04", description: "otro día" }),
      entry("ingreso", 1_120_000, { entry_date: "2026-10-03", receipt_id: "r9", description: "ya vinculado" }),
      entry("ingreso", 1_120_000, { entry_date: "2026-10-03", voided_at: "x", description: "anulado" }),
      entry("ingreso", 1_120_000, { entry_date: "2026-10-03", currency: "USD", description: "dólares" }),
      entry("gasto", 1_120_000, { entry_date: "2026-10-03", description: "gasto" }),
      entry("ingreso", 1_000_000, { entry_date: "2026-10-03", description: "otro monto" }),
    ];
    expect(findLinkCandidates(receipt(), entries).map((e) => e.description)).toEqual(["igual"]);
  });

  const importCtx = {
    today: TODAY,
    categories: [{ id: "ci", kind: "ingreso" as const }],
    partners: [{ id: "g", active: true }],
  };

  it("arma el ingreso a partir de un recibo en guaraníes", () => {
    const { errors, payload } = buildReceiptImportPayload(receipt(), { ...importCtx, categoryId: "ci", partnerId: "g", fxRate: "" });
    expect(errors).toEqual({});
    expect(payload).toEqual({
      kind: "ingreso",
      entry_date: "2026-10-03",
      description: "Recibo F7-0001 · Servi Smart",
      category_id: "ci",
      amount: 1_120_000,
      currency: "PYG",
      fx_rate: null,
      status: "pagado",
      partner_id: "g",
      via_partner_id: null,
      payment_method: "Transferencia bancaria",
      notes: null,
      receipt_id: "r1",
    });
  });

  it("un recibo sin socio entra a la caja de F7", () => {
    const { payload } = buildReceiptImportPayload(receipt(), { ...importCtx, categoryId: "ci", partnerId: "", fxRate: "" });
    expect(payload?.partner_id).toBeNull();
  });

  it("un recibo en dólares pide el tipo de cambio", () => {
    const usd = receipt({ amount: 20.5, currency: "USD" });
    const missing = buildReceiptImportPayload(usd, { ...importCtx, categoryId: "ci", partnerId: "g", fxRate: "" });
    expect(missing.payload).toBeNull();
    expect(missing.errors.fx_rate).toBeDefined();
    const ok = buildReceiptImportPayload(usd, { ...importCtx, categoryId: "ci", partnerId: "g", fxRate: "7345,5" });
    expect(ok.payload).toMatchObject({ amount: 20.5, currency: "USD", fx_rate: 7345.5 });
  });

  it("un recibo con fecha futura entra como por cobrar y exige categoría", () => {
    const future = receipt({ payment_date: "2026-11-05" });
    expect(buildReceiptImportPayload(future, { ...importCtx, categoryId: "ci", partnerId: "g", fxRate: "" }).payload?.status).toBe("pendiente");
    expect(buildReceiptImportPayload(receipt(), { ...importCtx, categoryId: "", partnerId: "g", fxRate: "" }).errors.category_id).toBeDefined();
  });
});

describe("exportar a Excel", () => {
  const gasto = entry("gasto", 182_500, {
    entry_date: "2026-10-01",
    description: "Supabase; plan Pro",
    category_id: "cg1",
    amount: 25,
    currency: "USD",
    fx_rate: 7300,
    partner_id: "m",
    payment_method: "Tarjeta",
  });

  it("arma el CSV con BOM, punto y coma, y una fila por movimiento", () => {
    const csv = entriesToCsv([gasto], LOOKUPS, TODAY);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(CSV_HEADERS.join(";"));
    expect(lines[1]).toBe(
      '01/10/2026;Gasto;Pagado;"Supabase; plan Pro";Base de datos (Supabase);25;USD;7300;182500;Matías (adelantó);Tarjeta;Manual;;'
    );
    expect(lines[2]).toBe("");
  });

  it("usa coma decimal y muestra el motivo de un anulado", () => {
    const voided = entry("gasto", 164_261, {
      entry_date: "2026-10-02",
      description: "Hosting",
      amount: 22.5,
      currency: "USD",
      fx_rate: 7300.5,
      voided_at: "2026-10-03T00:00:00Z",
      void_reason: "Duplicado",
    });
    const row = entriesToCsv([voided], LOOKUPS, TODAY).slice(1).split("\r\n")[1];
    expect(row).toBe("02/10/2026;Gasto;Anulado;Hosting;;22,5;USD;7300,5;164261;Caja F7;;Manual;;Duplicado");
  });

  it("neutraliza fórmulas, comillas y saltos de línea en los textos", () => {
    const risky = entry("gasto", 1, {
      entry_date: "2026-10-02",
      description: '=HYPERLINK("x")',
      notes: "línea 1\nlínea 2",
    });
    const row = entriesToCsv([risky], LOOKUPS, TODAY).slice(1).split("\r\n")[1];
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain("línea 1 línea 2");
    expect(row).not.toContain("\n");
  });

  it("nombra el archivo con el período", () => {
    expect(csvFileName(resolvePeriod("este_mes", TODAY), TODAY)).toBe("finanzas-f7_2026-10-01_2026-10-31.csv");
    expect(csvFileName(ALL_TIME, TODAY)).toBe("finanzas-f7_inicio_2026-10-22.csv");
  });
});

describe("filas de la base", () => {
  it("convierte los numéricos de PostgREST a números", () => {
    const e = normalizeEntry({
      id: "e1",
      kind: "gasto",
      entry_date: "2026-10-01",
      description: "Supabase",
      category_id: "cg1",
      amount: "25.00",
      currency: "USD",
      fx_rate: "7300.00",
      amount_pyg: "182500",
      status: "pagado",
      partner_id: "m",
      via_partner_id: null,
      payment_method: null,
      notes: "",
      receipt_id: null,
      recurring_id: "t1",
      recurring_due: "2026-10-01",
      created_at: "2026-10-01T10:00:00+00:00",
      updated_at: null,
      voided_at: null,
      void_reason: null,
    });
    expect(e).toMatchObject({
      amount: 25,
      fx_rate: 7300,
      amount_pyg: 182_500,
      currency: "USD",
      status: "pagado",
      notes: null,
      recurring_due: "2026-10-01",
      voided_at: null,
    });
  });

  it("convierte socios, categorías, plantillas y recibos", () => {
    expect(normalizePartner({ id: "g", name: "Gonzalo", share_pct: "50.00", active: true, notes: null, created_at: "x" })).toMatchObject({
      share_pct: 50,
      active: true,
      notes: null,
    });
    expect(normalizeCategory({ id: "c", kind: "ingreso", name: "Suscripciones", active: false, sort_order: 10 })).toEqual({
      id: "c",
      kind: "ingreso",
      name: "Suscripciones",
      active: false,
      sort_order: 10,
    });
    expect(
      normalizeRecurring({
        id: "t",
        name: "Dominio",
        category_id: "c",
        amount: "150000.00",
        currency: "PYG",
        fx_rate: null,
        frequency: "anual",
        start_date: "2026-03-01",
        end_date: null,
        default_partner_id: null,
        payment_method: null,
        notes: null,
        active: true,
        created_at: "x",
      })
    ).toMatchObject({ amount: 150_000, fx_rate: null, frequency: "anual", end_date: null });
    expect(
      normalizeReceipt({
        id: "r",
        receipt_number: "F7-0001",
        customer_name: "Servi Smart",
        payment_date: "2026-10-03",
        amount: "1120000.00",
        currency: "PYG",
        payment_method: null,
        description: null,
        voided_at: null,
      })
    ).toMatchObject({ amount: 1_120_000, payment_date: "2026-10-03", voided_at: null });
  });
});

describe("errores de la base", () => {
  it("muestra tal cual los avisos que escribe la propia base", () => {
    expect(friendlyFinanceError({ code: "P0001", message: "Para anular hace falta el motivo" })).toBe("Para anular hace falta el motivo");
    expect(friendlyFinanceError({ code: "P0001", message: "El socio elegido está inactivo" })).toBe("El socio elegido está inactivo");
  });

  it("traduce los duplicados según qué regla se rompió", () => {
    const dup = (constraint: string) => ({ code: "23505", message: `duplicate key value violates unique constraint "${constraint}"` });
    expect(friendlyFinanceError(dup("f7_finance_entries_receipt_id_key"))).toBe("Ese recibo ya está registrado como ingreso.");
    expect(friendlyFinanceError(dup("f7_entries_recurring_once"))).toBe("Ese vencimiento del gasto fijo ya existe.");
    expect(friendlyFinanceError(dup("f7_partners_name_key"))).toBe("Ya hay un socio con ese nombre.");
    expect(friendlyFinanceError(dup("f7_finance_categories_name_key"))).toBe("Ya existe una categoría con ese nombre.");
    expect(friendlyFinanceError(dup("otra_cosa"))).toBe("Ya existe un registro igual.");
  });

  it("distingue borrar algo en uso de elegir algo que ya no existe", () => {
    expect(
      friendlyFinanceError({ code: "23503", message: 'update or delete on table "f7_partners" violates foreign key constraint "x" on table "f7_finance_entries"' })
    ).toBe("No se puede borrar: ya se usa en movimientos. Mejor desactivalo.");
    expect(friendlyFinanceError({ code: "23503", message: 'insert or update on table "f7_finance_entries" violates foreign key constraint "y"' })).toBe(
      "Algo de lo que elegiste ya no existe. Actualizá la pantalla y probá de nuevo."
    );
  });

  it("avisa de datos inválidos, falta de permiso, sesión vencida y falta de conexión", () => {
    expect(friendlyFinanceError({ code: "23514", message: 'new row violates check constraint "f7_entries_fx_check"' })).toBe(
      "Hay un dato que no es válido. Revisá el formulario."
    );
    expect(friendlyFinanceError({ code: "42501", message: "No autorizado" })).toBe("No tenés permiso para hacer esto.");
    expect(friendlyFinanceError({ message: 'new row violates row-level security policy for table "f7_finance_entries"' })).toBe(
      "No tenés permiso para hacer esto."
    );
    expect(friendlyFinanceError({ code: "PGRST301", message: "JWT expired" })).toBe("Tu sesión venció. Volvé a iniciar sesión.");
    expect(friendlyFinanceError(new TypeError("Failed to fetch"))).toBe("No hay conexión con el servidor. Revisá tu internet y probá de nuevo.");
  });

  it("usa el mensaje de respaldo cuando no reconoce el error", () => {
    expect(friendlyFinanceError(null)).toBe("No se pudo completar la acción. Probá de nuevo.");
    expect(friendlyFinanceError({ code: "XX000", message: "algo raro" })).toBe("No se pudo completar la acción. Probá de nuevo.");
    expect(friendlyFinanceError("boom", "No se pudo anular.")).toBe("No se pudo anular.");
  });
});
