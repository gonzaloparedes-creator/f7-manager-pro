import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import type { TemplateOverrides } from "@/lib/customerMessages";

export function useMessageTemplates() {
  const { companyId } = useCompany();
  const [overrides, setOverrides] = useState<TemplateOverrides>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_templates")
      .select("event_key, body")
      .eq("company_id", companyId);
    const next: TemplateOverrides = {};
    for (const row of data ?? []) next[row.event_key] = row.body;
    setOverrides(next);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { overrides, loading, reload: load, companyId };
}
