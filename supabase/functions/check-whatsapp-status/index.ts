import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return json({ error: "Evolution API no configurada" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "No autorizado" }, 401);

    const instance = `repairdesk_${user.id}`;
    const base = EVOLUTION_API_URL.replace(/\/$/, "");

    const res = await fetch(`${base}/instance/connectionState/${instance}`, {
      headers: { apikey: EVOLUTION_API_KEY },
    });
    const data = await res.json().catch(() => ({}));
    const state: string = data?.instance?.state ?? data?.state ?? "close";

    if (state === "open") {
      // Try to fetch the bound number
      let phone: string | null = null;
      try {
        const info = await fetch(`${base}/instance/fetchInstances?instanceName=${instance}`, {
          headers: { apikey: EVOLUTION_API_KEY },
        });
        const arr = await info.json();
        const inst = Array.isArray(arr) ? arr[0] : arr;
        phone = inst?.instance?.owner ?? inst?.owner ?? null;
        if (phone && phone.includes("@")) phone = phone.split("@")[0];
      } catch { /* noop */ }

      await supabase.from("profiles").update({
        whatsapp_connected: true,
        evolution_instance_name: instance,
        whatsapp_phone: phone,
      }).eq("id", user.id);
    }

    return json({ state, instance });
  } catch (e) {
    console.error("check-whatsapp-status error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
