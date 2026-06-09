import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type PlanType = "starter" | "pro";

export const PLAN_LIMITS = {
  starter: { photos: 5, branches: 1, users: 1 },
  pro: { photos: 20, branches: Infinity, users: 5 },
} as const;

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
        const p = ((data as any)?.plan_type as PlanType) ?? "starter";
        setPlan(p === "pro" ? "pro" : "starter");
        setLoading(false);
      });
    return () => { active = false; };
  }, [companyId, companyLoading]);

  const isStarter = plan === "starter";
  const isPro = plan === "pro";
  const limits = PLAN_LIMITS[plan];

  return { plan, isStarter, isPro, limits, loading: loading || companyLoading };
}
