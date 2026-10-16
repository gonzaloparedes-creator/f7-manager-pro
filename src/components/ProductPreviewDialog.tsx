import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, ShoppingCart, AlertTriangle, CalendarClock, Eye, EyeOff, FileText, Pencil, Trash2, X } from "lucide-react";
import QuantityStepper from "@/components/QuantityStepper";
import { formatPYG } from "@/lib/orders";
import { balanceDue, depositOf, displayDate, expiryText, type DeviceReservation } from "@/lib/reservations";
import { isLowBattery, originLabel } from "@/lib/deviceSpecs";
import { toMinPrice } from "@/lib/devicePricing";
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
  reservation,
  onAddToCart,
  onReserve,
  onSellReservation,
  onDossier,
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
  /** Reserva activa de este equipo, si la tiene: solo se puede vender desde la reserva. */
  reservation?: DeviceReservation;
  onAddToCart: () => void;
  onReserve?: () => void;
  onSellReservation?: () => void;
  onDossier?: () => void;
  onUpdateQty: (qty: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showMinPrice, setShowMinPrice] = useState(false);
  const productId = product?.id;
  useEffect(() => { setShowMinPrice(false); }, [productId]);

  if (!product) return null;
  const outOfStock = product.stock <= 0;
  const lowStock = canViewStock && !outOfStock && product.stock <= product.min_stock_alert;
  const batteryText = product.battery_health != null ? `${product.battery_health}%` : null;
  const originText = originLabel(product.origin);
  const minPrice = product.is_device ? toMinPrice(product.min_price) : null;

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

          {product.is_device && (product.imei || batteryText || originText || minPrice !== null || product.repair_details || product.notes) && (
            <div className="space-y-1.5 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
              {product.imei && (
                <div><span className="text-muted-foreground">IMEI: </span><span className="font-medium">{product.imei}</span></div>
              )}
              {batteryText && (
                <div data-testid="preview-battery">
                  <span className="text-muted-foreground">Batería: </span>
                  <span className={isLowBattery(product.battery_health) ? "font-medium text-secondary" : "font-medium"}>{batteryText}</span>
                </div>
              )}
              {originText && (
                <div data-testid="preview-origin"><span className="text-muted-foreground">Origen: </span>{originText}</div>
              )}
              {minPrice !== null && (
                <div className="flex items-center gap-1.5" data-testid="preview-min-price">
                  <span className="text-muted-foreground">Mínimo de negociación: </span>
                  <span className="font-medium" data-testid="preview-min-price-value">
                    {showMinPrice ? formatPYG(minPrice) : "Gs. ••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMinPrice((v) => !v)}
                    aria-label={showMinPrice ? "Ocultar el mínimo de negociación" : "Ver el mínimo de negociación"}
                    aria-pressed={showMinPrice}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showMinPrice ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}
              {product.repair_details && (
                <div><span className="text-muted-foreground">Repuestos: </span>{product.repair_details}</div>
              )}
              {product.notes && (
                <div className="whitespace-pre-wrap"><span className="text-muted-foreground">Notas: </span>{product.notes}</div>
              )}
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

          {reservation && (
            <div className="space-y-1 rounded-md border border-secondary/40 bg-secondary/10 px-3 py-2.5 text-sm" data-testid="preview-reservation">
              <div className="flex items-center gap-1.5 font-medium text-secondary">
                <CalendarClock className="h-4 w-4" /> Reservado · {reservation.receipt_number}
              </div>
              <div>
                Para <span className="font-medium">{reservation.customer_name}</span>
                {" · "}{expiryText(reservation.expires_on)} ({displayDate(reservation.expires_on)})
              </div>
              <div className="text-muted-foreground">
                Precio {formatPYG(Number(reservation.agreed_price))}
                {depositOf(reservation) > 0
                  ? ` · seña ${formatPYG(depositOf(reservation))} · saldo ${formatPYG(balanceDue(reservation))}`
                  : " · sin seña"}
              </div>
            </div>
          )}

          {cartLine ? (
            <div className="flex items-center justify-between gap-2">
              <QuantityStepper value={cartLine.quantity} max={product.stock} onChange={onUpdateQty} />
              <span className="text-base font-semibold text-foreground">
                {formatPYG(cartLine.quantity * cartLine.unitPrice)}
              </span>
            </div>
          ) : reservation ? (
            <Button className="w-full gap-2" size="lg" onClick={onSellReservation}>
              <ShoppingCart className="h-4 w-4" /> Vender reserva
            </Button>
          ) : (
            <div className="space-y-2">
              <Button className="w-full gap-2" size="lg" disabled={outOfStock} onClick={onAddToCart}>
                <ShoppingCart className="h-4 w-4" /> Agregar al carrito
              </Button>
              {product.is_device && !outOfStock && onReserve && (
                <Button variant="outline" className="w-full gap-2" onClick={onReserve}>
                  <CalendarClock className="h-4 w-4" /> Reservar
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 border-t border-border p-4 sm:justify-start">
          <Button variant="outline" className="gap-2" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          {product.is_device && onDossier && (
            <Button variant="outline" className="gap-2" onClick={onDossier} data-testid="preview-dossier">
              <FileText className="h-4 w-4" /> Dossier
            </Button>
          )}
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
