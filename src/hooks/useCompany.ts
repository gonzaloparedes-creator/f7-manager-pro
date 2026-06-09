import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useCompany() {
  const { user, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) {
      setCompanyId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setCompanyId((data as any)?.company_id ?? null);
        setLoading(false);
      });
    return () => { active = false; };
  }, [user, authLoading]);

  return { companyId, loading: loading || authLoading };
}
