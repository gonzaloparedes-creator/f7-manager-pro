import { describe, expect, it } from "vitest";
import { buildSaleReceiptMessage } from "./saleReceipt";

const sale = {
  id: "abcdef123456",
  created_at: "2026-10-15T14:30:00.000Z",
  payment_method: "Efectivo",
  items: [{ product_name: "iPhone 14", quantity: 1, unit_price: 3000000 }],
};

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
