// Fecha (AAAA-MM-DD) en que se apaga la conexión de WhatsApp por código QR
// (Evolution). Mientras sea null, los avisos a los talleres todavía conectados
// no prometen una fecha concreta.
export const EVOLUTION_SUNSET_DATE: string | null = null;

export function evolutionSunsetLabel(): string | null {
  if (!EVOLUTION_SUNSET_DATE) return null;
  const [y, m, d] = EVOLUTION_SUNSET_DATE.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-PY", { day: "numeric", month: "long", year: "numeric" });
}

const DISMISS_KEY = "f7:evolution-banner-dismissed-at";
const DISMISS_DAYS = 7;

// El aviso del Dashboard se puede cerrar, pero vuelve a aparecer a la semana
// mientras la empresa siga conectada. localStorage puede fallar (ventana
// privada, sitio bloqueado): en ese caso el aviso simplemente se sigue viendo.
export function isEvolutionBannerDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function dismissEvolutionBanner() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* sin almacenamiento: no se recuerda el cierre */
  }
}
