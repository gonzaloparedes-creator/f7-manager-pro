import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { openWhatsApp, toWhatsAppPhone } from "@/lib/whatsapp";
import { buildSaleReceiptMessage } from "@/lib/saleReceipt";
import type { TicketSale } from "@/components/SaleTicket";
import { MessageCircle, Copy } from "lucide-react";

// Una venta de mostrador no guarda el teléfono del comprador, así que se
// escribe acá y no queda registrado en ningún lado.
export default function EnviarReciboDialog({
  open,
  onOpenChange,
  sale,
  businessName,
  branchName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sale: TicketSale | null;
  businessName?: string | null;
  branchName?: string | null;
}) {
  const { toast } = useToast();
  const [phoneInput, setPhoneInput] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !sale) return;
    setPhoneInput("");
    setMessage(buildSaleReceiptMessage(sale, { businessName, branchName }));
    // businessName/branchName solo importan al abrir: editar el texto a mano
    // no se tiene que pisar si cargan después.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sale]);

  const phone = toWhatsAppPhone(phoneInput);

  // window.open tiene que correr dentro del click (Safari/iOS bloquea los
  // popups abiertos después de un await).
  const handleOpen = () => {
    if (!phone || !message.trim()) return;
    openWhatsApp(phone, message);
    onOpenChange(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast({ title: "Comprobante copiado" });
    } catch {
      toast({ title: "No se pudo copiar", description: "Seleccioná el texto y copialo a mano.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" /> Enviar comprobante por WhatsApp
          </DialogTitle>
          <DialogDescription>
            Escribí el WhatsApp del cliente: se abre el chat con el comprobante listo para enviar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="receipt-phone">WhatsApp del cliente</Label>
            <Input
              id="receipt-phone"
              type="tel"
              inputMode="tel"
              placeholder="0981 123 456"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              autoComplete="off"
            />
            {phoneInput.trim() !== "" && (
              <p className="text-xs text-muted-foreground">
                {phone ? `Se envía a +${phone}` : "Ese número no parece válido."}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receipt-message">Mensaje</Label>
            <Textarea
              id="receipt-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={9}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
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
