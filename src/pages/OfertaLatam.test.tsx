import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { LandingLanguageProvider } from "@/i18n/LandingLanguage";
import OfertaLatam from "./OfertaLatam";
import { LATAM } from "./ofertaLatam.copy";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/latam"]}>
      <LandingLanguageProvider fixedLang="es">
        <OfertaLatam />
      </LandingLanguageProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, "", "/latam");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.pushState({}, "", "/");
});

const openedText = (spy: MockInstance) => new URL(String(spy.mock.calls[0][0])).searchParams.get("text") ?? "";

describe("/latam (landing del VSL para el resto de Latinoamérica)", () => {
  it("habla a cualquier taller, sin decir que es para Paraguay", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Si tenés un taller de celulares, mirá este video.");
    expect(screen.queryByText(/Hecho en Paraguay/)).toBeNull();
    expect(screen.queryByText(/🇵🇾/)).toBeNull();
  });

  it("muestra los precios en dólares y no en guaraníes, sin selector de moneda", () => {
    const { container } = renderPage();
    const text = container.textContent ?? "";
    expect(text).toContain("US$ 15");
    expect(text).toContain("$15");
    expect(text).not.toMatch(/Gs\.|guaran/i);
    expect(screen.queryByRole("button", { name: /Guaraníes/ })).toBeNull();
  });

  it("el botón de WhatsApp abre el chat con la marca (Vi el video · Latam)", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Escribinos por WhatsApp/ })[0]);
    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0][0])).toContain("https://wa.me/");
    expect(openedText(open)).toBe(LATAM.whatsapp.message + " (Vi el video · Latam)");
  });

  it("los botones de los planes también llevan la marca de /latam", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Elegir este plan/ })[0]);
    expect(openedText(open)).toMatch(/\(Vi el video · Latam\)$/);
  });

  it("el pago se coordina por WhatsApp, sin nombrar un medio de pago", () => {
    const { container } = renderPage();
    const text = container.textContent ?? "";
    expect(text).toContain("El pago lo coordinamos por WhatsApp");
    expect(text).not.toMatch(/paypal|binance|usdt|stripe|transferencia/i);
  });

  it("muestra el video latino listo para reproducir, con su propia portada", () => {
    const { container } = renderPage();
    expect(screen.getByText("Tocá para ver el video")).toBeInTheDocument();
    expect(container.querySelector('img[src="/latam/vsl-portada.webp"]')).not.toBeNull();
  });

  it("nunca promete avisos automáticos", () => {
    const { container } = renderPage();
    expect(container.textContent ?? "").not.toMatch(/autom[aá]ti/i);
  });
});
