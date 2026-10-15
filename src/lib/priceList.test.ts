import { describe, expect, it } from "vitest";
import { buildPriceList, type PriceListItem } from "./priceList";

const cats: Record<string, string> = { c1: "Celulares", c2: "Accesorios" };
const categoryName = (id: string | null) => (id ? cats[id] ?? null : null);
const now = new Date(2026, 9, 15, 12, 0, 0);

type TestItem = PriceListItem & { imei?: string; cost_price?: number };

const item = (over: Partial<TestItem> & { name: string }): TestItem => ({
  stock: 1,
  selling_price: 100000,
  category_id: "c1",
  ...over,
});

describe("buildPriceList", () => {
  it("agrupa por categoría, ordena por nombre y deja 'Sin categoría' al final", () => {
    const { text, included } = buildPriceList({
      items: [
        item({ name: "Funda", category_id: "c2", selling_price: 30000 }),
        item({ name: "iPhone 13 128GB", selling_price: 3500000 }),
        item({ name: "Cable suelto", category_id: null, selling_price: 10000 }),
        item({ name: "iPhone 11 64GB", selling_price: 1800000 }),
      ],
      categoryName,
      businessName: "Seven Store",
      now,
    });
    expect(included).toBe(4);
    expect(text.split("\n")).toEqual([
      "*Seven Store — Lista de precios*",
      "15/10/2026",
      "",
      "*Accesorios*",
      "• Funda — Gs. 30.000",
      "",
      "*Celulares*",
      "• iPhone 11 64GB — Gs. 1.800.000",
      "• iPhone 13 128GB — Gs. 3.500.000",
      "",
      "*Sin categoría*",
      "• Cable suelto — Gs. 10.000",
    ]);
  });

  it("omite agotados y sin precio, y los cuenta aparte", () => {
    const res = buildPriceList({
      items: [
        item({ name: "Hay stock" }),
        item({ name: "Agotado", stock: 0 }),
        item({ name: "Sin precio", selling_price: 0 }),
        item({ name: "Precio nulo", selling_price: null }),
      ],
      categoryName,
      now,
    });
    expect(res.included).toBe(1);
    expect(res.withoutStock).toBe(1);
    expect(res.withoutPrice).toBe(2);
    expect(res.text).toContain("Hay stock");
    expect(res.text).not.toContain("Agotado");
    expect(res.text).not.toContain("Sin precio");
    expect(res.text).not.toContain("Precio nulo");
  });

  it("no expone IMEI, costo ni cantidades de stock", () => {
    const { text } = buildPriceList({
      items: [item({ name: "iPhone 12", stock: 7, imei: "356938035643809", cost_price: 900000 })],
      categoryName,
      now,
    });
    expect(text).not.toContain("356938035643809");
    expect(text).not.toContain("900.000");
    expect(text).not.toContain("7");
  });

  it("agrega la batería % de los equipos que la tienen, incluso 0%", () => {
    const { text } = buildPriceList({
      items: [
        item({ name: "iPhone 13 128GB", selling_price: 3500000, battery_health: 89 }),
        item({ name: "iPhone 11 64GB", selling_price: 1800000, battery_health: null }),
        item({ name: "iPhone X", selling_price: 900000, battery_health: 0 }),
        item({ name: "iPhone XR", selling_price: 1000000 }),
      ],
      categoryName,
      now,
    });
    expect(text).toContain("• iPhone 13 128GB · Batería 89% — Gs. 3.500.000");
    expect(text).toContain("• iPhone 11 64GB — Gs. 1.800.000");
    expect(text).toContain("• iPhone X · Batería 0% — Gs. 900.000");
    expect(text).toContain("• iPhone XR — Gs. 1.000.000");
  });

  it("muestra la sucursal en el encabezado cuando se indica", () => {
    const { text } = buildPriceList({ items: [item({ name: "A" })], categoryName, branchName: "Casa Central", now });
    expect(text.split("\n")[1]).toBe("Casa Central · 15/10/2026");
  });

  it("sin nombre de negocio usa un título genérico", () => {
    const { text } = buildPriceList({ items: [item({ name: "A" })], categoryName, businessName: "  ", now });
    expect(text.split("\n")[0]).toBe("*Lista de precios*");
  });

  it("una categoría borrada o desconocida cae en 'Sin categoría'", () => {
    const { text } = buildPriceList({ items: [item({ name: "A", category_id: "zzz" })], categoryName, now });
    expect(text).toContain("*Sin categoría*");
  });

  it("sin artículos ofrecibles devuelve included 0", () => {
    const res = buildPriceList({ items: [item({ name: "A", stock: 0 })], categoryName, now });
    expect(res.included).toBe(0);
  });
});
