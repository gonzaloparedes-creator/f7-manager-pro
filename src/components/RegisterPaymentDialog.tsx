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
import { useOrderStatusPresets } from "@/hooks/useOrderStatusPresets";
import { useToast } from "@/hooks/use-toast";
import { formatPYG, logOrderPayment, resolveStatusLabel } from "@/lib/orders";
import { Wallet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type DiscountUnit = "percent" | "amount";

export interface OrderForPayment {
  id: string;
  order_number: string;
  status: string;
  quote_amount: number | null;
  deposit_amount: number | null;
  deposit_payment_method: string | null;
  cargos_adicionales: { motivo: string; monto: number }[] | null;
}

export default function RegisterPaymentDialog({
  order,
  open,
  onOpenChange,
  onRegistered,
}: {
  order: OrderForPayment | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRegistered: () => void;
}) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { presets: paymentMethodPresets } = usePaymentMethodPresets();
  const { presets: statusPresets } = useOrderStatusPresets();
  const { toast } = useToast();

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [discountUnit, setDiscountUnit] = useState<DiscountUnit>("percent");
  const [saving, setSaving] = useState(false);

  const cargosTotal = (order?.cargos_adicionales ?? []).reduce((s, c) => s + Number(c.monto || 0), 0);
  const totalAjustado = Number(order?.quote_amount ?? 0) + cargosTotal;
  const saldo = Math.max(0, totalAjustado - Number(order?.deposit_amount ?? 0));

  const discountInput = parseFloat(discountValue) || 0;
  // Igual criterio que el descuento del carrito de Productos: se calcula
  // sobre el saldo pendiente, nunca sobre el total completo de la orden.
  const discountRaw = discountUnit === "percent"
    ? saldo * (Math.min(100, Math.max(0, discountInput)) / 100)
    : Math.max(0, discountInput);
  const discountAmount = Math.min(saldo, Math.round(discountRaw));
  const saldoConDescuento = saldo - discountAmount;

  // Al abrir (o cambiar de orden) se resetean método y descuento.
  useEffect(() => {
    if (!open || !order) return;
    setDiscountValue("");
    setDiscountUnit("percent");
    setPayMethod(order.deposit_payment_method || paymentMethodPresets[0]?.label || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id]);

  // El monto sugerido sigue al saldo con descuento — si el usuario ya lo
  // editó a mano para un pago parcial, alcanza con no tocar el descuento de
  // nuevo para que su edición no se pise.
  useEffect(() => {
    if (!open) return;
    setPayAmount(saldoConDescuento > 0 ? String(saldoConDescuento) : "0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saldoConDescuento]);

  const amount = Math.round(Number(payAmount) || 0);

  const handleConfirm = async () => {
    if (!order || !user || !companyId) return;
    if (amount <= 0 && discountAmount <= 0) {
      toast({ title: "Nada para registrar", description: "Ingresá un monto a cobrar o un descuento.", variant: "destructive" });
      return;
    }
    if (amount < 0 || amount > saldoConDescuento) {
      toast({ title: "Monto inválido", description: `No puede superar el saldo (${formatPYG(saldoConDescuento)}).`, variant: "destructive" });
      return;
    }
    if (amount > 0 && !payMethod) {
      toast({ title: "Elegí un método de pago", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const newQuoteAmount = discountAmount > 0 ? Number(order.quote_amount ?? 0) - discountAmount : order.quote_amount;
      const newDeposit = Number(order.deposit_amount ?? 0) + amount;
      const { error } = await supabase
        .from("orders")
        .update({
          quote_amount: newQuoteAmount,
          deposit_amount: newDeposit,
          deposit_payment_method: amount > 0 ? payMethod : order.deposit_payment_method,
        })
        .eq("id", order.id);
      if (error) throw error;

      const noteParts: string[] = [];
      if (amount > 0) noteParts.push(`Pago registrado: ${formatPYG(amount)} (${payMethod})`);
      if (discountAmount > 0) {
        const pctNote = discountUnit === "percent" ? ` (${discountInput}%)` : "";
        noteParts.push(`Descuento aplicado: ${formatPYG(discountAmount)}${pctNote}`);
      }
      try {
        await supabase.from("order_status_history").insert({
          order_id: order.id,
          status: order.status,
          status_label: resolveStatusLabel(order.status, statusPresets),
          note: noteParts.join(" · "),
          is_internal: true,
          image_urls: [],
        } as any);
      } catch (e) {
        console.warn("Failed to log system history", e);
      }

      if (amount > 0) {
        logOrderPayment({ orderId: order.id, companyId, amount, method: payMethod, userId: user.id });
      }

      toast({
        title: discountAmount > 0 ? "Pago registrado con descuento" : "Pago registrado",
        description: saldoConDescuento - amount <= 0
          ? `${order.order_number} quedó totalmente pagada.`
          : `Saldo restante: ${formatPYG(saldoConDescuento - amount)}.`,
      });
      onOpenChange(false);
      onRegistered();
    } catch (e: any) {
      toast({ title: "Error al registrar el pago", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago{order ? ` — ${order.order_number}` : ""}</DialogTitle>
          <DialogDescription>Saldo pendiente: {formatPYG(saldo)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-discount">Descuento (opcional)</Label>
            <div className="flex gap-2">
              <Input
                id="rp-discount"
                type="number"
                min={0}
                step="1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="0"
                className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <div className="flex shrink-0 overflow-hidden rounded-md border border-input">
                <button
                  type="button"
                  onClick={() => setDiscountUnit("percent")}
                  className={cn(
                    "px-3 text-sm font-medium transition-colors",
                    discountUnit === "percent" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountUnit("amount")}
                  className={cn(
                    "px-3 text-sm font-medium transition-colors",
                    discountUnit === "amount" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Gs.
                </button>
              </div>
            </div>
            {discountAmount > 0 && (
              <p className="text-xs text-secondary">
                -{formatPYG(discountAmount)} · saldo con descuento: {formatPYG(saldoConDescuento)}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rp-amount">Monto a cobrar (Gs.)</Label>
              <Input
                id="rp-amount"
                type="number"
                min={0}
                max={saldoConDescuento}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-method">Método de pago</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger id="rp-method"><SelectValue placeholder="Elegí uno" /></SelectTrigger>
                <SelectContent>
                  {paymentMethodPresets.map((m) => (
                    <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Si el cliente paga parte, ingresá solo ese monto — el resto queda como saldo.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {saving ? "Registrando..." : "Confirmar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
