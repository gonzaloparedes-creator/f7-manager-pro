import { useCompanyAccess } from "@/hooks/useCompanyAccess";

export type SuspensionReason = "manual" | "expired";

// isActive === false significa "bloqueada": suspendida a mano o con el plazo vencido.
// Si no se pudo leer el estado, no se bloquea (isActive = true).
export function useCompanyStatus() {
  const { access, loading } = useCompanyAccess();

  const reason: SuspensionReason | null = !access || !access.blocked ? null : !access.isActive ? "manual" : "expired";

  return {
    isActive: loading ? null : access ? !access.blocked : true,
    reason,
    expiresAt: access?.period.plan_expires_at ?? null,
    loading,
  };
}
