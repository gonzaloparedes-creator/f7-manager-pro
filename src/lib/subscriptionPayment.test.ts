import { describe, expect, it } from "vitest";
import { planExpiryInfo, trialExpiryInfo } from "./planExpiry";
import type { F7Category, F7Partner } from "./f7Finance";
import {
  applyContextDefaults,
  buildPaymentPayload,
  cobroAmounts,
  defaultCurrency,
  initialCobro,
  paymentAction,
  pickDefaultCategory,
  receiptCoverage,
  receiptsByCompany,
  type CobroState,
  type CompanyReceiptRow,
  type PaymentContext,
  type PaymentInput,
} from "./subscriptionPayment";

const TODAY = "2026-11-10";
const paid = (today: string) =>
  planExpiryInfo({ billing_cycle: "mensual", plan_paid_from: "2026-11-01", plan_expires_at: "2026-11-30" }, today, 3);

describe("paymentAction · qué ofrecer en la tarjeta", () => {
  it("al día (le falta bastante): no hay nada que cobrar", () => {
    expect(paymentAction(paid("2026-11-10"))).toBe("none");
  });

  it("a 8 días del vencimiento todavía no se ofrece cobrar; a 7 sí", () => {
    expect(paymentAction(paid("2026-11-22"))).toBe("none");
    expect(paymentAction(paid("2026-11-23"))).toBe("renew");
  });

  it("vence hoy, venció o ya está en gracia: renovar", () => {
    expect(paymentAction(paid("2026-11-30"))).toBe("renew");
    expect(paymentAction(paid("2026-12-02"))).toBe("renew");
    expect(paymentAction(paid("2026-12-20"))).toBe("renew");
  });

  it("prueba gratis o sin fechas: registrar el pago", () => {
    expect(paymentAction(trialExpiryInfo({ trial_ends_at: "2026-11-20", created_at: "2026-11-06" }, TODAY, 3))).toBe("register");
    expect(paymentAction(null)).toBe("register");
  });
});

const receipt = (over: Partial<CompanyReceiptRow>): CompanyReceiptRow => ({
  id: "r1",
  receipt_number: "F7-0001",
  company_id: "c1",
  payment_date: "2026-11-01",
  period_start: "2026-11-01",
  period_end: "2026-11-30",
  amount: 95000,
  currency: "PYG",
  voided_at: null,
  created_at: "2026-11-01T12:00:00Z",
  ...over,
});

describe("receiptsByCompany", () => {
  it("agrupa por empresa, deja afuera anulados y sin empresa, y ordena del más nuevo al más viejo", () => {
    const map = receiptsByCompany([
      receipt({ id: "a", receipt_number: "F7-0001", created_at: "2026-10-01T10:00:00Z" }),
      receipt({ id: "b", receipt_number: "F7-0002", created_at: "2026-11-01T10:00:00Z" }),
      receipt({ id: "c", receipt_number: "F7-0003", voided_at: "2026-11-02T00:00:00Z" }),
      receipt({ id: "d", receipt_number: "F7-0004", company_id: null }),
      receipt({ id: "e", receipt_number: "F7-0005", company_id: "c2" }),
    ]);
    expect(map.get("c1")?.map((r) => r.receipt_number)).toEqual(["F7-0002", "F7-0001"]);
    expect(map.get("c2")?.map((r) => r.receipt_number)).toEqual(["F7-0005"]);
    expect(map.size).toBe(2);
  });
});

describe("receiptCoverage", () => {
  const info = paid(TODAY);

  it("covered cuando algún recibo vigente cubre el vencimiento que figura en la empresa", () => {
    expect(receiptCoverage(info, [receipt({})])).toBe("covered");
    expect(receiptCoverage(info, [receipt({ period_end: "2026-10-31" }), receipt({ id: "x" })])).toBe("covered");
  });

  it("uncovered cuando hay un pago cargado pero ningún recibo de ese período", () => {
    expect(receiptCoverage(info, [])).toBe("uncovered");
    expect(receiptCoverage(info, undefined)).toBe("uncovered");
    expect(receiptCoverage(info, [receipt({ period_end: "2026-10-31" })])).toBe("uncovered");
  });

  it("none cuando no hay un pago (prueba o sin fechas)", () => {
    expect(receiptCoverage(null, [receipt({})])).toBe("none");
    expect(receiptCoverage(trialExpiryInfo({ trial_ends_at: "2026-11-20", created_at: "2026-11-06" }, TODAY, 3), [])).toBe("none");
  });
});

const cat = (over: Partial<F7Category>): F7Category => ({ id: "k", kind: "ingreso", name: "Otros", active: true, sort_order: 1, ...over });
const partner = (over: Partial<F7Partner>): F7Partner => ({
  id: "p1",
  name: "Socio",
  share_pct: 50,
  active: true,
  notes: null,
  created_at: "2026-10-22T00:00:00Z",
  ...over,
});

describe("pickDefaultCategory", () => {
  it("prefiere Suscripciones (sin importar tildes ni mayúsculas)", () => {
    expect(pickDefaultCategory([cat({ id: "a", name: "Otros ingresos" }), cat({ id: "b", name: "SUSCRIPCIONES" })])).toBe("b");
  });

  it("si no existe, la primera de ingresos activa; ignora gastos e inactivas", () => {
    expect(
      pickDefaultCategory([
        cat({ id: "g", kind: "gasto", name: "Suscripciones" }),
        cat({ id: "i", active: false, name: "Suscripciones" }),
        cat({ id: "ok", name: "Servicios" }),
      ])
    ).toBe("ok");
  });

  it("sin categorías de ingreso devuelve vacío", () => {
    expect(pickDefaultCategory([cat({ kind: "gasto" })])).toBe("");
  });
});

describe("defaultCurrency", () => {
  it("Paraguay (o sin país) en guaraníes; el resto en dólares", () => {
    expect(defaultCurrency("PY")).toBe("PYG");
    expect(defaultCurrency(null)).toBe("PYG");
    expect(defaultCurrency(undefined)).toBe("PYG");
    expect(defaultCurrency("AR")).toBe("USD");
    expect(defaultCurrency("MX")).toBe("USD");
  });
});

describe("initialCobro y applyContextDefaults", () => {
  const ctx = (over: Partial<PaymentContext> = {}): PaymentContext => ({
    categories: [cat({ id: "susc", name: "Suscripciones" })],
    partners: [partner({ id: "p1" }), partner({ id: "p2", active: false })],
    issuerName: "F7 Manager Pro SRL",
    issuerDetails: "RUC 80000000-1",
    lastMethod: "Efectivo",
    lastCollector: "p1",
    lastFx: "7.300",
    ...over,
  });

  it("arranca cobrando hoy, al precio de lista y en la moneda del país", () => {
    const c = initialCobro({ country: "PY" }, TODAY);
    expect(c).toMatchObject({ currency: "PYG", amountText: null, paymentDate: TODAY, collectedBy: "", categoryId: "", paymentMethod: "Transferencia bancaria" });
    expect(initialCobro({ country: "CL" }, TODAY).currency).toBe("USD");
  });

  it("completa con lo último que se usó", () => {
    const c = applyContextDefaults(initialCobro({ country: "PY" }, TODAY), ctx());
    expect(c).toMatchObject({
      categoryId: "susc",
      collectedBy: "p1",
      paymentMethod: "Efectivo",
      fxText: "7.300",
      issuerName: "F7 Manager Pro SRL",
      issuerDetails: "RUC 80000000-1",
    });
  });

  it("no ofrece como cobrador a un socio inactivo ni a uno que ya no existe", () => {
    expect(applyContextDefaults(initialCobro({}, TODAY), ctx({ lastCollector: "p2" })).collectedBy).toBe("");
    expect(applyContextDefaults(initialCobro({}, TODAY), ctx({ lastCollector: "nadie" })).collectedBy).toBe("");
  });

  it("sin historial deja los valores de siempre", () => {
    const c = applyContextDefaults(
      initialCobro({}, TODAY),
      ctx({ lastCollector: null, lastMethod: null, lastFx: null, issuerName: null, issuerDetails: null })
    );
    expect(c).toMatchObject({ collectedBy: "", paymentMethod: "Transferencia bancaria", fxText: "", issuerName: "F7 Manager Pro" });
  });

  it("no pisa lo que ya estaba elegido", () => {
    const start: CobroState = { ...initialCobro({}, TODAY), categoryId: "mia", fxText: "7.500" };
    const c = applyContextDefaults(start, ctx());
    expect(c.categoryId).toBe("mia");
    expect(c.fxText).toBe("7.500");
  });
});

describe("cobroAmounts", () => {
  it("al precio de lista del plan, en la moneda elegida", () => {
    const pyg = cobroAmounts(initialCobro({ country: "PY" }, TODAY), "pro", "mensual");
    expect(pyg).toMatchObject({ listPrice: 95000, subtotal: 95000, discount: 0, total: 95000 });
    const usd = cobroAmounts({ ...initialCobro({ country: "PY" }, TODAY), currency: "USD" }, "pro", "mensual");
    expect(usd).toMatchObject({ listPrice: 15, subtotal: 15, total: 15 });
  });

  it("acepta un precio escrito y un descuento en porcentaje o fijo", () => {
    const base = { ...initialCobro({ country: "PY" }, TODAY), amountText: "100.000" };
    expect(cobroAmounts({ ...base, discountValue: "10" }, "pro", "mensual")).toMatchObject({ subtotal: 100000, discount: 10000, total: 90000 });
    expect(cobroAmounts({ ...base, discountMode: "fixed", discountValue: "25.000" }, "pro", "mensual")).toMatchObject({ discount: 25000, total: 75000 });
  });

  it("un texto ilegible da NaN (no un cero)", () => {
    const c = cobroAmounts({ ...initialCobro({ country: "PY" }, TODAY), amountText: "abc" }, "pro", "mensual");
    expect(Number.isNaN(c.subtotal)).toBe(true);
    expect(Number.isNaN(c.total)).toBe(true);
  });
});

describe("buildPaymentPayload", () => {
  const input = (over: Partial<PaymentInput> = {}, cobro: Partial<CobroState> = {}): PaymentInput => ({
    company: { id: "c1", name: "Tu Móvil" },
    plan: "pro",
    cycle: "mensual",
    periodStart: "2026-11-01",
    periodEnd: "2026-11-30",
    markPaying: true,
    reactivate: false,
    cobro: { ...initialCobro({ country: "PY" }, TODAY), categoryId: "susc", ...cobro },
    ...over,
  });

  it("arma el pedido completo en guaraníes", () => {
    const { errors, payload } = buildPaymentPayload(input(), TODAY);
    expect(errors).toEqual({});
    expect(payload).toMatchObject({
      company_id: "c1",
      customer_name: "Tu Móvil",
      plan_type: "pro",
      billing_cycle: "mensual",
      period_start: "2026-11-01",
      period_end: "2026-11-30",
      payment_date: TODAY,
      subtotal: 95000,
      discount_amount: 0,
      discount_note: null,
      amount: 95000,
      currency: "PYG",
      payment_method: "Transferencia bancaria",
      description: "Suscripción a F7 Manager Pro, Plan Pro (ciclo mensual)",
      category_id: "susc",
      collected_by: null,
      fx_rate: null,
      mark_paying: true,
      reactivate: false,
      customer_document: null,
      payment_reference: null,
      notes: null,
      issuer_details: null,
    });
  });

  it("el motivo del descuento solo viaja si hay descuento", () => {
    const sinDescuento = buildPaymentPayload(input({}, { discountNote: "amigo" }), TODAY).payload;
    expect(sinDescuento?.discount_note).toBeNull();
    const conDescuento = buildPaymentPayload(input({}, { discountValue: "10", discountNote: " Cliente fundador " }), TODAY).payload;
    expect(conDescuento).toMatchObject({ discount_amount: 9500, amount: 85500, subtotal: 95000, discount_note: "Cliente fundador" });
  });

  it("en dólares pide el tipo de cambio y lo valida", () => {
    const usd = { currency: "USD" as const };
    expect(buildPaymentPayload(input({}, usd), TODAY).errors.fx).toMatch(/tipo de cambio/i);
    expect(buildPaymentPayload(input({}, { ...usd, fxText: "73" }), TODAY).errors.fx).toMatch(/no parece/i);
    const ok = buildPaymentPayload(input({}, { ...usd, fxText: "7.300" }), TODAY);
    expect(ok.errors).toEqual({});
    expect(ok.payload).toMatchObject({ currency: "USD", amount: 15, fx_rate: 7300 });
  });

  it("en guaraníes ignora el tipo de cambio que haya quedado escrito", () => {
    expect(buildPaymentPayload(input({}, { fxText: "7.300" }), TODAY).payload?.fx_rate).toBeNull();
  });

  it("quién cobró: vacío es la Caja F7; con un socio lo manda", () => {
    expect(buildPaymentPayload(input({}, { collectedBy: "p1" }), TODAY).payload?.collected_by).toBe("p1");
  });

  it("rechaza lo que no cierra y no devuelve pedido", () => {
    const cases: [Partial<CobroState>, keyof ReturnType<typeof buildPaymentPayload>["errors"]][] = [
      [{ amountText: "0" }, "price"],
      [{ amountText: "abc" }, "price"],
      [{ discountValue: "100" }, "discount"],
      [{ discountValue: "abc" }, "discount"],
      [{ paymentDate: "2026-11-11" }, "paymentDate"],
      [{ paymentDate: "10/11/2026" }, "paymentDate"],
      [{ paymentMethod: "  " }, "paymentMethod"],
      [{ categoryId: "" }, "category"],
      [{ issuerName: " " }, "issuer"],
    ];
    for (const [cobro, field] of cases) {
      const res = buildPaymentPayload(input({}, cobro), TODAY);
      expect(res.payload, JSON.stringify(cobro)).toBeNull();
      expect(res.errors[field], JSON.stringify(cobro)).toBeTruthy();
    }
  });

  it("rechaza un período al revés", () => {
    const res = buildPaymentPayload(input({ periodStart: "2026-11-30", periodEnd: "2026-11-01" }), TODAY);
    expect(res.payload).toBeNull();
    expect(res.errors.period).toBeTruthy();
  });

  it("recorta los textos opcionales y manda null si quedan vacíos", () => {
    const res = buildPaymentPayload(
      input({}, { customerDocument: " 80012345-6 ", paymentReference: " TRX-9 ", notes: "   ", issuerDetails: " RUC 1 " }),
      TODAY
    ).payload;
    expect(res).toMatchObject({ customer_document: "80012345-6", payment_reference: "TRX-9", notes: null, issuer_details: "RUC 1" });
  });
});
