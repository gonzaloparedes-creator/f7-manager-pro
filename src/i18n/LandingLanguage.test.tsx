import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingLanguageProvider } from "./LandingLanguage";
import { LANG_STORAGE_KEY } from "./language";
import { useLanguage } from "./useLanguage";
import { usePageMeta } from "./usePageMeta";

function Probe() {
  const { lang, t, setLang, gs } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="login">{t.common.login}</span>
      <span data-testid="money">{gs(1850000)}</span>
      <button onClick={() => setLang("pt")}>a-portugues</button>
      <button onClick={() => setLang("en")}>a-ingles</button>
    </div>
  );
}

const renderProbe = () =>
  render(
    <LandingLanguageProvider>
      <Probe />
    </LandingLanguageProvider>
  );

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
  document.documentElement.lang = "es";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.pushState({}, "", "/");
});

describe("LandingLanguageProvider", () => {
  it("sin elección previa arranca en español", () => {
    renderProbe();
    expect(screen.getByTestId("lang")).toHaveTextContent("es");
    expect(screen.getByTestId("login")).toHaveTextContent("Ingresar");
    expect(screen.getByTestId("money")).toHaveTextContent("Gs. 1.850.000");
    expect(document.documentElement.lang).toBe("es");
  });

  it("recuerda el idioma elegido la última vez", () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, "pt");
    renderProbe();
    expect(screen.getByTestId("login")).toHaveTextContent("Entrar");
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("el link ?lang= manda sobre lo guardado y se recuerda para la otra landing", () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, "pt");
    window.history.pushState({}, "", "/oferta?utm_source=meta&lang=en");
    renderProbe();
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
    expect(screen.getByTestId("money")).toHaveTextContent("Gs. 1,850,000");
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
  });

  it("sin ?lang= no guarda nada: la elección es de la persona", () => {
    renderProbe();
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBeNull();
  });

  it("al elegir otro idioma cambia todo, lo guarda y actualiza el <html lang>", () => {
    renderProbe();
    act(() => screen.getByText("a-ingles").click());
    expect(screen.getByTestId("login")).toHaveTextContent("Log in");
    expect(document.documentElement.lang).toBe("en");
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");

    act(() => screen.getByText("a-portugues").click());
    expect(screen.getByTestId("login")).toHaveTextContent("Entrar");
    expect(document.documentElement.lang).toBe("pt-BR");
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("pt");
  });

  it("al salir de las landings se devuelve el <html lang> original (la app sigue en español)", () => {
    const { unmount } = renderProbe();
    act(() => screen.getByText("a-ingles").click());
    expect(document.documentElement.lang).toBe("en");
    unmount();
    expect(document.documentElement.lang).toBe("es");
  });

  it("un valor guardado inválido no rompe: español", () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, "klingon");
    renderProbe();
    expect(screen.getByTestId("lang")).toHaveTextContent("es");
  });

  it("si el navegador bloquea el almacenamiento (modo privado) sigue funcionando", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    renderProbe();
    expect(screen.getByTestId("lang")).toHaveTextContent("es");
    act(() => screen.getByText("a-ingles").click());
    expect(screen.getByTestId("login")).toHaveTextContent("Log in");
  });

  it("usar el idioma fuera del proveedor avisa con un error claro", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useLanguage())).toThrow(/LandingLanguageProvider/);
  });
});

describe("usePageMeta", () => {
  it("pone título y descripción, y al salir devuelve los de antes", () => {
    document.title = "Título original";
    const meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", "Descripción original");
    document.head.appendChild(meta);

    const { rerender, unmount } = renderHook(({ title, description }) => usePageMeta(title, description), {
      initialProps: { title: "Nuevo título", description: "Nueva descripción" },
    });
    expect(document.title).toBe("Nuevo título");
    expect(meta.getAttribute("content")).toBe("Nueva descripción");

    rerender({ title: "Otro título", description: "Otra descripción" });
    expect(document.title).toBe("Otro título");

    unmount();
    expect(document.title).toBe("Título original");
    expect(meta.getAttribute("content")).toBe("Descripción original");
    meta.remove();
  });
});
