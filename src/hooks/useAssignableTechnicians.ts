import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type AssignableTechnician = { id: string; full_name: string | null };

// Usuarios que pueden aparecer como "Técnico Asignado" de una orden: admin o
// staff. Deliberadamente excluye 'recepcion' — alguien que solo recepciona
// equipos no debería aparecer en esta lista. Reemplaza la query vieja que
// filtraba únicamente por role='staff' (por eso un admin nunca aparecía).
export function useAssignableTechnicians() {
  const { companyId } = useCompany();
  const [technicians, setTechnicians] = useState<AssignableTechnician[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", companyId);
    const ids = (profs ?? []).map((p) => p.id);
    if (ids.length === 0) {
      setTechnicians([]);
      setLoading(false);
      return;
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids)
      .in("role", ["admin", "staff"]);
    const assignableIds = new Set((roles ?? []).map((r) => r.user_id));
    setTechnicians((profs ?? []).filter((p) => assignableIds.has(p.id)) as AssignableTechnician[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { technicians, loading, reload: load, companyId };
}
