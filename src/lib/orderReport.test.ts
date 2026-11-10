import { describe, expect, it } from "vitest";
import { formatMoney } from "./currency";
import {
  buildOrderReportHtml,
  orderReportProfit,
  orderReportTotals,
  warrantyLine,
  type OrderReportData,
  type OrderReportOrder,
} from "./orderReport";

const order: OrderReportOrder = {
  order_number: "ORD-0042",
  created_at: "2026-11-03T14:30:00.000Z",
  status_label: "Listo para retirar",
  customer_name: "Rocío Saucedo",
  customer_phone: "0981 123 456",
  customer_cedula: "4.123.456",
  device_type: "Celular",
  marca: "Samsung",
  modelo: "A23",
  imei: "356938035643809",
  problems: ["Pantalla rota", "No carga"],
  problem_other: "Golpe en la esquina",
  problem_description: "Se cayó de la mesa",
  accessories: ["Funda", "SIM Card"],
  checklist: [
    { label: "Enciende", status: "ok" },
    { label: "Cámaras", status: "fail" },
  ],
  received_by_name: "Marcelo",
  assigned_technician_name: "Técnico Uno",
  branch_name: "Casa central",
  priority_label: "Alta",
  estimated_delivery_date: "2026-11-05",
  delivered_at: null,
  warranty_days: 30,
  quote_amount: 200000,
  original_quote_amount: 250000,
  deposit_amount: 100000,
  cargos_adicionales: [{ motivo: "Flete", monto: 20000 }],
  quote_response_label: "Aceptado",
  quote_response_note: "Dale, adelante",
  quote_responded_at: "2026-11-03T16:00:00.000Z",
  interruption_reason: "Esperando repuesto",
  photos: ["https://example.com/foto1.jpg", "javascript:alert(1)"],
  financial_documents: [{ name: "Presupuesto.pdf", uploaded_at: "2026-11-03T15:00:00.000Z" }],
};

const data: OrderReportData = {
  order,
  history: [
    { status_label: "Listo para retirar", note: "Ya puede venir", created_at: "2026-11-04T18:00:00.000Z", is_internal: false, image_urls: ["https://example.com/ev1.jpg"] },
    { status_label: "Recibido", note: null, created_at: "2026-11-03T14:30:00.000Z", is_internal: false, image_urls: [] },
    { status_label: "Recibido", note: "Pago registrado: seña", created_at: "2026-11-03T14:31:00.000Z", is_internal: true, image_urls: [] },
  ],
  notes: [{ note: "Se cambió la pantalla", created_at: "2026-11-04T10:00:00.000Z", author: "Técnico Uno" }],
  parts: [{ name: "Pantalla A23", quantity: 1, unit_price: 180000, unit_cost: 90000, details: null, supplier: "Proveedor SA" }],
  payments: [{ amount: 100000, method: "Efectivo", created_at: "2026-11-03T14:31:00.000Z", author: "Marcelo" }],
};

const opts = { businessName: "Tu Móvil", now: new Date("2026-11-10T12:00:00.000Z") };

describe("orderReportTotals", () => {
  it("el total suma presupuesto y cargos adicionales, y el saldo no baja de cero", () => {
    expect(orderReportTotals(order)).toEqual({ quote: 200000, cargos: 20000, total: 220000, paid: 100000, balance: 120000 });
    expect(orderReportTotals({ ...order, deposit_amount: 999999 }).balance).toBe(0);
  });

  it("tolera valores vacíos o corruptos", () => {
    const t = orderReportTotals({ quote_amount: Number.NaN, deposit_amount: 0, cargos_adicionales: [{ motivo: "x", monto: Number.NaN }] });
    expect(t).toEqual({ quote: 0, cargos: 0, total: 0, paid: 0, balance: 0 });
  });
});

describe("orderReportProfit", () => {
  it("ganancia = total - costo de repuestos, con margen sobre el total", () => {
    expect(orderReportProfit(220000, data.parts)).toEqual({ partsPrice: 180000, partsCost: 90000, profit: 130000, marginPct: 59 });
  });

  it("sin total no inventa un margen", () => {
    expect(orderReportProfit(0, []).marginPct).toBeNull();
  });
});

describe("warrantyLine", () => {
  it("sin garantía", () => {
    expect(warrantyLine({ warranty_days: 0, delivered_at: null, estimated_delivery_date: null })).toBe("Sin garantía");
  });

  it("con entrega estimada, la fecha se marca como estimada", () => {
    expect(warrantyLine({ warranty_days: 30, delivered_at: null, estimated_delivery_date: "2026-11-05" })).toMatch(/30 días, hasta el .* \(estimado\)/);
  });

  it("sin ninguna fecha, no inventa el vencimiento", () => {
    expect(warrantyLine({ warranty_days: 30, delivered_at: null, estimated_delivery_date: null })).toBe("30 días desde la entrega");
  });
});

describe("buildOrderReportHtml · versión cliente", () => {
  const html = buildOrderReportHtml(data, { ...opts, variant: "cliente", canViewCosts: true });

  it("lleva el negocio, la orden y el estado", () => {
    expect(html).toContain("Tu Móvil");
    expect(html).toContain("Orden ORD-0042");
    expect(html).toContain("Estado actual: Listo para retirar");
  });

  it("incluye lo que el cliente ya ve: historial visible, notas técnicas y fotos", () => {
    expect(html).toContain("Ya puede venir");
    expect(html).toContain("Se cambió la pantalla");
    expect(html).toContain("https://example.com/foto1.jpg");
    expect(html).toContain("https://example.com/ev1.jpg");
  });

  it("no incluye movimientos internos, nombres del equipo, teléfono, cédula ni costos", () => {
    expect(html).not.toContain("Pago registrado: seña");
    expect(html).not.toContain("Técnico Uno");
    expect(html).not.toContain("· Marcelo");
    expect(html).not.toContain("0981 123 456");
    expect(html).not.toContain("4.123.456");
    expect(html).not.toContain("Proveedor SA");
    expect(html).not.toContain("Ganancia");
    expect(html).not.toContain("Costo");
    expect(html).not.toContain("Uso interno");
  });

  it("muestra las cuentas de la orden", () => {
    expect(html).toContain(formatMoney(220000));
    expect(html).toContain(formatMoney(120000));
  });
});

describe("buildOrderReportHtml · versión interna", () => {
  it("con permiso de costos incluye movimientos internos, autores, teléfono, costos y ganancia", () => {
    const html = buildOrderReportHtml(data, { ...opts, variant: "interno", canViewCosts: true });
    expect(html).toContain("Uso interno");
    expect(html).toContain("Pago registrado: seña");
    expect(html).toContain("tag-int");
    expect(html).toContain("0981 123 456");
    expect(html).toContain("4.123.456");
    expect(html).toContain("Técnico Uno");
    expect(html).toContain("Presupuesto original");
    expect(html).toContain("Costo de repuestos");
    expect(html).toContain(formatMoney(130000));
    expect(html).toContain("costos y ganancia");
  });

  it("sin permiso de costos no los recibe en el papel", () => {
    const html = buildOrderReportHtml(data, { ...opts, variant: "interno", canViewCosts: false });
    expect(html).toContain("Pago registrado: seña");
    expect(html).not.toContain("Costo de repuestos");
    expect(html).not.toContain("Ganancia");
    expect(html).not.toContain(formatMoney(90000));
    expect(html).not.toContain("costos y ganancia");
  });
});

describe("buildOrderReportHtml · seguridad y casos borde", () => {
  it("escapa el HTML de lo que escriben las personas", () => {
    const evil: OrderReportData = {
      ...data,
      order: { ...order, customer_name: `<img src=x onerror=alert(1)>` },
      notes: [{ note: `<script>alert("x")</script>`, created_at: "2026-11-04T10:00:00.000Z", author: null }],
    };
    const html = buildOrderReportHtml(evil, { ...opts, variant: "cliente", canViewCosts: false });
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("solo imprime fotos con dirección http(s)", () => {
    const html = buildOrderReportHtml(data, { ...opts, variant: "cliente", canViewCosts: false });
    expect(html).not.toContain("javascript:");
  });

  it("ordena el historial del más viejo al más nuevo", () => {
    const html = buildOrderReportHtml(data, { ...opts, variant: "cliente", canViewCosts: false });
    expect(html.indexOf("<strong>Recibido</strong>")).toBeGreaterThan(-1);
    expect(html.indexOf("<strong>Recibido</strong>")).toBeLessThan(html.indexOf("<strong>Listo para retirar</strong>"));
  });

  it("una orden vacía no deja secciones sueltas", () => {
    const empty: OrderReportData = {
      order: {
        ...order,
        problems: [],
        problem_other: null,
        problem_description: null,
        accessories: [],
        checklist: [],
        photos: [],
        financial_documents: [],
        cargos_adicionales: [],
        quote_response_label: null,
      },
      history: [],
      notes: [],
      parts: [],
      payments: [],
    };
    const html = buildOrderReportHtml(empty, { ...opts, variant: "cliente", canViewCosts: false });
    expect(html).not.toContain("Historial de la orden");
    expect(html).not.toContain("Notas técnicas");
    expect(html).not.toContain("Repuestos usados");
    expect(html).not.toContain("Pagos registrados");
    expect(html).not.toContain("Fotos de recepción");
    expect(html).not.toContain("Documentos adjuntos");
  });

  it("la fecha de entrega estimada no se corre un día por la zona horaria", () => {
    const html = buildOrderReportHtml(data, { ...opts, variant: "cliente", canViewCosts: false });
    expect(html).toMatch(/05\/11\/2026/);
  });
});
