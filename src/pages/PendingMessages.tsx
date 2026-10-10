import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle, Pencil, X, CheckCircle2, Info, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import AvisarClienteDialog from "@/components/AvisarClienteDialog";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { usePendingMessages } from "@/hooks/usePendingMessages";
import { logCustomerMessage, type MessageAction } from "@/lib/customerMessages";
import { QUEUE_WINDOW_DAYS, type PendingKind, type PendingMessage } from "@/lib/pendingMessages";
import { openWhatsApp } from "@/lib/whatsapp";

const KIND_STYLES: Record<PendingKind, string> = {
  status: "border-primary/30 bg-primary/10 text-primary",
  creation: "border-secondary/40 bg-secondary/10 text-secondary",
  quote_response: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export default function PendingMessages() {
  const { items, count, evolutionActive, loading, error, refresh, markHandled } = usePendingMessages();
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [editing, setEditing] = useState<PendingMessage | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const record = (item: PendingMessage, action: MessageAction) => {
    if (!companyId || !user) return;
    void logCustomerMessage({
      companyId,
      userId: user.id,
      orderId: item.orderId,
      eventKey: item.eventKey,
      action,
      phone: item.phone,
      message: action === "dismissed" ? null : item.message,
    });
  };

  // window.open tiene que correr dentro del click (Safari/iOS bloquea los
  // popups abiertos después de un await).
  const handleOpen = (item: PendingMessage) => {
    openWhatsApp(item.phone, item.message);
    markHandled([item.id]);
    record(item, "opened");
  };

  const handleDismiss = (item: PendingMessage) => {
    markHandled([item.id]);
    record(item, "dismissed");
  };

  const handleDismissAll = () => {
    const pending = items;
    markHandled(pending.map((i) => i.id));
    pending.forEach((i) => record(i, "dismissed"));
    setConfirmAll(false);
  };

  const openEditor = (item: PendingMessage) => {
    setEditing(item);
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <MessageCircle className="h-6 w-6 text-green-600" />
            Avisos pendientes
            {count > 0 && <Badge className="bg-green-600 text-white hover:bg-green-600">{count}</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            Mensajes que F7 te sugiere mandar a tus clientes. Vos revisás y enviás desde tu WhatsApp: nada se manda solo.
          </p>
        </div>
        {count > 1 && (
          <Button variant="outline" onClick={() => setConfirmAll(true)}>
            Descartar todos
          </Button>
        )}
      </div>

      {evolutionActive && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-1">
              <div className="font-semibold">Tu WhatsApp conectado sigue avisando automáticamente</div>
              <p className="text-muted-foreground">
                Mientras tengas WhatsApp conectado desde Configuración, los avisos de estado salen solos y no hace falta
                revisar esta lista. Cuando lo desconectes, los avisos que no se hayan mandado van a aparecer acá para que los
                envíes con un toque.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && count === 0 && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
            <span>No pudimos cargar los avisos pendientes.</span>
            <Button size="sm" variant="outline" onClick={refresh}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {!evolutionActive && !error && loading && count === 0 && (
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {!evolutionActive && !error && !loading && count === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <div className="text-lg font-semibold">Estás al día</div>
            <p className="max-w-md text-sm text-muted-foreground">
              No hay avisos pendientes. Cuando una orden cambie de estado o un cliente responda un presupuesto, el mensaje
              listo para enviar aparece acá. Se muestran los últimos {QUEUE_WINDOW_DAYS} días.
            </p>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} data-testid="pending-item">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold">{item.customerName}</span>
                      <Link
                        to={`/ordenes/${item.orderId}`}
                        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {item.orderNumber} · {item.deviceType}
                      </Link>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={KIND_STYLES[item.kind]}>
                        {item.eventLabel}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">+{item.phone.replace(/\D/g, "")}</span>
                </div>

                <p className="line-clamp-3 whitespace-pre-line rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                  {item.message}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleOpen(item)}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    <MessageCircle className="mr-1.5 h-4 w-4" /> Abrir WhatsApp
                  </Button>
                  <Button variant="outline" onClick={() => openEditor(item)}>
                    <Pencil className="mr-1.5 h-4 w-4" /> Editar mensaje
                  </Button>
                  <Button variant="ghost" onClick={() => handleDismiss(item)}>
                    <X className="mr-1.5 h-4 w-4" /> Descartar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!evolutionActive && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          "Abrir WhatsApp" deja el mensaje cargado en tu WhatsApp; F7 no puede saber si finalmente lo enviaste, solo que lo
          abriste. Lo que descartes no se vuelve a sugerir.
        </p>
      )}

      {editing && (
        <AvisarClienteDialog
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o);
            if (!o) setTimeout(() => setEditing(null), 300);
          }}
          orderId={editing.orderId}
          customerName={editing.customerName}
          phone={editing.phone}
          eventKey={editing.eventKey}
          initialMessage={editing.message}
          suggested
          companyId={companyId}
        />
      )}

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="¿Descartar todos los avisos?"
        description={`Se van a descartar ${count} avisos pendientes sin abrir WhatsApp. No se vuelven a sugerir.`}
        confirmLabel="Descartar todos"
        onConfirm={handleDismissAll}
      />
    </div>
  );
}
