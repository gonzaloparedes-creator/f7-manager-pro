import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type WarrantyPreset = { id: string; label: string; days: number };

export function useWarrantyPresets() {
  const { companyId } = useCompany();
  const [presets, setPresets] = useState<WarrantyPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("warranty_presets")
      .select("id, label, days")
      .eq("company_id", companyId)
      .order("days", { ascending: true });
    setPresets((data ?? []) as WarrantyPreset[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { presets, loading, reload: load, companyId };
}
