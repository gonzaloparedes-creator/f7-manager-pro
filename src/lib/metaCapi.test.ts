import { describe, expect, it } from "vitest";
import { PRICING, type Cycle, type PlanType } from "@/lib/plans";
import {
  buildPurchaseEvent,
  normalizePhone,
  PLAN_PRICES_GS,
  purchaseValue,
  sha256Hex,
  splitName,
} from "../../supabase/functions/_shared/metaCapi";

describe("aviso de compras a Meta (report-purchase)", () => {
  it("los precios de la función son los mismos que los de la página", () => {
    for (const plan of Object.keys(PRICING) as PlanType[]) {
      for (const cycle of Object.keys(PRICING[plan]) as Cycle[]) {
        expect(PLAN_PRICES_GS[plan][cycle]).toBe(PRICING[plan][cycle].gs);
      }
    }
  });

  it("pasa los teléfonos de Paraguay a 595 sin el cero", () => {
    expect(normalizePhone("0981 123 456", "PY")).toBe("595981123456");
    expect(normalizePhone("981123456", "PY")).toBe("595981123456");
    expect(normalizePhone("+595 981 123456", "PY")).toBe("595981123456");
    expect(normalizePhone("11 5555 4444", "AR")).toBe("1155554444");
    expect(normalizePhone("", "PY")).toBe("");
  });

  it("solo manda el apellido cuando no hay dudas de cuál es", () => {
    expect(splitName("Marcelo Saucedo")).toEqual({ fn: "marcelo", ln: "saucedo" });
    expect(splitName("Matías Exequiel Ortega Barrios")).toEqual({ fn: "matias", ln: "ortega" });
    expect(splitName("Juan Carlos Pérez")).toEqual({ fn: "juan", ln: "" });
  });

  it("usa lo cobrado y, si falta, el precio del plan", () => {
    expect(purchaseValue("business", "anual", 1120000)).toBe(1120000);
    expect(purchaseValue("pro", "mensual", null)).toBe(95000);
  });

  it("arma el evento Purchase con los datos cifrados y el código del link", async () => {
    const ev = await buildPurchaseEvent({
      code: "AB12CD34EF",
      usedAt: "2026-11-04T17:38:35Z",
      planType: "pro",
      billingCycle: "mensual",
      amountGs: null,
      email: " Ana@Example.com ",
      phone: "0981 123 456",
      fullName: "Ana Gómez",
      country: "PY",
    });
    expect(ev.event_name).toBe("Purchase");
    expect(ev.event_id).toBe("alta-AB12CD34EF");
    expect(ev.event_time).toBe(Math.floor(Date.parse("2026-11-04T17:38:35Z") / 1000));
    expect(ev.custom_data).toEqual({ currency: "PYG", value: 95000, order_id: "AB12CD34EF", content_name: "pro mensual" });
    expect(ev.user_data.em).toEqual([await sha256Hex("ana@example.com")]);
    expect(ev.user_data.ph).toEqual([await sha256Hex("595981123456")]);
    expect(ev.user_data.fn).toEqual([await sha256Hex("ana")]);
    expect(ev.user_data.ln).toEqual([await sha256Hex("gomez")]);
    expect(ev.user_data.country).toEqual([await sha256Hex("py")]);
    // nada legible viaja a Meta
    expect(JSON.stringify(ev.user_data)).not.toMatch(/ana|example|981/);
  });

  it("no manda campos vacíos", async () => {
    const ev = await buildPurchaseEvent({
      code: "AB12CD34EF", usedAt: "2026-11-04T17:38:35Z", planType: "starter", billingCycle: "mensual",
      amountGs: null, email: "x@y.com", phone: "", fullName: "", country: "OTHER",
    });
    expect(Object.keys(ev.user_data)).toEqual(["em"]);
  });
});
