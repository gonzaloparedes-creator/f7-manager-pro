// Batería % y origen de un equipo (B1 seminuevos). Lógica pura, sin React ni Supabase.

export const DEVICE_ORIGINS = ["proveedor", "compra_cliente", "canje", "stock_propio", "consignado"] as const;
export type DeviceOrigin = (typeof DEVICE_ORIGINS)[number];

export const DEVICE_ORIGIN_LABELS: Record<DeviceOrigin, string> = {
  proveedor: "Proveedor",
  compra_cliente: "Comprado a cliente",
  canje: "Canje",
  stock_propio: "Stock propio",
  consignado: "Consignado",
};

/** Por debajo de este % Apple recomienda cambiar la batería: se resalta como aviso. */
export const LOW_BATTERY_THRESHOLD = 80;

export function isDeviceOrigin(value: unknown): value is DeviceOrigin {
  return typeof value === "string" && (DEVICE_ORIGINS as readonly string[]).includes(value);
}

export function originLabel(value: string | null | undefined): string | null {
  return isDeviceOrigin(value) ? DEVICE_ORIGIN_LABELS[value] : null;
}

export interface ParsedBattery {
  value: number | null;
  error: string | null;
}

// Acepta "89", " 89 " o "89%"; vacío = sin dato. Fuera de 0-100 o con otros
// caracteres es un error: guardar un 189 o un "abc" ensuciaría la lista de precios.
export function parseBattery(input: string | number | null | undefined): ParsedBattery {
  const text = String(input ?? "").trim().replace(/%$/, "").trim();
  if (text === "") return { value: null, error: null };
  if (!/^\d{1,3}$/.test(text) || Number(text) > 100) {
    return { value: null, error: "La batería tiene que ser un porcentaje entre 0 y 100" };
  }
  return { value: Number(text), error: null };
}

function toBattery(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null;
}

export function batteryLabel(value: number | string | null | undefined): string | null {
  const n = toBattery(value);
  return n === null ? null : `Batería ${n}%`;
}

export function isLowBattery(value: number | string | null | undefined): boolean {
  const n = toBattery(value);
  return n !== null && n < LOW_BATTERY_THRESHOLD;
}
