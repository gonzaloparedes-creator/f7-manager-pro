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
import { Loader2, ShoppingCart } from "lucide-react";
import { formatPYG } from "@/lib/orders";

type SellableProduct = {
  id: string;
  name: string;
  stock: number;
  selling_price: number;
  cost_price: number;
};

export default function SellProductDialog({
  open,
  onOpenChange,
  product,
  onSold,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: SellableProduct | null;
  onSold?: () => void;
}) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setQuantity("1");
      setUnitPrice(String(product.selling_price));
      setPaymentMethod("Efectivo");
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
      const { error } = await (supabase as any).from("product_sales").insert({
        company_id: companyId,
        inventory_item_id: product.id,
        product_name: product.name,
        quantity: qty,
        unit_price: price,
        unit_cost: product.cost_price,
        payment_method: paymentMethod,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success(`Venta registrada: ${formatPYG(total)}`);
      onOpenChange(false);
      onSold?.();
    } catch (e: any) {
      toast.error(e.message || "Error al registrar la venta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || overStock || qty <= 0}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
