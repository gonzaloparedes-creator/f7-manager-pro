import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CURRENCY, setActiveCurrency } from "./currency";
import { buildOrderMessageVars, getPreviewVars, renderMessage, resolveStatusBody } from "./customerMessages";
import { parseMinPrice } from "./devicePricing";
import { buildSaleReceiptMessage } from "./saleReceipt";

// La moneda activa es global (ver currency.ts): cada prueba la deja como estaba.
afterEach(() => setActiveCurrency(DEFAULT_CURRENCY));

const order = {
  customer_name: "Juan Pérez",
  customer_phone: "0975153380",
  device_type: "Celular",
  order_number: "ORD-0001",
  tracking_token: "tok123",
  quote_amount: 350,
  deposit_amount: 100,
};

const sale = {
  id: "abcdef123456",
  created_at: "2026-10-15T14:30:00.000Z",
  payment_method: "Efectivo",
  items: [{ product_name: "iPhone 14", quantity: 1, unit_price: 800 }],
};

describe("con la empresa en dólares", () => {
  it("los mensajes de WhatsApp muestran el presupuesto y el saldo en US$", () => {
    setActiveCurrency("USD");
    const vars = buildOrderMessageVars(order, { taller: "Taller" });
    expect(vars.monto).toBe("US$ 350");
    expect(vars.saldo).toBe("US$ 250");
    const msg = renderMessage("Presupuesto {{monto}}, saldo {{saldo}}", vars);
    expect(msg).toBe("Presupuesto US$ 350, saldo US$ 250");
    expect(msg).not.toContain("Gs.");
  });

  it("en guaraníes siguen saliendo igual que siempre", () => {
    const vars = buildOrderMessageVars({ ...order, quote_amount: 350000, deposit_amount: 100000 }, { taller: "Taller" });
    expect(vars.monto).toBe("Gs. 350.000");
    expect(vars.saldo).toBe("Gs. 250.000");
  });

  it("los ejemplos de la vista previa de plantillas siguen la moneda", () => {
    expect(getPreviewVars().monto).toBe("Gs. 350.000");
    setActiveCurrency("USD");
    expect(getPreviewVars().monto).toBe("US$ 350.000");
    expect(getPreviewVars().saldo).toBe("US$ 200.000");
  });

  it("el comprobante de venta por WhatsApp muestra US$", () => {
    setActiveCurrency("USD");
    const msg = buildSaleReceiptMessage(sale, { businessName: "Tienda" });
    expect(msg).toContain("*Total: US$ 800*");
    expect(msg).not.toContain("Gs.");
  });

  it("los mensajes de validación nombran la moneda de la empresa", () => {
    expect(parseMinPrice("12.5", 100).error).toContain("en Gs., sin decimales");
    setActiveCurrency("USD");
    expect(parseMinPrice("12.5", 100).error).toContain("en US$, sin decimales");
  });

  it("el texto de las plantillas por defecto no lleva ninguna moneda escrita", () => {
    expect(resolveStatusBody("listo", [])).not.toMatch(/Gs\.|US\$/);
    expect(resolveStatusBody("enviado", [])).not.toMatch(/Gs\.|US\$/);
  });
});
