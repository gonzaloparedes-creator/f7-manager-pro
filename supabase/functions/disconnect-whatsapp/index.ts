import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "No autorizado" }, 401);

    const instance = `repairdesk_${user.id}`;

    if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
      const base = EVOLUTION_API_URL.replace(/\/$/, "");
      // Try logout then delete
      try {
        await fetch(`${base}/instance/logout/${instance}`, {
          method: "DELETE",
          headers: { apikey: EVOLUTION_API_KEY },
        });
      } catch { /* noop */ }
      try {
        await fetch(`${base}/instance/delete/${instance}`, {
          method: "DELETE",
          headers: { apikey: EVOLUTION_API_KEY },
        });
      } catch { /* noop */ }
    }

    await supabase.from("profiles").update({
      whatsapp_connected: false,
      evolution_instance_name: null,
      whatsapp_phone: null,
    }).eq("id", user.id);

    return json({ success: true });
  } catch (e) {
    console.error("disconnect-whatsapp error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
