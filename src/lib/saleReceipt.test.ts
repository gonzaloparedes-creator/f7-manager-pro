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
});
