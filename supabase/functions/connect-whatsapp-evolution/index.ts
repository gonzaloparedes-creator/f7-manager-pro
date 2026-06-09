import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return json({ error: "Evolution API no configurada. Agregá EVOLUTION_API_URL y EVOLUTION_API_KEY como secrets." }, 500);
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

    // Try create instance (idempotent); ignore 'already exists'
    const createRes = await fetch(`${base}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({
        instanceName: instance,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
    const createTxt = await createRes.text();
    let created: any = null;
    try { created = JSON.parse(createTxt); } catch { /* noop */ }

    // If creation gave us a qrcode immediately, use it
    let qr = created?.qrcode?.base64 ?? null;

    if (!qr) {
      // Fetch via connect endpoint
      const connRes = await fetch(`${base}/instance/connect/${instance}`, {
        headers: { apikey: EVOLUTION_API_KEY },
      });
      const conn = await connRes.json().catch(() => ({}));
      qr = conn?.base64 ?? conn?.qrcode?.base64 ?? conn?.code ?? null;
    }

    // Save instance name on profile
    await supabase.from("profiles").update({ evolution_instance_name: instance }).eq("id", user.id);

    return json({ qr, instance });
  } catch (e) {
    console.error("connect-whatsapp-evolution error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
