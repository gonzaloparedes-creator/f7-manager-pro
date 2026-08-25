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
import { Loader2, ShoppingCart, CheckCircle2, Printer, Trash2 } from "lucide-react";
import { formatPYG } from "@/lib/orders";
import QuantityStepper from "@/components/QuantityStepper";

export type CartLine = { quantity: number; unitPrice: number };
export type Cart = Record<string, CartLine>;

export type CompletedCartSale = {
  id: string;
  created_at: string;
  payment_method: string | null;
  branch_id: string | null;
  items: { product_name: string; quantity: number; unit_price: number }[];
};

type CartProduct = { id: string; name: string; stock: number; cost_price: number };

export default function CartSheet({
  open,
  onOpenChange,
  products,
  cart,
  setCart,
  onSold,
  onPrintRequest,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: CartProduct[];
  cart: Cart;
  setCart: React.Dispatch<React.SetStateAction<Cart>>;
  onSold?: () => void;
  onPrintRequest?: (sale: CompletedCartSale) => void;
}) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [loading, setLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedCartSale | null>(null);

  const lines = Object.entries(cart)
    .map(([id, line]) => ({ id, product: products.find((p) => p.id === id), ...line }))
    .filter((l): l is typeof l & { product: CartProduct } => !!l.product);

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

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
      const saleGroupId = crypto.randomUUID();
      const rows = lines.map((l) => ({
        company_id: companyId,
        inventory_item_id: l.id,
        product_name: l.product.name,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        unit_cost: l.product.cost_price,
        payment_method: paymentMethod,
        created_by: user.id,
        sale_group_id: saleGroupId,
      }));
      const { data, error } = await (supabase as any)
        .from("product_sales")
        .insert(rows)
        .select("id, product_name, quantity, unit_price, payment_method, created_at, branch_id");
      if (error) throw error;

      const inserted = (data as { id: string; product_name: string; quantity: number; unit_price: number; payment_method: string | null; created_at: string; branch_id: string | null }[]) ?? [];
      toast.success(`Venta registrada: ${formatPYG(total)}`);
      setCompletedSale({
        id: saleGroupId,
        created_at: inserted[0]?.created_at ?? new Date().toISOString(),
        payment_method: paymentMethod,
        branch_id: inserted[0]?.branch_id ?? null,
        items: inserted.map((r) => ({ product_name: r.product_name, quantity: r.quantity, unit_price: r.unit_price })),
      });
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
            <SheetFooter className="mt-auto">
              <Button variant="outline" onClick={close}>Cerrar</Button>
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
            </div>

            {lines.length > 0 && (
              <>
                <div className="space-y-3 border-t border-border pt-3">
                  <div className="space-y-2">
                    <Label htmlFor="cart-payment">Medio de pago</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger id="cart-payment"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Efectivo">Efectivo</SelectItem>
                        <SelectItem value="Transferencia">Transferencia</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-xl font-bold text-primary">{formatPYG(total)}</span>
                  </div>
                </div>
                <SheetFooter>
                  <Button onClick={checkout} disabled={loading} size="lg" className="w-full">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar venta
                  </Button>
                </SheetFooter>
              </>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
