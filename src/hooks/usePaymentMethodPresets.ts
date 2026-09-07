import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type PaymentMethodPreset = { id: string; label: string };

export function usePaymentMethodPresets() {
  const { companyId } = useCompany();
  const [presets, setPresets] = useState<PaymentMethodPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("payment_method_presets")
      .select("id, label")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    setPresets((data ?? []) as PaymentMethodPreset[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { presets, loading, reload: load, companyId };
}
