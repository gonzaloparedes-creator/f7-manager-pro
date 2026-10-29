import { currencySymbol } from "@/lib/currency";

// Precio mínimo de negociación de un equipo (B1 seminuevos). Lógica pura, sin React ni Supabase.

export interface ParsedMinPrice {
  value: number | null;
  error: string | null;
}

// Vacío o 0 = sin mínimo (se guarda NULL). Gs. no tiene decimales: solo enteros.
// El mínimo no puede ser mayor que el precio de venta con el que se publica.
export function parseMinPrice(input: string | number | null | undefined, sellingPrice: number): ParsedMinPrice {
  const text = String(input ?? "").trim();
  if (text === "") return { value: null, error: null };
  if (!/^\d+$/.test(text)) return { value: null, error: `El precio mínimo tiene que ser un monto en ${currencySymbol()}, sin decimales` };
  const value = Number(text);
  if (value === 0) return { value: null, error: null };
  if (value > (Number.isFinite(sellingPrice) ? sellingPrice : 0)) {
    return { value: null, error: "El precio mínimo no puede ser mayor que el precio de venta" };
  }
  return { value, error: null };
}

export function toMinPrice(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** true si se vende (ya con el descuento aplicado) por debajo del mínimo cargado. */
export function isBelowMinPrice(unitPrice: number, minPrice: number | string | null | undefined): boolean {
  const min = toMinPrice(minPrice);
  return min !== null && unitPrice < min;
}

export function belowMinPriceNames(
  lines: { name: string; unitPrice: number; minPrice: number | string | null | undefined }[],
): string[] {
  return lines.filter((l) => isBelowMinPrice(l.unitPrice, l.minPrice)).map((l) => l.name);
}
