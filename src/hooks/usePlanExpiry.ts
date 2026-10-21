import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { planExpiryInfo, type PlanPeriodRow } from "@/lib/planExpiry";

// Vencimiento del plan de la propia empresa. null = todavía no tiene un pago registrado.
export function usePlanExpiry() {
  const { companyId, loading: companyLoading } = useCompany();
  const [row, setRow] = useState<PlanPeriodRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (companyLoading) return;
    if (!companyId) {
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("companies")
      .select("billing_cycle, plan_paid_from, plan_expires_at")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setRow(data ?? null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, companyLoading]);

  const info = useMemo(() => (row ? planExpiryInfo(row) : null), [row]);

  return { info, loading: loading || companyLoading };
}
