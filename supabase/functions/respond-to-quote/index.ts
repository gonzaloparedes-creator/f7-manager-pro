import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const WEBHOOK_URL = "https://clienteswebhook.wolclic.com/webhook/nueva-orden-repairdesk";
const VALID_RESPONSES = ["aceptado", "rechazado", "cambios_solicitados"] as const;
type QuoteResponse = (typeof VALID_RESPONSES)[number];

const RESPONSE_VERB: Record<QuoteResponse, string> = {
  aceptado: "aceptó",
  rechazado: "rechazó",
  cambios_solicitados: "pidió cambios en",
};

// Mensaje de vuelta AL CLIENTE (no al taller) — mismo estilo plano que el
// resto de las plantillas (send-order-notification / send-status-
// notification), enviado desde el WhatsApp de la empresa ya conectado.
const CLIENT_MESSAGE: Record<QuoteResponse, (name: string) => string> = {
  aceptado: (name) =>
    `¡Hola ${name}! Vi que aceptaste el presupuesto, ¡perfecto! En breve me pongo en contacto contigo. 🔧`,
  rechazado: (name) =>
    `¡Hola ${name}! Vi que rechazaste el presupuesto. Cualquier consulta, escribinos y lo revisamos juntos. 🔧`,
  cambios_solicitados: (name) =>
    `¡Hola ${name}! Recibimos tu pedido de cambios sobre el presupuesto. Lo revisamos y te contactamos a la brevedad. 🔧`,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Llamada por un cliente ANÓNIMO desde /tracking/:token (ver
// PublicTrackingByCode.tsx) — no hay usuario logueado, así que corre con
// service_role y bypassea RLS. La única puerta de entrada es que
// tracking_token matchee una orden real: no se acepta ningún otro
// identificador (nunca el código corto ORD-XXXX, que es enumerable) y el
// UPDATE toca exactamente 3 columnas nuevas, nunca status ni montos.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { tracking_token, response, note } = body ?? {};

    if (!tracking_token || !UUID_RE.test(tracking_token)) {
      return json({ error: "tracking_token inválido" }, 400);
    }
    if (!VALID_RESPONSES.includes(response)) {
      return json({ error: "Respuesta inválida" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order } = await supabase
      .from("orders")
      .select("id, company_id, status, order_number, customer_name, customer_phone, device_type, quote_amount, quote_responded_at")
      .eq("tracking_token", tracking_token)
      .maybeSingle();
    if (!order) return json({ error: "Presupuesto no encontrado" }, 404);
    if (order.status !== "presupuesto") {
      return json({ error: "Este presupuesto ya no está disponible para responder" }, 409);
    }

    // Doble-click / reenvío accidental del formulario: se actualiza igual (el
    // cliente puede haber cambiado de opinión) pero no se duplica el mensaje
    // de confirmación si la respuesta anterior es de hace <30s.
    const isRecentDuplicate =
      !!order.quote_responded_at && Date.now() - new Date(order.quote_responded_at).getTime() < 30_000;

    const cleanNote = typeof note === "string" && note.trim() ? note.trim().slice(0, 1000) : null;

    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        quote_response: response,
        quote_response_note: cleanNote,
        quote_responded_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (updateErr) throw updateErr;

    const historyNote = cleanNote
      ? `El cliente ${RESPONSE_VERB[response as QuoteResponse]} el presupuesto: "${cleanNote}"`
      : `El cliente ${RESPONSE_VERB[response as QuoteResponse]} el presupuesto.`;
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: order.status,
      note: historyNote,
      is_internal: false,
    });

    if (!isRecentDuplicate) {
      // El WhatsApp conectado es un recurso de LA EMPRESA (mismo patrón que
      // send-order-notification/send-status-notification) — el mensaje sale
      // desde ese mismo número, hacia el cliente, confirmando que se recibió
      // su respuesta.
      const { data: profile } = await supabase
        .from("profiles")
        .select("evolution_instance_name")
        .eq("company_id", order.company_id)
        .eq("whatsapp_connected", true)
        .limit(1)
        .maybeSingle();

      const payload = {
        event: "quote_response",
        evolutionInstance: profile?.evolution_instance_name ?? null,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        device_type: order.device_type,
        order_number: order.order_number,
        quote_response: response,
        quote_response_note: cleanNote,
        message_template: CLIENT_MESSAGE[response as QuoteResponse](order.customer_name),
      };

      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((e) => console.error("respond-to-quote webhook failed", e));
    }

    return json({ success: true });
  } catch (e) {
    console.error("respond-to-quote error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
