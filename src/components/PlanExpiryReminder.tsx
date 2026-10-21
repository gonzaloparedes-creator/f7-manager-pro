import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, X } from "lucide-react";
import { usePlanExpiry } from "@/hooks/usePlanExpiry";
import { formatDateISO } from "@/lib/subscriptionReceipt";
import { cn } from "@/lib/utils";

const storageKey = (expiresAt: string) => `f7:plan-expiry-reminder:${expiresAt}`;

function wasDismissed(expiresAt: string): boolean {
  try {
    return window.sessionStorage.getItem(storageKey(expiresAt)) === "1";
  } catch {
    return false;
  }
}

// Aviso fino para quien administra la cuenta: solo aparece cuando falta una semana o menos (o ya venció).
export default function PlanExpiryReminder() {
  const { info } = usePlanExpiry();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  if (!info || info.tone === "ok") return null;
  if (dismissedFor === info.expiresAt || wasDismissed(info.expiresAt)) return null;

  const expired = info.tone === "expired";

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(storageKey(info.expiresAt), "1");
    } catch {
      // sin almacenamiento disponible: se oculta hasta recargar
    }
    setDismissedFor(info.expiresAt);
  };

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 border-b px-4 py-2 text-sm md:px-8",
        expired ? "border-destructive/40 bg-destructive/10" : "border-secondary/40 bg-secondary/10"
      )}
    >
      <CalendarClock className={cn("h-4 w-4 shrink-0", expired ? "text-destructive" : "text-secondary")} />
      <p className="min-w-0 flex-1">
        <span className={cn("font-semibold", expired ? "text-destructive" : "text-secondary")}>{info.headline}</span>
        <span className="text-muted-foreground">
          {" · "}
          {expired ? "tu plan venció el" : "tu plan vence el"} {formatDateISO(info.expiresAt)}
        </span>
      </p>
      <Link
        to="/configuracion?tab=suscripcion"
        className="shrink-0 whitespace-nowrap font-medium text-primary underline-offset-2 hover:underline"
      >
        Ver mi plan
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ocultar aviso de vencimiento"
        className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
