import { describe, expect, it } from "vitest";
import {
  buildDevicePurchaseParams,
  checklistToList,
  emptyDevicePurchaseForm,
  imeiWarning,
  parseGs,
  summarizeChecklist,
  validateDevicePurchase,
  type DevicePurchaseForm,
} from "./devicePurchase";

const complete = (over: Partial<DevicePurchaseForm> = {}): DevicePurchaseForm => ({
  ...emptyDevicePurchaseForm(),
  device_name: "iPhone 13 128GB",
  imei: "356938035643809",
  seller_name: "Juan Pérez",
  seller_cedula: "4.123.456",
  purchase_price: "2.500.000",
  payment_method: "Efectivo",
  ...over,
});

describe("parseGs", () => {
  it("lee montos con separador de miles", () => {
    expect(parseGs("2.500.000")).toBe(2500000);
    expect(parseGs("Gs. 150.000")).toBe(150000);
  });
  it("devuelve 0 si no hay dígitos", () => {
    expect(parseGs("")).toBe(0);
    expect(parseGs("abc")).toBe(0);
  });
});

describe("validateDevicePurchase", () => {
  it("acepta un formulario completo", () => {
    expect(validateDevicePurchase(complete())).toBeNull();
  });
  it("pide cada dato obligatorio", () => {
    expect(validateDevicePurchase(complete({ device_name: "  " }))).toMatch(/equipo/);
    expect(validateDevicePurchase(complete({ imei: "" }))).toMatch(/IMEI/);
    expect(validateDevicePurchase(complete({ seller_name: "" }))).toMatch(/nombre/);
    expect(validateDevicePurchase(complete({ seller_cedula: "" }))).toMatch(/cédula/);
    expect(validateDevicePurchase(complete({ purchase_price: "0" }))).toMatch(/pagás/);
    expect(validateDevicePurchase(complete({ payment_method: "" }))).toMatch(/medio/);
  });
  it("el precio de venta y el teléfono son opcionales", () => {
    expect(validateDevicePurchase(complete({ selling_price: "", seller_phone: "" }))).toBeNull();
  });
});

describe("imeiWarning", () => {
  it("no avisa con un IMEI válido", () => {
    expect(imeiWarning("356938035643809")).toBeNull();
  });
  it("avisa si el dígito de control no cierra", () => {
    expect(imeiWarning("356938035643808")).toMatch(/verificación/);
  });
  it("avisa si son solo números pero no 15", () => {
    expect(imeiWarning("35693803564")).toMatch(/15 dígitos/);
  });
  it("no opina de un número de serie con letras ni de un campo vacío", () => {
    expect(imeiWarning("F2LXK1ABCD")).toBeNull();
    expect(imeiWarning("")).toBeNull();
  });
});

describe("checklist", () => {
  it("se ordena como los ítems configurados y omite lo no revisado", () => {
    const list = checklistToList({ Cámara: "fail", Pantalla: "ok" }, ["Pantalla", "Batería", "Cámara"]);
    expect(list).toEqual([
      { label: "Pantalla", status: "ok" },
      { label: "Cámara", status: "fail" },
    ]);
  });
  it("conserva ítems que ya no están configurados", () => {
    const list = checklistToList({ Viejo: "ok", Pantalla: "ok" }, ["Pantalla"]);
    expect(list.map((i) => i.label)).toEqual(["Pantalla", "Viejo"]);
  });
  it("resume cuántos ok y cuáles fallan", () => {
    const s = summarizeChecklist([
      { label: "Pantalla", status: "ok" },
      { label: "Cámara", status: "fail" },
      { label: "Face ID", status: "fail" },
    ]);
    expect(s).toMatchObject({ okCount: 1, failCount: 2, failed: ["Cámara", "Face ID"] });
  });
});

describe("buildDevicePurchaseParams", () => {
  it("normaliza montos y textos para la RPC", () => {
    const params = buildDevicePurchaseParams(
      complete({
        device_name: "  iPhone 13  ",
        selling_price: "3.200.000",
        reason: " cambia de equipo ",
        checklist: { Pantalla: "ok" },
        accessories: ["Cargador"],
        branch_id: "b1",
      }),
      ["Pantalla"]
    );
    expect(params).toMatchObject({
      device_name: "iPhone 13",
      purchase_price: 2500000,
      selling_price: 3200000,
      reason: "cambia de equipo",
      branch_id: "b1",
      checklist: [{ label: "Pantalla", status: "ok" }],
      accessories: ["Cargador"],
    });
  });
});
