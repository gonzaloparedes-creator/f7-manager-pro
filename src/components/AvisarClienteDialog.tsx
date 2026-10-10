import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useToast } from "@/hooks/use-toast";
import { openWhatsApp } from "@/lib/whatsapp";
import { logCustomerMessage } from "@/lib/customerMessages";
import { MessageCircle, Copy, AlertTriangle } from "lucide-react";

// wa.me falla o trunca el texto cuando la URL completa se pasa de unos
// ~2000 caracteres; el texto codificado crece ~1.3x, así que se avisa antes.
const SOFT_LIMIT = 1200;

export interface MessageOption {
  key: string;
  label: string;
  message: string;
  /** Evento que se registra en el log; por defecto, `key`. */
  eventKey?: string;
  /** Orden a la que se asocia el registro; por defecto, la del diálogo. */
  orderId?: string | null;
  /** Mensaje combinado de varias órdenes: se registra una vez por cada una. */
  orderIds?: string[];
}

export default function AvisarClienteDialog({
  open,
  onOpenChange,
  orderId,
  customerName,
  phone,
  eventKey,
  initialMessage,
  title = "Avisar al cliente",
  description,
  options,
  suggested = true,
  companyId: companyIdProp,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string | null;
  customerName: string;
  /** Teléfono ya validado (null si el de la orden es un relleno tipo "000"). */
  phone: string | null;
  eventKey: string;
  initialMessage: string;
  title?: string;
  description?: string;
  /** Mensajes alternativos para elegir (envío manual desde la orden). */
  options?: MessageOption[];
  /** true cuando F7 sugiere el aviso (se puede descartar con "No avisar"). */
  suggested?: boolean;
  /** Si el padre ya conoce la empresa, evita perder el registro si se toca antes de que cargue useCompany. */
  companyId?: string | null;
}) {
  const { user } = useAuth();
  const { companyId: hookCompanyId } = useCompany();
  const companyId = companyIdProp ?? hookCompanyId;
  const { toast } = useToast();
  const [message, setMessage] = useState(initialMessage);
  const [selectedKey, setSelectedKey] = useState(options?.[0]?.key ?? "");
  const [currentEventKey, setCurrentEventKey] = useState(eventKey);
  const [currentOrderId, setCurrentOrderId] = useState(orderId);
  const [currentOrderIds, setCurrentOrderIds] = useState<string[] | undefined>(options?.[0]?.orderIds);

  useEffect(() => {
    if (!open) return;
    setMessage(initialMessage);
    setSelectedKey(options?.[0]?.key ?? "");
    setCurrentEventKey(eventKey);
    setCurrentOrderId(orderId);
    setCurrentOrderIds(options?.[0]?.orderIds);
    // options se reconstruye en cada render del padre; solo importa cuando
    // el diálogo se abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMessage, eventKey, orderId]);

  const record = (action: "opened" | "copied" | "dismissed") => {
    if (!companyId || !user) return;
    void logCustomerMessage({
      companyId,
      userId: user.id,
      orderId: currentOrderId,
      orderIds: currentOrderIds,
      eventKey: currentEventKey,
      action,
      phone,
      message: action === "dismissed" ? null : message,
    });
  };

  const pickOption = (key: string) => {
    const opt = options?.find((o) => o.key === key);
    if (!opt) return;
    setSelectedKey(key);
    setMessage(opt.message);
    setCurrentEventKey(opt.eventKey ?? opt.key);
    setCurrentOrderId(opt.orderId !== undefined ? opt.orderId : orderId);
    setCurrentOrderIds(opt.orderIds);
  };

  // window.open tiene que correr dentro del click: si se hace después de un
  // await, Safari/iOS lo bloquea como popup.
  const handleOpen = () => {
    if (!phone || !message.trim()) return;
    openWhatsApp(phone, message);
    record("opened");
    onOpenChange(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast({ title: "Mensaje copiado" });
      record("copied");
    } catch {
      toast({ title: "No se pudo copiar", description: "Seleccioná el texto y copialo a mano.", variant: "destructive" });
    }
  };

  const handleDismiss = () => {
    record("dismissed");
    onOpenChange(false);
  };

  const tooLong = message.length > SOFT_LIMIT;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" /> {title}
          </DialogTitle>
          <DialogDescription>
            {description ??
              (phone
                ? `Se abre WhatsApp con el mensaje listo para ${customerName}. Revisalo y tocá enviar.`
                : `Este cliente no tiene un teléfono válido cargado.`)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {options && options.length > 1 && (
            <div className="space-y-1.5">
              <Label>Mensaje</Label>
              <Select value={selectedKey} onValueChange={pickOption}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {phone ? (
            <p className="text-sm text-muted-foreground">
              Para: <span className="font-medium text-foreground">+{phone.replace(/\D/g, "")}</span>
            </p>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                El teléfono de esta orden parece un relleno (por ejemplo "000"). Para no avisarle a otra
                persona por error, no se abre WhatsApp. Podés copiar el mensaje y enviarlo a mano.
              </span>
            </div>
          )}

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={7}
            className="text-sm"
            aria-label="Mensaje para el cliente"
          />
          {tooLong && (
            <p className="text-xs text-amber-600">
              El mensaje es largo ({message.length} caracteres); WhatsApp puede cortarlo. Si pasa, usá "Copiar".
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {suggested && (
            <Button type="button" variant="ghost" onClick={handleDismiss}>
              No avisar
            </Button>
          )}
          <Button type="button" variant="outline" onClick={handleCopy} disabled={!message.trim()}>
            <Copy className="mr-1.5 h-4 w-4" /> Copiar
          </Button>
          <Button
            type="button"
            onClick={handleOpen}
            disabled={!phone || !message.trim()}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            <MessageCircle className="mr-1.5 h-4 w-4" /> Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
