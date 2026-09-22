import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { usePaymentMethodPresets } from "@/hooks/usePaymentMethodPresets";
import { useToast } from "@/hooks/use-toast";
import { formatPYG } from "@/lib/orders";
import { logExpensePayment } from "@/lib/expenses";
import { Wallet, Loader2 } from "lucide-react";

export interface ExpenseForInstallment {
  id: string;
  category: string;
  amount: number;
  amount_paid: number;
  installments_total: number | null;
  installments_paid: number;
}

export default function PayExpenseInstallmentDialog({
  expense,
  open,
  onOpenChange,
  onPaid,
}: {
  expense: ExpenseForInstallment | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPaid: () => void;
}) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { presets: paymentMethodPresets } = usePaymentMethodPresets();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [saving, setSaving] = useState(false);

  const pending = Math.max(0, Number(expense?.amount ?? 0) - Number(expense?.amount_paid ?? 0));

  useEffect(() => {
    if (!open || !expense) return;
    setAmount(pending > 0 ? String(pending) : "0");
    setMethod(paymentMethodPresets[0]?.label ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  const amountNum = Math.round(Number(amount)) || 0;

  const handleConfirm = async () => {
    if (!expense || !user || !companyId) return;
    if (amountNum <= 0 || amountNum > pending) {
      toast({ title: "Monto inválido", description: `No puede superar lo pendiente (${formatPYG(pending)}).`, variant: "destructive" });
      return;
    }
    if (!method) {
      toast({ title: "Elegí un método de pago", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const newAmountPaid = Number(expense.amount_paid) + amountNum;
      const newInstallmentsPaid = expense.installments_total
        ? Math.min(expense.installments_total, expense.installments_paid + 1)
        : expense.installments_paid;
      const { error } = await supabase
        .from("expenses")
        .update({ amount_paid: newAmountPaid, installments_paid: newInstallmentsPaid })
        .eq("id", expense.id);
      if (error) throw error;

      logExpensePayment({ expenseId: expense.id, companyId, amount: amountNum, method, userId: user.id });

      toast({
        title: "Cuota registrada",
        description: newAmountPaid >= expense.amount
          ? "El gasto quedó totalmente pagado."
          : `Pendiente: ${formatPYG(expense.amount - newAmountPaid)}.`,
      });
      onOpenChange(false);
      onPaid();
    } catch (e: any) {
      toast({ title: "Error al registrar el pago", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Abonar cuota{expense ? ` — ${expense.category}` : ""}</DialogTitle>
          <DialogDescription>Pendiente: {formatPYG(pending)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="pei-amount">Monto a abonar (Gs.)</Label>
            <Input id="pei-amount" type="number" min={0} max={pending} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pei-method">Método de pago</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="pei-method"><SelectValue placeholder="Elegí uno" /></SelectTrigger>
              <SelectContent>
                {paymentMethodPresets.map((m) => (
                  <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving} className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {saving ? "Registrando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
