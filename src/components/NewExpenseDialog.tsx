import { useEffect, useState } from "react";
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
import { usePaymentMethodPresets } from "@/hooks/usePaymentMethodPresets";
import { useToast } from "@/hooks/use-toast";
import { logExpensePayment } from "@/lib/expenses";
import { Loader2, FolderPlus, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CREATE_CATEGORY = "__create_category__";
type PaymentType = "contado" | "credito";

export interface EditableExpense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  payment_type: PaymentType;
  expense_date: string;
  notes: string | null;
}

export default function NewExpenseDialog({
  open,
  onOpenChange,
  onSaved,
  editItem,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  /** Si se pasa, el diálogo edita metadatos de este gasto (no el monto ni la forma de pago, que ya movieron plata real). */
  editItem?: EditableExpense | null;
}) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { presets: categories, reload: reloadCategories } = useExpenseCategories();
  const { presets: paymentMethodPresets } = usePaymentMethodPresets();
  const { toast } = useToast();

  const [category, setCategory] = useState("");
  const [newCatName, setNewCatName] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>("contado");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [installmentsTotal, setInstallmentsTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = !!editItem;

  useEffect(() => {
    if (!open) return;
    setNewCatName(null);
    if (editItem) {
      setCategory(editItem.category);
      setDescription(editItem.description ?? "");
      setAmount(String(editItem.amount));
      setExpenseDate(new Date(`${editItem.expense_date}T00:00:00`));
      setPaymentType(editItem.payment_type);
      setNotes(editItem.notes ?? "");
    } else {
      setCategory("");
      setDescription("");
      setAmount("");
      setExpenseDate(new Date());
      setPaymentType("contado");
      setInstallmentsTotal("");
      setNotes("");
    }
    setPaymentMethod(paymentMethodPresets[0]?.label ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editItem?.id]);

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
    if (isEdit) {
      setSaving(true);
      const { error } = await supabase
        .from("expenses")
        .update({
          category: category.trim(),
          description: description.trim() || null,
          expense_date: format(expenseDate, "yyyy-MM-dd"),
          notes: notes.trim() || null,
        })
        .eq("id", editItem!.id);
      setSaving(false);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Gasto actualizado" });
      onOpenChange(false);
      onSaved();
      return;
    }

    const amountNum = Math.round(Number(amount)) || 0;
    if (amountNum <= 0) {
      toast({ title: "Ingresá un monto válido", variant: "destructive" });
      return;
    }
    if (paymentType === "contado" && !paymentMethod) {
      toast({ title: "Elegí un método de pago", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: created, error } = await supabase
        .from("expenses")
        .insert({
          company_id: companyId,
          category: category.trim(),
          description: description.trim() || null,
          amount: amountNum,
          payment_type: paymentType,
          amount_paid: paymentType === "contado" ? amountNum : 0,
          installments_total: paymentType === "credito" && installmentsTotal.trim() ? parseInt(installmentsTotal, 10) : null,
          expense_date: format(expenseDate, "yyyy-MM-dd"),
          notes: notes.trim() || null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (paymentType === "contado") {
        logExpensePayment({ expenseId: created.id, companyId, amount: amountNum, method: paymentMethod, userId: user.id });
      }

      toast({ title: "Gasto registrado" });
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast({ title: "Error al registrar el gasto", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar gasto" : "Nuevo gasto"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Corregí categoría, descripción, fecha o notas." : "Registrá un gasto del taller o la tienda."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
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
                  <SelectTrigger id="expense-category"><SelectValue placeholder="Elegí una" /></SelectTrigger>
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
              <Label>Fecha</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start gap-2 text-left font-normal">
                    <CalendarIcon className="h-4 w-4" />
                    {format(expenseDate, "d MMM yyyy", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expenseDate}
                    onSelect={(d) => { if (d) { setExpenseDate(d); setDateOpen(false); } }}
                    disabled={(d) => d > new Date()}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-description">Descripción (opcional)</Label>
            <Input
              id="expense-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Almuerzo del equipo, factura de luz..."
            />
          </div>

          {isEdit ? (
            <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              El monto y la forma de pago no se pueden editar una vez creado el gasto — si te equivocaste, eliminá el gasto y cargalo de nuevo.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="expense-amount">Monto (Gs.)</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  min={0}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Forma de pago</Label>
                <div className="flex overflow-hidden rounded-md border border-input">
                  <button
                    type="button"
                    onClick={() => setPaymentType("contado")}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-sm font-medium transition-colors",
                      paymentType === "contado" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Contado
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType("credito")}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-sm font-medium transition-colors",
                      paymentType === "credito" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Crédito
                  </button>
                </div>
              </div>

              {paymentType === "contado" ? (
                <div className="space-y-2">
                  <Label htmlFor="expense-method">Método de pago</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="expense-method"><SelectValue placeholder="Elegí uno" /></SelectTrigger>
                    <SelectContent>
                      {paymentMethodPresets.map((m) => (
                        <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="expense-installments">Cantidad de cuotas (opcional)</Label>
                  <Input
                    id="expense-installments"
                    type="number"
                    min={1}
                    step="1"
                    value={installmentsTotal}
                    onChange={(e) => setInstallmentsTotal(e.target.value)}
                    placeholder="Ej: 3"
                  />
                  <p className="text-xs text-muted-foreground">
                    El gasto queda pendiente de pago — desde la lista se van registrando las cuotas a medida que se pagan.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="expense-notes">Notas (opcional)</Label>
            <Textarea id="expense-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar gasto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
