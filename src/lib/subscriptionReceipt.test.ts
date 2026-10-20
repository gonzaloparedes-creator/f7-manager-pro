import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  addMonthsISO,
  amountInWords,
  buildSubscriptionReceiptHtml,
  computeDiscountAmount,
  computePeriodEnd,
  computeTotal,
  defaultAmount,
  defaultDescription,
  formatDateISO,
  formatMoney,
  integerToWords,
  parseMoneyInput,
  parsePercentInput,
  receiptPdfFileName,
  roundMoney,
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
  subtotal: 140000,
  discount_amount: 0,
  discount_note: null,
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

describe("descuento", () => {
  it("redondea según la moneda", () => {
    expect(roundMoney(12345.6, "PYG")).toBe(12346);
    expect(roundMoney(2.675, "USD")).toBe(2.68);
    expect(roundMoney(1.005, "USD")).toBe(1.01);
    expect(roundMoney(NaN, "PYG")).toBeNaN();
  });

  it("interpreta el porcentaje que se escribe", () => {
    expect(parsePercentInput("10")).toBe(10);
    expect(parsePercentInput("12,5")).toBe(12.5);
    expect(parsePercentInput("7.25")).toBe(7.25);
    expect(parsePercentInput(" 15 ")).toBe(15);
    expect(parsePercentInput("")).toBeNaN();
    expect(parsePercentInput("-5")).toBeNaN();
    expect(parsePercentInput("10%")).toBeNaN();
    expect(parsePercentInput("1,234")).toBeNaN();
  });

  it("calcula el descuento en porcentaje", () => {
    expect(computeDiscountAmount(140000, "percent", "10", "PYG")).toBe(14000);
    expect(computeDiscountAmount(1120000, "percent", "15", "PYG")).toBe(168000);
    expect(computeDiscountAmount(100001, "percent", "10", "PYG")).toBe(10000);
    expect(computeDiscountAmount(22, "percent", "10", "USD")).toBe(2.2);
    expect(computeDiscountAmount(150, "percent", "12,5", "USD")).toBe(18.75);
  });

  it("calcula el descuento en monto fijo", () => {
    expect(computeDiscountAmount(140000, "fixed", "20.000", "PYG")).toBe(20000);
    expect(computeDiscountAmount(22, "fixed", "2,50", "USD")).toBe(2.5);
  });

  it("vacío es sin descuento y lo ilegible no se adivina", () => {
    expect(computeDiscountAmount(140000, "percent", "", "PYG")).toBe(0);
    expect(computeDiscountAmount(140000, "fixed", "   ", "PYG")).toBe(0);
    expect(computeDiscountAmount(140000, "percent", "diez", "PYG")).toBeNaN();
    expect(computeDiscountAmount(140000, "fixed", "14,5", "PYG")).toBeNaN();
  });

  it("el total es precio menos descuento, sin arrastrar decimales", () => {
    expect(computeTotal(140000, 14000, "PYG")).toBe(126000);
    expect(computeTotal(22, 2.2, "USD")).toBe(19.8);
    expect(computeTotal(0.3, 0.1, "USD")).toBe(0.2);
    expect(computeTotal(140000, 0, "PYG")).toBe(140000);
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
      { ...draft, customer_name: "  ", subtotal: 0, amount: 0, payment_method: "", description: " ", issuer_name: "" },
      today
    );
    expect(Object.keys(errors).sort()).toEqual(["customer_name", "description", "issuer_name", "payment_method", "subtotal"]);
  });

  it("acepta un descuento que cierra con el total", () => {
    const withDiscount = { ...draft, discount_amount: 14000, discount_note: "Promo", amount: 126000 };
    expect(validateDraft(withDiscount, today)).toEqual({});
  });

  it("rechaza un descuento ilegible, negativo o que deja el total en cero", () => {
    expect(validateDraft({ ...draft, discount_amount: NaN, amount: NaN }, today).discount_amount).toMatch(/no se entiende/i);
    expect(validateDraft({ ...draft, discount_amount: -1000, amount: 141000 }, today).discount_amount).toMatch(/no se entiende/i);
    expect(validateDraft({ ...draft, discount_amount: 140000, amount: 0 }, today).discount_amount).toMatch(/menor al precio/);
    expect(validateDraft({ ...draft, discount_amount: 200000, amount: -60000 }, today).discount_amount).toMatch(/menor al precio/);
  });

  it("rechaza un total que no coincide con precio menos descuento", () => {
    const errors = validateDraft({ ...draft, discount_amount: 14000, amount: 130000 }, today);
    expect(errors.amount).toMatch(/no coincide/);
    expect(validateDraft({ ...draft, amount: 139999 }, today).amount).toMatch(/no coincide/);
  });

  it("valida el descuento en dólares con centavos", () => {
    const usd = { ...draft, currency: "USD" as const, subtotal: 22.5, discount_amount: 2.25, amount: 20.25 };
    expect(validateDraft(usd, today)).toEqual({});
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
    const html = buildSubscriptionReceiptHtml({ ...receipt, subtotal: 22, amount: 22, currency: "USD" });
    expect(html).toContain("US$ 22");
    expect(html).toContain("Veintidós dólares estadounidenses");
  });

  it("sin descuento no muestra el desglose", () => {
    const html = buildSubscriptionReceiptHtml(receipt);
    expect(html).not.toContain('class="breakdown"');
    expect(html).not.toContain("Descuento");
    expect(html).toContain("Monto recibido");
    expect(html).not.toContain("Total recibido");
  });

  it("con descuento muestra precio, descuento con su motivo y el total", () => {
    const html = buildSubscriptionReceiptHtml({
      ...receipt,
      discount_amount: 14000,
      discount_note: "Promo lanzamiento",
      amount: 126000,
    });
    expect(html).toContain('class="breakdown"');
    expect(html).toContain("Gs. 140.000");
    expect(html).toContain("Descuento · Promo lanzamiento");
    expect(html).toContain("− Gs. 14.000");
    expect(html).toContain("Total recibido");
    expect(html).toContain("Gs. 126.000");
    expect(html).toContain("Ciento veintiséis mil guaraníes");
  });

  it("el descuento sin motivo no deja un separador suelto", () => {
    const html = buildSubscriptionReceiptHtml({ ...receipt, discount_amount: 14000, amount: 126000 });
    expect(html).toContain("<span>Descuento</span>");
    expect(html).not.toContain("Descuento ·");
  });

  it("escapa el motivo del descuento", () => {
    const html = buildSubscriptionReceiptHtml({
      ...receipt,
      discount_amount: 14000,
      discount_note: "<script>x</script>",
      amount: 126000,
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
  });
});

describe("nombre del archivo PDF", () => {
  const named = (customer_name: string) => receiptPdfFileName({ receipt_number: "F7-0001", customer_name });

  it("lleva el número y el cliente", () => {
    expect(named("Servi Smart")).toBe("Recibo-F7-0001-Servi-Smart.pdf");
  });

  it("saca tildes y símbolos", () => {
    expect(named("Taller Peña & Hnos.")).toBe("Recibo-F7-0001-Taller-Pena-Hnos.pdf");
    expect(named("  Ñandú / Cía  ")).toBe("Recibo-F7-0001-Nandu-Cia.pdf");
  });

  it("recorta los nombres largos sin dejar un guion al final", () => {
    const name = named("Distribuidora Internacional de Repuestos Electronicos del Este S.A.");
    expect(name.endsWith(".pdf")).toBe(true);
    expect(name).not.toMatch(/-\.pdf$/);
    expect(name.length).toBeLessThanOrEqual("Recibo-F7-0001-".length + 40 + ".pdf".length);
  });

  it("sin nombre legible queda solo el número", () => {
    expect(named("")).toBe("Recibo-F7-0001.pdf");
    expect(named("???")).toBe("Recibo-F7-0001.pdf");
  });
});

describe("descripción", () => {
  it("describe el plan por defecto", () => {
    expect(defaultDescription("pro", "anual")).toBe("Suscripción a F7 Manager Pro, Plan Pro (ciclo anual)");
  });
});
