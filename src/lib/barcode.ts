// Lógica pura del código de barras de un artículo, sin React ni Supabase.
// Un lector USB/Bluetooth escribe el código como si fuera un teclado, así que
// "escanear" es buscar un texto exacto entre los artículos de la empresa.

export const BARCODE_MAX_LENGTH = 64;
// Mismo criterio que el CHECK de la base: ASCII imprimible sin espacios.
const BARCODE_PATTERN = /^[!-~]+$/;
// Con menos caracteres que esto la búsqueda parcial trae demasiado ruido
// ("12" encontraría cualquier código que lo contenga).
const MIN_PARTIAL_LENGTH = 5;

export interface BarcodeItem {
  id: string;
  barcode?: string | null;
}

export function parseBarcode(raw: string | null | undefined): { value: string | null; error: string | null } {
  const value = (raw ?? "").trim();
  if (!value) return { value: null, error: null };
  if (value.length > BARCODE_MAX_LENGTH) {
    return { value: null, error: `El código de barras no puede tener más de ${BARCODE_MAX_LENGTH} caracteres.` };
  }
  if (!BARCODE_PATTERN.test(value)) {
    return {
      value: null,
      error: "El código de barras solo puede tener letras sin tildes, números y símbolos comunes, sin espacios.",
    };
  }
  return { value, error: null };
}

/** Artículo cuyo código es el escaneado (o null). Un lector con Bloq Mayús puede cambiar las mayúsculas: se acepta si solo hay uno así. */
export function findByBarcode<T extends BarcodeItem>(items: T[], code: string): T | null {
  const wanted = code.trim();
  if (!wanted) return null;
  const exact = items.find((i) => i.barcode === wanted);
  if (exact) return exact;
  const lower = wanted.toLowerCase();
  const loose = items.filter((i) => i.barcode?.toLowerCase() === lower);
  return loose.length === 1 ? loose[0] : null;
}

/** Para el buscador: coincidencia exacta, o parcial si se tipearon varios caracteres. */
export function matchesBarcodeQuery(item: BarcodeItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  const code = item.barcode?.toLowerCase();
  if (!q || !code) return false;
  return code === q || (q.length >= MIN_PARTIAL_LENGTH && code.includes(q));
}

export function isDuplicateBarcodeError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "23505" && (error.message ?? "").includes("barcode");
}
