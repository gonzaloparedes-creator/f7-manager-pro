import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type ProblemPreset = { id: string; label: string };

export function useProblemPresets() {
  const { companyId } = useCompany();
  const [presets, setPresets] = useState<ProblemPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("problem_presets")
      .select("id, label")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    setPresets((data ?? []) as ProblemPreset[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { presets, loading, reload: load, companyId };
}
