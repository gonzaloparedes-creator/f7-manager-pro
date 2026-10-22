import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_DATE, formatEntryAmount, type F7Entry } from "@/lib/f7Finance";
import { markEntryPaid } from "@/lib/f7FinanceApi";
import { formatDateISO, isValidISODate } from "@/lib/subscriptionReceipt";
import { useSticky } from "./helpers";
import { FieldError, PaymentMethodSelect } from "./shared";

interface Props {
  target: F7Entry | null;
  today: string;
  onClose: () => void;
  onSaved: (entry: F7Entry) => void;
}

export function MarkEntryPaidDialog({ target, onClose, ...rest }: Props) {
  const shown = useSticky(target);
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-testid="pay-dialog">
        {shown ? <PayForm key={shown.id} entry={shown} onClose={onClose} {...rest} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PayForm({ entry, today, onClose, onSaved }: Omit<Props, "target"> & { entry: F7Entry }) {
  const income = entry.kind === "ingreso";
  const fromReceipt = !!entry.receipt_id;
  const [date, setDate] = useState(fromReceipt ? entry.entry_date : today);
  const [method, setMethod] = useState(entry.payment_method ?? "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const amount = formatEntryAmount(entry);
  const receiptInFuture = fromReceipt && entry.entry_date > today;

  const save = async () => {
    if (!isValidISODate(date) || date < MIN_DATE) {
      setError("Elegí una fecha válida (desde 2020).");
      return;
    }
    if (date > today) {
      setError("No puede ser una fecha futura: la plata ya tiene que haberse movido.");
      return;
    }
    setBusy(true);
    try {
      const saved = await markEntryPaid(entry.id, { entry_date: date, payment_method: method.trim() || null });
      onSaved(saved);
      toast.success(income ? "Marcado como cobrado" : "Marcado como pagado");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el movimiento.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && !receiptInFuture) void save();
      }}
    >
      <DialogHeader>
        <DialogTitle>{income ? "Marcar como cobrado" : "Marcar como pagado"}</DialogTitle>
        <DialogDescription>
          {entry.description} · {amount.main}
          {amount.sub ? ` (${amount.sub})` : ""}. Vencía el {formatDateISO(entry.entry_date)}.
        </DialogDescription>
      </DialogHeader>

      {receiptInFuture ? (
        <Alert variant="destructive">
          <AlertDescription>
            El recibo tiene fecha del {formatDateISO(entry.entry_date)}, que todavía no llegó. Podés marcarlo como cobrado a partir de ese día.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="pay-date">{income ? "¿Qué día se cobró?" : "¿Qué día se pagó?"}</Label>
        <Input
          id="pay-date"
          data-testid="pay-date"
          type="date"
          value={date}
          max={today}
          min={MIN_DATE}
          onChange={(e) => {
            setDate(e.target.value);
            setError(undefined);
          }}
          disabled={busy || fromReceipt}
          aria-invalid={!!error}
        />
        <p className="text-xs text-muted-foreground">
          {fromReceipt
            ? "La fecha la define el recibo."
            : "Cuenta en el mes de esta fecha, porque los números se cuentan cuando la plata se mueve."}
        </p>
        <FieldError message={error} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pay-method">Forma de pago</Label>
        <PaymentMethodSelect id="pay-method" testId="pay-method" value={method} onChange={setMethod} disabled={busy} />
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || receiptInFuture} data-testid="pay-confirm">
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {busy ? "Guardando..." : income ? "Marcar como cobrado" : "Marcar como pagado"}
        </Button>
      </DialogFooter>
    </form>
  );
}
