import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendWhatsAppText } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "No autorizado" }, 401);

    const rateLimited = await isRateLimited(supabase, user.id);
    if (rateLimited) return json({ error: "Demasiadas notificaciones enviadas. Probá de nuevo en unos minutos." }, 429);

    const body = await req.json();
    const {
      customer_name,
      customer_phone,
      device_type,
      order_number,
      order_code,
      app_origin,
      kind, // "order" (default) | "quote" — un Presupuesto todavía no tiene el equipo recibido
      quote_amount,
    } = body ?? {};

    const code = order_code ?? order_number;
    const isQuote = kind === "quote";

    if (!customer_name || !customer_phone || !device_type || !order_number || !code) {
      return json({ error: "Campos requeridos faltantes" }, 400);
    }

    // La orden tiene que existir y ser visible para este usuario bajo RLS
    // (misma empresa, técnico asignado, admin, etc). Si no aparece, no se
    // envía nada — evita usar esta función para spamear números arbitrarios
    // sin una orden real detrás.
    const { data: ownedOrder } = await supabase
      .from("orders")
      .select("id, company_id")
      .eq("order_number", order_number)
      .maybeSingle();
    if (!ownedOrder) return json({ error: "Orden no encontrada" }, 404);

    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", ownedOrder.company_id)
      .maybeSingle();
    const businessName = company?.name || "F7 Manager Pro";

    // El WhatsApp conectado es un recurso de LA EMPRESA (lo conecta el admin
    // desde Configuración), no de quien crea la orden — si un staff genera
    // la orden, no tiene su propio WhatsApp conectado y antes esto quedaba
    // en null. Se busca el perfil de la empresa que sí tiene WhatsApp activo.
    const { data: profile } = await supabase
      .from("profiles")
      .select("evolution_instance_name")
      .eq("company_id", ownedOrder.company_id)
      .eq("whatsapp_connected", true)
      .limit(1)
      .maybeSingle();

    const tracking_url = `${app_origin ?? ""}/tracking/${code}`;
    const message_template = isQuote
      ? `¡Hola ${customer_name}! Te dejamos el presupuesto para tu ${device_type}: ` +
        `*Gs. ${Number(quote_amount ?? 0).toLocaleString("es-PY")}*. ` +
        `Podés ver el detalle y responder (aceptar, rechazar o pedir cambios) acá: ${tracking_url} 🔧`
      : `¡Hola ${customer_name}! Recibimos tu ${device_type} en ${businessName}. ` +
        `Tu número de orden es *${order_number}*. ` +
        `Seguí el estado de tu reparación aquí: ${tracking_url} 🔧`;

    const result = await sendWhatsAppText(profile?.evolution_instance_name, customer_phone, message_template);

    await supabase.from("notification_send_log").insert({ user_id: user.id });

    if (!result.ok) return json({ error: result.error }, 502);
    return json({ success: true });
  } catch (e) {
    console.error("send-order-notification error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

const RATE_LIMIT_PER_HOUR = 40;

async function isRateLimited(supabase: ReturnType<typeof createClient>, userId: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("notification_send_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  return (count ?? 0) >= RATE_LIMIT_PER_HOUR;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
