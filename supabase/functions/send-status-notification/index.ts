import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendWhatsAppText } from "../_shared/evolution.ts";

const STATUS_LABELS: Record<string, string> = {
  recibido: "Recibido",
  en_diagnostico: "En diagnóstico",
  en_reparacion: "En reparación",
  listo: "Listo para retirar",
  entregado: "Entregado",
};

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
      new_status,
      app_origin,
    } = body ?? {};

    const code = order_code ?? order_number;

    if (!customer_name || !customer_phone || !device_type || !order_number || !code || !new_status) {
      return json({ error: "Campos requeridos faltantes" }, 400);
    }

    // La orden tiene que existir y ser visible para este usuario bajo RLS.
    const { data: ownedOrder } = await supabase
      .from("orders")
      .select("id, company_id")
      .eq("order_number", order_number)
      .maybeSingle();
    if (!ownedOrder) return json({ error: "Orden no encontrada" }, 404);

    // El WhatsApp conectado y las preferencias de notificación son de LA
    // EMPRESA (configurados por el admin en Configuración), no de quien
    // cambia el estado — si un staff actualiza la orden, antes se miraba su
    // propio perfil (sin WhatsApp conectado) y nunca se enviaba nada.
    const { data: profile } = await supabase
      .from("profiles")
      .select("evolution_instance_name, notification_preferences")
      .eq("company_id", ownedOrder.company_id)
      .eq("whatsapp_connected", true)
      .limit(1)
      .maybeSingle();

    const prefs = (profile?.notification_preferences ?? {}) as Record<string, boolean>;
    if (prefs[new_status] !== true) {
      return json({ skipped: true, reason: "notification disabled for status" });
    }

    const tracking_url = `${app_origin ?? ""}/tracking/${code}`;
    const statusLabel = STATUS_LABELS[new_status] ?? new_status;
    const message_template =
      new_status === "listo"
        ? `¡Hola ${customer_name}! 🎉 Tu ${device_type} ya está listo para retirar. ` +
          `Pasá cuando quieras por el local. Ante cualquier consulta no dudes en escribirnos. ` +
          `¡Gracias por confiar en nosotros! ✅`
        : `¡Hola ${customer_name}! El estado de tu ${device_type} ` +
          `(Orden *${order_number}*) fue actualizado a: *${statusLabel}*. ` +
          `Revisá los detalles aquí: ${tracking_url} 🔧`;

    const result = await sendWhatsAppText(profile?.evolution_instance_name, customer_phone, message_template);

    await supabase.from("notification_send_log").insert({ user_id: user.id });

    if (!result.ok) return json({ error: result.error }, 502);
    return json({ success: true });
  } catch (e) {
    console.error("send-status-notification error", e);
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
