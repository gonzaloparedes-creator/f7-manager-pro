import { describe, expect, it } from "vitest";
import { buildPurchaseReceiptHtml, escapeHtml } from "./devicePurchaseReceipt";
import type { DevicePurchaseRecord } from "./devicePurchase";

const record = (over: Partial<DevicePurchaseRecord> = {}): DevicePurchaseRecord => ({
  id: "p1",
  receipt_number: "CMP-0007",
  created_at: "2026-10-15T14:30:00.000Z",
  branch_id: null,
  device_name: "iPhone 13 128GB",
  imei: "356938035643809",
  seller_name: "Juan Pérez",
  seller_cedula: "4.123.456",
  seller_phone: "0981 123 456",
  purchase_price: 2500000,
  payment_method: "Efectivo",
  reason: "Cambia de equipo",
  checklist: [
    { label: "Pantalla", status: "ok" },
    { label: "Cámara", status: "fail" },
  ],
  accessories: ["Cargador", "Caja"],
  notes: null,
  ...over,
});

describe("escapeHtml", () => {
  it("escapa los caracteres que permiten inyectar HTML", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;"
    );
  });
  it("tolera null y números", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(12)).toBe("12");
  });
});

describe("buildPurchaseReceiptHtml", () => {
  it("incluye número, equipo, vendedor, monto y las dos copias", () => {
    const html = buildPurchaseReceiptHtml(record(), { businessName: "Seven Store", branchName: "Centro" });
    expect(html).toContain("CMP-0007");
    expect(html).toContain("iPhone 13 128GB");
    expect(html).toContain("356938035643809");
    expect(html).toContain("Juan Pérez");
    expect(html).toContain("Gs. 2.500.000");
    expect(html).toContain("Seven Store · Centro");
    expect(html).toContain("Con fallas: Cámara");
    expect(html).toContain("Funciona: Pantalla");
    expect(html).toContain("Cargador, Caja");
    expect(html).toContain("Copia del vendedor");
    expect(html).toContain("Copia de la tienda");
  });

  it("no deja pasar HTML en los datos cargados por el usuario", () => {
    const html = buildPurchaseReceiptHtml(
      record({ seller_name: `<script>alert(1)</script>`, notes: `"><img src=x onerror=alert(2)>`, device_name: "A&B" }),
      { businessName: `<b>Taller</b>`, branchName: null }
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>Taller</b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("A&amp;B");
  });

  it("omite las filas sin dato y el estado si no se revisó nada", () => {
    const html = buildPurchaseReceiptHtml(record({ checklist: [], accessories: [], reason: null, seller_phone: null }), {
      businessName: null,
      branchName: null,
    });
    expect(html).not.toContain("<th>Estado</th>");
    expect(html).not.toContain("Accesorios entregados");
    expect(html).not.toContain("Motivo de la venta");
    expect(html).not.toContain("<th>Teléfono</th>");
  });
});
