import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { openWhatsApp } from "@/lib/whatsapp";
import type { TechnicianRecipient } from "@/lib/technicianNotice";
import { MessageCircle, Copy, Check } from "lucide-react";

// El aviso al técnico es interno (no le habla a un cliente), así que no
// queda en customer_message_log: no hay nada que auditar ni que reintentar.
export default function AvisarTecnicoDialog({
  open,
  onOpenChange,
  recipients,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recipients: TechnicianRecipient[];
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setMessages(Object.fromEntries(recipients.map((r) => [r.id, r.message])));
    setOpened(new Set());
    // recipients se reconstruye en cada render del padre; solo importa al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // window.open tiene que correr dentro del click (Safari/iOS bloquea los
  // popups abiertos después de un await).
  const handleOpen = (recipient: TechnicianRecipient) => {
    const message = messages[recipient.id] ?? recipient.message;
    if (!message.trim()) return;
    openWhatsApp(recipient.phone, message);
    const next = new Set(opened).add(recipient.id);
    setOpened(next);
    if (next.size === recipients.length) onOpenChange(false);
  };

  const handleCopy = async (recipient: TechnicianRecipient) => {
    try {
      await navigator.clipboard.writeText(messages[recipient.id] ?? recipient.message);
      toast({ title: "Mensaje copiado" });
    } catch {
      toast({ title: "No se pudo copiar", description: "Seleccioná el texto y copialo a mano.", variant: "destructive" });
    }
  };

  const single = recipients.length === 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" /> Avisar al técnico
          </DialogTitle>
          <DialogDescription>
            {single
              ? `Se abre WhatsApp con el aviso listo para ${recipients[0].name}. Revisalo y tocá enviar.`
              : "Se abre WhatsApp con el aviso listo para cada técnico. Revisalo y tocá enviar."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {recipients.map((recipient) => (
            <div key={recipient.id} className="space-y-2" data-testid="technician-recipient">
              <p className="text-sm text-muted-foreground">
                Para: <span className="font-medium text-foreground">{recipient.name}</span> · +{recipient.phone}
              </p>
              <Textarea
                value={messages[recipient.id] ?? recipient.message}
                onChange={(e) => setMessages((prev) => ({ ...prev, [recipient.id]: e.target.value }))}
                rows={single ? 6 : 4}
                className="text-sm"
                aria-label={`Mensaje para ${recipient.name}`}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => handleCopy(recipient)}>
                  <Copy className="mr-1.5 h-4 w-4" /> Copiar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleOpen(recipient)}
                  disabled={!(messages[recipient.id] ?? recipient.message).trim()}
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  {opened.has(recipient.id) ? (
                    <><Check className="mr-1.5 h-4 w-4" /> Abierto</>
                  ) : (
                    <><MessageCircle className="mr-1.5 h-4 w-4" /> Abrir WhatsApp</>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {opened.size > 0 ? "Listo" : "No avisar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
