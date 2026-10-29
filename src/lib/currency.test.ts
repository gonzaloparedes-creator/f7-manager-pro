import { afterEach, describe, expect, it } from "vitest";
import { COUNTRIES } from "./locations";
import {
  COUNTRY_CURRENCY,
  CURRENCIES,
  CURRENCY_CODES,
  DEFAULT_CURRENCY,
  FALLBACK_CURRENCY,
  currencyForCountry,
  currencySymbol,
  formatMoney,
  getActiveCurrency,
  hasOwnCurrency,
  parseCurrency,
  setActiveCurrency,
} from "./currency";

afterEach(() => setActiveCurrency(DEFAULT_CURRENCY));

describe("formatMoney", () => {
  it("por defecto es guaraníes, igual que siempre", () => {
    expect(formatMoney(350000)).toBe("Gs. 350.000");
    expect(formatMoney(0)).toBe("Gs. 0");
    expect(formatMoney(1850000)).toBe("Gs. 1.850.000");
  });

  it("vacío o inválido es cero", () => {
    expect(formatMoney(null)).toBe("Gs. 0");
    expect(formatMoney(undefined)).toBe("Gs. 0");
    expect(formatMoney(Number.NaN)).toBe("Gs. NaN");
  });

  it("en dólares usa US$ y el mismo agrupado que los formularios", () => {
    setActiveCurrency("USD");
    expect(formatMoney(350)).toBe("US$ 350");
    expect(formatMoney(1250)).toBe("US$ 1.250");
  });

  it("acepta la moneda explícita sin tocar la activa", () => {
    expect(formatMoney(350, "USD")).toBe("US$ 350");
    expect(getActiveCurrency()).toBe("PYG");
  });

  it("los montos negativos conservan el signo (como antes)", () => {
    expect(formatMoney(-5000)).toBe("Gs. -5.000");
  });
});

describe("moneda activa", () => {
  it("cambiarla cambia el símbolo y el formato", () => {
    expect(currencySymbol()).toBe("Gs.");
    setActiveCurrency("USD");
    expect(getActiveCurrency()).toBe("USD");
    expect(currencySymbol()).toBe("US$");
    expect(currencySymbol("PYG")).toBe("Gs.");
  });
});

describe("parseCurrency", () => {
  it("entiende las monedas conocidas", () => {
    expect(parseCurrency("PYG")).toBe("PYG");
    expect(parseCurrency("USD")).toBe("USD");
  });

  it("lo desconocido cae en guaraníes (la base nunca deja otra cosa, pero la pantalla no se rompe)", () => {
    expect(parseCurrency("EUR")).toBe("PYG");
    expect(parseCurrency("usd")).toBe("PYG");
    expect(parseCurrency("")).toBe("PYG");
    expect(parseCurrency(null)).toBe("PYG");
    expect(parseCurrency(undefined)).toBe("PYG");
    expect(parseCurrency(42)).toBe("PYG");
  });
});

describe("moneda por país", () => {
  it("Paraguay usa guaraníes", () => {
    expect(currencyForCountry("PY")).toBe("PYG");
    expect(hasOwnCurrency("PY")).toBe(true);
  });

  it("los países sin moneda propia cargada todavía ofrecen dólares", () => {
    for (const country of ["AR", "BR", "BO", "UY", "CL", "OTHER"]) {
      expect(currencyForCountry(country), country).toBe(FALLBACK_CURRENCY);
      expect(hasOwnCurrency(country), country).toBe(false);
    }
    expect(FALLBACK_CURRENCY).toBe("USD");
  });

  it("país vacío o desconocido también cae en el dólar", () => {
    expect(currencyForCountry(null)).toBe("USD");
    expect(currencyForCountry(undefined)).toBe("USD");
    expect(currencyForCountry("")).toBe("USD");
    expect(currencyForCountry("ZZ")).toBe("USD");
  });

  it("todo país asociado apunta a una moneda que existe y a un país de la lista", () => {
    const countryCodes = COUNTRIES.map((c) => c.code);
    for (const [country, currency] of Object.entries(COUNTRY_CURRENCY)) {
      expect(countryCodes, country).toContain(country);
      expect(CURRENCY_CODES, country).toContain(currency);
    }
  });
});

describe("registro de monedas", () => {
  it("cada moneda tiene nombre y símbolo, y su clave coincide con su código", () => {
    for (const code of CURRENCY_CODES) {
      expect(CURRENCIES[code].code).toBe(code);
      expect(CURRENCIES[code].name.length).toBeGreaterThan(3);
      expect(CURRENCIES[code].symbol.length).toBeGreaterThan(0);
    }
    expect(CURRENCY_CODES).toEqual(["PYG", "USD"]);
  });

  it("los símbolos no se confunden entre sí", () => {
    const symbols = CURRENCY_CODES.map((c) => CURRENCIES[c].symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });
});
