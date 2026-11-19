import { describe, expect, it } from "vitest";
import { buildSaleReceiptMessage, saleToPay } from "./saleReceipt";

const sale = {
  id: "abcdef123456",
  created_at: "2026-10-15T14:30:00.000Z",
  payment_method: "Efectivo",
  items: [{ product_name: "iPhone 14", quantity: 1, unit_price: 3000000 }],
};

describe("saleToPay", () => {
  it("es el total menos canje y seña, y nunca negativo", () => {
    expect(saleToPay(sale)).toBe(3000000);
    expect(saleToPay({ ...sale, deposit: 500000 })).toBe(2500000);
    expect(saleToPay({ ...sale, deposit: 500000, trade_in: { device_name: "X", value: 1000000 } })).toBe(1500000);
    expect(saleToPay({ ...sale, deposit: 3000000, trade_in: { device_name: "X", value: 1000000 } })).toBe(0);
  });
});

describe("buildSaleReceiptMessage", () => {
  it("sin canje muestra el total", () => {
    const msg = buildSaleReceiptMessage(sale, { businessName: "Seven Store" });
    expect(msg).toContain("*Total: Gs. 3.000.000*");
    expect(msg).not.toContain("Equipo recibido");
  });

  it("con canje muestra el equipo recibido y lo que se paga", () => {
    const msg = buildSaleReceiptMessage(
      { ...sale, trade_in: { device_name: "iPhone 11", value: 1200000 } },
      { businessName: "Seven Store" }
    );
    expect(msg).toContain("Subtotal: Gs. 3.000.000");
    expect(msg).toContain("Equipo recibido (iPhone 11): -Gs. 1.200.000");
    expect(msg).toContain("*A pagar: Gs. 1.800.000*");
  });

  it("con seña de reserva muestra la seña ya abonada y lo que se paga ahora", () => {
    const msg = buildSaleReceiptMessage({ ...sale, deposit: 500000 }, {});
    expect(msg).toContain("Subtotal: Gs. 3.000.000");
    expect(msg).toContain("Seña ya abonada: -Gs. 500.000");
    expect(msg).toContain("*A pagar: Gs. 2.500.000*");
    expect(msg).not.toContain("Equipo recibido");
  });

  it("con canje y seña los resta a los dos", () => {
    const msg = buildSaleReceiptMessage(
      { ...sale, deposit: 500000, trade_in: { device_name: "iPhone 11", value: 1200000 } },
      {}
    );
    expect(msg).toContain("Equipo recibido (iPhone 11): -Gs. 1.200.000");
    expect(msg).toContain("Seña ya abonada: -Gs. 500.000");
    expect(msg).toContain("*A pagar: Gs. 1.300.000*");
  });

  it("una seña en cero no cambia el comprobante", () => {
    const msg = buildSaleReceiptMessage({ ...sale, deposit: 0 }, {});
    expect(msg).toContain("*Total: Gs. 3.000.000*");
    expect(msg).not.toContain("Seña");
  });

  describe("con descuento", () => {
    const discounted = {
      ...sale,
      items: [
        { product_name: "Glass 5d A07", quantity: 1, unit_price: 18000, unit_price_before_discount: 30000 },
        { product_name: "Estuche Samsung A07", quantity: 1, unit_price: 12000, unit_price_before_discount: 20000 },
      ],
    };

    it("muestra cada producto a precio de lista y el descuento aparte", () => {
      const msg = buildSaleReceiptMessage(discounted, {});
      expect(msg).toContain("• 1 x Glass 5d A07 — Gs. 30.000");
      expect(msg).toContain("• 1 x Estuche Samsung A07 — Gs. 20.000");
      expect(msg).toContain("Subtotal: Gs. 50.000");
      expect(msg).toContain("Descuento: -Gs. 20.000");
      expect(msg).toContain("*Total: Gs. 30.000*");
    });

    it("lo que se cobra sigue siendo el precio rebajado", () => {
      expect(saleToPay(discounted)).toBe(30000);
    });

    it("sin descuento no escribe subtotal ni descuento", () => {
      const msg = buildSaleReceiptMessage(sale, {});
      expect(msg).not.toContain("Descuento");
      expect(msg).not.toContain("Subtotal");
    });

    it("con descuento y canje: subtotal a lista, descuento, equipo recibido y lo que se paga", () => {
      const msg = buildSaleReceiptMessage(
        {
          ...sale,
          items: [{ product_name: "iPhone 14", quantity: 1, unit_price: 2700000, unit_price_before_discount: 3000000 }],
          trade_in: { device_name: "iPhone 11", value: 1200000 },
        },
        {}
      );
      expect(msg).toContain("Subtotal: Gs. 3.000.000");
      expect(msg).toContain("Descuento: -Gs. 300.000");
      expect(msg).toContain("Equipo recibido (iPhone 11): -Gs. 1.200.000");
      expect(msg).toContain("*A pagar: Gs. 1.500.000*");
      expect(msg).not.toContain("*Total:");
    });
  });

  it("sin garantía registrada no escribe líneas de garantía ni IMEI", () => {
    const msg = buildSaleReceiptMessage(sale, {});
    expect(msg).not.toContain("IMEI");
    expect(msg).not.toContain("arantía");
  });

  it("con garantía muestra IMEI, vencimiento y la nota de conservar el comprobante", () => {
    const msg = buildSaleReceiptMessage(
      { ...sale, items: [{ ...sale.items[0], imei: "356938035643809", warranty_days: 30 }] },
      {}
    );
    expect(msg).toContain("IMEI: 356938035643809");
    expect(msg).toContain("Garantía: 30 días (hasta 14/11/2026)");
    expect(msg).toContain("comprobante de garantía");
  });

  it("deja constancia de la venta sin garantía y no pide guardar el mensaje", () => {
    const msg = buildSaleReceiptMessage(
      { ...sale, items: [{ ...sale.items[0], imei: "356938035643809", warranty_days: 0 }] },
      {}
    );
    expect(msg).toContain("Sin garantía");
    expect(msg).not.toContain("comprobante de garantía");
  });
});
