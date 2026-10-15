import { describe, expect, it } from "vitest";
import {
  daysInStock,
  daysInStockLabel,
  hasDevicesInStock,
  isStaleDevice,
  staleDeviceSummary,
} from "./deviceStock";

const NOW = new Date("2026-10-15T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const device = (days: number, over: Partial<{ stock: number; cost_price: number; is_device: boolean }> = {}) => ({
  is_device: true,
  stock: 1,
  cost_price: 1_000_000,
  created_at: daysAgo(days),
  ...over,
});

describe("daysInStock", () => {
  it("cuenta días completos desde que ingresó", () => {
    expect(daysInStock(daysAgo(0), NOW)).toBe(0);
    expect(daysInStock(daysAgo(29), NOW)).toBe(29);
    expect(daysInStock(daysAgo(45), NOW)).toBe(45);
  });

  it("devuelve null sin fecha o con fecha inválida, y nunca negativo", () => {
    expect(daysInStock(null, NOW)).toBeNull();
    expect(daysInStock(undefined, NOW)).toBeNull();
    expect(daysInStock("no-es-fecha", NOW)).toBeNull();
    expect(daysInStock(daysAgo(-3), NOW)).toBe(0);
  });
});

describe("isStaleDevice", () => {
  it("marca como detenido desde los 30 días", () => {
    expect(isStaleDevice(device(29), NOW)).toBe(false);
    expect(isStaleDevice(device(30), NOW)).toBe(true);
    expect(isStaleDevice(device(90), NOW)).toBe(true);
  });

  it("ignora productos que no son equipos y equipos ya vendidos", () => {
    expect(isStaleDevice(device(90, { is_device: false }), NOW)).toBe(false);
    expect(isStaleDevice(device(90, { stock: 0 }), NOW)).toBe(false);
  });

  it("no marca nada si no hay fecha de ingreso", () => {
    expect(isStaleDevice({ is_device: true, stock: 1, cost_price: 1, created_at: null }, NOW)).toBe(false);
  });
});

describe("staleDeviceSummary", () => {
  it("suma el costo inmovilizado solo de los equipos detenidos con stock", () => {
    const items = [
      device(10, { cost_price: 500_000 }),
      device(31, { cost_price: 2_000_000 }),
      device(60, { cost_price: 3_000_000 }),
      device(60, { cost_price: 9_000_000, stock: 0 }),
      device(60, { cost_price: 9_000_000, is_device: false }),
    ];
    expect(staleDeviceSummary(items, NOW)).toEqual({ count: 2, immobilizedCost: 5_000_000 });
  });

  it("devuelve ceros sin equipos detenidos", () => {
    expect(staleDeviceSummary([device(1)], NOW)).toEqual({ count: 0, immobilizedCost: 0 });
  });
});

describe("hasDevicesInStock / daysInStockLabel", () => {
  it("detecta si hay equipos con stock", () => {
    expect(hasDevicesInStock([device(1)])).toBe(true);
    expect(hasDevicesInStock([device(1, { stock: 0 }), device(1, { is_device: false })])).toBe(false);
    expect(hasDevicesInStock([])).toBe(false);
  });

  it("arma el texto en singular y plural", () => {
    expect(daysInStockLabel(0)).toBe("Ingresó hoy");
    expect(daysInStockLabel(1)).toBe("1 día en stock");
    expect(daysInStockLabel(42)).toBe("42 días en stock");
  });
});
