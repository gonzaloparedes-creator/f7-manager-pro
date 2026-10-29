import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, HandCoins, ShoppingCart, Smartphone, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { DeviceReservation } from "@/lib/reservations";
import {
  buildDeviceAlerts,
  hubKpis,
  monthStartIso,
  type HubAlertTarget,
  type HubItem,
  type HubSale,
} from "@/lib/devicesHub";

// Resumen de los equipos del negocio: cuánta plata hay parada, qué se vende, qué
// está reservado, cómo va el mes y qué datos faltan. Las cifras de costo y de
// ganancia se muestran solo a quien puede verlas.
export default function DevicesHub({
  items,
  reservations,
  scrapWithoutParts,
  canViewStock,
  canViewCosts,
  isAdmin,
  onRegisterDevice,
  onBuyForResale,
  onBuyForParts,
  onGoCatalog,
  onAlert,
}: {
  items: HubItem[];
  reservations: DeviceReservation[];
  scrapWithoutParts: number;
  canViewStock: boolean;
  canViewCosts: boolean;
  isAdmin: boolean;
  onRegisterDevice: () => void;
  onBuyForResale: () => void;
  onBuyForParts: () => void;
  onGoCatalog: () => void;
  onAlert: (target: HubAlertTarget) => void;
}) {
  const { companyId } = useCompany();
  const [monthSales, setMonthSales] = useState<HubSale[] | null>(null);

  // El tab se desmonta al cambiar de pestaña, así que al volver se recalcula;
  // el catálogo también se recarga después de cada venta, y con eso cambia `items`.
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (supabase as any)
      .from("product_sales")
      .select("quantity, unit_price, unit_cost, inventory_items!inner(is_device)")
      .eq("company_id", companyId)
      .eq("inventory_items.is_device", true)
      .gte("created_at", monthStartIso())
      .limit(1000)
      .then(({ data, error }: { data: HubSale[] | null; error: unknown }) => {
        if (cancelled || error) return;
        setMonthSales(data ?? []);
      });
    return () => { cancelled = true; };
  }, [companyId, items]);

  const activeReservations = useMemo(() => reservations.filter((r) => r.status === "activa"), [reservations]);

  const kpis = useMemo(
    () => hubKpis({ items, activeReservations, monthSales: monthSales ?? [] }),
    [items, activeReservations, monthSales]
  );
  const alerts = useMemo(
    () => buildDeviceAlerts({ items, activeReservations, scrapWithoutParts, canViewStock }),
    [items, activeReservations, scrapWithoutParts, canViewStock]
  );

  const monthLabel = new Date().toLocaleDateString("es-PY", { month: "long" });

  return (
    <div className="space-y-4" data-testid="devices-hub">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">En stock</div>
          <div className="mt-1 text-2xl font-bold" data-testid="hub-in-stock">{kpis.inStock.count}</div>
          <div className="text-[11px] text-muted-foreground">
            {canViewStock && canViewCosts ? `${formatMoney(kpis.inStock.cost)} de costo parado` : "equipos disponibles"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">A la venta</div>
          <div className="mt-1 text-2xl font-bold" data-testid="hub-for-sale">{kpis.forSale.count}</div>
          <div className="text-[11px] text-muted-foreground">{formatMoney(kpis.forSale.potential)} de venta potencial</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Reservados</div>
          <div className="mt-1 text-2xl font-bold" data-testid="hub-reserved">{kpis.reserved.count}</div>
          <div className="text-[11px] text-muted-foreground">
            {kpis.reserved.count > 0 ? `${formatMoney(kpis.reserved.deposits)} en señas` : "sin señas pendientes"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Vendidos en {monthLabel}</div>
          <div className="mt-1 text-2xl font-bold text-success" data-testid="hub-sold-month">
            {monthSales === null ? "—" : kpis.soldMonth.count}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {monthSales === null
              ? "Cargando..."
              : isAdmin
                ? `${formatMoney(kpis.soldMonth.profit)} de ganancia${kpis.soldMonth.profitComplete ? "" : " (parcial)"}`
                : `${formatMoney(kpis.soldMonth.revenue)} vendidos`}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Acciones rápidas</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" className="justify-start gap-2" onClick={onRegisterDevice} data-testid="hub-register">
              <Smartphone className="h-4 w-4" /> Registrar equipo
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={onBuyForResale} data-testid="hub-buy">
              <HandCoins className="h-4 w-4" /> Comprar a cliente
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={onBuyForParts} data-testid="hub-buy-parts">
              <Wrench className="h-4 w-4" /> Comprar para piezas
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={onGoCatalog} data-testid="hub-sell">
              <ShoppingCart className="h-4 w-4" /> Vender un equipo
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Atención</h3>
          {alerts.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="hub-all-good">
              <CheckCircle2 className="h-4 w-4 text-success" /> Todo en orden con tus equipos.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {alerts.map((a) => (
                <li key={a.key}>
                  <button
                    type="button"
                    data-testid={`hub-alert-${a.key}`}
                    onClick={() => onAlert(a.target)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md border border-secondary/30 bg-secondary/10 px-3 py-2 text-left text-sm text-secondary",
                      "transition-colors hover:bg-secondary/20"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" /> {a.text}
                    </span>
                    <span className="shrink-0 text-xs font-medium">Ver →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
