import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  addMonthsISO,
  amountInWords,
  buildSubscriptionReceiptHtml,
  computePeriodEnd,
  defaultAmount,
  defaultDescription,
  formatDateISO,
  formatMoney,
  integerToWords,
  parseMoneyInput,
  todayInAsuncion,
  validateDraft,
  type ReceiptDraft,
  type SubscriptionReceipt,
} from "./subscriptionReceipt";

const draft: ReceiptDraft = {
  company_id: null,
  customer_name: "Taller Don Pedro",
  customer_document: "80012345-6",
  customer_email: null,
  customer_phone: null,
  plan_type: "business",
  billing_cycle: "mensual",
  period_start: "2026-10-20",
  period_end: "2026-11-19",
  payment_date: "2026-10-20",
  amount: 140000,
  currency: "PYG",
  payment_method: "Transferencia bancaria",
  payment_reference: null,
  description: "Suscripción",
  notes: null,
  issuer_name: "F7 Manager Pro",
  issuer_details: null,
};

const receipt: SubscriptionReceipt = {
  ...draft,
  id: "r1",
  receipt_number: "F7-0001",
  created_at: "2026-10-20T15:00:00Z",
  voided_at: null,
  void_reason: null,
};

describe("fechas", () => {
  it("suma meses sin pasarse al mes siguiente", () => {
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsISO("2026-10-20", 6)).toBe("2027-04-20");
    expect(addMonthsISO("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonthsISO("2026-10-20", 12)).toBe("2027-10-20");
  });

  it("suma días cruzando meses y años", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("el período termina el día anterior a la renovación", () => {
    expect(computePeriodEnd("2026-10-20", "mensual")).toBe("2026-11-19");
    expect(computePeriodEnd("2026-10-20", "semestral")).toBe("2027-04-19");
    expect(computePeriodEnd("2026-10-20", "anual")).toBe("2027-10-19");
    expect(computePeriodEnd("2026-01-01", "mensual")).toBe("2026-01-31");
  });

  it("formatea dd/mm/aaaa y rechaza fechas inválidas", () => {
    expect(formatDateISO("2026-10-05")).toBe("05/10/2026");
    expect(formatDateISO("2026-10-05T12:00:00Z")).toBe("05/10/2026");
    expect(formatDateISO("2026-02-31")).toBe("");
    expect(formatDateISO(null)).toBe("");
  });

  it("calcula el día de hoy en Asunción, no en UTC", () => {
    // 01:30 UTC del 21 es todavía el 20 en Paraguay (UTC-3 / UTC-4).
    expect(todayInAsuncion(new Date("2026-10-21T01:30:00Z"))).toBe("2026-10-20");
    expect(todayInAsuncion(new Date("2026-10-21T12:00:00Z"))).toBe("2026-10-21");
  });
});

describe("montos", () => {
  it("toma el precio de la lista única de planes", () => {
    expect(defaultAmount("business", "mensual", "PYG")).toBe(140000);
    expect(defaultAmount("pro", "anual", "USD")).toBe(150);
    expect(defaultAmount("retail", "semestral", "PYG")).toBe(430000);
  });

  it("interpreta lo que se escribe", () => {
    expect(parseMoneyInput("140.000", "PYG")).toBe(140000);
    expect(parseMoneyInput("140000", "PYG")).toBe(140000);
    expect(parseMoneyInput("14,5", "PYG")).toBeNaN();
    expect(parseMoneyInput("22", "USD")).toBe(22);
    expect(parseMoneyInput("22,50", "USD")).toBe(22.5);
    expect(parseMoneyInput("22.5", "USD")).toBe(22.5);
    expect(parseMoneyInput("", "USD")).toBeNaN();
    expect(parseMoneyInput("abc", "PYG")).toBeNaN();
    expect(parseMoneyInput("1,234.5", "USD")).toBeNaN();
  });

  it("da formato según la moneda", () => {
    expect(formatMoney(140000, "PYG")).toBe("Gs. 140.000");
    expect(formatMoney(22, "USD")).toBe("US$ 22");
    expect(formatMoney(22.5, "USD")).toBe("US$ 22,50");
  });
});

describe("monto en letras", () => {
  it.each([
    [0, "cero"],
    [1, "uno"],
    [15, "quince"],
    [21, "veintiuno"],
    [30, "treinta"],
    [45, "cuarenta y cinco"],
    [100, "cien"],
    [101, "ciento uno"],
    [999, "novecientos noventa y nueve"],
    [1000, "mil"],
    [1500, "mil quinientos"],
    [2000, "dos mil"],
    [21000, "veintiún mil"],
    [100000, "cien mil"],
    [140000, "ciento cuarenta mil"],
    [295000, "doscientos noventa y cinco mil"],
    [1000000, "un millón"],
    [1400000, "un millón cuatrocientos mil"],
    [2000000, "dos millones"],
    [21000000, "veintiún millones"],
    [1000000000, "mil millones"],
  ])("integerToWords(%i)", (n, words) => {
    expect(integerToWords(n)).toBe(words);
  });

  it("aplica la apócope delante del sustantivo", () => {
    expect(amountInWords(1, "PYG")).toBe("Un guaraní");
    expect(amountInWords(21, "PYG")).toBe("Veintiún guaraníes");
    expect(amountInWords(141, "PYG")).toBe("Ciento cuarenta y un guaraníes");
    expect(amountInWords(140000, "PYG")).toBe("Ciento cuarenta mil guaraníes");
    expect(amountInWords(1400000, "PYG")).toBe("Un millón cuatrocientos mil guaraníes");
    expect(amountInWords(31000, "PYG")).toBe("Treinta y un mil guaraníes");
  });

  it("escribe dólares con centavos", () => {
    expect(amountInWords(22, "USD")).toBe("Veintidós dólares estadounidenses");
    expect(amountInWords(1, "USD")).toBe("Un dólar estadounidense");
    expect(amountInWords(22.5, "USD")).toBe("Veintidós dólares estadounidenses con 50/100");
    expect(amountInWords(119, "USD")).toBe("Ciento diecinueve dólares estadounidenses");
  });

  it("no inventa nada con montos inválidos", () => {
    expect(amountInWords(NaN, "PYG")).toBe("");
    expect(amountInWords(-5, "PYG")).toBe("");
  });
});

describe("validateDraft", () => {
  const today = "2026-10-20";

  it("acepta un recibo completo", () => {
    expect(validateDraft(draft, today)).toEqual({});
  });

  it("pide lo mínimo", () => {
    const errors = validateDraft(
      { ...draft, customer_name: "  ", amount: 0, payment_method: "", description: " ", issuer_name: "" },
      today
    );
    expect(Object.keys(errors).sort()).toEqual(["amount", "customer_name", "description", "issuer_name", "payment_method"]);
  });

  it("rechaza fecha de pago futura y vencimiento anterior al inicio", () => {
    const errors = validateDraft({ ...draft, payment_date: "2026-10-21", period_end: "2026-10-01" }, today);
    expect(errors.payment_date).toMatch(/futura/);
    expect(errors.period_end).toMatch(/anterior/);
  });

  it("rechaza fechas que no existen", () => {
    const errors = validateDraft({ ...draft, payment_date: "2026-02-31", period_start: "" }, today);
    expect(errors.payment_date).toBeDefined();
    expect(errors.period_start).toBeDefined();
  });
});

describe("recibo impreso", () => {
  it("lleva todo lo que pidió el dueño", () => {
    const html = buildSubscriptionReceiptHtml(
      { ...receipt, issuer_details: "RUC 80000000-1\nAsunción, Paraguay", payment_reference: "Op. 998877", notes: "Pago anticipado" },
      { logoUrl: "https://app.test/f7-logo.png" }
    );
    expect(html).toContain("https://app.test/f7-logo.png");
    expect(html).toContain("F7-0001");
    expect(html).toContain("Taller Don Pedro");
    expect(html).toContain("80012345-6");
    expect(html).toContain("Plan Business");
    expect(html).toContain("Mensual");
    expect(html).toContain("20/10/2026 al 19/11/2026");
    expect(html).toContain("Fecha de adquisición del plan");
    expect(html).toContain("Fecha de pago");
    expect(html).toContain("Gs. 140.000");
    expect(html).toContain("Ciento cuarenta mil guaraníes");
    expect(html).toContain("Transferencia bancaria");
    expect(html).toContain("Op. 998877");
    expect(html).toContain("Pago anticipado");
    expect(html).toContain("RUC 80000000-1");
    expect(html).toContain("Asunción, Paraguay");
    expect(html).not.toContain("ANULADO");
  });

  it("omite las filas vacías", () => {
    const html = buildSubscriptionReceiptHtml(receipt);
    expect(html).not.toContain("Correo electrónico");
    expect(html).not.toContain("Referencia del pago");
    expect(html).not.toContain("Observaciones");
  });

  it("escapa lo que escribe el usuario", () => {
    const html = buildSubscriptionReceiptHtml({ ...receipt, customer_name: '<img src=x onerror="alert(1)">', notes: "<script>x</script>" });
    expect(html).not.toContain("<script>x</script>");
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("marca como anulado con el motivo", () => {
    const html = buildSubscriptionReceiptHtml({ ...receipt, voided_at: "2026-10-21T15:00:00Z", void_reason: "Monto mal cargado" });
    expect(html).toContain("ANULADO");
    expect(html).toContain("Monto mal cargado");
    expect(html).toContain("No tiene validez");
  });

  it("muestra dólares", () => {
    const html = buildSubscriptionReceiptHtml({ ...receipt, amount: 22, currency: "USD" });
    expect(html).toContain("US$ 22");
    expect(html).toContain("Veintidós dólares estadounidenses");
  });

  it("describe el plan por defecto", () => {
    expect(defaultDescription("pro", "anual")).toBe("Suscripción a F7 Manager Pro, Plan Pro (ciclo anual)");
  });
});
