import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { useBranches } from "@/hooks/useBranches";
import { usePaymentMethodPresets } from "@/hooks/usePaymentMethodPresets";
import { useToast } from "@/hooks/use-toast";
import {
  WEEKDAY_OPTIONS,
  describeSchedule,
  formatDueDate,
  nextDueDate,
  type RecurringFrequency,
} from "@/lib/recurringExpenses";
import { Loader2, FolderPlus, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { currencySymbol } from "@/lib/currency";

const CREATE_CATEGORY = "__create_category__";
const GENERAL_BRANCH = "__general__";
const PENDING_PAYMENT = "__pending__";

export interface RecurringRule {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  frequency: RecurringFrequency;
  day_of_month: number | null;
  day_of_week: number | null;
  payment_method: string | null;
  start_date: string;
  generated_through: string | null;
  active: boolean;
  notes: string | null;
  branch_id: string | null;
}

export default function RecurringExpenseDialog({
  open,
  onOpenChange,
  onSaved,
  editItem,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  editItem?: RecurringRule | null;
}) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { presets: categories, reload: reloadCategories } = useExpenseCategories();
  const { presets: paymentMethodPresets } = usePaymentMethodPresets();
  const { branches, defaultBranchId, hasMultipleBranches } = useBranches();
  const { toast } = useToast();

  const [category, setCategory] = useState("");
  const [newCatName, setNewCatName] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("mensual");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState(PENDING_PAYMENT);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [branchChoice, setBranchChoice] = useState<string | null>(null);

  const isEdit = !!editItem;
  const effectiveBranchId = branchChoice === null ? defaultBranchId : branchChoice === GENERAL_BRANCH ? null : branchChoice;

  useEffect(() => {
    if (!open) return;
    setNewCatName(null);
    setBranchChoice(null);
    if (editItem) {
      setCategory(editItem.category);
      setDescription(editItem.description ?? "");
      setAmount(String(editItem.amount));
      setFrequency(editItem.frequency);
      setDayOfMonth(String(editItem.day_of_month ?? 1));
      setDayOfWeek(String(editItem.day_of_week ?? 1));
      setPaymentChoice(editItem.payment_method ?? PENDING_PAYMENT);
      setNotes(editItem.notes ?? "");
    } else {
      setCategory("");
      setDescription("");
      setAmount("");
      setFrequency("mensual");
      setDayOfMonth("1");
      setDayOfWeek("1");
      setStartDate(new Date());
      setPaymentChoice(PENDING_PAYMENT);
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editItem?.id]);

  const dayOfMonthNum = Math.round(Number(dayOfMonth)) || 0;
  const schedule = {
    frequency,
    day_of_month: frequency === "mensual" ? dayOfMonthNum : null,
    day_of_week: frequency === "semanal" ? Number(dayOfWeek) : null,
  };
  const scheduleValid = frequency === "semanal" || (dayOfMonthNum >= 1 && dayOfMonthNum <= 31);

  const nextLabel = useMemo(() => {
    if (!scheduleValid) return null;
    return formatDueDate(
      nextDueDate({
        ...schedule,
        start_date: editItem ? editItem.start_date : format(startDate, "yyyy-MM-dd"),
        generated_through: editItem?.generated_through ?? null,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frequency, dayOfMonthNum, dayOfWeek, startDate, editItem, scheduleValid]);

  const createCategory = async () => {
    if (!newCatName?.trim() || !companyId) return;
    setSavingCategory(true);
    const { error } = await supabase.from("expense_categories").insert({ company_id: companyId, label: newCatName.trim() });
    setSavingCategory(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await reloadCategories();
    setCategory(newCatName.trim());
    setNewCatName(null);
  };

  const handleSubmit = async () => {
    if (!user || !companyId) return;
    if (!category.trim()) {
      toast({ title: "Elegí una categoría", variant: "destructive" });
      return;
    }
    const amountNum = Math.round(Number(amount)) || 0;
    if (amountNum <= 0) {
      toast({ title: "Ingresá un monto válido", variant: "destructive" });
      return;
    }
    if (!scheduleValid) {
      toast({ title: "El día del mes tiene que estar entre 1 y 31", variant: "destructive" });
      return;
    }

    const fields = {
      category: category.trim(),
      description: description.trim() || null,
      amount: amountNum,
      frequency,
      day_of_month: schedule.day_of_month,
      day_of_week: schedule.day_of_week,
      payment_method: paymentChoice === PENDING_PAYMENT ? null : paymentChoice,
      notes: notes.trim() || null,
    };

    setSaving(true);
    const { error } = editItem
      ? await supabase.from("recurring_expenses").update(fields).eq("id", editItem.id).eq("company_id", companyId)
      : await supabase.from("recurring_expenses").insert({
          ...fields,
          company_id: companyId,
          branch_id: effectiveBranchId,
          start_date: format(startDate, "yyyy-MM-dd"),
          created_by: user.id,
        });
    setSaving(false);
    if (error) { toast({ title: "Error al guardar la regla", description: error.message, variant: "destructive" }); return; }
    toast({ title: isEdit ? "Regla actualizada" : "Regla creada" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar gasto recurrente" : "Nuevo gasto recurrente"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Los cambios valen para los próximos gastos; los que ya se cargaron no se modifican."
              : "Se carga solo en la fecha que elijas: alquiler, internet, sueldos…"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Categoría</Label>
            {newCatName !== null ? (
              <div className="flex gap-1">
                <Input autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nombre" />
                <Button type="button" size="sm" onClick={createCategory} disabled={savingCategory || !newCatName.trim()}>
                  {savingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : "OK"}
                </Button>
              </div>
            ) : (
              <Select
                value={category}
                onValueChange={(v) => { if (v === CREATE_CATEGORY) { setNewCatName(""); return; } setCategory(v); }}
              >
                <SelectTrigger id="recurring-category"><SelectValue placeholder="Elegí una" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.label}>{c.label}</SelectItem>)}
                  <SelectItem value={CREATE_CATEGORY} className="text-primary">
                    <span className="flex items-center gap-1.5"><FolderPlus className="h-3.5 w-3.5" /> Nueva categoría...</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-description">Descripción (opcional)</Label>
            <Input
              id="recurring-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Alquiler del local, internet..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-amount">Monto ({currencySymbol()})</Label>
            <Input
              id="recurring-amount"
              type="number"
              min={0}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          {hasMultipleBranches && !isEdit && (
            <div className="space-y-2">
              <Label htmlFor="recurring-branch">Sucursal</Label>
              <Select value={effectiveBranchId ?? GENERAL_BRANCH} onValueChange={setBranchChoice}>
                <SelectTrigger id="recurring-branch"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENERAL_BRANCH}>General (toda la empresa)</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Se repite</Label>
            <div className="flex overflow-hidden rounded-md border border-input">
              {(["mensual", "semanal"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={cn(
                    "flex-1 px-3 py-1.5 text-sm font-medium transition-colors",
                    frequency === f ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f === "mensual" ? "Cada mes" : "Cada semana"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {frequency === "mensual" ? (
              <div className="space-y-2">
                <Label htmlFor="recurring-day-of-month">Día del mes</Label>
                <Input
                  id="recurring-day-of-month"
                  type="number"
                  min={1}
                  max={31}
                  step="1"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="recurring-day-of-week">Día de la semana</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger id="recurring-day-of-week"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_OPTIONS.map((w) => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!isEdit && (
              <div className="space-y-2">
                <Label>Empieza el</Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start gap-2 text-left font-normal">
                      <CalendarIcon className="h-4 w-4" />
                      {format(startDate, "d MMM yyyy", { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => { if (d) { setStartDate(d); setDateOpen(false); } }}
                      disabled={(d) => d < startOfDay(new Date())}
                      locale={es}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
          {scheduleValid && (
            <p className="text-xs text-muted-foreground" data-testid="recurring-preview">
              {describeSchedule(schedule)} · próximo gasto: <span className="font-medium text-foreground">{nextLabel}</span>
              {frequency === "mensual" && dayOfMonthNum > 28 && " · en los meses más cortos se carga el último día del mes."}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="recurring-payment">Cuando se genere el gasto</Label>
            <Select value={paymentChoice} onValueChange={setPaymentChoice}>
              <SelectTrigger id="recurring-payment"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={PENDING_PAYMENT}>Queda pendiente de pago</SelectItem>
                {paymentMethodPresets.map((m) => (
                  <SelectItem key={m.id} value={m.label}>Se paga con {m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {paymentChoice === PENDING_PAYMENT
                ? "Aparece como «A pagar» hasta que lo abones desde la lista; no mueve la caja."
                : "Se registra como pagado ese día; si el método es efectivo, se descuenta en el Cierre de Caja."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-notes">Notas (opcional)</Label>
            <Textarea id="recurring-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear regla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
