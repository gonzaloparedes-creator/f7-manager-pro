import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import WhatsAppPrefsCard from "@/components/WhatsAppPrefsCard";
import WhatsAppTemplatesCard from "@/components/WhatsAppTemplatesCard";
import { evolutionSunsetLabel } from "@/lib/whatsappMigration";
import { MessageCircle, ShieldAlert, ShieldCheck } from "lucide-react";

const STEPS = [
  "Creás la orden o cambiás el estado, y F7 te muestra el aviso listo para mandar.",
  "Tocás “Abrir WhatsApp”: se abre tu WhatsApp con el mensaje ya escrito para ese cliente. Podés retocarlo antes.",
  "Tocás enviar en WhatsApp. Si lo dejás para después, el aviso queda esperando en Avisos.",
];

async function edgeErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (body?.error) return String(body.error);
    } catch { /* respuesta sin JSON */ }
  }
  return (error as Error)?.message || fallback;
}

export default function WhatsAppSettingsTab({ onOpenStatuses }: { onOpenStatuses?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { evolutionActive, reload } = useWhatsAppSettings();
  const [ownConnected, setOwnConnected] = useState(false);
  const [ownPhone, setOwnPhone] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadOwn = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("whatsapp_connected, whatsapp_phone")
      .eq("id", user.id)
      .maybeSingle();
    setOwnConnected(data?.whatsapp_connected === true);
    setOwnPhone(data?.whatsapp_phone ?? null);
  }, [user]);

  // user?.id (no el objeto user): evita recargar por un simple refresh de token.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadOwn(); }, [user?.id]);

  const disconnect = async () => {
    setDisconnecting(true);
    const { data, error } = await supabase.functions.invoke("disconnect-whatsapp");
    setDisconnecting(false);
    if (error || data?.error) {
      const description = data?.error ?? await edgeErrorMessage(error, "No se pudo desconectar");
      toast({ title: "Error", description, variant: "destructive" });
      return;
    }
    toast({ title: "WhatsApp desconectado", description: "Desde ahora los avisos los mandás con un toque desde tu WhatsApp." });
    setConfirmOpen(false);
    await Promise.all([loadOwn(), reload()]);
  };

  const sunset = evolutionSunsetLabel();

  return (
    <div className="space-y-6">
      {evolutionActive && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/30" data-testid="evolution-notice">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1 text-sm text-amber-950 dark:text-amber-100">
                <div className="font-semibold">Tu taller sigue usando la conexión por código QR</div>
                <p className="text-amber-900/90 dark:text-amber-100/80">
                  Esa conexión no es oficial: WhatsApp puede bloquear el número conectado sin avisar, y con él tus chats con clientes.
                  Por eso F7 pasa a un modo más seguro, donde los mensajes los mandás vos desde tu propio WhatsApp con un toque.
                  {sunset ? ` La conexión por QR funciona hasta el ${sunset}.` : " La conexión por QR va a dejar de funcionar más adelante: te avisamos con tiempo."}
                </p>
                <p className="text-amber-900/90 dark:text-amber-100/80">
                  {ownConnected
                    ? `Tu WhatsApp${ownPhone ? ` (${ownPhone})` : ""} está conectado. Al desconectarlo, los avisos automáticos de tu taller pasan a ser los de abajo, con un toque.`
                    : "El WhatsApp conectado es de otro administrador de tu taller: tiene que desconectarlo desde su cuenta para pasar al modo seguro."}
                </p>
              </div>
            </div>
            {ownConnected && (
              <Button variant="outline" className="border-amber-400 bg-transparent text-amber-950 hover:bg-amber-100 hover:text-amber-950 dark:text-amber-100 dark:hover:bg-amber-900/40 dark:hover:text-amber-100" onClick={() => setConfirmOpen(true)}>
                Desconectar y pasar al modo seguro
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="font-semibold">Avisar al cliente por WhatsApp</div>
              <div className="text-xs text-muted-foreground">Mandás el mensaje con un toque, desde tu propio WhatsApp.</div>
            </div>
          </div>
          <ol className="space-y-2 text-sm">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>
              Conviene usar el WhatsApp del taller (o WhatsApp Web en la compu del mostrador). Tu cliente ve el número de ese WhatsApp,
              así que si te escribe de vuelta, la conversación queda donde la tenés a mano.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/avisos">Ver avisos pendientes</Link>
          </Button>
        </CardContent>
      </Card>

      <WhatsAppPrefsCard evolutionActive={evolutionActive} />
      <WhatsAppTemplatesCard onOpenStatuses={onOpenStatuses} evolutionActive={evolutionActive} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Desconectar tu WhatsApp?"
        description="Se corta la conexión por código QR de tu cuenta y dejan de salir avisos automáticos desde ahí. Desde ese momento F7 te va a mostrar cada aviso listo para mandar con un toque. Tus chats y tu número no se tocan."
        confirmLabel="Desconectar"
        confirmingLabel="Desconectando..."
        loading={disconnecting}
        onConfirm={disconnect}
      />
    </div>
  );
}
