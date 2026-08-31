import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type MarcaPreset = { id: string; label: string };

// El nombre del toggle (use_device_classification) refleja que controla el
// paquete completo Marca+Modelo, no solo la lista de marcas — mismo bundle
// que useDeviceTypePresets ya hace con presets+selectionMode.
export function useMarcaPresets() {
  const { companyId } = useCompany();
  const [presets, setPresets] = useState<MarcaPreset[]>([]);
  const [useDeviceClassification, setUseDeviceClassification] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: rows }, { data: company }] = await Promise.all([
      supabase
        .from("marca_presets")
        .select("id, label")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("companies")
        .select("use_device_classification")
        .eq("id", companyId)
        .maybeSingle<{ use_device_classification: boolean | null }>(),
    ]);
    setPresets((rows ?? []) as MarcaPreset[]);
    setUseDeviceClassification(!!company?.use_device_classification);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { presets, useDeviceClassification, loading, reload: load, companyId };
}
