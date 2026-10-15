import { describe, expect, it } from "vitest";
import { batteryLabel, isDeviceOrigin, isLowBattery, originLabel, parseBattery } from "./deviceSpecs";

describe("parseBattery", () => {
  it("vacío significa sin dato, no cero", () => {
    expect(parseBattery("")).toEqual({ value: null, error: null });
    expect(parseBattery("   ")).toEqual({ value: null, error: null });
    expect(parseBattery(null)).toEqual({ value: null, error: null });
  });
  it("lee el número con o sin el símbolo %", () => {
    expect(parseBattery("89").value).toBe(89);
    expect(parseBattery(" 89% ").value).toBe(89);
    expect(parseBattery("0").value).toBe(0);
    expect(parseBattery("100").value).toBe(100);
  });
  it("rechaza lo que no es un porcentaje válido", () => {
    for (const bad of ["101", "-5", "abc", "89.5", "8 9", "1000"]) {
      expect(parseBattery(bad).error).toMatch(/entre 0 y 100/);
    }
  });
});

describe("batteryLabel / isLowBattery", () => {
  it("arma la etiqueta solo si hay dato válido", () => {
    expect(batteryLabel(89)).toBe("Batería 89%");
    expect(batteryLabel("92")).toBe("Batería 92%");
    expect(batteryLabel(0)).toBe("Batería 0%");
    expect(batteryLabel(null)).toBeNull();
    expect(batteryLabel(undefined)).toBeNull();
    expect(batteryLabel("")).toBeNull();
    expect(batteryLabel(150)).toBeNull();
  });
  it("marca como baja por debajo de 80", () => {
    expect(isLowBattery(79)).toBe(true);
    expect(isLowBattery(80)).toBe(false);
    expect(isLowBattery(null)).toBe(false);
  });
});

describe("origen", () => {
  it("reconoce los cinco orígenes y les da nombre", () => {
    expect(originLabel("compra_cliente")).toBe("Comprado a cliente");
    expect(originLabel("canje")).toBe("Canje");
    expect(originLabel("consignado")).toBe("Consignado");
    expect(isDeviceOrigin("proveedor")).toBe(true);
  });
  it("ignora valores desconocidos o vacíos", () => {
    expect(originLabel(null)).toBeNull();
    expect(originLabel("otro")).toBeNull();
    expect(isDeviceOrigin("otro")).toBe(false);
  });
});
