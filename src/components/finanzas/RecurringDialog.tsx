import { useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  MIN_DATE,
  emptyRecurringDraft,
  pastDueCount,
  recurringDraftFrom,
  validateRecurringDraft,
  type F7Category,
  type F7Partner,
  type F7Recurring,
  type RecurringDraft,
  type RecurringErrors,
} from "@/lib/f7Finance";
import { createRecurring, generateRecurring, updateRecurring } from "@/lib/f7FinanceApi";
import { useSticky } from "./helpers";
import { CategorySelect, FieldError, MoneyFields, PartnerSelect, PaymentMethodSelect, SectionTitle, Segmented } from "./shared";

export interface RecurringTarget {
  key: number;
  template: F7Recurring | null;
  // Una vez que generó movimientos, la frecuencia y la fecha de inicio quedan fijas.
  scheduleLocked: boolean;
}

interface Props {
  target: RecurringTarget | null;
  today: string;
  categories: F7Category[];
  partners: F7Partner[];
  onClose: () => void;
  onSaved: (template: F7Recurring) => void;
  onGenerated: () => void;
}

export function RecurringDialog({ target, onClose, ...rest }: Props) {
  const shown = useSticky(target);
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto" data-testid="recurring-dialog">
        {shown ? <RecurringForm key={shown.key} target={shown} onClose={onClose} {...rest} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RecurringForm({ target, today, categories, partners, onClose, onSaved, onGenerated }: Props & { target: RecurringTarget }) {
  const { template, scheduleLocked } = target;
  const [draft, setDraft] = useState<RecurringDraft>(() => (template ? recurringDraftFrom(template) : emptyRecurringDraft(today)));
  const [errors, setErrors] = useState<RecurringErrors>({});
  const [markPast, setMarkPast] = useState(true);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof RecurringDraft>(field: K, value: RecurringDraft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const overdueCount = template ? 0 : pastDueCount({ frequency: draft.frequency, start_date: draft.start_date, end_date: draft.end_date || null }, today);

  const save = async () => {
    const keepPartnerIds = template?.default_partner_id ? [template.default_partner_id] : [];
    const { errors: found, payload } = validateRecurringDraft(draft, { categories, partners, keepPartnerIds });
    setErrors(found);
    if (!payload) {
      toast.error("Revisá los datos marcados en rojo.");
      return;
    }
    setBusy(true);
    try {
      if (template) {
        const updated = await updateRecurring(template.id, payload);
        onSaved(updated);
        // Cambiar el último vencimiento o el calendario puede dejar vencimientos por crear: se crean ya, no en la próxima visita.
        let generated = 0;
        if (updated.active) {
          try {
            generated = await generateRecurring(updated.id, false);
          } catch {
            // Si falla, el generador de la próxima carga los crea.
          }
        }
        if (generated > 0) onGenerated();
        toast.success(
          generated > 0
            ? `Gasto fijo actualizado · ${generated} ${generated === 1 ? "vencimiento nuevo" : "vencimientos nuevos"}`
            : "Gasto fijo actualizado"
        );
        onClose();
        return;
      }
      const created = await createRecurring(payload);
      onSaved(created);
      let generated = 0;
      try {
        generated = await generateRecurring(created.id, markPast && overdueCount > 0);
      } catch {
        toast.warning("Se guardó el gasto fijo, pero no se pudieron crear los vencimientos. Probá con Actualizar.");
      }
      if (generated > 0) onGenerated();
      toast.success(generated > 0 ? `Gasto fijo creado · ${generated} ${generated === 1 ? "vencimiento" : "vencimientos"}` : "Gasto fijo creado");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el gasto fijo.");
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
        <DialogTitle>{template ? "Editar gasto fijo" : "Nuevo gasto fijo"}</DialogTitle>
        <DialogDescription>
          Un gasto que se repite (Supabase, Vercel, dominio...). En cada vencimiento se crea solo un gasto "por pagar"; vos lo marcás como pagado.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <SectionTitle>Qué es</SectionTitle>
        <div className="space-y-1.5">
          <Label htmlFor="rec-name">Nombre</Label>
          <Input
            id="rec-name"
            data-testid="rec-name"
            value={draft.name}
            maxLength={120}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Ej.: Supabase Pro"
            disabled={busy}
            aria-invalid={!!errors.name}
          />
          <FieldError message={errors.name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-category">Categoría</Label>
          <CategorySelect
            id="rec-category"
            testId="rec-category"
            value={draft.category_id}
            onChange={(v) => set("category_id", v)}
            categories={categories}
            kind="gasto"
          />
          <FieldError message={errors.category_id} />
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle>Cuánto y cada cuánto</SectionTitle>
        <MoneyFields
          idPrefix="rec"
          amount={draft.amount}
          currency={draft.currency}
          fxRate={draft.fx_rate}
          onAmount={(v) => set("amount", v)}
          onCurrency={(v) => set("currency", v)}
          onFx={(v) => set("fx_rate", v)}
          errors={errors}
          disabled={busy}
          fxHint="Es un cambio estimado: cada vencimiento se crea con este valor y lo corregís al pagarlo."
        />
        <div className="space-y-1.5">
          <Label>Frecuencia</Label>
          <Segmented
            label="Frecuencia"
            testId="rec-frequency"
            value={draft.frequency}
            onChange={(v) => set("frequency", v)}
            disabled={busy || scheduleLocked}
            options={FREQUENCIES.map((f) => ({ key: f, label: FREQUENCY_LABELS[f] }))}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rec-start">Primer vencimiento</Label>
            <Input
              id="rec-start"
              data-testid="rec-start"
              type="date"
              value={draft.start_date}
              min={MIN_DATE}
              onChange={(e) => set("start_date", e.target.value)}
              disabled={busy || scheduleLocked}
              aria-invalid={!!errors.start_date}
            />
            <FieldError message={errors.start_date} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-end">Último vencimiento (opcional)</Label>
            <Input
              id="rec-end"
              data-testid="rec-end"
              type="date"
              value={draft.end_date}
              min={draft.start_date || MIN_DATE}
              onChange={(e) => set("end_date", e.target.value)}
              disabled={busy}
              aria-invalid={!!errors.end_date}
            />
            <FieldError message={errors.end_date} />
          </div>
        </div>
        {scheduleLocked ? (
          <p className="text-xs text-muted-foreground">
            Este gasto fijo ya generó movimientos, así que la frecuencia y el primer vencimiento no se cambian. Si necesitás otra frecuencia, pausalo y creá uno nuevo.
          </p>
        ) : null}
        {template ? (
          <p className="text-xs text-muted-foreground">Los cambios de monto valen para los próximos vencimientos; los que ya se crearon no se tocan.</p>
        ) : null}
      </div>

      {overdueCount > 0 ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p>
              El primer vencimiento ya pasó: se {overdueCount === 1 ? "crea 1 vencimiento atrasado" : `crean ${overdueCount} vencimientos atrasados`}.
            </p>
            <div className="flex items-start gap-2">
              <Checkbox id="rec-mark-past" checked={markPast} onCheckedChange={(v) => setMarkPast(v === true)} disabled={busy} data-testid="rec-mark-past" />
              <Label htmlFor="rec-mark-past" className="text-sm font-normal leading-snug">
                Marcarlos como ya pagados (cuentan en los números de cada mes). Si no, quedan "por pagar (vencido)".
              </Label>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        <SectionTitle>Cómo se paga</SectionTitle>
        <div className="space-y-1.5">
          <Label htmlFor="rec-partner">¿Quién lo paga habitualmente?</Label>
          <PartnerSelect
            id="rec-partner"
            testId="rec-partner"
            value={draft.default_partner_id}
            onChange={(v) => set("default_partner_id", v)}
            partners={partners}
            emptyLabel="Caja F7"
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">Si lo adelanta un socio de su bolsillo, F7 se lo debe y se lo reembolsa después.</p>
          <FieldError message={errors.default_partner_id} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-method">Forma de pago</Label>
          <PaymentMethodSelect id="rec-method" testId="rec-method" value={draft.payment_method} onChange={(v) => set("payment_method", v)} disabled={busy} />
          <FieldError message={errors.payment_method} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-notes">Notas (opcional)</Label>
          <Textarea
            id="rec-notes"
            data-testid="rec-notes"
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
        <Button type="submit" disabled={busy} data-testid="rec-save">
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {busy ? "Guardando..." : template ? "Guardar cambios" : "Crear gasto fijo"}
        </Button>
      </DialogFooter>
    </form>
  );
}
