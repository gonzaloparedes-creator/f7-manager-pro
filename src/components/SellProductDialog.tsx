import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";
import { Loader2, ShoppingCart, CheckCircle2, Printer } from "lucide-react";
import { formatPYG } from "@/lib/orders";

type SellableProduct = {
  id: string;
  name: string;
  stock: number;
  selling_price: number;
  cost_price: number;
};

export type CompletedSale = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  payment_method: string | null;
  created_at: string;
  branch_id: string | null;
};

export default function SellProductDialog({
  open,
  onOpenChange,
  product,
  onSold,
  onPrintRequest,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: SellableProduct | null;
  onSold?: () => void;
  onPrintRequest?: (sale: CompletedSale) => void;
}) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [loading, setLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);

  useEffect(() => {
    if (product) {
      setQuantity("1");
      setUnitPrice(String(product.selling_price));
      setPaymentMethod("Efectivo");
      setCompletedSale(null);
    }
  }, [product, open]);

  const qty = parseInt(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const total = qty * price;
  const overStock = !!product && qty > product.stock;

  const submit = async () => {
    if (!user || !companyId || !product) return;
    if (qty <= 0) { toast.error("La cantidad debe ser mayor a 0"); return; }
    if (overStock) { toast.error(`Solo hay ${product.stock} en stock`); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("product_sales")
        .insert({
          company_id: companyId,
          inventory_item_id: product.id,
          product_name: product.name,
          quantity: qty,
          unit_price: price,
          unit_cost: product.cost_price,
          payment_method: paymentMethod,
          created_by: user.id,
        })
        .select("id, product_name, quantity, unit_price, payment_method, created_at, branch_id")
        .single();
      if (error) throw error;
      toast.success(`Venta registrada: ${formatPYG(total)}`);
      setCompletedSale(data as CompletedSale);
      onSold?.();
    } catch (e: any) {
      toast.error(e.message || "Error al registrar la venta");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    onOpenChange(false);
    setCompletedSale(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-sm">
        {completedSale ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="h-5 w-5" /> Venta registrada
              </DialogTitle>
              <DialogDescription>
                {completedSale.product_name} · {formatPYG(completedSale.quantity * Number(completedSale.unit_price || 0))}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={close}>Cerrar</Button>
              <Button onClick={() => onPrintRequest?.(completedSale)} className="gap-2">
                <Printer className="h-4 w-4" /> Imprimir ticket
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" /> Vender {product?.name}
              </DialogTitle>
              <DialogDescription>
                Stock disponible: {product?.stock ?? 0}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="sale-qty">Cantidad</Label>
                  <Input
                    id="sale-qty"
                    type="number"
                    min={1}
                    max={product?.stock ?? undefined}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sale-price">Precio unitario (Gs.)</Label>
                  <Input
                    id="sale-price"
                    type="number"
                    min={0}
                    step="1"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sale-payment">Medio de pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="sale-payment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {overStock && (
                <p className="text-sm font-medium text-destructive">
                  Solo hay {product?.stock} en stock.
                </p>
              )}

              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold text-primary">{formatPYG(total)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={loading}>Cancelar</Button>
              <Button onClick={submit} disabled={loading || overStock || qty <= 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar venta
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
