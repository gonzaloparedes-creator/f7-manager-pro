// Moneda de cada empresa (companies.currency). Los montos se guardan como números
// enteros y NO se convierten al cambiar de moneda: la moneda solo decide cómo se ven.
//
// Para sumar una moneda nueva (ej. el real brasileño):
//   1. agregarla en CURRENCIES,
//   2. asociarla a su país en COUNTRY_CURRENCY (así se preselecciona al elegir el país),
//   3. extender el CHECK de companies.currency y currency_for_country() en una migración.

export type CurrencyCode = "PYG" | "USD";

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string;
  symbol: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  PYG: { code: "PYG", name: "Guaraní paraguayo", symbol: "Gs." },
  USD: { code: "USD", name: "Dólar estadounidense", symbol: "US$" },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export const DEFAULT_CURRENCY: CurrencyCode = "PYG";

// Mientras un país no tenga su moneda cargada, se ofrece el dólar.
export const FALLBACK_CURRENCY: CurrencyCode = "USD";

// Códigos de país de lib/locations.ts. Los que no figuran todavía no tienen moneda propia.
export const COUNTRY_CURRENCY: Partial<Record<string, CurrencyCode>> = {
  PY: "PYG",
};

export function parseCurrency(value: unknown): CurrencyCode {
  return typeof value === "string" && value in CURRENCIES ? (value as CurrencyCode) : DEFAULT_CURRENCY;
}

export function hasOwnCurrency(country: string | null | undefined): boolean {
  return !!country && country in COUNTRY_CURRENCY;
}

export function currencyForCountry(country: string | null | undefined): CurrencyCode {
  return (country && COUNTRY_CURRENCY[country]) || FALLBACK_CURRENCY;
}

// Moneda de la empresa con la sesión abierta. La fija CurrencyProvider (y las páginas
// públicas con la moneda del negocio que muestran) ANTES de dibujar cualquier monto, y al
// cambiarla se vuelve a dibujar todo. Así los ~250 lugares que formatean montos, incluidos
// los comprobantes y mensajes armados fuera de React, no necesitan recibir la moneda.
let activeCurrency: CurrencyCode = DEFAULT_CURRENCY;

export function setActiveCurrency(code: CurrencyCode) {
  activeCurrency = code;
}

export function getActiveCurrency(): CurrencyCode {
  return activeCurrency;
}

export function currencySymbol(code: CurrencyCode = activeCurrency): string {
  return CURRENCIES[code].symbol;
}

export function formatMoney(value: number | null | undefined, code: CurrencyCode = activeCurrency): string {
  const n = Number(value ?? 0);
  return `${CURRENCIES[code].symbol} ${n.toLocaleString("es-PY")}`;
}
