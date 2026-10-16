import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { usePaymentMethodPresets } from "@/hooks/usePaymentMethodPresets";
import { useCashRegisterGate } from "@/hooks/useCashRegisterGate";
import CashRegisterRequiredNotice from "@/components/CashRegisterRequiredNotice";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPYG } from "@/lib/orders";
import { openWhatsApp, toWhatsAppPhone } from "@/lib/whatsapp";
import {
  balanceDue,
  buildReservationMessage,
  displayDate,
  emptyReservationDraft,
  parseReservationDraft,
  toYmd,
  type DeviceReservation,
  type ReservationDraft,
} from "@/lib/reservations";

export type ReservableDevice = { id: string; name: string; imei: string | null; selling_price: number };

// Los montos se guardan como solo dígitos y se muestran con puntos de miles.
const digitsOnly = (s: string) => s.replace(/\D/g, "");
const thousands = (s: string) => (s ? Number(s).toLocaleString("es-PY") : "");

export default function ReserveDeviceDialog({
  open,
  onOpenChange,
  device,
  onReserved,
  businessName,
  branchName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  device: ReservableDevice | null;
  onReserved: () => void;
  businessName?: string | null;
  branchName?: string | null;
}) {
  const { presets: paymentMethods } = usePaymentMethodPresets();
  const cashGate = useCashRegisterGate(open);
  const [draft, setDraft] = useState<ReservationDraft>(() => emptyReservationDraft(0));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<DeviceReservation | null>(null);

  const deviceId = device?.id;
  useEffect(() => {
    if (!open || !device) return;
    setDraft(emptyReservationDraft(Number(device.selling_price) || 0));
    setDone(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId]);

  if (!device) return null;

  const set = (patch: Partial<ReservationDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const depositAmount = Number(draft.deposit || 0);
  const priceAmount = Number(draft.agreedPrice || 0);
  const gateBlocks = depositAmount > 0 && cashGate.blocked;

  const chipClass = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
    );

  const submit = async () => {
    const parsed = parseReservationDraft(draft, device.id);
    if (parsed.error !== null) { toast.error(parsed.error); return; }
    if (parsed.params.deposit_amount > 0 && await cashGate.check()) {
      toast.error("La caja de hoy no está abierta. Abrila desde Caja para recibir la seña.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc("register_device_reservation", { p: parsed.params });
      if (error) throw error;
      const reservation = data as DeviceReservation;
      setDone(reservation);
      toast.success(`Reserva registrada: ${reservation.receipt_number}`);
      onReserved();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo registrar la reserva");
    } finally {
      setSaving(false);
    }
  };

  const phone = done ? toWhatsAppPhone(done.customer_phone) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" /> Equipo reservado
              </DialogTitle>
              <DialogDescription>
                Reserva <span className="font-semibold text-foreground">{done.receipt_number}</span> — {done.device_name} para {done.customer_name}, hasta el {displayDate(done.expires_on)}.
                {Number(done.deposit_amount) > 0
                  ? ` Seña: ${formatPYG(Number(done.deposit_amount))}. Saldo al retirarlo: ${formatPYG(balanceDue(done))}.`
                  : " Sin seña."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
              {phone && (
                <Button className="gap-2" onClick={() => openWhatsApp(phone, buildReservationMessage(done, { businessName, branchName }))}>
                  <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reservar equipo</DialogTitle>
              <DialogDescription>
                {device.name}{device.imei ? ` · IMEI ${device.imei}` : ""}. Mientras esté reservado no se puede vender a otra persona.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="res-name">Nombre del cliente</Label>
                  <Input id="res-name" value={draft.customerName} maxLength={120} autoComplete="off" onChange={(e) => set({ customerName: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="res-phone">WhatsApp (opcional)</Label>
                  <Input id="res-phone" type="tel" inputMode="tel" value={draft.customerPhone} maxLength={40} autoComplete="off" placeholder="0981 123 456" onChange={(e) => set({ customerPhone: e.target.value })} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="res-price">Precio acordado (Gs.)</Label>
                  <Input id="res-price" inputMode="numeric" placeholder="0" value={thousands(draft.agreedPrice)} onChange={(e) => set({ agreedPrice: digitsOnly(e.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="res-deposit">Seña que deja (Gs., opcional)</Label>
                  <Input id="res-deposit" inputMode="numeric" placeholder="0" value={thousands(draft.deposit)} onChange={(e) => set({ deposit: digitsOnly(e.target.value) })} />
                </div>
              </div>

              {depositAmount > 0 && (
                <div className="grid gap-2">
                  <Label>Con qué deja la seña</Label>
                  <div className="flex flex-wrap gap-2">
                    {paymentMethods.map((m) => (
                      <button key={m.id} type="button" onClick={() => set({ paymentMethod: m.label })} className={chipClass(draft.paymentMethod === m.label)}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {priceAmount >= depositAmount && priceAmount > 0 && (
                    <p className="text-xs text-muted-foreground" data-testid="reserve-balance">
                      Saldo al retirarlo: {formatPYG(priceAmount - depositAmount)}. La seña entra a la caja de hoy.
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="res-expires">Se lo guardás hasta</Label>
                <Input id="res-expires" type="date" min={toYmd(new Date())} value={draft.expiresOn} onChange={(e) => set({ expiresOn: e.target.value })} />
                <p className="text-xs text-muted-foreground">
                  Pasada esa fecha la reserva queda marcada como vencida, pero el equipo sigue apartado hasta que la cancelés o la extiendas.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="res-notes">Notas (opcional)</Label>
                <Textarea id="res-notes" rows={2} maxLength={500} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Ej: viene a retirarlo el sábado" />
              </div>

              {gateBlocks && <CashRegisterRequiredNotice what="recibir la seña" />}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={submit} disabled={saving || gateBlocks}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reservar equipo
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
