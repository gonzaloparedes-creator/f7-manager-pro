import { describe, expect, it } from "vitest";
import {
  buildPartParams,
  buildScrapDevices,
  partAvailability,
  scrapTotals,
  validatePart,
  type ScrapPart,
} from "./scrapDevice";
import type { DevicePurchaseRecord } from "./devicePurchase";

const purchase = (over: Partial<DevicePurchaseRecord> = {}): DevicePurchaseRecord => ({
  id: "p1",
  receipt_number: "CMP-0001",
  created_at: "2026-10-10T12:00:00.000Z",
  kind: "piezas",
  branch_id: null,
  device_name: "iPhone 11 pantalla rota",
  imei: null,
  seller_name: "Ana",
  seller_cedula: "123",
  seller_phone: null,
  purchase_price: 300_000,
  payment_method: "Efectivo",
  reason: null,
  checklist: [],
  accessories: [],
  notes: null,
  ...over,
});

const part = (over: Partial<ScrapPart> = {}): ScrapPart => ({
  id: "x1",
  purchase_id: "p1",
  inventory_item_id: "i1",
  part_name: "Cámara trasera",
  allocated_cost: 100_000,
  created_at: "2026-10-11T12:00:00.000Z",
  stock: 1,
  ...over,
});

describe("buildScrapDevices", () => {
  it("solo toma compras para piezas y suma lo asignado a sus piezas", () => {
    const devices = buildScrapDevices(
      [purchase(), purchase({ id: "p2", kind: "compra" })],
      [part(), part({ id: "x2", allocated_cost: 50_000 }), part({ id: "x3", purchase_id: "p2" })]
    );
    expect(devices).toHaveLength(1);
    expect(devices[0].allocated).toBe(150_000);
    expect(devices[0].unassigned).toBe(150_000);
    expect(devices[0].parts).toHaveLength(2);
  });

  it("lo sin asignar nunca queda negativo y el más reciente va primero", () => {
    const devices = buildScrapDevices(
      [purchase({ id: "old", created_at: "2026-10-01T00:00:00.000Z" }), purchase({ id: "new", created_at: "2026-10-12T00:00:00.000Z" })],
      [part({ purchase_id: "old", allocated_cost: 999_999 })]
    );
    expect(devices.map((d) => d.purchase.id)).toEqual(["new", "old"]);
    expect(devices[1].unassigned).toBe(0);
  });

  it("un equipo sin piezas tiene todo el costo sin asignar", () => {
    const [d] = buildScrapDevices([purchase()], []);
    expect(d.parts).toEqual([]);
    expect(d.unassigned).toBe(300_000);
  });
});

describe("scrapTotals", () => {
  it("resume equipos, plata invertida, asignada y equipos sin desarmar", () => {
    const devices = buildScrapDevices(
      [purchase(), purchase({ id: "p2", purchase_price: 200_000 })],
      [part({ allocated_cost: 120_000 })]
    );
    expect(scrapTotals(devices)).toEqual({
      count: 2,
      invested: 500_000,
      allocated: 120_000,
      unassigned: 380_000,
      withoutParts: 1,
      partsCount: 1,
    });
  });
  it("sin equipos da todo en cero", () => {
    expect(scrapTotals([])).toEqual({ count: 0, invested: 0, allocated: 0, unassigned: 0, withoutParts: 0, partsCount: 0 });
  });
});

describe("partAvailability", () => {
  it("distingue en stock, usada y eliminada", () => {
    expect(partAvailability({ stock: 1 })).toBe("en_stock");
    expect(partAvailability({ stock: 0 })).toBe("usada");
    expect(partAvailability({ stock: null })).toBe("eliminada");
  });
});

describe("validatePart", () => {
  it("pide el nombre", () => {
    expect(validatePart({ name: "  ", cost: "0", selling: "" }, 100)).toMatch(/nombre/);
  });
  it("el costo no puede pasarse de lo que queda por asignar", () => {
    expect(validatePart({ name: "Flex", cost: "100.001", selling: "" }, 100_000)).toMatch(/Gs\. 100\.000/);
    expect(validatePart({ name: "Flex", cost: "100.000", selling: "" }, 100_000)).toBeNull();
  });
  it("sin nada por asignar solo deja cargar piezas a costo cero", () => {
    expect(validatePart({ name: "Flex", cost: "1", selling: "" }, 0)).toMatch(/costo 0/);
    expect(validatePart({ name: "Flex", cost: "", selling: "" }, 0)).toBeNull();
  });
  it("rechaza nombres larguísimos", () => {
    expect(validatePart({ name: "a".repeat(121), cost: "", selling: "" }, 0)).toMatch(/largo/);
  });
});

describe("buildPartParams", () => {
  it("normaliza nombre y montos para la RPC", () => {
    expect(buildPartParams("p1", { name: "  Pantalla OLED ", cost: "150.000", selling: "250.000" })).toEqual({
      purchase_id: "p1",
      part_name: "Pantalla OLED",
      allocated_cost: 150_000,
      selling_price: 250_000,
    });
  });
});
