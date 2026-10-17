import { describe, it, expect } from "vitest";
import { resolveUserPermissions } from "./userPermissions";

const ON = { can_view_costs: true, can_give_discounts: true };
const OFF = { can_view_costs: false, can_give_discounts: false };

describe("resolveUserPermissions", () => {
  it("cierra todo mientras carga, incluso para admin", () => {
    expect(resolveUserPermissions({ loading: true, isAdmin: true, flags: ON })).toEqual({
      canViewCosts: false,
      canGiveDiscounts: false,
    });
  });

  it("admin siempre puede todo, aunque el flag esté apagado", () => {
    expect(resolveUserPermissions({ loading: false, isAdmin: true, flags: OFF })).toEqual({
      canViewCosts: true,
      canGiveDiscounts: true,
    });
  });

  it("empleado con los flags en true (default) conserva todo", () => {
    expect(resolveUserPermissions({ loading: false, isAdmin: false, flags: ON })).toEqual({
      canViewCosts: true,
      canGiveDiscounts: true,
    });
  });

  it("empleado con los flags apagados no ve costos ni da descuentos", () => {
    expect(resolveUserPermissions({ loading: false, isAdmin: false, flags: OFF })).toEqual({
      canViewCosts: false,
      canGiveDiscounts: false,
    });
  });

  it("los dos switches son independientes", () => {
    expect(
      resolveUserPermissions({
        loading: false,
        isAdmin: false,
        flags: { can_view_costs: false, can_give_discounts: true },
      }),
    ).toEqual({ canViewCosts: false, canGiveDiscounts: true });
    expect(
      resolveUserPermissions({
        loading: false,
        isAdmin: false,
        flags: { can_view_costs: true, can_give_discounts: false },
      }),
    ).toEqual({ canViewCosts: true, canGiveDiscounts: false });
  });

  it("sin flags (perfil no leído) un no-admin queda cerrado", () => {
    expect(resolveUserPermissions({ loading: false, isAdmin: false, flags: null })).toEqual({
      canViewCosts: false,
      canGiveDiscounts: false,
    });
  });
});
