import { useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ENTRY_KINDS,
  KIND_HINTS,
  KIND_LABELS,
  validateEntryDraft,
  type Currency,
  type EntryDraft,
  type EntryErrors,
  type EntryKind,
  type F7Category,
  type F7Entry,
  type F7Partner,
} from "@/lib/f7Finance";
import { createEntry, updateEntry } from "@/lib/f7FinanceApi";
import { formatDateISO } from "@/lib/subscriptionReceipt";
import { useSticky } from "./helpers";
import { CategorySelect, FieldError, MoneyFields, PartnerSelect, PaymentMethodSelect, SectionTitle, Segmented } from "./shared";

export interface EntryTarget {
  key: number;
  entry: F7Entry | null;
  draft: EntryDraft;
}

interface Props {
  target: EntryTarget | null;
  today: string;
  categories: F7Category[];
  partners: F7Partner[];
  onClose: () => void;
  onSaved: (entry: F7Entry) => void;
}

const FLOW_LABELS: Record<EntryKind, { who: string; from?: string }> = {
  ingreso: { who: "¿Quién lo cobró?" },
  gasto: { who: "¿Quién lo pagó?" },
  aporte: { who: "¿Qué socio pone la plata?" },
  reembolso: { who: "¿A quién se le devuelve?", from: "¿De dónde sale la plata?" },
  distribucion: { who: "¿Qué socio retira?", from: "¿De dónde sale la plata?" },
};

export function EntryDialog({ target, onClose, ...rest }: Props) {
  const shown = useSticky(target);
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto" data-testid="entry-dialog">
        {shown ? <EntryForm key={shown.key} target={shown} onClose={onClose} {...rest} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({ target, today, categories, partners, onClose, onSaved }: Props & { target: EntryTarget }) {
  const { entry } = target;
  const [draft, setDraft] = useState<EntryDraft>(target.draft);
  const [errors, setErrors] = useState<EntryErrors>({});
  const [busy, setBusy] = useState(false);

  const kind = draft.kind;
  const isLedger = kind === "ingreso" || kind === "gasto";
  const fromReceipt = !!entry?.receipt_id;
  const set = <K extends keyof EntryDraft>(field: K, value: EntryDraft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const changeKind = (next: EntryKind) => {
    setDraft((d) => ({
      ...d,
      kind: next,
      category_id: "",
      partner_id: "",
      via_partner_id: "",
      status: next === "ingreso" || next === "gasto" ? d.status : "pagado",
    }));
    setErrors({});
  };

  const save = async () => {
    const keepPartnerIds = [entry?.partner_id, entry?.via_partner_id].filter((id): id is string => !!id);
    const { errors: found, payload } = validateEntryDraft(draft, { today, categories, partners, keepPartnerIds });
    setErrors(found);
    if (!payload) {
      toast.error("Revisá los datos marcados en rojo.");
      return;
    }
    setBusy(true);
    try {
      const saved = entry ? await updateEntry(entry.id, payload) : await createEntry(payload);
      onSaved(saved);
      toast.success(entry ? "Movimiento actualizado" : "Movimiento registrado");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el movimiento.");
    } finally {
      setBusy(false);
    }
  };

  const paid = draft.status === "pagado";
  const dateLabel = isLedger && !paid ? "Fecha de vencimiento" : kind === "ingreso" ? "Fecha de cobro" : isLedger ? "Fecha de pago" : "Fecha";
  const statusOptions =
    kind === "ingreso"
      ? [
          { key: "pagado" as const, label: "Cobrado" },
          { key: "pendiente" as const, label: "Por cobrar" },
        ]
      : [
          { key: "pagado" as const, label: "Pagado" },
          { key: "pendiente" as const, label: "Por pagar" },
        ];

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
        <DialogTitle>{entry ? `Editar ${KIND_LABELS[kind].toLowerCase()}` : `Nuevo movimiento: ${KIND_LABELS[kind].toLowerCase()}`}</DialogTitle>
        <DialogDescription>{KIND_HINTS[kind]}</DialogDescription>
      </DialogHeader>

      {!entry ? (
        <div className="space-y-1.5">
          <Label htmlFor="entry-kind">Tipo de movimiento</Label>
          <Select value={kind} onValueChange={(v) => changeKind(v as EntryKind)} disabled={busy}>
            <SelectTrigger id="entry-kind" data-testid="entry-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTRY_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {fromReceipt ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Este ingreso viene de un recibo: el monto y la fecha no se cambian. Si hay un error, anulalo y volvé a importar el recibo.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        <SectionTitle>Qué pasó</SectionTitle>
        <div className="space-y-1.5">
          <Label htmlFor="entry-description">Descripción</Label>
          <Input
            id="entry-description"
            data-testid="entry-description"
            value={draft.description}
            maxLength={200}
            onChange={(e) => set("description", e.target.value)}
            placeholder={kind === "ingreso" ? "Ej.: Suscripción Taller Pérez" : kind === "gasto" ? "Ej.: Hosting Vercel" : "Ej.: Aporte inicial"}
            disabled={busy}
            aria-invalid={!!errors.description}
          />
          <FieldError message={errors.description} />
        </div>

        {isLedger ? (
          <div className="space-y-1.5">
            <Label htmlFor="entry-category">Categoría</Label>
            <CategorySelect
              id="entry-category"
              testId="entry-category"
              value={draft.category_id}
              onChange={(v) => set("category_id", v)}
              categories={categories}
              kind={kind as "ingreso" | "gasto"}
            />
            <FieldError message={errors.category_id} />
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <SectionTitle>Monto y fecha</SectionTitle>
        <MoneyFields
          idPrefix="entry"
          amount={draft.amount}
          currency={draft.currency}
          fxRate={draft.fx_rate}
          onAmount={(v) => set("amount", v)}
          onCurrency={(v: Currency) => set("currency", v)}
          onFx={(v) => set("fx_rate", v)}
          errors={errors}
          disabled={busy || fromReceipt}
        />

        {isLedger ? (
          <div className="space-y-1.5">
            <Label>{kind === "ingreso" ? "¿Ya se cobró?" : "¿Ya se pagó?"}</Label>
            <Segmented
              label="Estado"
              testId="entry-status"
              value={draft.status}
              onChange={(v) => set("status", v)}
              options={statusOptions}
              disabled={busy}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="entry-date">{dateLabel}</Label>
          <Input
            id="entry-date"
            data-testid="entry-date"
            type="date"
            value={draft.entry_date}
            max={paid ? today : undefined}
            min="2020-01-01"
            onChange={(e) => set("entry_date", e.target.value)}
            disabled={busy || fromReceipt}
            aria-invalid={!!errors.entry_date}
          />
          {fromReceipt ? <p className="text-xs text-muted-foreground">Fecha del recibo: {formatDateISO(draft.entry_date)}.</p> : null}
          <FieldError message={errors.entry_date} />
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle>Cuenta</SectionTitle>
        <div className="space-y-1.5">
          <Label htmlFor="entry-partner">{FLOW_LABELS[kind].who}</Label>
          <PartnerSelect
            id="entry-partner"
            testId="entry-partner"
            value={draft.partner_id}
            onChange={(v) => set("partner_id", v)}
            partners={partners}
            emptyLabel={isLedger ? "Caja F7" : undefined}
            disabled={busy}
          />
          {isLedger ? (
            <p className="text-xs text-muted-foreground">
              {kind === "ingreso"
                ? "Si lo cobró un socio en su cuenta, F7 le queda debiendo esa plata a la caja."
                : "Si lo adelantó un socio de su bolsillo, F7 se lo debe y se lo reembolsa después."}
            </p>
          ) : null}
          <FieldError message={errors.partner_id} />
        </div>

        {FLOW_LABELS[kind].from ? (
          <div className="space-y-1.5">
            <Label htmlFor="entry-via">{FLOW_LABELS[kind].from}</Label>
            <PartnerSelect
              id="entry-via"
              testId="entry-via"
              value={draft.via_partner_id}
              onChange={(v) => set("via_partner_id", v)}
              partners={partners}
              emptyLabel="Caja F7"
              excludeId={kind === "reembolso" ? draft.partner_id : undefined}
              disabled={busy}
            />
            <FieldError message={errors.via_partner_id} />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="entry-method">Forma de pago</Label>
          <PaymentMethodSelect
            id="entry-method"
            testId="entry-method"
            value={draft.payment_method}
            onChange={(v) => set("payment_method", v)}
            disabled={busy}
          />
          <FieldError message={errors.payment_method} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="entry-notes">Notas (opcional)</Label>
          <Textarea
            id="entry-notes"
            data-testid="entry-notes"
            rows={2}
            maxLength={1000}
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
            disabled={busy}
          />
          <FieldError message={errors.notes} />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy} data-testid="entry-save">
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {busy ? "Guardando..." : entry ? "Guardar cambios" : "Registrar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
