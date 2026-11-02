import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El plan y los permisos son lo único que cambia entre los casos; el resto de
// los hooks y proveedores de AppLayout se reemplazan por versiones mínimas.
const state = vi.hoisted(() => ({
  plan: {} as Record<string, unknown>,
  perms: {} as Record<string, unknown>,
}));

vi.mock("@/hooks/usePlan", () => ({ usePlan: () => state.plan }));
vi.mock("@/hooks/useStaffPermissions", () => ({ useStaffPermissions: () => state.perms }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, loading: false }) }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ isAdmin: true }) }));
vi.mock("@/hooks/useSuperAdmin", () => ({ useSuperAdmin: () => ({ isSuperAdmin: false }) }));
vi.mock("@/hooks/useCompanyStatus", () => ({
  useCompanyStatus: () => ({ isActive: true, reason: null, expiresAt: null, loading: false }),
}));
vi.mock("@/hooks/useGenerateRecurringExpenses", () => ({ useGenerateRecurringExpenses: () => {} }));
vi.mock("@/hooks/usePendingMessages", () => ({ usePendingMessages: () => ({ count: 0 }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock("@/lib/upgrade", () => ({ openUpgradeWhatsApp: vi.fn() }));
vi.mock("@/pages/SuspendedAccount", () => ({ default: () => <p>cuenta suspendida</p> }));
vi.mock("@/components/UpgradeProDialog", () => ({ default: () => null }));
vi.mock("@/components/QuickActionsFab", () => ({ default: () => null }));
vi.mock("@/components/PlanExpiryReminder", () => ({ default: () => null }));
vi.mock("@/components/WhatsAppOfferProvider", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("@/components/PendingMessagesProvider", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("@/components/CurrencyProvider", () => ({ CurrencyProvider: ({ children }: { children: unknown }) => children }));

import AppLayout from "./AppLayout";

const taller = { isStarter: false, isBusiness: true, isRetail: false, hasWorkshop: true, loading: false };
const retail = { isStarter: false, isBusiness: false, isRetail: true, hasWorkshop: false, loading: false };
const permisosCompletos = { canViewProducts: true, canViewGastos: true, canViewCaja: true, canManageCompany: true, loading: false };

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<p>pantalla-ordenes</p>} />
          <Route path="/ordenes/nueva" element={<p>pantalla-nueva-orden</p>} />
          <Route path="/inventario" element={<p>pantalla-inventario</p>} />
          <Route path="/panic-full" element={<p>pantalla-panic</p>} />
          <Route path="/productos" element={<p>pantalla-productos</p>} />
          <Route path="/clientes" element={<p>pantalla-clientes</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const link = (name: string) => screen.queryAllByRole("link", { name });

beforeEach(() => {
  state.plan = taller;
  state.perms = permisosCompletos;
});

afterEach(() => {
  cleanup();
});

describe("AppLayout con un plan de taller", () => {
  it("muestra Órdenes, Inventario y Panic Full y deja entrar a esas pantallas", () => {
    renderAt("/dashboard");
    expect(screen.getByText("pantalla-ordenes")).toBeInTheDocument();
    expect(link("Órdenes").length).toBeGreaterThan(0);
    expect(link("Inventario").length).toBeGreaterThan(0);
    expect(link("Panic Full").length).toBeGreaterThan(0);
  });
});

describe("AppLayout con el plan Retail (solo ventas)", () => {
  beforeEach(() => {
    state.plan = retail;
  });

  it("el menú no tiene Órdenes, Inventario ni Panic Full, y conserva lo de ventas", () => {
    renderAt("/productos");
    expect(screen.getByText("pantalla-productos")).toBeInTheDocument();
    expect(link("Órdenes")).toHaveLength(0);
    expect(link("Inventario")).toHaveLength(0);
    expect(link("Panic Full")).toHaveLength(0);
    for (const name of ["Clientes", "Avisos", "Productos", "Reportes", "Caja", "Gastos", "Configuración"]) {
      expect(link(name).length).toBeGreaterThan(0);
    }
  });

  it("abrir Órdenes lo lleva a Productos", () => {
    renderAt("/dashboard");
    expect(screen.getByText("pantalla-productos")).toBeInTheDocument();
    expect(screen.queryByText("pantalla-ordenes")).toBeNull();
  });

  it("abrir Nueva orden (pantalla completa), Inventario o Panic Full también lo lleva a Productos", () => {
    for (const [path, pantalla] of [
      ["/ordenes/nueva", "pantalla-nueva-orden"],
      ["/inventario", "pantalla-inventario"],
      ["/panic-full", "pantalla-panic"],
    ]) {
      renderAt(path);
      expect(screen.getByText("pantalla-productos")).toBeInTheDocument();
      expect(screen.queryByText(pantalla)).toBeNull();
      cleanup();
    }
  });

  it("un empleado sin permiso para Productos cae en Clientes (sin bucle)", () => {
    state.perms = { ...permisosCompletos, canViewProducts: false };
    renderAt("/dashboard");
    expect(screen.getByText("pantalla-clientes")).toBeInTheDocument();
  });

  it("mientras se cargan los permisos no redirige todavía", () => {
    state.perms = { ...permisosCompletos, canViewProducts: false, loading: true };
    renderAt("/dashboard");
    expect(screen.queryByText("pantalla-productos")).toBeNull();
    expect(screen.queryByText("pantalla-clientes")).toBeNull();
    expect(screen.queryByText("pantalla-ordenes")).toBeNull();
  });
});
