import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, ShoppingCart, AlertTriangle, EyeOff, Pencil, Trash2, X } from "lucide-react";
import QuantityStepper from "@/components/QuantityStepper";
import { formatPYG } from "@/lib/orders";
import type { Product } from "@/pages/Products";
import type { CartLine } from "@/components/CartSheet";

export default function ProductPreviewDialog({
  product,
  onOpenChange,
  categoryLabel,
  subcategoryLabel,
  branchLabel,
  canViewStock,
  canDelete,
  cartLine,
  onAddToCart,
  onUpdateQty,
  onEdit,
  onDelete,
}: {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  categoryLabel: string | null;
  subcategoryLabel: string | null;
  branchLabel: string | null;
  canViewStock: boolean;
  canDelete: boolean;
  cartLine: CartLine | undefined;
  onAddToCart: () => void;
  onUpdateQty: (qty: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!product) return null;
  const outOfStock = product.stock <= 0;
  const lowStock = canViewStock && !outOfStock && product.stock <= product.min_stock_alert;

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-w-md overflow-hidden p-0 sm:max-w-lg">
        <div className="relative">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-64 w-full object-cover sm:h-80"
            />
          ) : (
            <div className="flex h-64 items-center justify-center bg-muted sm:h-80">
              <ShoppingBag className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
          <DialogClose className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white ring-offset-background transition-colors hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </DialogClose>
        </div>

        <div className="space-y-4 p-6 pt-4">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-xl leading-snug">{product.name}</DialogTitle>
            <DialogDescription className="sr-only">Detalle del producto</DialogDescription>
          </DialogHeader>
          <div className="text-2xl font-bold text-primary">{formatPYG(product.selling_price)}</div>

          {(categoryLabel || subcategoryLabel || branchLabel) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {categoryLabel && <Badge variant="outline">{categoryLabel}</Badge>}
              {subcategoryLabel && <Badge variant="secondary">{subcategoryLabel}</Badge>}
              {branchLabel && <Badge variant="secondary">{branchLabel}</Badge>}
            </div>
          )}

          <div>
            {outOfStock ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Sin stock
              </Badge>
            ) : lowStock ? (
              <Badge variant="outline" className="gap-1 border-secondary/40 text-secondary">
                <AlertTriangle className="h-3 w-3" /> Bajo stock: {product.stock}
              </Badge>
            ) : !canViewStock ? (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <EyeOff className="h-3 w-3" /> Stock oculto
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Stock: {product.stock}</span>
            )}
          </div>

          {cartLine ? (
            <div className="flex items-center justify-between gap-2">
              <QuantityStepper value={cartLine.quantity} max={product.stock} onChange={onUpdateQty} />
              <span className="text-base font-semibold text-foreground">
                {formatPYG(cartLine.quantity * cartLine.unitPrice)}
              </span>
            </div>
          ) : (
            <Button className="w-full gap-2" size="lg" disabled={outOfStock} onClick={onAddToCart}>
              <ShoppingCart className="h-4 w-4" /> Agregar al carrito
            </Button>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border p-4 sm:justify-start">
          <Button variant="outline" className="gap-2" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          {canDelete && (
            <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
