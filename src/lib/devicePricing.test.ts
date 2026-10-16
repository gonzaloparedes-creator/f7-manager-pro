import { describe, expect, it } from "vitest";
import { belowMinPriceNames, isBelowMinPrice, parseMinPrice, toMinPrice } from "./devicePricing";
import { buildPriceList } from "./priceList";

describe("parseMinPrice", () => {
  it("vacío o 0 significa sin mínimo", () => {
    expect(parseMinPrice("", 1000000)).toEqual({ value: null, error: null });
    expect(parseMinPrice("  ", 1000000)).toEqual({ value: null, error: null });
    expect(parseMinPrice(null, 1000000)).toEqual({ value: null, error: null });
    expect(parseMinPrice("0", 1000000)).toEqual({ value: null, error: null });
  });
  it("acepta un monto entero hasta el precio de venta incluido", () => {
    expect(parseMinPrice("900000", 1000000).value).toBe(900000);
    expect(parseMinPrice(" 1000000 ", 1000000).value).toBe(1000000);
  });
  it("rechaza decimales, negativos y texto", () => {
    for (const bad of ["12.5", "-5", "abc", "1e5", "9 000"]) {
      expect(parseMinPrice(bad, 1000000).error).toMatch(/sin decimales/);
    }
  });
  it("rechaza un mínimo mayor que el precio de venta", () => {
    expect(parseMinPrice("1000001", 1000000).error).toMatch(/no puede ser mayor/);
    expect(parseMinPrice("500", 0).error).toMatch(/no puede ser mayor/);
  });
});

describe("isBelowMinPrice", () => {
  it("avisa solo si hay mínimo y el precio queda estrictamente por debajo", () => {
    expect(isBelowMinPrice(850000, 900000)).toBe(true);
    expect(isBelowMinPrice(900000, 900000)).toBe(false);
    expect(isBelowMinPrice(950000, "900000")).toBe(false);
    expect(isBelowMinPrice(1, null)).toBe(false);
    expect(isBelowMinPrice(1, undefined)).toBe(false);
    expect(isBelowMinPrice(1, 0)).toBe(false);
  });
  it("toMinPrice ignora valores inválidos", () => {
    expect(toMinPrice("")).toBeNull();
    expect(toMinPrice("abc")).toBeNull();
    expect(toMinPrice(-3)).toBeNull();
    expect(toMinPrice("750000")).toBe(750000);
  });
});

describe("belowMinPriceNames", () => {
  it("devuelve solo los nombres de las líneas por debajo del mínimo", () => {
    expect(
      belowMinPriceNames([
        { name: "iPhone 13", unitPrice: 800000, minPrice: 900000 },
        { name: "Funda", unitPrice: 10000, minPrice: null },
        { name: "iPhone 12", unitPrice: 700000, minPrice: 650000 },
      ]),
    ).toEqual(["iPhone 13"]);
  });
});

describe("la lista de WhatsApp no filtra el mínimo", () => {
  it("no incluye min_price aunque el equipo lo traiga", () => {
    const { text } = buildPriceList({
      items: [{ name: "iPhone 13", stock: 1, selling_price: 1000000, category_id: null, battery_health: 89, min_price: 912345 }],
      categoryName: () => null,
      now: new Date(2026, 9, 15),
    });
    expect(text).toContain("iPhone 13");
    expect(text).not.toContain("912");
    expect(text).not.toMatch(/m[ií]nimo/i);
  });
});
