import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Lo que devuelve get_signup_invite y lo que recibe signUp son lo único que cambia entre casos.
const db = vi.hoisted(() => ({
  invite: [] as unknown[],
  signUp: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => {
      db.rpc(...args);
      return Promise.resolve({ data: db.invite, error: null });
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
    auth: { signUp: (...args: unknown[]) => db.signUp(...args) },
    functions: { invoke: (...args: unknown[]) => db.invoke(...args) },
  },
}));
vi.mock("@/lib/upgrade", () => ({ openUpgradeWhatsApp: vi.fn() }));

import Register from "./Register";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/empezar/:code" element={<Register />} />
        <Route path="/dashboard" element={<p>panel</p>} />
        <Route path="/login" element={<p>login</p>} />
      </Routes>
    </MemoryRouter>
  );

const fillForm = () => {
  fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Ana Gómez" } });
  fireEvent.change(screen.getByLabelText("Nombre del taller"), { target: { value: "Taller Ana" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "Clave-segura-1" } });
};

beforeEach(() => {
  db.invite = [];
  db.signUp.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  db.rpc.mockReset();
  db.invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("registro con link de alta pagada (/empezar/:code)", () => {
  it("muestra el plan pagado y la garantía, y manda el código al crear la cuenta", async () => {
    db.invite = [{ plan_type: "pro", billing_cycle: "mensual", plan_expires_at: "2026-12-03", usable: true }];
    // Desde Argentina no se pide departamento, así el formulario se puede enviar directo.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ country: "AR" }) }));
    renderAt("/empezar/AB12CD34EF");

    expect(await screen.findByText(/Plan Pro mensual · activo hasta el 03\/12\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Garantía de 7 días/)).toBeInTheDocument();
    expect(db.rpc).toHaveBeenCalledWith("get_signup_invite", { _code: "AB12CD34EF" });
    await waitFor(() => expect(screen.queryByText("Departamento")).toBeNull());

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await waitFor(() => expect(db.signUp).toHaveBeenCalledTimes(1));
    const meta = db.signUp.mock.calls[0][0].options.data;
    expect(meta.signup_invite).toBe("AB12CD34EF");
    expect(meta.country).toBe("AR");
    // y le avisa la compra a Meta con el código del link
    await waitFor(() => expect(db.invoke).toHaveBeenCalledWith("report-purchase", { body: { code: "AB12CD34EF" } }));
  });

  it("si el link ya se usó, no muestra el formulario y ofrece WhatsApp", async () => {
    db.invite = [{ plan_type: "pro", billing_cycle: "mensual", plan_expires_at: "2026-12-03", usable: false }];
    renderAt("/empezar/AB12CD34EF");
    expect(await screen.findByText("Este link ya no sirve")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear cuenta" })).toBeNull();
  });

  it("si el código no existe, avisa que no se encontró", async () => {
    renderAt("/empezar/NOEXISTE");
    expect(await screen.findByText(/No encontramos este link de alta/)).toBeInTheDocument();
  });

  it("el registro común no consulta links ni manda código", async () => {
    renderAt("/register");
    expect(await screen.findByText("Empezá a gestionar tus reparaciones")).toBeInTheDocument();
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
