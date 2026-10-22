import { useMemo, useState } from "react";
import { Info, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildReceiptImportPayload,
  findLinkCandidates,
  fold,
  unregisteredReceipts,
  type EntryErrors,
  type F7Category,
  type F7Entry,
  type F7Partner,
  type ReceiptLite,
} from "@/lib/f7Finance";
import { createEntries, linkEntryToReceipt } from "@/lib/f7FinanceApi";
import { formatDateISO, formatMoney } from "@/lib/subscriptionReceipt";
import { CategorySelect, FieldError, PartnerSelect } from "./shared";

interface Props {
  open: boolean;
  today: string;
  receipts: ReceiptLite[];
  entries: F7Entry[];
  categories: F7Category[];
  partners: F7Partner[];
  onClose: () => void;
  onSaved: (entries: F7Entry[]) => void;
}

export function ReceiptImportDialog({ open, onClose, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto" data-testid="import-dialog">
        {open ? <ImportForm onClose={onClose} {...rest} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({ today, receipts, entries, categories, partners, onClose, onSaved }: Omit<Props, "open">) {
  // Se calcula una sola vez al abrir: al vincular o registrar, la lista no salta debajo del cursor.
  const [pending] = useState(() => unregisteredReceipts(receipts, entries));
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const candidates = useMemo(() => new Map(pending.map((r) => [r.id, findLinkCandidates(r, entries)])), [pending, entries]);

  const defaultCategory = useMemo(() => {
    const ingresos = categories.filter((c) => c.kind === "ingreso" && c.active);
    return (ingresos.find((c) => fold(c.name) === "suscripciones") ?? ingresos[0])?.id ?? "";
  }, [categories]);

  const [categoryId, setCategoryId] = useState(defaultCategory);
  const [partnerId, setPartnerId] = useState("");
  const [fxRate, setFxRate] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(pending.filter((r) => (candidates.get(r.id) ?? []).length === 0).map((r) => r.id))
  );
  const [rowErrors, setRowErrors] = useState<Record<string, EntryErrors>>({});
  const [busy, setBusy] = useState(false);

  const visible = pending.filter((r) => !linkedIds.has(r.id));
  const chosen = visible.filter((r) => selected.has(r.id));
  const hasUsd = chosen.some((r) => r.currency === "USD");

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    setRowErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const link = async (receipt: ReceiptLite, entry: F7Entry) => {
    setBusy(true);
    try {
      onSaved([await linkEntryToReceipt(entry.id, receipt.id)]);
      setLinkedIds((prev) => new Set(prev).add(receipt.id));
      toast.success(`Recibo ${receipt.receipt_number} vinculado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo vincular el recibo.");
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    const errorsById: Record<string, EntryErrors> = {};
    const payloads = [];
    for (const receipt of chosen) {
      const { errors, payload } = buildReceiptImportPayload(receipt, { categoryId, partnerId, fxRate, today, categories, partners });
      if (!payload) errorsById[receipt.id] = errors;
      else payloads.push(payload);
    }
    setRowErrors(errorsById);
    if (Object.keys(errorsById).length > 0 || payloads.length === 0) {
      toast.error(payloads.length === 0 && chosen.length === 0 ? "Elegí al menos un recibo." : "Revisá los recibos marcados en rojo.");
      return;
    }
    setBusy(true);
    try {
      const created = await createEntries(payloads);
      onSaved(created);
      toast.success(created.length === 1 ? "1 ingreso registrado" : `${created.length} ingresos registrados`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron registrar los ingresos.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Importar recibos como ingresos</DialogTitle>
        <DialogDescription>
          Cada recibo de suscripción vigente que todavía no está en Finanzas se registra como un ingreso. El monto y la fecha vienen del recibo y después no se tocan.
        </DialogDescription>
      </DialogHeader>

      {visible.length === 0 ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>No hay recibos pendientes: todos los recibos vigentes ya están registrados como ingresos.</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="import-category">Categoría de los ingresos</Label>
              <CategorySelect id="import-category" testId="import-category" value={categoryId} onChange={setCategoryId} categories={categories} kind="ingreso" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-partner">¿Quién cobró?</Label>
              <PartnerSelect id="import-partner" testId="import-partner" value={partnerId} onChange={setPartnerId} partners={partners} emptyLabel="Caja F7" />
            </div>
          </div>

          {hasUsd ? (
            <div className="space-y-1.5">
              <Label htmlFor="import-fx">Tipo de cambio para los recibos en dólares (Gs. por US$)</Label>
              <Input id="import-fx" data-testid="import-fx" inputMode="decimal" value={fxRate} onChange={(e) => setFxRate(e.target.value)} placeholder="7.300" disabled={busy} />
              <p className="text-xs text-muted-foreground">Se usa el mismo cambio para todos los recibos en dólares que registres ahora.</p>
            </div>
          ) : null}

          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border" data-testid="import-list">
            {visible.map((receipt) => {
              const matches = candidates.get(receipt.id) ?? [];
              const errors = rowErrors[receipt.id];
              const message = errors ? Object.values(errors).find(Boolean) : undefined;
              return (
                <li key={receipt.id} className="space-y-2 px-3 py-2.5" data-testid="import-row">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`import-${receipt.id}`}
                      checked={selected.has(receipt.id)}
                      onCheckedChange={(v) => toggle(receipt.id, v === true)}
                      disabled={busy}
                      className="mt-0.5"
                      aria-label={`Registrar el recibo ${receipt.receipt_number}`}
                    />
                    <Label htmlFor={`import-${receipt.id}`} className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 font-normal">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{receipt.customer_name}</span>
                        <span className="block text-xs text-muted-foreground">
                          Recibo {receipt.receipt_number} · {formatDateISO(receipt.payment_date)}
                          {receipt.payment_method ? ` · ${receipt.payment_method}` : ""}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-primary">{formatMoney(receipt.amount, receipt.currency)}</span>
                    </Label>
                  </div>
                  {matches.length > 0 ? (
                    <div className="ml-7 space-y-1.5 rounded-md border border-secondary/40 bg-secondary/10 px-2.5 py-2 text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-secondary">
                        <Badge variant="outline" className="border-secondary/40 text-secondary">
                          Posible duplicado
                        </Badge>
                        Ya cargaste un ingreso del mismo día y monto.
                      </div>
                      {matches.map((entry) => (
                        <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-muted-foreground">{entry.description}</span>
                          <Button type="button" size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => void link(receipt, entry)}>
                            <Link2 className="mr-1.5 h-3.5 w-3.5" />
                            Es este, vincular
                          </Button>
                        </div>
                      ))}
                      <p className="text-muted-foreground">Si no es el mismo, marcá el recibo para registrarlo igual.</p>
                    </div>
                  ) : null}
                  <FieldError message={message} />
                </li>
              );
            })}
          </ul>
        </>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          {visible.length === 0 ? "Cerrar" : "Cancelar"}
        </Button>
        {visible.length > 0 ? (
          <Button type="button" onClick={() => void register()} disabled={busy || chosen.length === 0} data-testid="import-confirm">
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {busy ? "Registrando..." : chosen.length === 1 ? "Registrar 1 ingreso" : `Registrar ${chosen.length} ingresos`}
          </Button>
        ) : null}
      </DialogFooter>
    </div>
  );
}
