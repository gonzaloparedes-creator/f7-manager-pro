import { describe, expect, it } from "vitest";
import { PLAN_LIMITS, isWorkshopPath, planHasSeatLimits, planHasWorkshop, type PlanType } from "./plans";

const TALLER: PlanType[] = ["starter", "pro", "business"];

describe("planHasWorkshop", () => {
  it("los planes de taller incluyen órdenes, repuestos y Panic Full", () => {
    for (const plan of TALLER) expect(planHasWorkshop(plan)).toBe(true);
  });

  it("Retail es solo ventas: no incluye el lado taller", () => {
    expect(planHasWorkshop("retail")).toBe(false);
  });
});

describe("planHasSeatLimits", () => {
  it("Starter y Retail tienen tope de usuarios y sucursales", () => {
    expect(planHasSeatLimits("starter")).toBe(true);
    expect(planHasSeatLimits("retail")).toBe(true);
  });

  it("Pro y Business no lo tienen", () => {
    expect(planHasSeatLimits("pro")).toBe(false);
    expect(planHasSeatLimits("business")).toBe(false);
  });

  it("Retail tiene los mismos límites que Starter (decisión de precios: no abaratar el plan de entrada)", () => {
    expect(PLAN_LIMITS.retail).toEqual(PLAN_LIMITS.starter);
  });
});

describe("isWorkshopPath", () => {
  it("reconoce las pantallas del lado taller", () => {
    for (const path of ["/dashboard", "/ordenes/nueva", "/ordenes/3f2a-uuid", "/inventario", "/panic-full"]) {
      expect(isWorkshopPath(path)).toBe(true);
    }
  });

  it("no toca las pantallas de ventas ni las generales", () => {
    for (const path of ["/", "/productos", "/clientes", "/avisos", "/reportes", "/cierre-caja", "/gastos", "/como-usar", "/configuracion"]) {
      expect(isWorkshopPath(path)).toBe(false);
    }
  });

  it("compara por segmento: una ruta que solo empieza igual no cuenta", () => {
    expect(isWorkshopPath("/dashboardx")).toBe(false);
    expect(isWorkshopPath("/ordenesx")).toBe(false);
    expect(isWorkshopPath("/inventario-extra")).toBe(false);
  });
});
