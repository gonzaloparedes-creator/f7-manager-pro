import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import Privacidad from "./Privacidad";

afterEach(() => cleanup());

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/privacidad"]}>
      <Privacidad />
    </MemoryRouter>
  );

describe("/privacidad", () => {
  it("muestra la política con fecha, el píxel de Meta y los proveedores", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Política de privacidad" })).toBeInTheDocument();
    expect(screen.getByText(/Última actualización:/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cookies y píxel de Meta" })).toBeInTheDocument();
    for (const proveedor of ["Supabase", "Vercel", "YouTube"]) {
      expect(screen.getByText(new RegExp(proveedor))).toBeInTheDocument();
    }
    expect(screen.getByText("No vendemos datos a nadie.")).toBeInTheDocument();
  });

  it("explica cómo pedir que borren tus datos, con el WhatsApp de soporte", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Tus derechos" })).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /\+595985158655/ });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "https://wa.me/595985158655");
  });

  it("nunca promete avisos automáticos", () => {
    const { container } = renderPage();
    expect(container.textContent ?? "").not.toMatch(/autom[aá]tic/i);
  });
});
