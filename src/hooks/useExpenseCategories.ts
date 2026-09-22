import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type ExpenseCategoryPreset = { id: string; label: string };

export function useExpenseCategories() {
  const { companyId } = useCompany();
  const [presets, setPresets] = useState<ExpenseCategoryPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("expense_categories")
      .select("id, label")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    setPresets((data ?? []) as ExpenseCategoryPreset[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { presets, loading, reload: load, companyId };
}
