import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const WEBHOOK_URL = "https://clienteswebhook.wolclic.com/webhook/nueva-orden-repairdesk";

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
    } = body ?? {};

    const code = order_code ?? order_number;

    if (!customer_name || !customer_phone || !device_type || !order_number || !code) {
      return json({ error: "Campos requeridos faltantes" }, 400);
    }

    // La orden tiene que existir y ser visible para este usuario bajo RLS
    // (misma empresa, técnico asignado, admin, etc). Si no aparece, no se
    // envía nada — evita usar esta función para spamear números arbitrarios
    // sin una orden real detrás.
    const { data: ownedOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", order_number)
      .maybeSingle();
    if (!ownedOrder) return json({ error: "Orden no encontrada" }, 404);

    // Fetch evolution instance from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("evolution_instance_name")
      .eq("id", user.id)
      .maybeSingle();

    const tracking_url = `${app_origin ?? ""}/tracking/${code}`;
    const message_template =
      `¡Hola ${customer_name}! Recibimos tu ${device_type} en F7 Manager Pro. ` +
      `Tu número de orden es *${order_number}*. ` +
      `Seguí el estado de tu reparación aquí: ${tracking_url} 🔧`;

    const payload = {
      event: "new_order",
      technician_id: user.id,
      evolutionInstance: profile?.evolution_instance_name ?? null,
      customer_name,
      customer_phone,
      device_type,
      order_number,
      order_code: code,
      tracking_url,
      message_template,
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    await supabase.from("notification_send_log").insert({ user_id: user.id });

    return json({ success: res.ok, status: res.status });
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
