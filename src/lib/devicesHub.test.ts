import { describe, expect, it } from "vitest";
import {
  buildDeviceAlerts,
  hasDeviceActivity,
  hubKpis,
  matchesDataFilter,
  monthStartIso,
  type HubItem,
} from "./devicesHub";

const NOW = new Date("2026-10-16T12:00:00");

const device = (over: Partial<HubItem> = {}): HubItem => ({
  id: "d1",
  is_device: true,
  stock: 1,
  cost_price: 2_000_000,
  selling_price: 3_000_000,
  image_url: "https://x.test/a.jpg",
  imei: "356938035643809",
  created_at: "2026-10-10T12:00:00.000Z",
  ...over,
});

describe("matchesDataFilter", () => {
  it("detecta equipos en stock sin foto, sin precio o sin IMEI", () => {
    expect(matchesDataFilter(device({ image_url: null }), "no_photo")).toBe(true);
    expect(matchesDataFilter(device(), "no_photo")).toBe(false);
    expect(matchesDataFilter(device({ selling_price: 0 }), "no_price")).toBe(true);
    expect(matchesDataFilter(device({ selling_price: "0" }), "no_price")).toBe(true);
    expect(matchesDataFilter(device({ imei: "  " }), "no_imei")).toBe(true);
    expect(matchesDataFilter(device({ imei: null }), "no_imei")).toBe(true);
    expect(matchesDataFilter(device(), "no_imei")).toBe(false);
  });
  it("ignora lo vendido y lo que no es un equipo", () => {
    expect(matchesDataFilter(device({ stock: 0, image_url: null }), "no_photo")).toBe(false);
    expect(matchesDataFilter(device({ is_device: false, image_url: null }), "no_photo")).toBe(false);
  });
});

describe("hubKpis", () => {
  it("cuenta stock, a la venta, reservados y lo vendido en el mes", () => {
    const k = hubKpis({
      items: [
        device({ id: "a" }),
        device({ id: "b", cost_price: 1_000_000, selling_price: 1_500_000 }),
        device({ id: "c", selling_price: 0 }),
        device({ id: "d", stock: 0 }),
        device({ id: "e", is_device: false }),
      ],
      activeReservations: [{ inventory_item_id: "b", deposit_amount: 300_000 }],
      monthSales: [
        { quantity: 1, unit_price: 2_800_000, unit_cost: 2_000_000 },
        { quantity: 1, unit_price: 1_200_000, unit_cost: "1000000" },
      ],
    });
    expect(k.inStock).toEqual({ count: 3, cost: 5_000_000 });
    expect(k.forSale).toEqual({ count: 1, potential: 3_000_000 });
    expect(k.reserved).toEqual({ count: 1, deposits: 300_000 });
    expect(k.soldMonth).toEqual({ count: 2, revenue: 4_000_000, profit: 1_000_000, profitComplete: true });
  });

  it("una reserva de un equipo que ya no está en stock no cuenta", () => {
    const k = hubKpis({
      items: [device({ id: "a", stock: 0 })],
      activeReservations: [{ inventory_item_id: "a", deposit_amount: 100_000 }, { inventory_item_id: null, deposit_amount: 5 }],
      monthSales: [],
    });
    expect(k.reserved).toEqual({ count: 0, deposits: 0 });
  });

  it("una venta sin costo guardado no inventa ganancia y avisa que el dato es parcial", () => {
    const k = hubKpis({
      items: [],
      activeReservations: [],
      monthSales: [
        { quantity: 1, unit_price: 1_000_000, unit_cost: null },
        { quantity: 2, unit_price: 500_000, unit_cost: 300_000 },
      ],
    });
    expect(k.soldMonth.profit).toBe(400_000);
    expect(k.soldMonth.profitComplete).toBe(false);
    expect(k.soldMonth.revenue).toBe(2_000_000);
    expect(k.soldMonth.count).toBe(3);
  });

  it("sin nada da todo en cero", () => {
    const k = hubKpis({ items: [], activeReservations: [], monthSales: [] });
    expect(k.inStock.count + k.forSale.count + k.reserved.count + k.soldMonth.count).toBe(0);
    expect(k.soldMonth.profitComplete).toBe(true);
  });
});

describe("buildDeviceAlerts", () => {
  const base = { activeReservations: [], scrapWithoutParts: 0, canViewStock: true, now: NOW };

  it("no avisa nada cuando está todo en orden", () => {
    expect(buildDeviceAlerts({ ...base, items: [device()] })).toEqual([]);
  });

  it("avisa lo que falta con el singular y el plural correctos", () => {
    const alerts = buildDeviceAlerts({
      ...base,
      items: [device({ id: "a", image_url: null }), device({ id: "b", image_url: null }), device({ id: "c", imei: null })],
    });
    expect(alerts.map((a) => a.text)).toEqual([
      "2 equipos en stock sin foto",
      "1 equipo en stock sin IMEI cargado",
    ]);
    expect(alerts[0].target).toEqual({ tab: "catalogo", filter: "no_photo" });
  });

  it("los detenidos solo se avisan a quien puede ver el stock", () => {
    const old = device({ created_at: "2026-08-01T00:00:00.000Z" });
    expect(buildDeviceAlerts({ ...base, items: [old] }).map((a) => a.key)).toEqual(["stale"]);
    expect(buildDeviceAlerts({ ...base, canViewStock: false, items: [old] })).toEqual([]);
  });

  it("avisa reservas vencidas y chatarra sin desarmar, cada una a su pestaña", () => {
    const alerts = buildDeviceAlerts({
      ...base,
      items: [],
      activeReservations: [
        { status: "activa", expires_on: "2026-10-10" },
        { status: "activa", expires_on: "2026-10-20" },
      ],
      scrapWithoutParts: 2,
    });
    expect(alerts.map((a) => [a.key, a.count, a.target.tab])).toEqual([
      ["overdue_reservations", 1, "reservas"],
      ["scrap_without_parts", 2, "chatarra"],
    ]);
    expect(alerts[0].text).toBe("1 reserva vencida sin resolver");
  });
});

describe("hasDeviceActivity", () => {
  it("es verdad si hay un equipo, una compra o una reserva", () => {
    expect(hasDeviceActivity({ items: [{ is_device: false }], purchaseCount: 0, reservationCount: 0 })).toBe(false);
    expect(hasDeviceActivity({ items: [{ is_device: true }], purchaseCount: 0, reservationCount: 0 })).toBe(true);
    expect(hasDeviceActivity({ items: [], purchaseCount: 1, reservationCount: 0 })).toBe(true);
    expect(hasDeviceActivity({ items: [], purchaseCount: 0, reservationCount: 1 })).toBe(true);
  });
});

describe("monthStartIso", () => {
  it("es el primer día del mes a la medianoche, hora local", () => {
    const d = new Date(monthStartIso(new Date("2026-10-16T15:00:00")));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 1, 0]);
  });
});
