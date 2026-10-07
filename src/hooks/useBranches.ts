import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";

export type Branch = { id: string; name: string; address: string | null };

export function useBranches() {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userBranchId, setUserBranchId] = useState<string | null>(null);
  const [restrictToBranch, setRestrictToBranch] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user || !companyId) { setLoading(false); return; }
      setLoading(true);
      const [{ data: brs }, { data: prof }] = await Promise.all([
        supabase.from("branches").select("id, name, address").eq("company_id", companyId).order("name"),
        supabase.from("profiles").select("branch_id, restrict_to_branch").eq("id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      setBranches((brs ?? []) as Branch[]);
      setUserBranchId(prof?.branch_id ?? null);
      setRestrictToBranch(!!prof?.restrict_to_branch);
      setLoading(false);
    };
    load();
    return () => { active = false; };
    // Ver comentario equivalente en useCompany.ts: el objeto `user` cambia de
    // referencia en cada refresh de token (p. ej. al volver a la pestaña),
    // aunque sea el mismo usuario — depender del id evita refetchear de más.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, companyId]);

  // Un usuario restringido a su sucursal solo conoce la suya: así no aparecen
  // selectores ni filtros de "otra sucursal" (la RLS igual no le dejaría ver
  // ni cargar nada de las demás).
  const visibleBranches = restrictToBranch ? branches.filter((b) => b.id === userBranchId) : branches;
  const hasMultipleBranches = visibleBranches.length > 1;
  // Sucursal que se guarda por defecto en un alta nueva. Con una sola
  // sucursal no hace falta atribuir (queda sin sucursal, como siempre).
  const defaultBranchId = hasMultipleBranches || restrictToBranch ? userBranchId : null;

  return { branches: visibleBranches, userBranchId, restrictToBranch, defaultBranchId, hasMultipleBranches, loading };
}
