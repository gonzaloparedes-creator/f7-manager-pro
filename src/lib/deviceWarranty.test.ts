import { describe, expect, it } from "vitest";
import {
  clampWarrantyDays,
  deviceWarranty,
  entryFromDeviceSale,
  entryFromRepairOrder,
  matchesWarrantyFilter,
  matchesWarrantySearch,
  pluralDays,
  warrantyDocumentLine,
  warrantyStatusLabel,
  warrantySummary,
  type WarrantyEntry,
} from "./deviceWarranty";

const SOLD = "2026-10-01T12:00:00.000Z";
const at = (iso: string) => new Date(iso);

describe("deviceWarranty", () => {
  it("garantía vigente con días de sobra", () => {
    const w = deviceWarranty(SOLD, 30, at("2026-10-15T12:00:00.000Z"));
    expect(w.kind).toBe("active");
    expect(w.daysLeft).toBe(16);
    expect(warrantyStatusLabel(w)).toBe("Vigente · quedan 16 días");
  });

  it("por vencer dentro de la ventana de aviso", () => {
    const w = deviceWarranty(SOLD, 30, at("2026-10-29T12:00:00.000Z"));
    expect(w.kind).toBe("due");
    expect(w.daysLeft).toBe(2);
    expect(warrantyStatusLabel(w)).toBe("Vence en 2 días");
  });

  it("el último día todavía está vigente y dice que vence hoy", () => {
    const w = deviceWarranty(SOLD, 30, at("2026-10-31T13:00:00.000Z"));
    expect(w.kind).toBe("due");
    expect(w.daysLeft).toBe(0);
    expect(warrantyStatusLabel(w)).toBe("Vence hoy");
  });

  it("vencida al día siguiente", () => {
    const w = deviceWarranty(SOLD, 30, at("2026-11-01T13:00:00.000Z"));
    expect(w.kind).toBe("expired");
    expect(w.daysLeft).toBe(-1);
    expect(warrantyStatusLabel(w)).toBe("Vencida hace 1 día");
  });

  it("distingue sin garantía de garantía no registrada", () => {
    expect(deviceWarranty(SOLD, 0, new Date()).kind).toBe("none");
    expect(deviceWarranty(SOLD, null, new Date()).kind).toBe("unrecorded");
    expect(deviceWarranty(SOLD, undefined, new Date()).kind).toBe("unrecorded");
    expect(warrantyStatusLabel(deviceWarranty(SOLD, 0, new Date()))).toBe("Sin garantía");
    expect(warrantyStatusLabel(deviceWarranty(SOLD, null, new Date()))).toBe("Sin garantía registrada");
  });

  it("clampWarrantyDays acota y redondea", () => {
    expect(clampWarrantyDays(-5)).toBe(0);
    expect(clampWarrantyDays(45.6)).toBe(46);
    expect(clampWarrantyDays(99999)).toBe(3650);
    expect(clampWarrantyDays(Number.NaN)).toBe(0);
  });

  it("pluralDays", () => {
    expect(pluralDays(1)).toBe("1 día");
    expect(pluralDays(0)).toBe("0 días");
    expect(pluralDays(-3)).toBe("3 días");
  });
});

describe("warrantyDocumentLine", () => {
  it("no escribe nada si la venta no registró garantía", () => {
    expect(warrantyDocumentLine(SOLD, null)).toBeNull();
    expect(warrantyDocumentLine(SOLD, undefined)).toBeNull();
  });

  it("deja constancia de que se vendió sin garantía", () => {
    expect(warrantyDocumentLine(SOLD, 0)).toBe("Sin garantía");
  });

  it("indica días y fecha de vencimiento", () => {
    expect(warrantyDocumentLine(SOLD, 30)).toBe("Garantía: 30 días (hasta 31/10/2026)");
    expect(warrantyDocumentLine(SOLD, 1)).toMatch(/^Garantía: 1 día \(hasta 02\/10\/2026\)$/);
  });
});

describe("filtros y resumen", () => {
  const now = at("2026-10-29T12:00:00.000Z");
  const entry = (over: Partial<WarrantyEntry>): WarrantyEntry => ({
    key: "k",
    source: "venta",
    title: "iPhone 13",
    imei: "356938035000001",
    buyerName: "Juan Pérez",
    buyerPhone: "0981 123 456",
    startedAt: SOLD,
    warrantyDays: 30,
    reference: "Ticket #ABC123",
    ...over,
  });

  it("matchesWarrantyFilter", () => {
    const due = deviceWarranty(SOLD, 30, now);
    const expired = deviceWarranty(SOLD, 10, now);
    const active = deviceWarranty(SOLD, 90, now);
    expect(matchesWarrantyFilter(due, "due")).toBe(true);
    expect(matchesWarrantyFilter(due, "active")).toBe(true);
    expect(matchesWarrantyFilter(active, "due")).toBe(false);
    expect(matchesWarrantyFilter(active, "active")).toBe(true);
    expect(matchesWarrantyFilter(expired, "expired")).toBe(true);
    expect(matchesWarrantyFilter(expired, "active")).toBe(false);
    expect(matchesWarrantyFilter(expired, "all")).toBe(true);
    expect(matchesWarrantyFilter(deviceWarranty(SOLD, null, now), "all")).toBe(true);
    expect(matchesWarrantyFilter(deviceWarranty(SOLD, null, now), "expired")).toBe(false);
  });

  it("warrantySummary cuenta vigentes, por vencer y vencidas", () => {
    const summary = warrantySummary(
      [
        entry({ warrantyDays: 90 }),
        entry({ warrantyDays: 30 }),
        entry({ warrantyDays: 10 }),
        entry({ warrantyDays: 0 }),
        entry({ warrantyDays: null }),
      ],
      now
    );
    expect(summary).toEqual({ active: 1, due: 1, expired: 1 });
  });

  it("busca por IMEI completo o parcial", () => {
    expect(matchesWarrantySearch(entry({}), "356938035000001")).toBe(true);
    expect(matchesWarrantySearch(entry({}), "0350000")).toBe(true);
    expect(matchesWarrantySearch(entry({}), "999999")).toBe(false);
  });

  it("busca por comprador, teléfono, modelo y referencia", () => {
    expect(matchesWarrantySearch(entry({}), "juan")).toBe(true);
    expect(matchesWarrantySearch(entry({}), "iphone 13")).toBe(true);
    expect(matchesWarrantySearch(entry({}), "abc123")).toBe(true);
    expect(matchesWarrantySearch(entry({}), "981123")).toBe(true);
    expect(matchesWarrantySearch(entry({}), "maria")).toBe(false);
  });

  it("no filtra con búsqueda vacía ni compara dígitos sueltos contra el IMEI", () => {
    expect(matchesWarrantySearch(entry({}), "   ")).toBe(true);
    expect(matchesWarrantySearch(entry({ title: "Funda", buyerName: null, reference: "x" }), "35")).toBe(false);
  });

  it("tolera entradas sin IMEI ni teléfono", () => {
    const e = entry({ imei: null, buyerPhone: null });
    expect(matchesWarrantySearch(e, "356938")).toBe(false);
    expect(matchesWarrantySearch(e, "juan")).toBe(true);
  });
});

describe("armado de entradas", () => {
  it("entryFromDeviceSale usa el ticket del grupo de venta", () => {
    const e = entryFromDeviceSale({
      id: "11111111-1111-1111-1111-111111abcdef",
      product_name: "iPhone 12",
      imei: "123456789012345",
      customer_name: "Ana",
      customer_phone: null,
      created_at: SOLD,
      warranty_days: 60,
      sale_group_id: "22222222-2222-2222-2222-222222fedcba",
    });
    expect(e).toMatchObject({
      key: "venta-11111111-1111-1111-1111-111111abcdef",
      source: "venta",
      title: "iPhone 12",
      reference: "Ticket #FEDCBA",
      warrantyDays: 60,
    });
  });

  it("entryFromDeviceSale sin grupo cae al id de la fila", () => {
    const e = entryFromDeviceSale({
      id: "11111111-1111-1111-1111-111111abcdef",
      product_name: "iPhone 12",
      imei: null,
      customer_name: null,
      customer_phone: null,
      created_at: SOLD,
      warranty_days: null,
      sale_group_id: null,
    });
    expect(e.reference).toBe("Ticket #ABCDEF");
  });

  it("entryFromRepairOrder arma el título con marca y modelo", () => {
    const base = {
      id: "o1",
      order_number: "ORD-0007",
      imei: null,
      customer_name: "Luis",
      customer_phone: "0971",
      delivered_at: SOLD,
      warranty_days: 30,
    };
    expect(entryFromRepairOrder({ ...base, marca: "Samsung", modelo: "A54", device_type: "Celular" }).title).toBe("Samsung A54");
    expect(entryFromRepairOrder({ ...base, marca: null, modelo: null, device_type: "Notebook" }).title).toBe("Notebook");
    expect(entryFromRepairOrder({ ...base, marca: null, modelo: null, device_type: null }).title).toBe("Equipo");
    expect(entryFromRepairOrder({ ...base, marca: "LG", modelo: null, device_type: null })).toMatchObject({
      source: "reparacion",
      reference: "ORD-0007",
      key: "orden-o1",
    });
  });
});
