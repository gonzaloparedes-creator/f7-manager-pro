import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { LandingLanguageProvider } from "@/i18n/LandingLanguage";
import { LANG_STORAGE_KEY } from "@/i18n/language";
import OfertaPy from "./OfertaPy";
import { PY } from "./ofertaPy.copy";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/py"]}>
      <LandingLanguageProvider fixedLang="es">
        <OfertaPy />
      </LandingLanguageProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, "", "/py");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.pushState({}, "", "/");
});

const openedText = (spy: MockInstance) => new URL(String(spy.mock.calls[0][0])).searchParams.get("text") ?? "";

describe("/py (landing del VSL para Paraguay)", () => {
  it("está siempre en español aunque la persona haya elegido otro idioma en /oferta", () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, "pt");
    window.history.pushState({}, "", "/py?lang=en");
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Si tenés un taller de celulares en Paraguay");
    expect(screen.getAllByText("Ingresar").length).toBeGreaterThan(0);
    // desde /py no se guarda ningún idioma
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("pt");
  });

  it("no tiene selector de idioma", () => {
    renderPage();
    expect(screen.queryByLabelText("Idioma")).toBeNull();
  });

  it("el botón de WhatsApp abre el chat con el mensaje del video y la marca (Vi el video)", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Escribinos por WhatsApp/ })[0]);
    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0][0])).toContain("https://wa.me/");
    expect(openedText(open)).toBe(PY.whatsapp.message + " (Vi el video)");
  });

  it("los botones de los planes también llevan la marca (Vi el video)", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Elegir este plan/ })[0]);
    expect(openedText(open)).toMatch(/\(Vi el video\)$/);
  });

  it("muestra la historia de Javier y Gonzalo, los 4 pasos y la garantía", () => {
    renderPage();
    expect(screen.getByText(/especialista en microsoldadura y repara celulares hace más de 7 años/)).toBeInTheDocument();
    for (const label of ["Recibir", "Avisar", "Entregar", "Ganar"]) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("El mensaje ya viene escrito")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /te devolvemos todo tu dinero/ })).toBeInTheDocument();
  });

  it("el precio del plan Pro sale de la tabla de precios, en guaraníes", () => {
    renderPage();
    expect(screen.getAllByText(/Gs\. 95\.000/).length).toBeGreaterThan(0);
  });

  it("nunca promete avisos automáticos", () => {
    const { container } = renderPage();
    expect(container.textContent ?? "").not.toMatch(/autom[aá]tic/i);
  });
});
