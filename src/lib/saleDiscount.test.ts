import { describe, expect, it } from "vitest";
import { discountOf, lineListPrice, listTotalOf } from "./saleDiscount";

// La venta del cliente (ticket 3A2233): un descuento de 40.000 repartido en el mismo
// porcentaje (40 %) en cada línea; en la base queda el precio cobrado y el de antes.
const clientSale = [
  { quantity: 1, unit_price: 18000, unit_price_before_discount: 30000 },
  { quantity: 1, unit_price: 12000, unit_price_before_discount: 20000 },
  { quantity: 1, unit_price: 12000, unit_price_before_discount: 20000 },
  { quantity: 1, unit_price: 18000, unit_price_before_discount: 30000 },
];

describe("lineListPrice", () => {
  it("es el precio guardado de antes del descuento", () => {
    expect(lineListPrice({ unit_price: 18000, unit_price_before_discount: 30000 })).toBe(30000);
  });

  it("sin el dato (ventas anteriores o sin descuento) es el precio cobrado", () => {
    expect(lineListPrice({ unit_price: 18000 })).toBe(18000);
    expect(lineListPrice({ unit_price: 18000, unit_price_before_discount: null })).toBe(18000);
    expect(lineListPrice({ unit_price: 18000, unit_price_before_discount: undefined })).toBe(18000);
  });

  it("un precio de antes que no es mayor al cobrado no inventa un descuento", () => {
    expect(lineListPrice({ unit_price: 18000, unit_price_before_discount: 18000 })).toBe(18000);
    expect(lineListPrice({ unit_price: 18000, unit_price_before_discount: 15000 })).toBe(18000);
    expect(lineListPrice({ unit_price: 18000, unit_price_before_discount: 0 })).toBe(18000);
  });

  it("acepta números que llegan como texto (numeric de la base) y valores vacíos", () => {
    expect(lineListPrice({ unit_price: "18000", unit_price_before_discount: "30000" })).toBe(30000);
    expect(lineListPrice({ unit_price: null, unit_price_before_discount: null })).toBe(0);
    expect(lineListPrice({ unit_price: 0, unit_price_before_discount: 30000 })).toBe(30000);
  });
});

describe("listTotalOf / discountOf", () => {
  it("la venta del cliente: lista 100.000, cobrado 60.000, descuento 40.000", () => {
    expect(listTotalOf(clientSale)).toBe(100000);
    expect(discountOf(clientSale)).toBe(40000);
  });

  it("multiplica por la cantidad", () => {
    const lines = [{ quantity: 3, unit_price: 9000, unit_price_before_discount: 10000 }];
    expect(listTotalOf(lines)).toBe(30000);
    expect(discountOf(lines)).toBe(3000);
  });

  it("sin descuento no hay nada que mostrar", () => {
    const lines = [
      { quantity: 1, unit_price: 50000 },
      { quantity: 2, unit_price: 15000, unit_price_before_discount: null },
    ];
    expect(listTotalOf(lines)).toBe(80000);
    expect(discountOf(lines)).toBe(0);
  });

  it("una venta con una línea con descuento y otra sin", () => {
    const lines = [
      { quantity: 1, unit_price: 18000, unit_price_before_discount: 30000 },
      { quantity: 1, unit_price: 12000 },
    ];
    expect(listTotalOf(lines)).toBe(42000);
    expect(discountOf(lines)).toBe(12000);
  });

  it("sin líneas es cero", () => {
    expect(listTotalOf([])).toBe(0);
    expect(discountOf([])).toBe(0);
  });

  it("lista menos descuento es siempre lo cobrado", () => {
    const cobrado = clientSale.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    expect(listTotalOf(clientSale) - discountOf(clientSale)).toBe(cobrado);
  });
});
