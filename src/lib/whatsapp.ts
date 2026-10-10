// Helper genérico para abrir un chat de WhatsApp (web o app, según el
// dispositivo) a partir de un teléfono ya guardado en formato "595XXXXXXXXX"
// (mismo formato que usan clients.phone y orders.customer_phone). Separado
// de lib/upgrade.ts porque ese archivo es específico del contacto de F7
// Manager Pro para upgrades de plan, no un helper de propósito general.

// Teléfonos escritos a mano (perfil de un usuario, cliente de mostrador):
// "0981 123 456", "981123456" o "595981123456" -> "595981123456". Un número
// largo que no empieza con 0 se asume ya internacional (otros países).
export function toWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `595${digits.replace(/^0+/, "")}`;
  else if (digits.length <= 9) digits = `595${digits}`;
  const local = digits.startsWith("595") ? digits.slice(3) : digits;
  return local.length >= 8 && digits.length <= 15 ? digits : null;
}

export function openWhatsApp(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return;
  const url = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
