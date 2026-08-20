// Centralized WhatsApp upgrade contact for Plan Pro
export const UPGRADE_PHONE = "595985158655";
export const UPGRADE_MESSAGE =
  "¡Hola! Vengo de la plataforma y me interesa activar el Plan Pro de F7 Manager Pro para mi taller.";

// Mensaje genérico para los CTA de la landing pública que no apuntan a un
// plan específico (Ver planes, Empezar ahora, etc.) — los botones de cada
// tarjeta de precio siguen mandando su propio PLAN_MESSAGES.
export const GENERAL_INTEREST_MESSAGE =
  "¡Hola! Vengo de la página de F7 Manager Pro y me interesa empezar a usarlo en mi taller.";

export function openUpgradeWhatsApp(customMessage?: string) {
  const msg = customMessage ?? UPGRADE_MESSAGE;
  const url = `https://wa.me/${UPGRADE_PHONE}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
