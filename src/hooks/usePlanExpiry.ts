import { useMemo } from "react";
import { useCompanyAccess } from "@/hooks/useCompanyAccess";
import { planExpiryInfo } from "@/lib/planExpiry";

// Vencimiento del plan de la propia empresa. null = todavía no tiene un pago registrado.
export function usePlanExpiry() {
  const { access, loading } = useCompanyAccess();

  const info = useMemo(
    () => (access ? planExpiryInfo(access.period, access.today, access.graceDays) : null),
    [access]
  );

  return { info, loading };
}
