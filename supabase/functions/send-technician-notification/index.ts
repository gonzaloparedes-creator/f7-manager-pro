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

    const body = await req.json().catch(() => ({}));
    const { order_number, technician_id, customer_name, device_type } = body ?? {};
    if (!order_number || !technician_id) return json({ error: "Campos requeridos faltantes" }, 400);

    // La orden tiene que existir y ser visible para este usuario bajo RLS
    // (misma empresa) — evita notificar a un técnico de otra empresa.
    const { data: order } = await supabase
      .from("orders")
      .select("id, company_id")
      .eq("order_number", order_number)
      .maybeSingle();
    if (!order) return json({ error: "Orden no encontrada" }, 404);

    const { data: technician } = await supabase
      .from("profiles")
      .select("id, full_name, phone, company_id")
      .eq("id", technician_id)
      .maybeSingle();
    if (!technician || technician.company_id !== order.company_id) {
      return json({ error: "Técnico no encontrado en esta empresa" }, 404);
    }
    if (!technician.phone) {
      return json({ success: false, skipped: "El técnico no tiene teléfono cargado" });
    }

    // Mismo WhatsApp conectado que ya usa la empresa para avisar al cliente
    // (ver send-order-notification) — es un recurso de la empresa, no de
    // quien crea la orden.
    const { data: waProfile } = await supabase
      .from("profiles")
      .select("evolution_instance_name")
      .eq("company_id", order.company_id)
      .eq("whatsapp_connected", true)
      .limit(1)
      .maybeSingle();

    const techName = technician.full_name || "";
    const greeting = techName ? `¡Hola ${techName}!` : "¡Hola!";
    const details = [customer_name, device_type].filter(Boolean).join(" — ");
    const message = `${greeting} 🔧 Se te asignó una nueva orden: *${order_number}*${details ? ` (${details})` : ""}. Entrá a F7 Manager Pro para ver el detalle.`;

    const result = await sendWhatsAppText(waProfile?.evolution_instance_name, technician.phone, message);

    await supabase.from("notification_send_log").insert({ user_id: user.id });

    if (!result.ok) return json({ success: false, skipped: result.error });
    return json({ success: true });
  } catch (e) {
    console.error("send-technician-notification error", e);
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
