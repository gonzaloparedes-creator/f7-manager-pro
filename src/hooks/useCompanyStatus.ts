import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export function useCompanyStatus() {
  const { companyId, loading: companyLoading } = useCompany();
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (companyLoading) return;
    if (!companyId) {
      setIsActive(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("companies")
      .select("is_active")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setIsActive((data as any)?.is_active ?? true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, companyLoading]);

  return { isActive, loading: loading || companyLoading };
}
