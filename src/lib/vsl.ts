// VSL de la landing /py (versión Paraguay). El video vive en YouTube como "no listado":
// carga rápido con datos móviles y no gasta ancho de banda de Vercel.
// Para cambiar el video: subirlo a YouTube (no listado) y pegar acá su id (lo que va después de "v=").
export const VSL_YOUTUBE_ID = "rM6JSDxGgaU";

// VSL de /latam (en dólares y sin "hecho en Paraguay"), en YouTube como no listado (subido el 2026-11-04).
export const VSL_LATAM_YOUTUBE_ID = "Tx6a76yhPVw";

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

// Links por grupo de WhatsApp (?g=1, ?g=2…): la marca del mensaje dice de qué grupo viene,
// por ejemplo " (Vi el video · Latam)" → " (Vi el video · Latam · Grupo 1)".
const GROUP_RE = /^[a-z0-9]{1,12}$/i;

export function withGroupTag(tag: string, group: string | null | undefined): string {
  if (!group || !GROUP_RE.test(group)) return tag;
  return /\)\s*$/.test(tag) ? tag.replace(/\)\s*$/, ` · Grupo ${group})`) : `${tag} (Grupo ${group})`;
}
