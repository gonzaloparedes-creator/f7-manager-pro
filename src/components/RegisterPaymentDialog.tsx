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
import { Wallet, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type DiscountUnit = "percent" | "amount";
interface PayLine { id: string; amount: string; method: string }

export interface OrderForPayment {
  id: string;
  order_number: string;
  status: string;
  quote_amount: number | null;
  deposit_amount: number | null;
  deposit_payment_method: string | null;
  cargos_adicionales: { motivo: string; monto: number }[] | null;
}

let lineIdSeq = 0;
function newLineId() { lineIdSeq += 1; return `line-${lineIdSeq}`; }

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

  const [payLines, setPayLines] = useState<PayLine[]>([]);
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

  // Al abrir (o cambiar de orden) se resetea a una sola línea con el saldo
  // completo y el último método conocido — el caso común (un solo método)
  // queda idéntico a como era antes de soportar pagos divididos.
  useEffect(() => {
    if (!open || !order) return;
    setDiscountValue("");
    setDiscountUnit("percent");
    setPayLines([{
      id: newLineId(),
      amount: saldo > 0 ? String(saldo) : "0",
      method: order.deposit_payment_method || paymentMethodPresets[0]?.label || "",
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id]);

  // `usePaymentMethodPresets` carga de forma asíncrona — si el dialog se
  // abre antes de que termine, la línea inicial queda sin método. Se
  // completa acá apenas los presets están listos, sin pisar una línea que
  // el usuario ya haya elegido a mano.
  useEffect(() => {
    if (!open || paymentMethodPresets.length === 0) return;
    setPayLines((prev) => prev.map((l) => (l.method ? l : { ...l, method: paymentMethodPresets[0].label })));
  }, [open, paymentMethodPresets]);

  // El monto sugerido sigue al saldo con descuento, pero solo mientras haya
  // una única línea — si el usuario ya dividió el pago en varios métodos,
  // tocar el descuento no debe pisarle esa distribución manual.
  useEffect(() => {
    if (!open) return;
    setPayLines((prev) => {
      if (prev.length !== 1) return prev;
      const only = prev[0];
      const suggested = saldoConDescuento > 0 ? String(saldoConDescuento) : "0";
      if (only.amount === suggested) return prev;
      return [{ ...only, amount: suggested }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saldoConDescuento]);

  const totalPay = payLines.reduce((s, l) => s + (Math.round(Number(l.amount)) || 0), 0);

  const addLine = () => {
    const usedMethods = new Set(payLines.map((l) => l.method));
    const nextMethod = paymentMethodPresets.find((m) => !usedMethods.has(m.label))?.label
      ?? paymentMethodPresets[0]?.label ?? "";
    setPayLines((prev) => [...prev, { id: newLineId(), amount: "", method: nextMethod }]);
  };
  const removeLine = (id: string) => {
    setPayLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  };
  const updateLine = (id: string, patch: Partial<PayLine>) => {
    setPayLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const handleConfirm = async () => {
    if (!order || !user || !companyId) return;
    const activeLines = payLines
      .map((l) => ({ ...l, amountNum: Math.round(Number(l.amount)) || 0 }))
      .filter((l) => l.amountNum > 0);

    if (totalPay <= 0 && discountAmount <= 0) {
      toast({ title: "Nada para registrar", description: "Ingresá un monto a cobrar o un descuento.", variant: "destructive" });
      return;
    }
    if (totalPay < 0 || totalPay > saldoConDescuento) {
      toast({ title: "Monto inválido", description: `No puede superar el saldo (${formatPYG(saldoConDescuento)}).`, variant: "destructive" });
      return;
    }
    if (activeLines.some((l) => !l.method)) {
      toast({ title: "Elegí un método de pago", description: "Cada monto necesita su método de pago.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const newQuoteAmount = discountAmount > 0 ? Number(order.quote_amount ?? 0) - discountAmount : order.quote_amount;
      const newDeposit = Number(order.deposit_amount ?? 0) + totalPay;
      const distinctMethods = Array.from(new Set(activeLines.map((l) => l.method)));
      const combinedMethod = distinctMethods.length > 0 ? distinctMethods.join(" + ") : order.deposit_payment_method;
      const { error } = await supabase
        .from("orders")
        .update({
          quote_amount: newQuoteAmount,
          deposit_amount: newDeposit,
          deposit_payment_method: combinedMethod,
        })
        .eq("id", order.id);
      if (error) throw error;

      const noteParts: string[] = [];
      if (activeLines.length > 0) {
        const paidList = activeLines.map((l) => `${formatPYG(l.amountNum)} (${l.method})`).join(", ");
        noteParts.push(`Pago registrado: ${paidList}`);
      }
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

      // Un `logOrderPayment` por línea — así el ledger refleja cada método
      // real por separado (necesario para que Reportes/Cierre de Caja
      // desglosen bien un pago dividido entre efectivo y transferencia).
      for (const line of activeLines) {
        logOrderPayment({ orderId: order.id, companyId, amount: line.amountNum, method: line.method, userId: user.id });
      }

      toast({
        title: discountAmount > 0 ? "Pago registrado con descuento" : "Pago registrado",
        description: saldoConDescuento - totalPay <= 0
          ? `${order.order_number} quedó totalmente pagada.`
          : `Saldo restante: ${formatPYG(saldoConDescuento - totalPay)}.`,
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

          <div className="space-y-2">
            <Label>Monto a cobrar y método de pago</Label>
            <div className="space-y-2">
              {payLines.map((line, idx) => (
                <div key={line.id} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={line.amount}
                    onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                    placeholder="0"
                    aria-label={`Monto ${idx + 1}`}
                  />
                  <Select value={line.method} onValueChange={(v) => updateLine(line.id, { method: v })}>
                    <SelectTrigger className="w-40 shrink-0" aria-label={`Método ${idx + 1}`}>
                      <SelectValue placeholder="Elegí uno" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethodPresets.map((m) => (
                        <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    disabled={payLines.length <= 1}
                    onClick={() => removeLine(line.id)}
                    aria-label="Quitar este método"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Agregar otro método
            </Button>
            <p className={cn(
              "text-xs font-medium",
              totalPay > saldoConDescuento ? "text-destructive" : "text-muted-foreground"
            )}>
              Total a registrar: {formatPYG(totalPay)} / Saldo: {formatPYG(saldoConDescuento)}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Si el cliente paga parte, ingresá solo ese monto — el resto queda como saldo. Si paga con más de un método (ej. mitad efectivo, mitad transferencia), agregá una línea por cada uno.
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
