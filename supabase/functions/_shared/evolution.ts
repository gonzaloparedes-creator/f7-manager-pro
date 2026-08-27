// Envío directo de WhatsApp vía Evolution API — antes estas funciones le
// pegaban a un webhook externo de n8n (clienteswebhook.wolclic.com) que
// relayeaba a Evolution API; se saca ese intermediario (dejaba de recibir
// los eventos y no había forma de ver qué pasaba del otro lado) y se pega
// directo, mismas credenciales que ya usan connect-whatsapp-evolution y
// check-whatsapp-status.
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

export async function sendWhatsAppText(
  instance: string | null | undefined,
  phone: string | null | undefined,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return { ok: false, error: "Evolution API no configurada (faltan EVOLUTION_API_URL/EVOLUTION_API_KEY)" };
  }
  if (!instance) {
    return { ok: false, error: "La empresa no tiene un WhatsApp conectado" };
  }
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) {
    return { ok: false, error: "Número de teléfono inválido" };
  }

  const base = EVOLUTION_API_URL.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ number: digits, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("sendWhatsAppText: Evolution API respondió", res.status, body);
      return { ok: false, error: `Evolution API respondió ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("sendWhatsAppText error", e);
    return { ok: false, error: (e as Error).message };
  }
}

// Envía una imagen ya subida a Storage (URL pública) como mensaje de
// WhatsApp — Evolution API la descarga sola desde esa URL, no hace falta
// mandar el binario. Se usa para adjuntar evidencia fotográfica (ver
// send-status-notification, estado "enviado").
export async function sendWhatsAppMedia(
  instance: string | null | undefined,
  phone: string | null | undefined,
  mediaUrl: string,
  caption?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return { ok: false, error: "Evolution API no configurada (faltan EVOLUTION_API_URL/EVOLUTION_API_KEY)" };
  }
  if (!instance) {
    return { ok: false, error: "La empresa no tiene un WhatsApp conectado" };
  }
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) {
    return { ok: false, error: "Número de teléfono inválido" };
  }

  const base = EVOLUTION_API_URL.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/message/sendMedia/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({
        number: digits,
        mediatype: "image",
        media: mediaUrl,
        ...(caption ? { caption } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("sendWhatsAppMedia: Evolution API respondió", res.status, body);
      return { ok: false, error: `Evolution API respondió ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("sendWhatsAppMedia error", e);
    return { ok: false, error: (e as Error).message };
  }
}
