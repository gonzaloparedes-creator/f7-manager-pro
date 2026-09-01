import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type ModeloPreset = { id: string; label: string };

// Lista independiente de marca_presets — mismo bundle use_device_classification,
// pero es su propia colección (no depende de qué Marca esté seleccionada).
export function useModeloPresets() {
  const { companyId } = useCompany();
  const [presets, setPresets] = useState<ModeloPreset[]>([]);
  const [useDeviceClassification, setUseDeviceClassification] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: rows }, { data: company }] = await Promise.all([
      supabase
        .from("modelo_presets")
        .select("id, label")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("companies")
        .select("use_device_classification")
        .eq("id", companyId)
        .maybeSingle<{ use_device_classification: boolean | null }>(),
    ]);
    setPresets((rows ?? []) as ModeloPreset[]);
    setUseDeviceClassification(!!company?.use_device_classification);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { presets, useDeviceClassification, loading, reload: load, companyId };
}
