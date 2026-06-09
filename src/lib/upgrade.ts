// Centralized WhatsApp upgrade contact for Plan Pro
export const UPGRADE_PHONE = "595985158655";
export const UPGRADE_MESSAGE =
  "¡Hola! Vengo de la plataforma y me interesa activar el Plan Pro de F7 Manager Pro para mi taller.";

export function openUpgradeWhatsApp(customMessage?: string) {
  const msg = customMessage ?? UPGRADE_MESSAGE;
  const url = `https://wa.me/${UPGRADE_PHONE}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
