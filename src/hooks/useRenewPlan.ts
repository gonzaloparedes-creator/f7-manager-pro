import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { PLAN_LABELS } from "@/lib/plans";
import { choosePlanMessage, openUpgradeWhatsApp, renewPlanMessage } from "@/lib/upgrade";

// Abre WhatsApp con el pedido ya escrito: renovar el plan (plan + negocio) o, en la prueba gratis, elegir un plan.
// El nombre se trae al montar para que el clic abra la ventana al instante.
export function useRenewPlan(kind: "paid" | "trial" = "paid") {
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
    () =>
      openUpgradeWhatsApp(
        kind === "trial" ? choosePlanMessage(companyName) : renewPlanMessage(PLAN_LABELS[plan], companyName)
      ),
    [kind, plan, companyName]
  );
}
