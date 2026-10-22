import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { F7Recurring } from "@/lib/f7Finance";
import { formatDateISO } from "@/lib/subscriptionReceipt";
import { useSticky } from "./helpers";

export interface ResumeTarget {
  template: F7Recurring;
  // Vencimientos que quedaron sin generar mientras la plantilla estuvo pausada (AAAA-MM-DD, de menor a mayor).
  missing: string[];
}

interface Props {
  target: ResumeTarget | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResumeRecurringDialog({ target, busy, onClose, onConfirm }: Props) {
  const shown = useSticky(target);
  const count = shown?.missing.length ?? 0;
  const first = count > 0 ? formatDateISO(shown!.missing[0]) : "";
  const last = count > 0 ? formatDateISO(shown!.missing[count - 1]) : "";

  return (
    <AlertDialog open={!!target} onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialogContent data-testid="resume-dialog">
        {shown ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Reanudar “{shown.template.name}”</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    {count === 1
                      ? `Al reanudar se crea 1 vencimiento que quedó sin generar (${first}).`
                      : `Al reanudar se crean ${count} vencimientos que quedaron sin generar (del ${first} al ${last}).`}
                  </p>
                  <p>
                    Aparecen como gastos pendientes de pago. Si alguno no corresponde porque el servicio estaba pausado, anulalo desde
                    Movimientos.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <Button onClick={onConfirm} disabled={busy} data-testid="resume-confirm">
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                {busy ? "Reanudando..." : "Reanudar y crearlos"}
              </Button>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
