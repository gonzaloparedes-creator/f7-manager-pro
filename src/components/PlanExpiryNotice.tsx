import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CalendarX2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlanExpiryBar from "@/components/PlanExpiryBar";
import { usePlanExpiry } from "@/hooks/usePlanExpiry";
import { useRenewPlan } from "@/hooks/useRenewPlan";
import { useUserRole } from "@/hooks/useUserRole";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { accessHeadline } from "@/lib/planExpiry";
import { addDaysISO, formatDateISO } from "@/lib/subscriptionReceipt";
import { cn } from "@/lib/utils";

const storageKey = (expiresAt: string) => `f7:plan-expiry-notice:${expiresAt}`;

function wasDismissed(expiresAt: string): boolean {
  try {
    return window.sessionStorage.getItem(storageKey(expiresAt)) === "1";
  } catch {
    return false;
  }
}

function titleFor(daysLeft: number): string {
  if (daysLeft > 1) return `Tu plan vence en ${daysLeft} días`;
  if (daysLeft === 1) return "Tu plan vence mañana";
  if (daysLeft === 0) return "Tu plan vence hoy";
  return "Tu plan venció";
}

// Tarjeta del tablero principal: avisa a quien administra la cuenta que el plan está por vencer
// (naranja, se puede ocultar por sesión) o que ya venció y falta poco para la suspensión (roja, fija).
export default function PlanExpiryNotice() {
  const { isAdmin } = useUserRole();
  const { canManageCompany } = useStaffPermissions();
  const { info } = usePlanExpiry();
  const renew = useRenewPlan();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  if (!isAdmin || !canManageCompany || !info || info.tone === "ok") return null;

  const grace = info.phase !== "active";
  if (!grace && (dismissedFor === info.expiresAt || wasDismissed(info.expiresAt))) return null;

  const suspendsOn = formatDateISO(addDaysISO(info.accessUntil, 1));

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(storageKey(info.expiresAt), "1");
    } catch {
      // sin almacenamiento disponible: se oculta hasta recargar
    }
    setDismissedFor(info.expiresAt);
  };

  const Icon = grace ? CalendarX2 : CalendarClock;

  return (
    <section
      role="status"
      data-testid="plan-expiry-notice"
      aria-label="Aviso de vencimiento del plan"
      className={cn(
        "relative overflow-hidden rounded-lg border p-4 md:p-5",
        grace ? "border-destructive/50 bg-destructive/10" : "border-secondary/50 bg-secondary/10"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            grace ? "bg-destructive/15 text-destructive" : "bg-secondary/15 text-secondary"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className={cn("text-base font-semibold md:text-lg", grace ? "text-destructive" : "text-secondary")}>
              {titleFor(info.daysLeft)}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {grace
                ? `Tu plan terminó el ${formatDateISO(info.expiresAt)}. ${accessHeadline(info.daysToSuspension, info.accessUntil)}: si no lo renovás, la cuenta se suspende el ${suspendsOn}.`
                : `Vence el ${formatDateISO(info.expiresAt)}. Renovalo a tiempo: si pasa la fecha, la cuenta se suspende sola el ${suspendsOn}.`}
            </p>
          </div>

          <PlanExpiryBar info={info} />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={renew} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <RefreshCw className="mr-2 h-4 w-4" /> Renovar mi plan
            </Button>
            <Button asChild variant="outline">
              <Link to="/configuracion?tab=suscripcion">Ver mi suscripción</Link>
            </Button>
          </div>
        </div>
        {!grace && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Ocultar aviso de vencimiento"
            className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}
