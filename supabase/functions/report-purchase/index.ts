import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { buildPurchaseEvent } from "../_shared/metaCapi.ts";

// Le avisa a Meta (API de conversiones) que se usó un link de alta pagada: «esta persona
// compró el plan X por tanto». La llaman Register.tsx justo después del registro con
// /empezar/:code y, como respaldo, /superadmin/altas para los links usados que todavía no
// se avisaron. Corre con service_role y sin usuario logueado: la única entrada es un código
// de link ya USADO, cada link se avisa una sola vez (meta_reported_at) y la respuesta no
// devuelve ningún dato. Sin META_CAPI_TOKEN no hace nada y el link queda pendiente.

const CODE_RE = /^[0-9A-F]{10}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!CODE_RE.test(code)) return json({ error: "invalid_code" }, 400);

    const token = Deno.env.get("META_CAPI_TOKEN");
    if (!token) return json({ skipped: "no_token" });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: invite } = await admin
      .from("signup_invites")
      .select("id, code, plan_type, billing_cycle, amount_gs, used_at, used_company_id, meta_reported_at")
      .eq("code", code)
      .maybeSingle();
    if (!invite?.used_at || !invite.used_company_id) return json({ skipped: "not_used" });
    if (invite.meta_reported_at) return json({ skipped: "already_reported" });

    // Se marca antes de mandar, para que dos llamadas a la vez no avisen dos veces.
    const { data: claimed } = await admin
      .from("signup_invites")
      .update({ meta_reported_at: new Date().toISOString(), meta_report_error: null })
      .eq("id", invite.id)
      .is("meta_reported_at", null)
      .select("id");
    if (!claimed?.length) return json({ skipped: "already_reported" });

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, phone")
      .eq("company_id", invite.used_company_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let email = "";
    let country = "";
    if (profile) {
      const { data: u } = await admin.auth.admin.getUserById(profile.id);
      email = u?.user?.email ?? "";
      country = String(u?.user?.user_metadata?.country ?? "");
    }

    const event = await buildPurchaseEvent({
      code: invite.code,
      usedAt: invite.used_at,
      planType: invite.plan_type,
      billingCycle: invite.billing_cycle,
      amountGs: invite.amount_gs,
      email,
      phone: profile?.phone ?? "",
      fullName: profile?.full_name ?? "",
      country,
    });

    const pixel = Deno.env.get("META_PIXEL_ID") ?? "1720376785975837";
    const version = Deno.env.get("META_GRAPH_VERSION") ?? "v23.0";
    const testCode = Deno.env.get("META_TEST_EVENT_CODE");
    const res = await fetch(`https://graph.facebook.com/${version}/${pixel}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [event], access_token: token, ...(testCode ? { test_event_code: testCode } : {}) }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      await admin
        .from("signup_invites")
        .update({ meta_reported_at: null, meta_report_error: `${res.status}: ${detail}` })
        .eq("id", invite.id);
      return json({ error: "meta_error" }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
