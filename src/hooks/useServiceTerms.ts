import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { DEFAULT_SERVICE_TERMS } from "@/lib/orders";

export function useServiceTerms() {
  const { companyId } = useCompany();
  const [template, setTemplate] = useState<string>(DEFAULT_SERVICE_TERMS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("service_terms_template")
      .eq("id", companyId)
      .maybeSingle<{ service_terms_template: string | null }>();
    setTemplate(data?.service_terms_template || DEFAULT_SERVICE_TERMS);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { template, loading, reload: load, companyId };
}
