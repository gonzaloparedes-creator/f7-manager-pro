import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CalendarCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import PlanExpiryBar from "@/components/PlanExpiryBar";
import { PLAN_LABELS, type Cycle, type PlanType } from "@/lib/plans";
import {
  CYCLE_LABELS,
  formatDateISO,
  isValidISODate,
  todayInAsuncion,
} from "@/lib/subscriptionReceipt";
import { companyExpiryInfo, planExpiryInfo, renewalStart, suggestedExpiry } from "@/lib/planExpiry";
import { usePlanGraceDays } from "@/hooks/usePlanGraceDays";

const PLAN_ORDER: PlanType[] = ["starter", "pro", "business", "retail"];
const CYCLES: Cycle[] = ["mensual", "semestral", "anual"];

export interface PayableCompany {
  id: string;
  name: string;
  plan_type: string;
  is_active: boolean;
  is_paying: boolean;
  billing_cycle: string | null;
  plan_paid_from: string | null;
  plan_expires_at: string | null;
  created_at?: string | null;
  trial_ends_at?: string | null;
}

export interface PaymentPatch {
  plan_type?: PlanType;
  billing_cycle: Cycle | null;
  plan_paid_from: string | null;
  plan_expires_at: string | null;
  trial_ends_at?: string | null;
  is_paying?: boolean;
  is_active?: boolean;
}

interface MarkPaidDialogProps {
  company: PayableCompany | null;
  // Corregir las fechas del período actual en vez de registrar un pago nuevo.
  editing?: boolean;
  onClose: () => void;
  onSaved: (companyId: string, patch: PaymentPatch) => void;
}

export default function MarkPaidDialog({ company, editing = false, onClose, onSaved }: MarkPaidDialogProps) {
  return (
    <Dialog open={!!company} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        {company && (
          <MarkPaidForm
            key={`${company.id}-${editing ? "edit" : "pay"}`}
            company={company}
            editing={editing}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MarkPaidForm({
  company,
  editing: editingRequested,
  onClose,
  onSaved,
}: {
  company: PayableCompany;
  editing: boolean;
  onClose: () => void;
  onSaved: MarkPaidDialogProps["onSaved"];
}) {
  const navigate = useNavigate();
  const graceDays = usePlanGraceDays();
  const today = useMemo(() => todayInAsuncion(), []);
  const continueFrom = useMemo(() => renewalStart(company.plan_expires_at, today), [company.plan_expires_at, today]);
  const canContinue = continueFrom !== today;
  const editing = editingRequested && !!company.plan_paid_from && !!company.plan_expires_at;

  const [plan, setPlan] = useState<PlanType>(
    PLAN_ORDER.includes(company.plan_type as PlanType) ? (company.plan_type as PlanType) : "pro"
  );
  const [cycle, setCycle] = useState<Cycle>(CYCLES.includes(company.billing_cycle as Cycle) ? (company.billing_cycle as Cycle) : "mensual");
  const [paidFrom, setPaidFrom] = useState(editing ? (company.plan_paid_from as string).slice(0, 10) : continueFrom);
  const [expiresOverride, setExpiresOverride] = useState<string | null>(
    editing ? (company.plan_expires_at as string).slice(0, 10) : null
  );
  const [markPaying, setMarkPaying] = useState(true);
  const [reactivate, setReactivate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [ackLapsed, setAckLapsed] = useState(false);

  const fromValid = isValidISODate(paidFrom);
  const expiresAt = expiresOverride ?? (fromValid ? suggestedExpiry(paidFrom, cycle) : "");
  const expiresValid = isValidISODate(expiresAt);

  let error: string | null = null;
  if (!fromValid) error = "Elegí una fecha de pago válida.";
  else if (!expiresValid) error = "Elegí una fecha de vencimiento válida.";
  else if (expiresAt < paidFrom) error = "El vencimiento no puede ser anterior a la fecha de pago.";

  const preview = useMemo(
    () =>
      error
        ? null
        : planExpiryInfo({ billing_cycle: cycle, plan_paid_from: paidFrom, plan_expires_at: expiresAt }, today, graceDays),
    [error, cycle, paidFrom, expiresAt, today, graceDays]
  );

  // Estado actual de la empresa (antes de guardar): si hoy está bloqueada por vencimiento, el pago la destraba.
  const currentInfo = useMemo(
    () =>
      companyExpiryInfo(
        {
          billing_cycle: company.billing_cycle,
          plan_paid_from: company.plan_paid_from,
          plan_expires_at: company.plan_expires_at,
          trial_ends_at: company.trial_ends_at,
          created_at: company.created_at,
        },
        today,
        graceDays
      ),
    [
      company.billing_cycle,
      company.plan_paid_from,
      company.plan_expires_at,
      company.trial_ends_at,
      company.created_at,
      today,
      graceDays,
    ]
  );
  const wouldBeSuspended = preview?.phase === "suspended";

  const changeFrom = (value: string) => {
    setPaidFrom(value);
    setExpiresOverride(null);
    setAckLapsed(false);
  };
  const changeCycle = (value: Cycle) => {
    setCycle(value);
    setExpiresOverride(null);
    setAckLapsed(false);
  };

  const save = async () => {
    if (error || (wouldBeSuspended && !ackLapsed)) return;
    setSaving(true);
    const patch: PaymentPatch = {
      plan_type: plan,
      billing_cycle: cycle,
      plan_paid_from: paidFrom,
      plan_expires_at: expiresAt,
    };
    if (!editing) {
      if (markPaying && !company.is_paying) patch.is_paying = true;
      if (!company.is_active && reactivate) patch.is_active = true;
    }

    const { error: saveError } = await supabase.from("companies").update(patch).eq("id", company.id);
    setSaving(false);
    if (saveError) {
      toast.error(editing ? "No se pudieron guardar las fechas" : "No se pudo registrar el pago", {
        description: saveError.message,
      });
      return;
    }
    onSaved(company.id, patch);
    onClose();
    toast.success(editing ? `Fechas actualizadas: ${company.name}` : `Pago registrado: ${company.name}`, {
      description: `Plan ${PLAN_LABELS[plan]} ${CYCLE_LABELS[cycle].toLowerCase()} · vence el ${formatDateISO(expiresAt)}`,
      ...(editing
        ? {}
        : { action: { label: "Emitir recibo", onClick: () => navigate(`/superadmin/recibos?empresa=${company.id}`) } }),
    });
  };

  const clearDates = async () => {
    setSaving(true);
    const patch: PaymentPatch = { billing_cycle: null, plan_paid_from: null, plan_expires_at: null, trial_ends_at: null };
    const { error: clearError } = await supabase.from("companies").update(patch).eq("id", company.id);
    setSaving(false);
    setConfirmClear(false);
    if (clearError) {
      toast.error("No se pudieron borrar las fechas", { description: clearError.message });
      return;
    }
    onSaved(company.id, patch);
    onClose();
    toast.success(`Fechas de pago borradas: ${company.name}`);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          {editing ? "Editar fechas del plan" : "Registrar pago"}
        </DialogTitle>
        <DialogDescription>
          {company.name}
          {company.plan_paid_from && company.plan_expires_at
            ? ` · período actual hasta el ${formatDateISO(company.plan_expires_at)}`
            : company.trial_ends_at
              ? ` · en prueba gratis hasta el ${formatDateISO(company.trial_ends_at)}`
              : " · todavía sin pago registrado"}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pay-plan">Plan</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as PlanType)}>
              <SelectTrigger id="pay-plan"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLAN_ORDER.map((p) => <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label id="pay-cycle-label">Ciclo pagado</Label>
            <div role="group" aria-labelledby="pay-cycle-label" className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
              {CYCLES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cycle === c}
                  onClick={() => changeCycle(c)}
                  className={`rounded-sm px-1 py-1.5 text-xs font-medium transition-colors ${
                    cycle === c ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {CYCLE_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pay-from">Pagó desde</Label>
          <Input id="pay-from" type="date" value={paidFrom} onChange={(e) => changeFrom(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => changeFrom(today)}>
              Hoy
            </Button>
            {canContinue && !editing && (
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => changeFrom(continueFrom)}>
                A continuación ({formatDateISO(continueFrom)})
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pay-until">Vence el</Label>
          <Input id="pay-until" type="date" value={expiresAt} onChange={(e) => setExpiresOverride(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {expiresOverride === null
              ? "Se calcula solo: fecha de pago + ciclo. Podés ajustarlo a mano."
              : "Ajustado a mano. Al cambiar la fecha de pago o el ciclo se vuelve a calcular."}
          </p>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          preview && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Así lo va a ver</div>
              <PlanExpiryBar info={preview} />
            </div>
          )
        )}

        {preview && preview.phase === "suspended" && (
          <div role="alert" className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p>
                <span className="font-semibold text-destructive">Este período ya terminó.</span> El acceso llegó hasta el{" "}
                {formatDateISO(preview.accessUntil)}: si lo guardás así, la cuenta queda suspendida ahora mismo. Si el cliente
                pagó más recientemente, corregí la fecha de pago.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="pay-ack" checked={ackLapsed} onCheckedChange={(v) => setAckLapsed(v === true)} />
              <Label htmlFor="pay-ack" className="text-sm font-normal">
                Entiendo que la cuenta quedará suspendida
              </Label>
            </div>
          </div>
        )}
        {preview && preview.phase === "grace" && (
          <p className="rounded-lg border border-secondary/50 bg-secondary/10 p-3 text-sm">
            <span className="font-semibold text-secondary">Este período ya venció.</span> La cuenta sigue funcionando
            hasta el {formatDateISO(preview.accessUntil)} y después se suspende sola.
          </p>
        )}
        {preview && preview.phase === "active" && currentInfo?.phase === "suspended" && (
          <p className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
            Hoy la cuenta está suspendida por vencimiento: al guardar este pago vuelve a funcionar sola.
          </p>
        )}

        {!editing && (!company.is_paying || !company.is_active) && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            {!company.is_paying && (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="pay-paying" className="text-sm font-normal">Marcar como cliente que paga</Label>
                <Switch id="pay-paying" checked={markPaying} onCheckedChange={setMarkPaying} />
              </div>
            )}
            {!company.is_active && (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="pay-reactivate" className="text-sm font-normal">Reactivar la cuenta (está suspendida)</Label>
                <Switch id="pay-reactivate" checked={reactivate} onCheckedChange={setReactivate} />
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {company.plan_paid_from ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive sm:mr-auto"
            disabled={saving}
            onClick={() => setConfirmClear(true)}
          >
            Borrar fechas de pago
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={saving || !!error || (wouldBeSuspended && !ackLapsed)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Guardar fechas" : "Registrar pago"}
          </Button>
        </div>
      </DialogFooter>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="¿Borrar las fechas de pago?"
        description={`${company.name} vuelve a quedar sin fechas, ni de pago ni de prueba gratis (no se toca el plan ni la suspensión manual). Los recibos ya emitidos no cambian.${
          currentInfo && currentInfo.phase !== "active"
            ? " Atención: sin fechas la cuenta deja de controlarse por vencimiento, así que recupera el acceso."
            : ""
        }`}
        confirmLabel="Borrar fechas"
        confirmingLabel="Borrando..."
        loading={saving}
        onConfirm={clearDates}
      />
    </>
  );
}
