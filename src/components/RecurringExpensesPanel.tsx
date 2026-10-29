import { useState } from "react";
import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useBranches } from "@/hooks/useBranches";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { RecurringRule } from "@/components/RecurringExpenseDialog";
import { describeSchedule, formatDueDate, nextDueDate } from "@/lib/recurringExpenses";
import { formatMoney } from "@/lib/currency";
import { Repeat, Plus, Pencil, Trash2 } from "lucide-react";

export default function RecurringExpensesPanel({
  rules,
  loading,
  onCreate,
  onEdit,
  onChanged,
}: {
  rules: RecurringRule[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (rule: RecurringRule) => void;
  onChanged: () => void;
}) {
  const { companyId } = useCompany();
  const { branches, hasMultipleBranches } = useBranches();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<RecurringRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const branchName = (id: string | null) => (id ? (branches.find((b) => b.id === id)?.name ?? "Sucursal") : "General");

  const toggleActive = async (rule: RecurringRule, active: boolean) => {
    if (!companyId) return;
    setTogglingId(rule.id);
    // Al reanudar, lo que pasó mientras estuvo pausada no se carga de golpe.
    const yesterday = format(addDays(new Date(), -1), "yyyy-MM-dd");
    const resumedCursor = rule.generated_through && rule.generated_through > yesterday ? rule.generated_through : yesterday;
    const { error } = await supabase
      .from("recurring_expenses")
      .update(active ? { active: true, generated_through: resumedCursor } : { active: false })
      .eq("id", rule.id)
      .eq("company_id", companyId);
    setTogglingId(null);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    onChanged();
  };

  const removeRule = async (rule: RecurringRule) => {
    if (!companyId) return;
    setDeleting(true);
    const { error } = await supabase.from("recurring_expenses").delete().eq("id", rule.id).eq("company_id", companyId);
    setDeleting(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setPendingDelete(null);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Gastos fijos que se cargan solos en la fecha elegida: alquiler, internet, sueldos…
        </p>
        <Button onClick={onCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva regla
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-muted-foreground">
              <Repeat className="h-8 w-8" />
              Todavía no tenés gastos recurrentes.
              <span className="text-xs">Creá una regla y el gasto aparece solo cada mes o cada semana.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gasto</TableHead>
                    <TableHead>Se repite</TableHead>
                    {hasMultipleBranches && <TableHead>Sucursal</TableHead>}
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Al generarse</TableHead>
                    <TableHead>Próximo</TableHead>
                    <TableHead className="w-[150px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id} className={r.active ? undefined : "opacity-60"}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className="w-fit">{r.category}</Badge>
                          {r.description && <span className="max-w-[220px] truncate text-xs text-muted-foreground">{r.description}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{describeSchedule(r)}</TableCell>
                      {hasMultipleBranches && <TableCell className="whitespace-nowrap text-muted-foreground">{branchName(r.branch_id)}</TableCell>}
                      <TableCell className="text-right font-medium">{formatMoney(r.amount)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.payment_method ? `Pagado · ${r.payment_method}` : "A pagar"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.active ? formatDueDate(nextDueDate(r)) : <Badge variant="secondary">Pausada</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Switch
                            checked={r.active}
                            disabled={togglingId === r.id}
                            onCheckedChange={(v) => toggleActive(r, v)}
                            aria-label={r.active ? "Pausar regla" : "Reanudar regla"}
                          />
                          <Button size="icon" variant="ghost" onClick={() => onEdit(r)} aria-label={`Editar regla de ${r.category}`}>
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setPendingDelete(r)} aria-label={`Eliminar regla de ${r.category}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="¿Eliminar regla?"
        description={
          pendingDelete
            ? `Se dejará de cargar el gasto recurrente de "${pendingDelete.category}" (${formatMoney(pendingDelete.amount)}). Los gastos que ya se generaron se conservan.`
            : ""
        }
        loading={deleting}
        onConfirm={() => pendingDelete && removeRule(pendingDelete)}
      />
    </div>
  );
}
