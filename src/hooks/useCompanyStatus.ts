import { useCompanyAccess } from "@/hooks/useCompanyAccess";

// manual = la suspendió el administrador; expired = venció el plan pago; trial = terminó la prueba gratis.
export type SuspensionReason = "manual" | "expired" | "trial";

// isActive === false significa "bloqueada": suspendida a mano o con el plazo vencido.
// Si no se pudo leer el estado, no se bloquea (isActive = true).
export function useCompanyStatus() {
  const { access, loading } = useCompanyAccess();

  const reason: SuspensionReason | null =
    !access || !access.blocked ? null : !access.isActive ? "manual" : access.kind === "trial" ? "trial" : "expired";

  return {
    isActive: loading ? null : access ? !access.blocked : true,
    reason,
    expiresAt: access?.period.plan_expires_at ?? access?.period.trial_ends_at ?? null,
    loading,
  };
}
