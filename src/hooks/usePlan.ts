import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { type PlanType, PLAN_LIMITS } from "@/lib/plans";

export type { PlanType };
export { PLAN_LIMITS };

export function usePlan() {
  const { companyId, loading: companyLoading } = useCompany();
  const [plan, setPlan] = useState<PlanType>("starter");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (companyLoading) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("companies")
      .select("plan_type")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const p = (data as any)?.plan_type as PlanType | undefined;
        setPlan(p && p in PLAN_LIMITS ? p : "starter");
        setLoading(false);
      });
    return () => { active = false; };
  }, [companyId, companyLoading]);

  const isStarter = plan === "starter";
  const isPro = plan === "pro";
  const isBusiness = plan === "business";
  const isRetail = plan === "retail";
  const limits = PLAN_LIMITS[plan];

  return { plan, isStarter, isPro, isBusiness, isRetail, limits, loading: loading || companyLoading };
}
