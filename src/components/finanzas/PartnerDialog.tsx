import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { validatePartnerDraft, type F7Partner, type PartnerDraft } from "@/lib/f7Finance";
import { createPartner, deletePartner, updatePartner } from "@/lib/f7FinanceApi";
import { useSticky } from "./helpers";
import { FieldError } from "./shared";

export interface PartnerTarget {
  key: number;
  partner: F7Partner | null;
}

interface Props {
  target: PartnerTarget | null;
  partners: F7Partner[];
  onClose: () => void;
  onSaved: (partner: F7Partner) => void;
  onDeleted: (id: string) => void;
}

export function PartnerDialog({ target, onClose, ...rest }: Props) {
  const shown = useSticky(target);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-testid="partner-dialog">
        {shown ? <PartnerForm key={shown.key} target={shown} busy={busy} setBusy={setBusy} onClose={onClose} {...rest} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PartnerForm({
  target,
  partners,
  busy,
  setBusy,
  onClose,
  onSaved,
  onDeleted,
}: Props & { target: PartnerTarget; busy: boolean; setBusy: (busy: boolean) => void }) {
  const { partner } = target;
  const [draft, setDraft] = useState<PartnerDraft>(() => ({
    name: partner?.name ?? "",
    share_pct: partner ? String(partner.share_pct).replace(".", ",") : "",
    active: partner?.active ?? true,
    notes: partner?.notes ?? "",
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof PartnerDraft, string>>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof PartnerDraft>(field: K, value: PartnerDraft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const others = partners.filter((p) => p.id !== partner?.id);
  const otherActiveTotal = Math.round(others.filter((p) => p.active).reduce((sum, p) => sum + p.share_pct, 0) * 100) / 100;

  const save = async () => {
    const { errors: found, payload } = validatePartnerDraft(draft, partners, partner?.id ?? null);
    setErrors(found);
    if (!payload) {
      toast.error("Revisá los datos marcados en rojo.");
      return;
    }
    setBusy(true);
    try {
      const saved = partner ? await updatePartner(partner.id, payload) : await createPartner(payload);
      onSaved(saved);
      toast.success(partner ? "Socio actualizado" : "Socio agregado");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el socio.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!partner) return;
    setBusy(true);
    try {
      await deletePartner(partner.id);
      onDeleted(partner.id);
      toast.success("Socio borrado");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar el socio.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void save();
        }}
      >
        <DialogHeader>
          <DialogTitle>{partner ? "Editar socio" : "Agregar socio"}</DialogTitle>
          <DialogDescription>
            El porcentaje define cuánto de la utilidad le corresponde. Los socios activos tienen que sumar 100 %.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="partner-name">Nombre</Label>
          <Input
            id="partner-name"
            data-testid="partner-name"
            value={draft.name}
            maxLength={80}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Ej.: Gonzalo"
            disabled={busy}
            aria-invalid={!!errors.name}
          />
          <FieldError message={errors.name} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="partner-share">Participación en la utilidad (%)</Label>
          <Input
            id="partner-share"
            data-testid="partner-share"
            inputMode="decimal"
            value={draft.share_pct}
            onChange={(e) => set("share_pct", e.target.value)}
            placeholder="50"
            disabled={busy}
            aria-invalid={!!errors.share_pct}
          />
          <p className="text-xs text-muted-foreground">
            {others.some((p) => p.active)
              ? `Los otros socios activos suman ${otherActiveTotal.toLocaleString("es-PY")} %.`
              : "Con dos socios a partes iguales, poné 50 en cada uno."}
          </p>
          <FieldError message={errors.share_pct} />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5">
          <div className="min-w-0">
            <Label htmlFor="partner-active" className="text-sm">
              Socio activo
            </Label>
            <p className="text-xs text-muted-foreground">
              Si lo desactivás, no aparece para nuevos movimientos y no cuenta en el control del 100 %. Su historial y su porcentaje se conservan: si ya no
              participa de las ganancias, ponele 0 %.
            </p>
          </div>
          <Switch id="partner-active" data-testid="partner-active" checked={draft.active} onCheckedChange={(v) => set("active", v)} disabled={busy} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="partner-notes">Notas (opcional)</Label>
          <Textarea
            id="partner-notes"
            data-testid="partner-notes"
            rows={2}
            maxLength={500}
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
            disabled={busy}
          />
          <FieldError message={errors.notes} />
        </div>

        <DialogFooter className="gap-2 sm:justify-between sm:gap-0">
          {partner ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={busy}>
              Borrar socio
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy} data-testid="partner-save">
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {busy ? "Guardando..." : partner ? "Guardar cambios" : "Agregar socio"}
            </Button>
          </div>
        </DialogFooter>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Borrar este socio?"
        description="Solo se puede borrar un socio que no tenga ningún movimiento. Si ya tiene historial, desactivalo en lugar de borrarlo."
        confirmLabel="Borrar socio"
        confirmingLabel="Borrando..."
        loading={busy}
        onConfirm={() => void remove()}
      />
    </>
  );
}
