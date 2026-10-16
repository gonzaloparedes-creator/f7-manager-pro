import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { usePaymentMethodPresets } from "@/hooks/usePaymentMethodPresets";
import { useCashRegisterGate } from "@/hooks/useCashRegisterGate";
import CashRegisterRequiredNotice from "@/components/CashRegisterRequiredNotice";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPYG } from "@/lib/orders";
import { depositOf, parseCancelDraft, type CancelDraft, type DeviceReservation } from "@/lib/reservations";

const digitsOnly = (s: string) => s.replace(/\D/g, "");
const thousands = (s: string) => (s ? Number(s).toLocaleString("es-PY") : "");

export default function CancelReservationDialog({
  reservation,
  onOpenChange,
  onCancelled,
}: {
  reservation: DeviceReservation | null;
  onOpenChange: (o: boolean) => void;
  onCancelled: () => void;
}) {
  const { presets: paymentMethods } = usePaymentMethodPresets();
  const cashGate = useCashRegisterGate(!!reservation);
  const [draft, setDraft] = useState<CancelDraft>({ refund: "", method: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const reservationId = reservation?.id;
  useEffect(() => {
    if (!reservation) return;
    // Por defecto se devuelve toda la seña por el mismo medio con el que se recibió.
    const deposit = depositOf(reservation);
    setDraft({
      refund: deposit > 0 ? String(deposit) : "",
      method: reservation.deposit_payment_method ?? "",
      reason: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  if (!reservation) return null;
  const deposit = depositOf(reservation);
  const set = (patch: Partial<CancelDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const refund = Number(draft.refund || 0);
  const retained = Math.max(0, deposit - refund);
  const gateBlocks = refund > 0 && cashGate.blocked;

  const chipClass = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
    );

  const submit = async () => {
    const parsed = parseCancelDraft(draft, reservation.id, deposit);
    if (parsed.error !== null) { toast.error(parsed.error); return; }
    if (parsed.params.refund_amount > 0 && await cashGate.check()) {
      toast.error("La caja de hoy no está abierta. Abrila desde Caja para devolver la seña.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("cancel_device_reservation", { p: parsed.params });
      if (error) throw error;
      toast.success(`Reserva ${reservation.receipt_number} cancelada`);
      onCancelled();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cancelar la reserva");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!reservation} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cancelar reserva {reservation.receipt_number}</DialogTitle>
          <DialogDescription>
            {reservation.device_name} · {reservation.customer_name}. El equipo vuelve a estar disponible para la venta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {deposit > 0 ? (
            <>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                Seña recibida: <span className="font-semibold">{formatPYG(deposit)}</span>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cancel-refund">Cuánto le devolvés (Gs.)</Label>
                <Input id="cancel-refund" inputMode="numeric" placeholder="0" value={thousands(draft.refund)} onChange={(e) => set({ refund: digitsOnly(e.target.value) })} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => set({ refund: String(deposit) })}>Devolver todo</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => set({ refund: "" })}>Retener todo</Button>
                </div>
                <p className="text-xs text-muted-foreground" data-testid="cancel-summary">
                  Se devuelve {formatPYG(Math.min(refund, deposit))} · Te quedás con {formatPYG(retained)} (queda como ingreso retenido de la seña).
                </p>
              </div>
              {refund > 0 && (
                <div className="grid gap-2">
                  <Label>Con qué se la devolvés</Label>
                  <div className="flex flex-wrap gap-2">
                    {paymentMethods.map((m) => (
                      <button key={m.id} type="button" onClick={() => set({ method: m.label })} className={chipClass(draft.method === m.label)}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Sale de la caja de hoy.</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Esta reserva no tiene seña: no hay plata que devolver.</p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
            <Input id="cancel-reason" maxLength={300} value={draft.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="Ej: el cliente se arrepintió" />
          </div>

          {gateBlocks && <CashRegisterRequiredNotice what="devolver la seña" />}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Volver</Button>
          <Button variant="destructive" onClick={submit} disabled={saving || gateBlocks}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancelar reserva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
