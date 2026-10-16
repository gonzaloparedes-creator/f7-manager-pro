import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { daysLeft, displayDate, suggestedExtension, toYmd, type DeviceReservation } from "@/lib/reservations";

export default function ExtendReservationDialog({
  reservation,
  onOpenChange,
  onExtended,
}: {
  reservation: DeviceReservation | null;
  onOpenChange: (o: boolean) => void;
  onExtended: () => void;
}) {
  const [expiresOn, setExpiresOn] = useState("");
  const [saving, setSaving] = useState(false);

  const reservationId = reservation?.id;
  useEffect(() => {
    if (!reservation) return;
    setExpiresOn(suggestedExtension(reservation.expires_on));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  if (!reservation) return null;

  const submit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) { toast.error("Elegí la nueva fecha"); return; }
    if (daysLeft(expiresOn) < 0) { toast.error("La nueva fecha no puede ser anterior a hoy"); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("extend_device_reservation", {
        p: { reservation_id: reservation.id, expires_on: expiresOn },
      });
      if (error) throw error;
      toast.success(`Reserva ${reservation.receipt_number} extendida hasta el ${displayDate(expiresOn)}`);
      onExtended();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo extender la reserva");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!reservation} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Extender reserva {reservation.receipt_number}</DialogTitle>
          <DialogDescription>
            {reservation.device_name} · {reservation.customer_name}. Vence el {displayDate(reservation.expires_on)}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="extend-date">Nuevo vencimiento</Label>
          <Input id="extend-date" type="date" min={toYmd(new Date())} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Volver</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Extender
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
