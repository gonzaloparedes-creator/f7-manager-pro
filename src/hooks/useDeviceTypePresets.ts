import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type DeviceTypePreset = { id: string; label: string };

export function useDeviceTypePresets() {
  const { companyId } = useCompany();
  const [presets, setPresets] = useState<DeviceTypePreset[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: rows }, { data: company }] = await Promise.all([
      supabase
        .from("device_type_presets")
        .select("id, label")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("companies")
        .select("use_device_type_presets")
        .eq("id", companyId)
        .maybeSingle<{ use_device_type_presets: boolean | null }>(),
    ]);
    setPresets((rows ?? []) as DeviceTypePreset[]);
    setSelectionMode(!!company?.use_device_type_presets);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { presets, selectionMode, loading, reload: load, companyId };
}
