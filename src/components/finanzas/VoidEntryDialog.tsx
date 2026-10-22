import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEntryAmount, type F7Entry } from "@/lib/f7Finance";
import { voidEntry } from "@/lib/f7FinanceApi";
import { formatDateISO } from "@/lib/subscriptionReceipt";
import { useSticky } from "./helpers";

interface Props {
  target: F7Entry | null;
  onClose: () => void;
  onSaved: (entry: F7Entry) => void;
}

export function VoidEntryDialog({ target, onClose, onSaved }: Props) {
  const shown = useSticky(target);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-testid="void-dialog">
        {shown ? <VoidForm key={shown.id} entry={shown} busy={busy} setBusy={setBusy} onClose={onClose} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function VoidForm({
  entry,
  busy,
  setBusy,
  onClose,
  onSaved,
}: {
  entry: F7Entry;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onClose: () => void;
  onSaved: (entry: F7Entry) => void;
}) {
  const [reason, setReason] = useState("");
  const amount = formatEntryAmount(entry);

  const confirm = async () => {
    if (!reason.trim() || busy) return;
    setBusy(true);
    try {
      const saved = await voidEntry(entry.id, reason);
      onSaved(saved);
      toast.success("Movimiento anulado");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo anular el movimiento.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void confirm();
      }}
    >
      <DialogHeader>
        <DialogTitle>Anular movimiento</DialogTitle>
        <DialogDescription>
          {entry.description} · {amount.main} · {formatDateISO(entry.entry_date)}
        </DialogDescription>
      </DialogHeader>

      <Alert variant="destructive">
        <AlertDescription className="space-y-1">
          <p>Anular es definitivo: el movimiento deja de contar en los totales y ya no se puede editar ni restaurar.</p>
          <p>Si fue un error de carga, anulalo y registrá uno nuevo con los datos correctos.</p>
          {entry.receipt_id ? <p>El recibo vuelve a quedar libre para registrarlo de nuevo.</p> : null}
          {entry.recurring_id ? <p>Este vencimiento del gasto fijo no se vuelve a generar.</p> : null}
        </AlertDescription>
      </Alert>

      <div className="space-y-1.5">
        <Label htmlFor="void-reason">Motivo de la anulación</Label>
        <Textarea
          id="void-reason"
          data-testid="void-reason"
          rows={3}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej.: Lo cargué dos veces."
          disabled={busy}
        />
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" variant="destructive" disabled={busy || !reason.trim()} data-testid="void-confirm">
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {busy ? "Anulando..." : "Anular movimiento"}
        </Button>
      </DialogFooter>
    </form>
  );
}
