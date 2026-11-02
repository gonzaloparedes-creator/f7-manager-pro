import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { type PlanType, PLAN_LIMITS, planHasSeatLimits, planHasWorkshop } from "@/lib/plans";

export type { PlanType };
export { PLAN_LIMITS };

// El plan se lee al montar. Si Super Admin lo cambia con la sesión abierta (en
// otra pestaña, o el cliente con la app abierta) el menú se quedaba con el plan
// viejo hasta recargar. Al volver a la pestaña se vuelve a leer, en silencio y
// como máximo una vez cada 10 s.
const REFRESH_MIN_GAP_MS = 10_000;

export function usePlan() {
  const { companyId, loading: companyLoading } = useCompany();
  const [plan, setPlan] = useState<PlanType>("starter");
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - last < REFRESH_MIN_GAP_MS) return;
      last = now;
      setRefreshTick((n) => n + 1);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (companyLoading) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    // Solo la primera carga de cada empresa muestra el estado "cargando";
    // volver a leer el plan no debe parpadear el menú.
    const isRefresh = loadedFor.current === companyId;
    if (!isRefresh) setLoading(true);
    supabase
      .from("companies")
      .select("plan_type")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const p = (data as { plan_type?: PlanType } | null)?.plan_type;
        if (p && p in PLAN_LIMITS) setPlan(p);
        // Sin respuesta válida: la primera carga cae a Starter (el más
        // restrictivo), pero un refresco que falla (sin red, sesión vencida) no
        // debe bajarle el plan a quien ya lo tenía cargado.
        else if (!isRefresh) setPlan("starter");
        loadedFor.current = companyId;
        setLoading(false);
      });
    return () => { active = false; };
  }, [companyId, companyLoading, refreshTick]);

  const isStarter = plan === "starter";
  const isPro = plan === "pro";
  const isBusiness = plan === "business";
  const isRetail = plan === "retail";
  const hasWorkshop = planHasWorkshop(plan);
  const hasSeatLimits = planHasSeatLimits(plan);
  const limits = PLAN_LIMITS[plan];

  return { plan, isStarter, isPro, isBusiness, isRetail, hasWorkshop, hasSeatLimits, limits, loading: loading || companyLoading };
}
