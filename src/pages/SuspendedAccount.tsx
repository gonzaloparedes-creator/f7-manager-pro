import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CalendarX2, ShieldAlert } from "lucide-react";
import { choosePlanMessage, openUpgradeWhatsApp } from "@/lib/upgrade";
import { formatDateISO } from "@/lib/subscriptionReceipt";
import type { SuspensionReason } from "@/hooks/useCompanyStatus";

interface SuspendedAccountProps {
  reason?: SuspensionReason;
  // Último día cubierto por el plan o la prueba (solo cuando la suspensión es por plazo).
  expiresAt?: string | null;
}

export default function SuspendedAccount({ reason = "manual", expiresAt = null }: SuspendedAccountProps) {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const trial = reason === "trial";
  const expired = reason === "expired" || trial;
  const Icon = expired ? CalendarX2 : ShieldAlert;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-4 rounded-lg border bg-card p-8 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <Icon className="h-7 w-7" />
        </div>
        {trial ? (
          <>
            <h1 className="text-2xl font-bold">Tu prueba gratis terminó</h1>
            <p className="text-muted-foreground">
              {expiresAt ? `La prueba de F7 Manager Pro terminó el ${formatDateISO(expiresAt)}` : "La prueba de F7 Manager Pro terminó"} y
              la cuenta quedó en pausa. Tus datos están guardados: apenas elijas un plan, todo vuelve a funcionar.
            </p>
          </>
        ) : expired ? (
          <>
            <h1 className="text-2xl font-bold">Tu plan venció</h1>
            <p className="text-muted-foreground">
              {expiresAt ? `El período de tu plan terminó el ${formatDateISO(expiresAt)}` : "El período de tu plan terminó"} y la
              cuenta quedó suspendida. Tus datos están guardados: apenas renovemos tu plan, todo vuelve a funcionar.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Cuenta Suspendida</h1>
            <p className="text-muted-foreground">
              Tu cuenta ha sido suspendida. Por favor contactá al administrador para reactivar tu acceso a F7 Manager Pro.
            </p>
          </>
        )}
        <div className="space-y-2">
          <Button
            onClick={() =>
              openUpgradeWhatsApp(
                trial
                  ? choosePlanMessage()
                  : expired
                    ? "Hola, el plan de mi cuenta de F7 Manager Pro venció y quiero renovarlo."
                    : "Hola, mi cuenta de F7 Manager Pro fue suspendida y quiero reactivarla."
              )
            }
            className="w-full"
          >
            {trial ? "Elegir un plan" : expired ? "Renovar mi plan" : "Contactar para reactivar"}
          </Button>
          {expired && (
            <Button onClick={() => window.location.reload()} variant="secondary" className="w-full">
              {trial ? "Ya activé mi plan, volver a entrar" : "Ya renové, volver a entrar"}
            </Button>
          )}
          <Button onClick={signOut} variant="outline" className="w-full">
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
