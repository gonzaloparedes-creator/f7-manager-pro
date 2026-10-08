import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { useBranches } from "@/hooks/useBranches";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import NewExpenseDialog, { type EditableExpense } from "@/components/NewExpenseDialog";
import PayExpenseInstallmentDialog, { type ExpenseForInstallment } from "@/components/PayExpenseInstallmentDialog";
import { formatPYG } from "@/lib/orders";
import { Receipt, Plus, Pencil, Trash2, Wallet, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Expense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  payment_type: "contado" | "credito";
  amount_paid: number;
  installments_total: number | null;
  installments_paid: number;
  expense_date: string;
  notes: string | null;
  branch_id: string | null;
}

const ALL_CATEGORIES = "__all__";
const ALL_BRANCHES = "__all_branches__";
const GENERAL_BRANCH = "__general__";

export default function Gastos() {
  const { companyId } = useCompany();
  const { isStarter, loading: planLoading } = usePlan();
  const { canViewGastos, loading: permLoading } = useStaffPermissions();
  const { toast } = useToast();
  const { presets: categories } = useExpenseCategories();
  const { branches, hasMultipleBranches } = useBranches();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [branchFilter, setBranchFilter] = useState(ALL_BRANCHES);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Expense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [payingExpense, setPayingExpense] = useState<Expense | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);

  const viewMonth = useMemo(() => addMonths(new Date(), monthOffset), [monthOffset]);
  const monthLabel = format(viewMonth, "MMMM yyyy", { locale: es });

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const from = format(startOfMonth(viewMonth), "yyyy-MM-dd");
    const to = format(endOfMonth(viewMonth), "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("expenses")
      .select("id, category, description, amount, payment_type, amount_paid, installments_total, installments_paid, expense_date, notes, branch_id")
      .eq("company_id", companyId)
      .gte("expense_date", from)
      .lte("expense_date", to)
      .order("expense_date", { ascending: false });
    if (error) toast({ title: "Error al cargar gastos", description: error.message, variant: "destructive" });
    setExpenses((data ?? []) as Expense[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [companyId, monthOffset]);

  // El filtro de sucursal también define los totales de arriba; el de categoría solo la lista.
  const scoped = useMemo(() => {
    if (branchFilter === ALL_BRANCHES) return expenses;
    if (branchFilter === GENERAL_BRANCH) return expenses.filter((e) => !e.branch_id);
    return expenses.filter((e) => e.branch_id === branchFilter);
  }, [expenses, branchFilter]);
  const filtered = useMemo(
    () => (categoryFilter === ALL_CATEGORIES ? scoped : scoped.filter((e) => e.category === categoryFilter)),
    [scoped, categoryFilter]
  );
  const branchName = (id: string | null) => (id ? (branches.find((b) => b.id === id)?.name ?? "Sucursal") : "General");

  const totalMonth = useMemo(() => scoped.reduce((s, e) => s + Number(e.amount), 0), [scoped]);
  const totalToday = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return scoped.filter((e) => e.expense_date === todayStr).reduce((s, e) => s + Number(e.amount), 0);
  }, [scoped]);
  const totalPending = useMemo(
    () => scoped.reduce((s, e) => s + Math.max(0, Number(e.amount) - Number(e.amount_paid)), 0),
    [scoped]
  );

  const openCreate = () => { setEditItem(null); setOpen(true); };
  const openEdit = (e: Expense) => { setEditItem(e); setOpen(true); };
  const openPay = (e: Expense) => { setPayingExpense(e); setPayDialogOpen(true); };

  const removeExpense = async (e: Expense) => {
    setDeleting(true);
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    setDeleting(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setPendingDelete(null);
    load();
  };

  if (!permLoading && !canViewGastos) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="text-lg font-semibold">Acceso Denegado</div>
            <p className="text-sm text-muted-foreground">No tenés permiso para ver el apartado de Gastos.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!planLoading && isStarter) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Receipt className="h-6 w-6 text-primary" />
            Gastos
          </h1>
          <p className="text-sm text-muted-foreground">Repuestos, mercadería, alquiler y demás gastos del negocio.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Gasto
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Gastos del mes</div>
          <div className="mt-1 text-2xl font-bold">{formatPYG(totalMonth)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Gastos de hoy</div>
          <div className="mt-1 text-2xl font-bold">{formatPYG(totalToday)}</div>
        </Card>
        <Card className="col-span-2 p-4 lg:col-span-1">
          <div className="text-xs text-muted-foreground">Pendiente por pagar</div>
          <div className={cn("mt-1 text-2xl font-bold", totalPending > 0 && "text-secondary")}>{formatPYG(totalPending)}</div>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-36 text-center text-sm font-medium capitalize">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setMonthOffset((m) => m + 1)} disabled={monthOffset >= 0} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {hasMultipleBranches && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por sucursal"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_BRANCHES}>Todas las sucursales</SelectItem>
                <SelectItem value={GENERAL_BRANCH}>General (sin sucursal)</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por categoría"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>Todas las categorías</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.label}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <Receipt className="h-8 w-8" />
              Sin gastos en este período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Categoría</TableHead>
                    {hasMultipleBranches && <TableHead>Sucursal</TableHead>}
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Forma de pago</TableHead>
                    <TableHead className="w-[140px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const pending = Math.max(0, Number(e.amount) - Number(e.amount_paid));
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {format(new Date(`${e.expense_date}T00:00:00`), "d MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                        {hasMultipleBranches && <TableCell className="whitespace-nowrap text-muted-foreground">{branchName(e.branch_id)}</TableCell>}
                        <TableCell className="max-w-[220px] truncate text-muted-foreground">{e.description ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatPYG(e.amount)}</TableCell>
                        <TableCell>
                          {e.payment_type === "contado" ? (
                            <Badge variant="secondary">Contado</Badge>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <Badge variant="outline" className="w-fit border-secondary/40 text-secondary">
                                Crédito{e.installments_total ? ` · ${e.installments_paid}/${e.installments_total}` : ""}
                              </Badge>
                              {pending > 0 && (
                                <span className="text-xs text-muted-foreground">Pendiente: {formatPYG(pending)}</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {pending > 0 && (
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openPay(e)}>
                                <Wallet className="h-3.5 w-3.5" /> Abonar
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => openEdit(e)} aria-label={`Editar ${e.category}`}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setPendingDelete(e)} aria-label={`Eliminar gasto de ${e.category}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <NewExpenseDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditItem(null); }}
        onSaved={load}
        editItem={editItem as EditableExpense | null}
      />
      <PayExpenseInstallmentDialog
        expense={payingExpense as ExpenseForInstallment | null}
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        onPaid={load}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="¿Eliminar gasto?"
        description={pendingDelete ? `Se eliminará el gasto de "${pendingDelete.category}" (${formatPYG(pendingDelete.amount)}).` : ""}
        loading={deleting}
        onConfirm={() => pendingDelete && removeExpense(pendingDelete)}
      />
    </div>
  );
}
