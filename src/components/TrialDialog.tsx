import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FlaskConical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import PlanExpiryBar from "@/components/PlanExpiryBar";
import { addDaysISO, formatDateISO, isValidISODate, todayInAsuncion } from "@/lib/subscriptionReceipt";
import { DEFAULT_TRIAL_DAYS, trialExpiryInfo } from "@/lib/planExpiry";
import { usePlanGraceDays } from "@/hooks/usePlanGraceDays";

export interface TrialCompany {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  plan_expires_at: string | null;
  trial_ends_at: string | null;
}

export interface TrialPatch {
  trial_ends_at: string | null;
}

interface TrialDialogProps {
  company: TrialCompany | null;
  onClose: () => void;
  onSaved: (companyId: string, patch: TrialPatch) => void;
}

export default function TrialDialog({ company, onClose, onSaved }: TrialDialogProps) {
  return (
    <Dialog open={!!company} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        {company && <TrialForm key={company.id} company={company} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function TrialForm({
  company,
  onClose,
  onSaved,
}: {
  company: TrialCompany;
  onClose: () => void;
  onSaved: TrialDialogProps["onSaved"];
}) {
  const graceDays = usePlanGraceDays();
  const today = useMemo(() => todayInAsuncion(), []);
  const fullTrial = addDaysISO(today, DEFAULT_TRIAL_DAYS - 1);

  const [endsAt, setEndsAt] = useState(company.trial_ends_at ?? fullTrial);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [ackLapsed, setAckLapsed] = useState(false);

  const hasTrial = !!company.trial_ends_at;
  const hasPaid = !!company.plan_expires_at;
  const valid = isValidISODate(endsAt);
  const preview = useMemo(
    () => (valid ? trialExpiryInfo({ trial_ends_at: endsAt, created_at: company.created_at }, today, graceDays) : null),
    [valid, endsAt, company.created_at, today, graceDays]
  );
  const wouldBeSuspended = preview?.phase === "suspended";

  const change = (value: string) => {
    setEndsAt(value);
    setAckLapsed(false);
  };
  // Se extiende desde el fin actual, o desde hoy si la prueba ya terminó.
  const extend = (days: number) => {
    const base = company.trial_ends_at && company.trial_ends_at >= today ? company.trial_ends_at : today;
    change(addDaysISO(base, days));
  };

  const persist = async (value: string | null, success: string) => {
    setSaving(true);
    const patch: TrialPatch = { trial_ends_at: value };
    const { error } = await supabase.from("companies").update(patch).eq("id", company.id);
    setSaving(false);
    setConfirmRemove(false);
    if (error) {
      toast.error("No se pudo guardar la prueba", { description: error.message });
      return;
    }
    onSaved(company.id, patch);
    onClose();
    toast.success(success);
  };

  const save = () => {
    if (!valid || (wouldBeSuspended && !ackLapsed)) return;
    void persist(endsAt, `Prueba actualizada: ${company.name} · termina el ${formatDateISO(endsAt)}`);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          Prueba gratis
        </DialogTitle>
        <DialogDescription>
          {company.name}
          {hasTrial ? ` · termina el ${formatDateISO(company.trial_ends_at as string)}` : " · todavía sin prueba cargada"}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {hasPaid && (
          <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            Esta empresa ya tiene un pago cargado (vence el {formatDateISO(company.plan_expires_at as string)}): mientras
            haya un plan pago, la prueba no cuenta para el acceso.
          </p>
        )}
        {!company.is_active && (
          <p className="rounded-lg border border-secondary/50 bg-secondary/10 p-3 text-sm">
            La cuenta está suspendida a mano. Cambiar la fecha de la prueba no la reactiva: usá el interruptor “Activa”
            de Gestión de empresas.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="trial-until">La prueba termina el</Label>
          <Input id="trial-until" type="date" value={endsAt} onChange={(e) => change(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => extend(7)}>
              +7 días
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => extend(14)}>
              +14 días
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => change(today)}>
              Termina hoy
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => change(fullTrial)}>
              {DEFAULT_TRIAL_DAYS} días desde hoy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            El último día de prueba es el que elijas
            {graceDays > 0 ? `; después el cliente tiene ${graceDays} ${graceDays === 1 ? "día" : "días"} de gracia y la cuenta se suspende sola.` : " y al día siguiente la cuenta se suspende sola."}
          </p>
        </div>

        {!valid ? (
          <p className="text-sm text-destructive">Elegí una fecha válida.</p>
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
                <span className="font-semibold text-destructive">Esta prueba ya terminó.</span> El acceso llegó hasta el{" "}
                {formatDateISO(preview.accessUntil)}: si la guardás así, la cuenta queda suspendida ahora mismo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="trial-ack" checked={ackLapsed} onCheckedChange={(v) => setAckLapsed(v === true)} />
              <Label htmlFor="trial-ack" className="text-sm font-normal">
                Entiendo que la cuenta quedará suspendida
              </Label>
            </div>
          </div>
        )}
        {preview && preview.phase === "grace" && (
          <p className="rounded-lg border border-secondary/50 bg-secondary/10 p-3 text-sm">
            <span className="font-semibold text-secondary">Esta prueba ya terminó.</span> La cuenta sigue funcionando hasta
            el {formatDateISO(preview.accessUntil)} y después se suspende sola.
          </p>
        )}
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {hasTrial ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive sm:mr-auto"
            disabled={saving}
            onClick={() => setConfirmRemove(true)}
          >
            Quitar el límite
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={saving || !valid || (wouldBeSuspended && !ackLapsed)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {hasTrial ? "Guardar fecha" : "Empezar prueba"}
          </Button>
        </div>
      </DialogFooter>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="¿Quitar el límite de la prueba?"
        description={`${company.name} queda sin fecha de fin: la cuenta deja de controlarse por tiempo y no se suspende sola (no se toca la suspensión manual).`}
        confirmLabel="Quitar el límite"
        confirmingLabel="Quitando..."
        loading={saving}
        onConfirm={() => persist(null, `Prueba sin límite: ${company.name}`)}
      />
    </>
  );
}
