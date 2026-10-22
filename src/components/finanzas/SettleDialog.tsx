import { useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_AMOUNT,
  MIN_DATE,
  formatGs,
  planSettlement,
  settlementDrafts,
  validateEntryDraft,
  type EntryPayload,
  type F7Category,
  type F7Entry,
  type F7Partner,
  type PartnerPosition,
  type Transfer,
} from "@/lib/f7Finance";
import { createEntries } from "@/lib/f7FinanceApi";
import { isValidISODate, parseMoneyInput } from "@/lib/subscriptionReceipt";
import { useSticky } from "./helpers";
import { FieldError, PaymentMethodSelect } from "./shared";

export interface SettleTarget {
  key: number;
  transfer: Transfer;
}

interface Props {
  target: SettleTarget | null;
  today: string;
  positions: PartnerPosition[];
  categories: F7Category[];
  partners: F7Partner[];
  onClose: () => void;
  onSaved: (entries: F7Entry[]) => void;
}

export function SettleDialog({ target, onClose, ...rest }: Props) {
  const shown = useSticky(target);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-testid="settle-dialog">
        {shown ? <SettleForm key={shown.key} target={shown} busy={busy} setBusy={setBusy} onClose={onClose} {...rest} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SettleForm({
  target,
  today,
  positions,
  categories,
  partners,
  busy,
  setBusy,
  onClose,
  onSaved,
}: Props & { target: SettleTarget; busy: boolean; setBusy: (busy: boolean) => void }) {
  const { transfer } = target;
  const nameOf = (id: string) => positions.find((p) => p.partnerId === id)?.name ?? "Socio";
  const from = nameOf(transfer.fromId);
  const to = nameOf(transfer.toId);

  const [amountText, setAmountText] = useState(String(transfer.amount));
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; date?: string }>({});

  const amount = useMemo(() => {
    const parsed = parseMoneyInput(amountText, "PYG");
    return Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_AMOUNT ? Math.round(parsed) : null;
  }, [amountText]);

  const plan = useMemo(() => (amount ? planSettlement({ ...transfer, amount }, positions) : null), [amount, transfer, positions]);

  const save = async () => {
    const found: { amount?: string; date?: string } = {};
    if (!amount) found.amount = "Poné un monto mayor a cero.";
    if (!isValidISODate(date) || date < MIN_DATE) found.date = "Elegí una fecha válida (desde 2020).";
    else if (date > today) found.date = "No puede ser una fecha futura: la plata ya tiene que haberse movido.";
    setErrors(found);
    if (!amount || found.date) return;

    const payloads: EntryPayload[] = [];
    for (const draft of settlementDrafts({ ...transfer, amount }, positions, today)) {
      const { errors: draftErrors, payload } = validateEntryDraft(
        { ...draft, entry_date: date, payment_method: method },
        { today, categories, partners, keepPartnerIds: [transfer.fromId, transfer.toId] }
      );
      if (!payload) {
        toast.error(Object.values(draftErrors).find(Boolean) ?? "No se pudo armar la liquidación.");
        return;
      }
      payloads.push(payload);
    }

    setBusy(true);
    try {
      const created = await createEntries(payloads);
      onSaved(created);
      toast.success("Liquidación registrada");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar la liquidación.");
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
        if (!busy) void save();
      }}
    >
      <DialogHeader>
        <DialogTitle>Registrar liquidación</DialogTitle>
        <DialogDescription>
          Anotá la transferencia entre socios para dejar las cuentas al día. Se guarda en uno o dos movimientos, juntos o ninguno.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-3 text-sm font-medium">
        <span className="truncate">{from}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">{to}</span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settle-amount">Monto transferido (Gs.)</Label>
        <Input
          id="settle-amount"
          data-testid="settle-amount"
          inputMode="numeric"
          value={amountText}
          onChange={(e) => {
            setAmountText(e.target.value);
            setErrors((prev) => ({ ...prev, amount: undefined }));
          }}
          disabled={busy}
          aria-invalid={!!errors.amount}
        />
        {amount && amount !== transfer.amount ? (
          <p className="text-xs text-muted-foreground">Lo sugerido era {formatGs(transfer.amount)}. Las cuentas quedan con la diferencia.</p>
        ) : null}
        <FieldError message={errors.amount} />
      </div>

      {plan ? (
        <ul className="space-y-1.5 rounded-md border border-border px-3 py-2.5 text-sm" data-testid="settle-plan">
          {plan.reembolso > 0 ? (
            <li className="flex items-baseline justify-between gap-3">
              <span>
                Reembolso a {to}
                <span className="block text-xs text-muted-foreground">Es lo que F7 le debía por lo que puso o adelantó.</span>
              </span>
              <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{formatGs(plan.reembolso)}</span>
            </li>
          ) : null}
          {plan.retiro > 0 ? (
            <li className="flex items-baseline justify-between gap-3">
              <span>
                Retiro de utilidad de {to}
                <span className="block text-xs text-muted-foreground">El resto es parte de su utilidad.</span>
              </span>
              <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{formatGs(plan.retiro)}</span>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="settle-date">¿Qué día se transfirió?</Label>
        <Input
          id="settle-date"
          data-testid="settle-date"
          type="date"
          value={date}
          max={today}
          min={MIN_DATE}
          onChange={(e) => {
            setDate(e.target.value);
            setErrors((prev) => ({ ...prev, date: undefined }));
          }}
          disabled={busy}
          aria-invalid={!!errors.date}
        />
        <FieldError message={errors.date} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settle-method">Forma de pago</Label>
        <PaymentMethodSelect id="settle-method" testId="settle-method" value={method} onChange={setMethod} disabled={busy} />
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || !amount} data-testid="settle-confirm">
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {busy ? "Registrando..." : "Registrar liquidación"}
        </Button>
      </DialogFooter>
    </form>
  );
}
