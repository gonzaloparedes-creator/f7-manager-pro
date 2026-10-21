import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { PLAN_LABELS } from "@/lib/plans";
import { openUpgradeWhatsApp, renewPlanMessage } from "@/lib/upgrade";

// Abre WhatsApp con el pedido de renovación ya escrito (plan + nombre del negocio).
// El nombre se trae al montar para que el clic abra la ventana al instante.
export function useRenewPlan() {
  const { companyId } = useCompany();
  const { plan } = usePlan();
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    let active = true;
    if (!companyId) return;
    supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setCompanyName(data?.name ?? "");
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  return useCallback(
    () => openUpgradeWhatsApp(renewPlanMessage(PLAN_LABELS[plan], companyName)),
    [plan, companyName]
  );
}
