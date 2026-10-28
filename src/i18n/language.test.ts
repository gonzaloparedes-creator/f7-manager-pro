import { describe, expect, it } from "vitest";
import { DEFAULT_LANG, formatNumber, languageInfo, parseLang, resolveInitialLang } from "./language";

describe("parseLang", () => {
  it("entiende los tres idiomas, con mayúsculas y región", () => {
    expect(parseLang("es")).toBe("es");
    expect(parseLang("EN")).toBe("en");
    expect(parseLang("pt")).toBe("pt");
    expect(parseLang("pt-BR")).toBe("pt");
    expect(parseLang("pt_br")).toBe("pt");
    expect(parseLang(" en-US ")).toBe("en");
  });

  it("lo desconocido o vacío no es un idioma", () => {
    expect(parseLang("fr")).toBeNull();
    expect(parseLang("")).toBeNull();
    expect(parseLang(null)).toBeNull();
    expect(parseLang(undefined)).toBeNull();
    expect(parseLang("español")).toBeNull();
  });
});

describe("resolveInitialLang", () => {
  it("sin link ni elección previa: español", () => {
    expect(resolveInitialLang("", null)).toEqual({ lang: DEFAULT_LANG, fromUrl: false });
    expect(DEFAULT_LANG).toBe("es");
  });

  it("usa lo que se eligió la última vez", () => {
    expect(resolveInitialLang("", "pt")).toEqual({ lang: "pt", fromUrl: false });
  });

  it("el link (?lang=) manda sobre lo guardado y avisa que vino del link", () => {
    expect(resolveInitialLang("?lang=en", "pt")).toEqual({ lang: "en", fromUrl: true });
  });

  it("convive con otros parámetros de los anuncios", () => {
    expect(resolveInitialLang("?utm_source=meta&lang=PT-br&fbclid=abc", null)).toEqual({ lang: "pt", fromUrl: true });
  });

  it("un idioma inválido en el link se ignora y vale lo guardado", () => {
    expect(resolveInitialLang("?lang=xx", "en")).toEqual({ lang: "en", fromUrl: false });
    expect(resolveInitialLang("?lang=", null)).toEqual({ lang: "es", fromUrl: false });
  });

  it("un valor guardado inválido cae en español", () => {
    expect(resolveInitialLang("", "klingon")).toEqual({ lang: "es", fromUrl: false });
  });
});

describe("formatNumber / languageInfo", () => {
  it("separa los miles como corresponde a cada idioma", () => {
    expect(formatNumber(55000, "es")).toBe("55.000");
    expect(formatNumber(1850000, "es")).toBe("1.850.000");
    expect(formatNumber(55000, "en")).toBe("55,000");
    expect(formatNumber(1850000, "pt")).toBe("1.850.000");
  });

  it("el portugués es el de Brasil", () => {
    expect(languageInfo("pt").htmlLang).toBe("pt-BR");
    expect(languageInfo("en").htmlLang).toBe("en");
    expect(languageInfo("es").htmlLang).toBe("es");
  });
});
