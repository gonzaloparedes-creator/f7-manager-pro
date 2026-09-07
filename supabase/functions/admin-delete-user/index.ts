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
    if (!isAdmin) return json({ error: "Solo administradores pueden eliminar usuarios" }, 403);

    const body = await req.json().catch(() => ({}));
    const { user_id } = body ?? {};
    if (!user_id) return json({ error: "Falta user_id" }, 400);
    if (user_id === user.id) return json({ error: "No podés eliminar tu propia cuenta desde acá" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();
    const company_id = callerProfile?.company_id as string | undefined;
    if (!company_id) return json({ error: "No se pudo determinar tu empresa" }, 400);

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, company_id, full_name")
      .eq("id", user_id)
      .maybeSingle();
    if (!targetProfile || targetProfile.company_id !== company_id) {
      return json({ error: "Usuario no encontrado en tu empresa" }, 404);
    }

    const { data: targetRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id);
    const targetIsAdmin = (targetRoles ?? []).some((r) => r.role === "admin");

    if (targetIsAdmin) {
      const { data: companyProfiles } = await admin
        .from("profiles")
        .select("id")
        .eq("company_id", company_id);
      const companyUserIds = (companyProfiles ?? []).map((p) => p.id);
      const { data: companyAdminRoles } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .in("user_id", companyUserIds);
      if ((companyAdminRoles ?? []).length <= 1) {
        return json({ error: "No podés eliminar al único administrador de la empresa" }, 400);
      }
    }

    // orders.technician_id (quién la creó) es NOT NULL + ON DELETE RESTRICT,
    // y received_by_id también bloquea el borrado si hay referencias — a
    // propósito, para no perder de forma irreversible a quién pertenece una
    // orden ya facturada/con garantía (ver 20260728000030). Se detecta antes
    // de intentar borrar para devolver un mensaje claro en vez del error crudo
    // de Postgres.
    const [{ count: asCreator }, { count: asReceiver }] = await Promise.all([
      admin.from("orders").select("id", { count: "exact", head: true }).eq("technician_id", user_id),
      admin.from("orders").select("id", { count: "exact", head: true }).eq("received_by_id", user_id),
    ]);
    const orderRefs = Math.max(asCreator ?? 0, asReceiver ?? 0);
    if ((asCreator ?? 0) > 0 || (asReceiver ?? 0) > 0) {
      return json({
        error: `No se puede eliminar: ${targetProfile.full_name || "este usuario"} tiene ${orderRefs} orden(es) registradas a su nombre (como técnico o quien recepcionó). Para eliminarlo, primero reasigná esas órdenes a otro técnico desde el detalle de cada una.`,
      }, 409);
    }

    // assigned_technician_id no tiene FK — se limpia a "Sin asignar" para no
    // dejar órdenes apuntando a un usuario que ya no existe.
    await admin.from("orders").update({ assigned_technician_id: null }).eq("assigned_technician_id", user_id);

    await admin.from("user_roles").delete().eq("user_id", user_id);
    await admin.from("profiles").delete().eq("id", user_id);

    const { error: deleteErr } = await admin.auth.admin.deleteUser(user_id);
    if (deleteErr) return json({ error: deleteErr.message }, 500);

    return json({ success: true });
  } catch (e) {
    console.error("admin-delete-user error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
