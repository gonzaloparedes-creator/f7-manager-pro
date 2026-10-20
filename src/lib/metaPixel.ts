type FbqFn = (command: "track", event: string, params?: Record<string, unknown>) => void;

// El Pixel de Meta vive en index.html. Si un bloqueador lo saca (o todavía no
// cargó), el sitio no debe romperse: este envoltorio simplemente no hace nada.
export function trackMeta(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: FbqFn }).fbq;
  if (typeof fbq !== "function") return;
  try {
    fbq("track", event, params);
  } catch {
    // el seguimiento nunca puede interrumpir lo que está haciendo la persona
  }
}
