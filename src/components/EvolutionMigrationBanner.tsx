import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { usePendingMessages } from "@/hooks/usePendingMessages";
import { dismissEvolutionBanner, evolutionSunsetLabel, isEvolutionBannerDismissed } from "@/lib/whatsappMigration";

// Aviso del Dashboard para los talleres que todavía mandan los avisos con el
// WhatsApp conectado por QR. Solo lo ve un administrador (es quien puede
// cambiar de modo) y se puede cerrar por una semana.
export default function EvolutionMigrationBanner() {
  const { isAdmin } = useUserRole();
  const { evolutionActive } = usePendingMessages();
  const [dismissed, setDismissed] = useState(isEvolutionBannerDismissed);

  if (!isAdmin || !evolutionActive || dismissed) return null;
  const sunset = evolutionSunsetLabel();

  return (
    <div
      role="status"
      data-testid="evolution-banner"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <div className="font-semibold">Cambiamos a WhatsApp seguro: pasate cuando quieras</div>
          <p className="mt-0.5 text-amber-900/90 dark:text-amber-100/80">
            Conectar el WhatsApp del taller con un código QR no es una vía oficial y WhatsApp puede bloquear tu número sin
            avisar. Ahora F7 te deja cada mensaje escrito y lo mandás con un toque desde tu propio WhatsApp.
            {sunset ? ` La conexión actual funciona hasta el ${sunset}.` : " La conexión actual va a dejar de funcionar más adelante: te avisamos con tiempo."}
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="border-amber-400 bg-transparent text-amber-950 hover:bg-amber-100 hover:text-amber-950 dark:text-amber-100 dark:hover:bg-amber-900/40 dark:hover:text-amber-100">
          <Link to="/configuracion?tab=whatsapp">Ver cómo pasarme</Link>
        </Button>
      </div>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => { dismissEvolutionBanner(); setDismissed(true); }}
        className="shrink-0 rounded p-1 text-amber-700 hover:bg-amber-200/60 dark:text-amber-300 dark:hover:bg-amber-900/50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
