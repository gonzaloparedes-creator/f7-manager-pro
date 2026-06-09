import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Caller-scoped client to identify and check role
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "No autorizado" }, 401);

    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleErr) return json({ error: roleErr.message }, 500);
    if (!isAdmin) return json({ error: "Solo administradores pueden crear usuarios" }, 403);

    const body = await req.json().catch(() => ({}));
    const { email, password, full_name, phone, role, branch_id } = body ?? {};

    if (!email || !password) return json({ error: "Email y contraseña son obligatorios" }, 400);
    if (!["admin", "staff"].includes(role)) return json({ error: "Rol inválido" }, 400);
    if (String(password).length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Resolve admin's company so the new user is created within the same tenant
    const { data: adminProfile, error: adminProfErr } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();
    if (adminProfErr || !adminProfile?.company_id) {
      return json({ error: "No se pudo determinar la empresa del administrador" }, 400);
    }
    const company_id = adminProfile.company_id as string;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name ?? "",
        phone: phone ?? "",
        company_id, // handle_new_user reads this to skip creating a new tenant
      },
    });
    if (createErr || !created.user) return json({ error: createErr?.message ?? "No se pudo crear el usuario" }, 400);

    const newId = created.user.id;

    // handle_new_user trigger creates the profile row; ensure branch + company are set
    const { error: profErr } = await admin
      .from("profiles")
      .update({ branch_id: branch_id ?? null, full_name: full_name ?? "", phone: phone ?? "", company_id })
      .eq("id", newId);
    if (profErr) {
      // try insert as fallback
      await admin.from("profiles").insert({
        id: newId,
        full_name: full_name ?? "",
        phone: phone ?? "",
        branch_id: branch_id ?? null,
        company_id,
      });
    }

    const { error: roleInsertErr } = await admin
      .from("user_roles")
      .insert({ user_id: newId, role });
    if (roleInsertErr) return json({ error: roleInsertErr.message }, 500);

    return json({ success: true, user_id: newId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
