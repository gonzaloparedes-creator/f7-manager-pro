import { useMemo } from "react";
import { useCompanyAccess } from "@/hooks/useCompanyAccess";
import { companyExpiryInfo } from "@/lib/planExpiry";

// Vencimiento de la propia empresa: su plan pago o, si no hay pago, su prueba gratis.
// null = no tiene ni pago ni prueba cargados.
export function usePlanExpiry() {
  const { access, loading } = useCompanyAccess();

  const info = useMemo(
    () => (access ? companyExpiryInfo(access.period, access.today, access.graceDays) : null),
    [access]
  );

  return { info, loading };
}
