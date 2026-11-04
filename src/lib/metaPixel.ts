type FbqFn = (command: "track" | "trackCustom", event: string, params?: Record<string, unknown>) => void;

// El link de seguimiento (/tracking/<código>) es la llave de entrada a la orden
// de un cliente del taller: esa dirección no tiene que viajar a Meta. index.html
// repite esta misma regla para ni siquiera cargar el Pixel en esa ruta.
export function isPixelExcludedPath(pathname: string): boolean {
  return pathname === "/tracking" || pathname.startsWith("/tracking/");
}

// El Pixel de Meta vive en index.html. Si un bloqueador lo saca (o todavía no
// cargó), el sitio no debe romperse: este envoltorio simplemente no hace nada.
export function trackMeta(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (isPixelExcludedPath(window.location.pathname)) return;
  const fbq = (window as unknown as { fbq?: FbqFn }).fbq;
  if (typeof fbq !== "function") return;
  try {
    fbq("track", event, params);
  } catch {
    // el seguimiento nunca puede interrumpir lo que está haciendo la persona
  }
}

// Eventos propios (no estándar de Meta), por ejemplo cuánto del VSL miró la persona.
// Sirven para armar públicos personalizados en el Administrador de anuncios.
export function trackMetaCustom(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (isPixelExcludedPath(window.location.pathname)) return;
  const fbq = (window as unknown as { fbq?: FbqFn }).fbq;
  if (typeof fbq !== "function") return;
  try {
    fbq("trackCustom", event, params);
  } catch {
    // el seguimiento nunca puede interrumpir lo que está haciendo la persona
  }
}
