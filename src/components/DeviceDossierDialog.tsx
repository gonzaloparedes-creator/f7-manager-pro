import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Lock, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  printDossier,
  type DossierDevice,
  type DossierHistory,
  type DossierVariant,
} from "@/lib/deviceDossier";
import type { Product } from "@/pages/Products";

const EMPTY_HISTORY: DossierHistory = { purchases: [], reservations: [], sales: [] };

// Se arma a mano (en vez de pasar el Product entero) para que el mínimo de negociación
// nunca llegue al armado del documento.
function toDossierDevice(p: Product): DossierDevice {
  return {
    name: p.name,
    imei: p.imei,
    battery_health: p.battery_health ?? null,
    origin: p.origin ?? null,
    selling_price: p.selling_price,
    cost_price: p.cost_price,
    purchase_cost: p.purchase_cost,
    repair_cost: p.repair_cost,
    repair_details: p.repair_details,
    notes: p.notes,
    image_url: p.image_url,
    stock: p.stock,
    created_at: p.created_at ?? null,
  };
}

export default function DeviceDossierDialog({
  device,
  onOpenChange,
  companyId,
  canViewCosts,
  businessName,
  branchName,
  categoryLabel,
}: {
  device: Product | null;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  canViewCosts: boolean;
  businessName: string | null;
  branchName: string | null;
  categoryLabel: string | null;
}) {
  const [history, setHistory] = useState<DossierHistory | null>(null);
  const [loadError, setLoadError] = useState(false);

  const deviceId = device?.id;
  useEffect(() => {
    setHistory(null);
    setLoadError(false);
    if (!deviceId || !companyId || !canViewCosts) return;
    let cancelled = false;

    // Siempre filtrado por empresa además de por equipo (las políticas RLS ya lo exigen).
    const load = async () => {
      const db = supabase as any;
      const [purchases, reservations, sales] = await Promise.all([
        db.from("device_purchases")
          .select("receipt_number, kind, created_at, purchase_price")
          .eq("company_id", companyId).eq("inventory_item_id", deviceId).order("created_at"),
        db.from("device_reservations")
          .select("receipt_number, customer_name, status, created_at, resolved_at, agreed_price, deposit_amount, refunded_amount, retained_amount, expires_on")
          .eq("company_id", companyId).eq("inventory_item_id", deviceId).order("created_at"),
        db.from("product_sales")
          .select("created_at, quantity, unit_price, unit_cost, payment_method, warranty_days, customer_name, reservation_deposit")
          .eq("company_id", companyId).eq("inventory_item_id", deviceId).order("created_at"),
      ]);
      if (cancelled) return;
      if (purchases.error || reservations.error || sales.error) {
        setLoadError(true);
        return;
      }
      setHistory({
        purchases: purchases.data ?? [],
        reservations: reservations.data ?? [],
        sales: sales.data ?? [],
      });
    };
    load().catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [deviceId, companyId, canViewCosts]);

  if (!device) return null;

  const print = (variant: DossierVariant) => {
    if (variant === "interno" && (!canViewCosts || !history)) return;
    try {
      printDossier(toDossierDevice(device), variant === "interno" && history ? history : EMPTY_HISTORY, {
        variant,
        businessName,
        branchName,
        categoryLabel,
      });
    } catch {
      toast.error("No se pudo abrir la impresión. Probá de nuevo.");
    }
  };

  return (
    <Dialog open={!!device} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Dossier del equipo</DialogTitle>
          <DialogDescription>{device.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full items-start justify-start gap-3 whitespace-normal px-4 py-3 text-left"
            onClick={() => print("cliente")}
            data-testid="dossier-cliente"
          >
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span className="space-y-0.5">
              <span className="block font-semibold">Ficha para el cliente</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Foto, precio, IMEI y batería. Sin costos ni historial: es para mostrar o mandar.
              </span>
            </span>
          </Button>

          {canViewCosts && (
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full items-start justify-start gap-3 whitespace-normal px-4 py-3 text-left"
              disabled={!history}
              onClick={() => print("interno")}
              data-testid="dossier-interno"
            >
              {history || loadError ? (
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
              ) : (
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
              )}
              <span className="space-y-0.5">
                <span className="block font-semibold">Dossier interno</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Costos, ganancia, estado e historial completo del equipo. Solo para uso interno.
                </span>
              </span>
            </Button>
          )}

          {canViewCosts && loadError && (
            <p className="text-sm text-destructive" data-testid="dossier-error">
              No se pudo cargar el historial del equipo, así que el dossier interno no está disponible. Cerrá y volvé a abrir para reintentar.
            </p>
          )}
        </div>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Printer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Se abre el cuadro de impresión del navegador: para tener un archivo, elegí «Guardar como PDF».
        </p>
      </DialogContent>
    </Dialog>
  );
}
