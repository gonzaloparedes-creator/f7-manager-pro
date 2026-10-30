// VSL de la landing /py (versión Paraguay). El video vive en YouTube como "no listado":
// carga rápido con datos móviles y no gasta ancho de banda de Vercel.
// Para cambiar el video: subirlo a YouTube (no listado) y pegar acá su id (lo que va después de "v=").
export const VSL_YOUTUBE_ID = "";

export const VSL_DURATION_LABEL = "6 min";

/** Porcentajes del video que se avisan al Pixel (para públicos de "vio el 50 %", etc.). */
export const VSL_MILESTONES = [25, 50, 75, 95] as const;
export type VslMilestone = (typeof VSL_MILESTONES)[number];

/**
 * Hitos recién alcanzados: los que ya se pasaron según el tiempo actual y todavía no se avisaron.
 * Si la persona salta hacia adelante, se avisan todos los que quedaron atrás, una sola vez cada uno.
 */
export function newMilestones(currentSeconds: number, durationSeconds: number, alreadySent: ReadonlySet<number>): VslMilestone[] {
  if (!(durationSeconds > 0) || !(currentSeconds >= 0)) return [];
  const percent = (currentSeconds / durationSeconds) * 100;
  return VSL_MILESTONES.filter((m) => percent >= m && !alreadySent.has(m));
}

/** URL del reproductor embebido (dominio sin cookies de YouTube). */
export function vslEmbedUrl(videoId: string, origin: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    playsinline: "1",
    modestbranding: "1",
    enablejsapi: "1",
    origin,
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}
