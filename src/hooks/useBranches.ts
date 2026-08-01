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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user || !companyId) { setLoading(false); return; }
      setLoading(true);
      const [{ data: brs }, { data: prof }] = await Promise.all([
        supabase.from("branches").select("id, name, address").eq("company_id", companyId).order("name"),
        supabase.from("profiles").select("branch_id").eq("id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      setBranches((brs ?? []) as Branch[]);
      setUserBranchId(prof?.branch_id ?? null);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [user, companyId]);

  return { branches, userBranchId, hasMultipleBranches: branches.length > 1, loading };
}
