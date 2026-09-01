import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Supabase Storage (S3 por debajo) rechaza keys con ciertos caracteres (ej.
// "N°" con el símbolo de grado) con un error "Invalid key" poco claro para
// el usuario. Esto sanitiza el nombre para usarlo en la key del storage —
// el nombre original (con tildes, ñ, °, etc.) se sigue guardando aparte
// para mostrarlo tal cual en la UI.
export function sanitizeFilenameForStorage(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  const base = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.slice(lastDot) : "";
  const safeBase = base
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "") // tildes: é -> e, ñ -> n
    .replace(/[^a-zA-Z0-9._-]/g, "_") // cualquier otro símbolo (°, espacios, etc.)
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  return (safeBase || "archivo") + safeExt;
}
