import { describe, expect, it } from "vitest";
import { receiptWarranty } from "./receiptWarranty";
import { DEFAULT_SERVICE_TERMS, NO_WARRANTY_CLAUSE, renderServiceTerms } from "./orders";

describe("receiptWarranty", () => {
  it("0, null, undefined y negativos son 'sin garantía'", () => {
    expect(receiptWarranty({ warranty_days: 0 })).toEqual({ kind: "none" });
    expect(receiptWarranty({ warranty_days: null })).toEqual({ kind: "none" });
    expect(receiptWarranty({})).toEqual({ kind: "none" });
    expect(receiptWarranty({ warranty_days: -5 })).toEqual({ kind: "none" });
    expect(receiptWarranty({ warranty_days: Number.NaN })).toEqual({ kind: "none" });
  });

  it("sin fecha de entrega ni estimada: dice los días pero no inventa una fecha", () => {
    expect(receiptWarranty({ warranty_days: 30 })).toEqual({
      kind: "days",
      days: 30,
      daysLabel: "30 días",
      endsOn: null,
      estimated: true,
    });
  });

  it("1 día va en singular", () => {
    const w = receiptWarranty({ warranty_days: 1 });
    expect(w.kind === "days" && w.daysLabel).toBe("1 día");
  });

  it("con entrega estimada: la fecha final es estimada", () => {
    const w = receiptWarranty({ warranty_days: 30, estimated_delivery_date: "2026-10-25" });
    expect(w).toMatchObject({ kind: "days", endsOn: "24/11/2026", estimated: true });
  });

  it("cruza fin de mes y de año", () => {
    const w = receiptWarranty({ warranty_days: 90, estimated_delivery_date: "2026-12-20" });
    expect(w).toMatchObject({ endsOn: "20/03/2027", estimated: true });
  });

  it("con la orden entregada la fecha es exacta y manda sobre la estimada", () => {
    const w = receiptWarranty({
      warranty_days: 15,
      delivered_at: "2026-10-10T12:00:00",
      estimated_delivery_date: "2026-10-01",
    });
    expect(w).toMatchObject({ kind: "days", endsOn: "25/10/2026", estimated: false });
  });

  it("una fecha de entrega inválida cae a la estimada, no rompe", () => {
    const w = receiptWarranty({
      warranty_days: 10,
      delivered_at: "no-es-fecha",
      estimated_delivery_date: "2026-10-01",
    });
    expect(w).toMatchObject({ endsOn: "11/10/2026", estimated: true });
  });
});

describe("renderServiceTerms con y sin garantía", () => {
  it("con garantía reemplaza el placeholder", () => {
    const out = renderServiceTerms(DEFAULT_SERVICE_TERMS, 30);
    expect(out).toContain("cuenta con 30 días de garantía");
    expect(out).not.toContain("{{garantia_dias}}");
  });

  it("1 día va en singular", () => {
    expect(renderServiceTerms("Garantía de {{garantia_dias}}.", 1)).toBe("Garantía de 1 día.");
  });

  it("sin garantía: el texto predeterminado declara que NO hay garantía y no dice '0 días'", () => {
    for (const days of [0, null, undefined]) {
      const out = renderServiceTerms(DEFAULT_SERVICE_TERMS, days);
      expect(out).toContain(`1. GARANTÍA: ${NO_WARRANTY_CLAUSE}`);
      expect(out).not.toMatch(/\b0 días/);
      expect(out).not.toContain("{{garantia_dias}}");
      expect(out).not.toContain("cuenta con");
      expect(out).toContain("Pasados 30 días");
    }
  });

  it("sin garantía: el resto de las cláusulas queda intacto", () => {
    const out = renderServiceTerms(DEFAULT_SERVICE_TERMS, 0);
    expect(out).toContain("2. DIAGNÓSTICO:");
    expect(out).toContain("7. ACEPTACIÓN:");
    expect(out.split("\n").length).toBe(DEFAULT_SERVICE_TERMS.split("\n").length);
  });

  it("sin garantía: conserva la numeración y el título de la cláusula", () => {
    const tpl = "TÉRMINOS\n\n- Garantía: {{garantia_dias}} sobre el trabajo.\n\n2. Otra cosa";
    expect(renderServiceTerms(tpl, 0)).toBe(`TÉRMINOS\n\n- Garantía: ${NO_WARRANTY_CLAUSE}\n\n2. Otra cosa`);
  });

  it("sin garantía: una línea con el placeholder en el medio se reemplaza entera", () => {
    const tpl = "A\nEl taller ofrece {{garantia_dias}} de cobertura limitada.\nB";
    const out = renderServiceTerms(tpl, 0);
    expect(out).toBe(`A\n${NO_WARRANTY_CLAUSE}\nB`);
  });

  it("sin garantía: si el placeholder aparece en varias líneas, todas se reemplazan", () => {
    const tpl = "1. Garantía: {{garantia_dias}}.\n2. Recordá: {{garantia_dias}} desde la entrega.";
    const out = renderServiceTerms(tpl, 0);
    expect(out).not.toContain("{{garantia_dias}}");
    expect(out.split("\n")).toHaveLength(2);
  });

  it("sin garantía: un texto sin placeholder no se toca", () => {
    const tpl = "Sin código de garantía.\nOtra línea.";
    expect(renderServiceTerms(tpl, 0)).toBe(tpl);
  });

  it("sin garantía: un texto de una sola línea no pierde el resto de las condiciones", () => {
    const out = renderServiceTerms("Garantía de {{garantia_dias}} y retiro en 30 días.", 0);
    expect(out).toContain("retiro en 30 días");
    expect(out).toContain("SIN GARANTÍA");
    expect(out).not.toContain("{{garantia_dias}}");
  });
});
