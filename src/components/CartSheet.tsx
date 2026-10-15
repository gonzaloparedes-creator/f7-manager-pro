import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";
import { Loader2, ShoppingCart, CheckCircle2, Printer, Trash2, MessageCircle, ArrowLeftRight, ShieldCheck } from "lucide-react";
import { formatPYG, isCashLabel } from "@/lib/orders";
import { cn } from "@/lib/utils";
import QuantityStepper from "@/components/QuantityStepper";
import BuyDeviceDialog from "@/components/BuyDeviceDialog";
import WarrantySelector from "@/components/WarrantySelector";
import { DEFAULT_DEVICE_WARRANTY_DAYS, clampWarrantyDays, warrantyDocumentLine } from "@/lib/deviceWarranty";
import { usePaymentMethodPresets } from "@/hooks/usePaymentMethodPresets";
import { useCashRegisterGate } from "@/hooks/useCashRegisterGate";
import CashRegisterRequiredNotice from "@/components/CashRegisterRequiredNotice";
import type { DevicePurchaseRecord } from "@/lib/devicePurchase";
import { amountToCollect, buildTradeInSaleParams, validateTradeInValue, type TradeInDraft } from "@/lib/tradeIn";

type DiscountUnit = "percent" | "amount";

export type CartLine = { quantity: number; unitPrice: number };
export type Cart = Record<string, CartLine>;

export type CompletedCartSale = {
  id: string;
  created_at: string;
  payment_method: string | null;
  branch_id: string | null;
  /** `imei` y `warranty_days` solo vienen en las líneas de equipos. */
  items: { product_name: string; quantity: number; unit_price: number; imei?: string | null; warranty_days?: number | null }[];
  customer_name?: string | null;
  customer_phone?: string | null;
  /** Equipo que el cliente entregó como parte de pago; `record` es su comprobante de compra. */
  trade_in?: { device_name: string; value: number; record?: DevicePurchaseRecord } | null;
};

type CartProduct = { id: string; name: string; stock: number; cost_price: number; is_device?: boolean };

export default function CartSheet({
  open,
  onOpenChange,
  products,
  cart,
  setCart,
  onSold,
  onPrintRequest,
  onReceiptRequest,
  onPrintTradeIn,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: CartProduct[];
  cart: Cart;
  setCart: React.Dispatch<React.SetStateAction<Cart>>;
  onSold?: () => void;
  onPrintRequest?: (sale: CompletedCartSale) => void;
  onReceiptRequest?: (sale: CompletedCartSale) => void;
  onPrintTradeIn?: (record: DevicePurchaseRecord) => void;
}) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { presets: paymentMethodPresets } = usePaymentMethodPresets();
  const cashGate = useCashRegisterGate(open);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [loading, setLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedCartSale | null>(null);
  const [discountValue, setDiscountValue] = useState("");
  const [discountUnit, setDiscountUnit] = useState<DiscountUnit>("percent");
  const [receivedCash, setReceivedCash] = useState("");
  const [tradeIn, setTradeIn] = useState<TradeInDraft | null>(null);
  const [tradeInOpen, setTradeInOpen] = useState(false);
  const [warrantyDays, setWarrantyDays] = useState(DEFAULT_DEVICE_WARRANTY_DAYS);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");

  const lines = Object.entries(cart)
    .map(([id, line]) => ({ id, product: products.find((p) => p.id === id), ...line }))
    .filter((l): l is typeof l & { product: CartProduct } => !!l.product);
  const hasDevice = lines.some((l) => l.product.is_device);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const discountInput = parseFloat(discountValue) || 0;
  // El descuento se reparte como el mismo % en cada línea (no un monto fijo
  // restado del total), para que el ticket siga mostrando un precio por
  // unidad creíble en vez de un número raro por el reparto.
  const discountRaw = discountUnit === "percent"
    ? subtotal * (Math.min(100, Math.max(0, discountInput)) / 100)
    : Math.max(0, discountInput);
  const discountAmount = Math.min(subtotal, Math.round(discountRaw));
  const discountFraction = subtotal > 0 ? discountAmount / subtotal : 0;
  const total = subtotal - discountAmount;
  const tradeInValue = tradeIn?.params.purchase_price ?? 0;
  const tradeInProblem = tradeIn ? validateTradeInValue(tradeInValue, total) : null;
  // Con canje, el cliente paga el total menos el valor del equipo que entrega.
  const toCollect = amountToCollect(total, tradeInValue);
  const receivedNum = Math.round(Number(receivedCash)) || 0;
  const vuelto = receivedNum - toCollect;
  const showVuelto = isCashLabel(paymentMethod) && receivedCash.trim() !== "" && toCollect > 0;

  const setQty = (id: string, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { ...prev[id], quantity: qty } };
    });
  };

  const setPrice = (id: string, price: number) => {
    setCart((prev) => ({ ...prev, [id]: { ...prev[id], unitPrice: price } }));
  };

  const removeLine = (id: string) => {
    setCart((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const close = () => {
    onOpenChange(false);
    setCompletedSale(null);
    setPaymentMethod("Efectivo");
    setDiscountValue("");
    setDiscountUnit("percent");
    setReceivedCash("");
    setTradeIn(null);
    setWarrantyDays(DEFAULT_DEVICE_WARRANTY_DAYS);
    setBuyerName("");
    setBuyerPhone("");
  };

  const checkout = async () => {
    if (!user || !companyId) return;
    if (lines.length === 0) return;
    const overStock = lines.find((l) => l.quantity > l.product.stock);
    if (overStock) {
      toast.error(`Solo hay ${overStock.product.stock} de "${overStock.product.name}" en stock`);
      return;
    }
    setLoading(true);
    try {
      if (await cashGate.check()) {
        toast.error("La caja de hoy no está abierta. Abrila desde Caja para poder vender.");
        return;
      }
      const saleGroupId = crypto.randomUUID();
      // El descuento queda "adentro" del precio unitario vendido, así
      // Reportes (que suma quantity*unit_price) ya refleja la venta real
      // sin tocar nada del lado del cálculo de ingresos/ganancia.
      const finalPrice = (l: (typeof lines)[number]) =>
        discountFraction > 0 ? Math.round(l.unitPrice * (1 - discountFraction)) : l.unitPrice;

      // La garantía y los datos del comprador solo aplican a los equipos: el
      // servidor los descarta en cualquier otra línea.
      const warranty = hasDevice
        ? {
            warranty_days: clampWarrantyDays(warrantyDays),
            customer_name: buyerName.trim() || null,
            customer_phone: buyerPhone.trim() || null,
          }
        : { warranty_days: null, customer_name: null, customer_phone: null };

      type InsertedRow = {
        id: string; product_name: string; quantity: number; unit_price: number; payment_method: string | null;
        created_at: string; branch_id: string | null;
        imei: string | null; warranty_days: number | null; customer_name: string | null; customer_phone: string | null;
      };
      let inserted: InsertedRow[];
      let tradeInInfo: CompletedCartSale["trade_in"] = null;

      if (tradeIn) {
        const problem = validateTradeInValue(tradeInValue, total);
        if (problem) { toast.error(problem); return; }
        // Venta y equipo recibido en una sola transacción: si algo falla no queda
        // una venta sin su canje ni un equipo en el catálogo sin su venta.
        const { data, error } = await (supabase as any).rpc("register_sale_with_trade_in", {
          p: buildTradeInSaleParams({
            saleGroupId,
            paymentMethod,
            lines: lines.map((l) => ({ inventory_item_id: l.id, quantity: l.quantity, unit_price: finalPrice(l) })),
            draft: tradeIn,
            warranty,
          }),
        });
        if (error) throw error;
        const result = data as { rows: InsertedRow[]; purchase: { purchase_id: string; receipt_number: string; branch_id: string | null } };
        inserted = result.rows ?? [];
        const params = tradeIn.params;
        tradeInInfo = {
          device_name: params.device_name,
          value: params.purchase_price,
          record: {
            id: result.purchase.purchase_id,
            receipt_number: result.purchase.receipt_number,
            created_at: inserted[0]?.created_at ?? new Date().toISOString(),
            kind: "canje",
            sale_group_id: saleGroupId,
            branch_id: result.purchase.branch_id,
            device_name: params.device_name,
            imei: params.imei,
            battery_health: params.battery_health,
            seller_name: params.seller_name,
            seller_cedula: params.seller_cedula,
            seller_phone: params.seller_phone || null,
            purchase_price: params.purchase_price,
            payment_method: "Canje",
            reason: params.reason || null,
            checklist: params.checklist,
            accessories: params.accessories,
            notes: params.notes || null,
          },
        };
      } else {
        const rows = lines.map((l) => ({
          company_id: companyId,
          inventory_item_id: l.id,
          product_name: l.product.name,
          quantity: l.quantity,
          unit_price: finalPrice(l),
          unit_cost: l.product.cost_price,
          payment_method: paymentMethod,
          created_by: user.id,
          sale_group_id: saleGroupId,
          ...warranty,
        }));
        const { data, error } = await (supabase as any)
          .from("product_sales")
          .insert(rows)
          .select("id, product_name, quantity, unit_price, payment_method, created_at, branch_id, imei, warranty_days, customer_name, customer_phone");
        if (error) throw error;
        inserted = (data as InsertedRow[]) ?? [];
      }

      toast.success(`Venta registrada: ${formatPYG(total)}`);
      const buyerRow = inserted.find((r) => r.customer_name || r.customer_phone);
      setCompletedSale({
        id: saleGroupId,
        created_at: inserted[0]?.created_at ?? new Date().toISOString(),
        payment_method: paymentMethod,
        branch_id: inserted[0]?.branch_id ?? null,
        items: inserted.map((r) => ({
          product_name: r.product_name,
          quantity: r.quantity,
          unit_price: r.unit_price,
          imei: r.imei,
          warranty_days: r.warranty_days,
        })),
        customer_name: buyerRow?.customer_name ?? null,
        customer_phone: buyerRow?.customer_phone ?? null,
        trade_in: tradeInInfo,
      });
      setTradeIn(null);
      setCart({});
      onSold?.();
    } catch (e: any) {
      toast.error(e.message || "Error al registrar la venta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        {completedSale ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" /> Venta registrada
              </SheetTitle>
              <SheetDescription>
                {completedSale.items.length} producto{completedSale.items.length !== 1 ? "s" : ""} ·{" "}
                {formatPYG(completedSale.items.reduce((s, i) => s + i.quantity * i.unit_price, 0))}
              </SheetDescription>
            </SheetHeader>
            {completedSale.trade_in && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm" data-testid="trade-in-done">
                <div className="font-medium text-foreground">Equipo recibido en canje</div>
                <div className="text-muted-foreground">
                  {completedSale.trade_in.device_name} · {formatPYG(completedSale.trade_in.value)}
                  {completedSale.trade_in.record ? ` · ${completedSale.trade_in.record.receipt_number}` : ""}
                </div>
                <div className="text-muted-foreground">
                  Cobrado: {formatPYG(Math.max(0, completedSale.items.reduce((s, i) => s + i.quantity * i.unit_price, 0) - completedSale.trade_in.value))}
                </div>
                {completedSale.trade_in.record && onPrintTradeIn && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-2"
                    onClick={() => completedSale.trade_in?.record && onPrintTradeIn(completedSale.trade_in.record)}
                  >
                    <Printer className="h-4 w-4" /> Imprimir comprobante del canje
                  </Button>
                )}
              </div>
            )}
            {completedSale.items.some((i) => i.warranty_days !== null && i.warranty_days !== undefined) && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm" data-testid="warranty-done">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Garantía registrada
                </div>
                {completedSale.items
                  .filter((i) => i.warranty_days !== null && i.warranty_days !== undefined)
                  .map((i, idx) => (
                    <div key={idx} className="text-muted-foreground">
                      {i.product_name}{i.imei ? ` · IMEI ${i.imei}` : ""} · {warrantyDocumentLine(completedSale.created_at, i.warranty_days)}
                    </div>
                  ))}
                {(completedSale.customer_name || completedSale.customer_phone) && (
                  <div className="text-muted-foreground">
                    Comprador: {[completedSale.customer_name, completedSale.customer_phone].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            )}
            <SheetFooter className="mt-auto">
              <Button variant="outline" onClick={close}>Cerrar</Button>
              {onReceiptRequest && (
                <Button variant="outline" onClick={() => onReceiptRequest(completedSale)} className="gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" /> Enviar por WhatsApp
                </Button>
              )}
              <Button onClick={() => onPrintRequest?.(completedSale)} className="gap-2">
                <Printer className="h-4 w-4" /> Imprimir ticket
              </Button>
            </SheetFooter>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" /> Carrito
              </SheetTitle>
              <SheetDescription>
                {lines.length === 0 ? "Todavía no agregaste productos." : `${lines.length} producto${lines.length !== 1 ? "s" : ""} en el carrito`}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-3 overflow-y-auto py-2">
              {lines.map((l) => (
                <div key={l.id} className="space-y-2 rounded-md border border-border bg-muted/30 p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{l.product.name}</div>
                    <button
                      type="button"
                      onClick={() => removeLine(l.id)}
                      aria-label={`Quitar ${l.product.name} del carrito`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Gs.</span>
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={l.unitPrice}
                        onChange={(e) => setPrice(l.id, parseFloat(e.target.value) || 0)}
                        className="h-9 w-24 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                    <QuantityStepper value={l.quantity} max={l.product.stock} onChange={(q) => setQty(l.id, q)} size="sm" />
                    <div className="w-20 shrink-0 text-right text-sm font-semibold">
                      {formatPYG(l.quantity * l.unitPrice)}
                    </div>
                  </div>
                </div>
              ))}

              {hasDevice && (
                <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3" data-testid="device-warranty-section">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Garantía del equipo
                  </div>
                  <WarrantySelector value={warrantyDays} onChange={(d) => setWarrantyDays(clampWarrantyDays(d))} className="w-full" />
                  <div className="grid gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="cart-buyer-name" className="text-xs">Comprador (opcional)</Label>
                      <Input
                        id="cart-buyer-name"
                        value={buyerName}
                        maxLength={120}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Nombre y apellido"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cart-buyer-phone" className="text-xs">WhatsApp del comprador (opcional)</Label>
                      <Input
                        id="cart-buyer-phone"
                        type="tel"
                        inputMode="tel"
                        value={buyerPhone}
                        maxLength={40}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        placeholder="0981 123 456"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Queda guardado con el IMEI: después la garantía se consulta en Productos › Garantías.
                  </p>
                </div>
              )}
            </div>

            {lines.length > 0 && (
              <>
                <div className="space-y-3 border-t border-border pt-3">
                  <div className="space-y-2">
                    <Label htmlFor="cart-payment">Medio de pago</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger id="cart-payment"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentMethodPresets.map((m) => (
                          <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cart-discount">Descuento (opcional)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="cart-discount"
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
                  </div>

                  {discountAmount > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{formatPYG(subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-secondary">
                        <span>Descuento</span>
                        <span>-{formatPYG(discountAmount)}</span>
                      </div>
                    </>
                  )}

                  {tradeIn ? (
                    <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-sm" data-testid="trade-in-card">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <ArrowLeftRight className="h-4 w-4 text-primary" /> Equipo recibido
                        </span>
                        <span className="font-semibold text-secondary">-{formatPYG(tradeInValue)}</span>
                      </div>
                      <div className="truncate text-muted-foreground">
                        {tradeIn.params.device_name} · IMEI {tradeIn.params.imei}
                      </div>
                      {tradeInProblem && <p className="text-xs text-destructive">{tradeInProblem}</p>}
                      <div className="flex gap-2 pt-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => setTradeInOpen(true)}>Editar</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setTradeIn(null)}>Quitar</Button>
                      </div>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setTradeInOpen(true)}>
                      <ArrowLeftRight className="h-4 w-4" /> Recibir un equipo como parte de pago
                    </Button>
                  )}

                  <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-xl font-bold text-primary">{formatPYG(total)}</span>
                  </div>
                  {tradeIn && !tradeInProblem && (
                    <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
                      <span className="text-sm text-muted-foreground">A cobrar (total − equipo recibido)</span>
                      <span className="text-xl font-bold text-primary" data-testid="to-collect">{formatPYG(toCollect)}</span>
                    </div>
                  )}

                  {isCashLabel(paymentMethod) && toCollect > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="cart-received">¿Con cuánto te paga? (Gs.)</Label>
                      <Input
                        id="cart-received"
                        type="number"
                        min={0}
                        step="1"
                        value={receivedCash}
                        onChange={(e) => setReceivedCash(e.target.value)}
                        placeholder="Ej: 50000"
                      />
                      {showVuelto && (
                        <div className={cn(
                          "flex items-center justify-between rounded-md border px-4 py-2 text-sm font-semibold",
                          vuelto >= 0 ? "border-secondary/40 bg-secondary/10 text-secondary" : "border-destructive/40 bg-destructive/10 text-destructive"
                        )}>
                          <span>{vuelto >= 0 ? "Vuelto" : "Falta"}</span>
                          <span className="text-lg">{formatPYG(Math.abs(vuelto))}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <SheetFooter className="flex-col gap-2 sm:flex-col sm:justify-start sm:space-x-0">
                  {cashGate.blocked && <CashRegisterRequiredNotice what="vender" />}
                  <Button onClick={checkout} disabled={loading || cashGate.blocked || !!tradeInProblem} size="lg" className="w-full">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar venta
                  </Button>
                </SheetFooter>
              </>
            )}
          </>
        )}
      </SheetContent>
      <BuyDeviceDialog
        open={tradeInOpen}
        onOpenChange={setTradeInOpen}
        mode="canje"
        maxValue={total}
        initialForm={tradeIn?.form ?? null}
        onCollect={setTradeIn}
      />
    </Sheet>
  );
}
