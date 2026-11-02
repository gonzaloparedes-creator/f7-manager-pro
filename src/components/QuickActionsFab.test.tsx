import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  plan: {} as Record<string, unknown>,
  perms: {} as Record<string, unknown>,
}));

vi.mock("@/hooks/usePlan", () => ({ usePlan: () => state.plan }));
vi.mock("@/hooks/useStaffPermissions", () => ({ useStaffPermissions: () => state.perms }));

import QuickActionsFab from "./QuickActionsFab";

const taller = { isBusiness: false, isRetail: false, hasWorkshop: true };
const business = { isBusiness: true, isRetail: false, hasWorkshop: true };
const retail = { isBusiness: false, isRetail: true, hasWorkshop: false };

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<><Where /><QuickActionsFab /></>} />
      </Routes>
    </MemoryRouter>
  );
}

const fab = () => screen.queryByRole("button", { name: "Acciones rápidas" });

beforeEach(() => {
  state.plan = taller;
  state.perms = { canViewProducts: true };
});

afterEach(() => {
  cleanup();
});

describe("QuickActionsFab", () => {
  it("un taller con tienda ofrece órdenes, presupuesto, lote y venta", () => {
    state.plan = business;
    renderAt("/clientes");
    fireEvent.click(fab()!);
    for (const label of ["Nueva Orden", "Nuevo Presupuesto", "Modo Lote", "Venta Mostrador"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("Retail solo tiene la venta: un toque lleva directo a Productos, sin menú", () => {
    state.plan = retail;
    renderAt("/clientes");
    fireEvent.click(fab()!);
    expect(screen.getByTestId("where")).toHaveTextContent("/productos");
    expect(screen.queryByText("Nueva Orden")).toBeNull();
  });

  it("Retail sin permiso para Productos no tiene ninguna acción: no muestra el botón", () => {
    state.plan = retail;
    state.perms = { canViewProducts: false };
    renderAt("/clientes");
    expect(fab()).toBeNull();
  });
});
