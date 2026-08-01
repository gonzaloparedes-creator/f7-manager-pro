// Helper genérico para abrir un chat de WhatsApp (web o app, según el
// dispositivo) a partir de un teléfono ya guardado en formato "595XXXXXXXXX"
// (mismo formato que usan clients.phone y orders.customer_phone). Separado
// de lib/upgrade.ts porque ese archivo es específico del contacto de F7
// Manager Pro para upgrades de plan, no un helper de propósito general.

export function openWhatsApp(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return;
  const url = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
