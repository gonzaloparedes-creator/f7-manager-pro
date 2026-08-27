import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type OrderStatusPreset = { id: string; key: string; label: string; sort_order: number; is_locked: boolean };

export function useOrderStatusPresets() {
  const { companyId } = useCompany();
  const [presets, setPresets] = useState<OrderStatusPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("order_status_presets")
      .select("id, key, label, sort_order, is_locked")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true });
    setPresets((data ?? []) as OrderStatusPreset[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { presets, loading, reload: load, companyId };
}
