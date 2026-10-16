import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HandCoins, Printer, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPYG } from "@/lib/orders";
import { partAvailability, type PartAvailability, type ScrapDevice, type ScrapTotals } from "@/lib/scrapDevice";
import type { DevicePurchaseRecord } from "@/lib/devicePurchase";

const AVAILABILITY: Record<PartAvailability, { label: string; className: string }> = {
  en_stock: { label: "En inventario", className: "border-success/40 text-success" },
  usada: { label: "Usada", className: "text-muted-foreground" },
  eliminada: { label: "Quitada de Inventario", className: "text-muted-foreground" },
};

// Equipos comprados para desarmar y las piezas que se les sacaron. El dinero que
// se pagó por cada equipo se reparte entre sus piezas, que quedan en Inventario.
export default function ScrapDevicesPanel({
  devices,
  totals,
  loaded,
  branchName,
  onBuy,
  onExtract,
  onPrint,
}: {
  devices: ScrapDevice[];
  totals: ScrapTotals;
  loaded: boolean;
  branchName: (id: string | null) => string | null;
  onBuy: () => void;
  onExtract: (device: ScrapDevice) => void;
  onPrint: (record: DevicePurchaseRecord) => void;
}) {
  if (!loaded) return <p className="text-center text-sm text-muted-foreground">Cargando...</p>;

  if (devices.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center text-muted-foreground">
          <Wrench className="h-8 w-8" />
          <p className="max-w-md text-sm">
            Acá van los equipos que comprás para desarmar (pantalla rota, placa dañada, sin posibilidad de reparación).
            No entran al catálogo: les sacás las piezas y quedan como repuestos en Inventario.
          </p>
          <Button onClick={onBuy} data-testid="scrap-empty-buy">
            <HandCoins className="h-4 w-4" /> Comprar equipo para piezas
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Equipos en chatarra</div>
          <div className="mt-1 text-2xl font-bold" data-testid="scrap-count">{totals.count}</div>
          <div className="text-[11px] text-muted-foreground">{totals.partsCount} pieza{totals.partsCount !== 1 ? "s" : ""} cargada{totals.partsCount !== 1 ? "s" : ""}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Invertido</div>
          <div className="mt-1 text-2xl font-bold">{formatPYG(totals.invested)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Asignado a piezas</div>
          <div className="mt-1 text-2xl font-bold text-success">{formatPYG(totals.allocated)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Sin asignar</div>
          <div className={cn("mt-1 text-2xl font-bold", totals.unassigned > 0 && "text-secondary")}>{formatPYG(totals.unassigned)}</div>
          <div className="text-[11px] text-muted-foreground">Plata de equipos sin desarmar del todo</div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={onBuy}>
          <HandCoins className="h-4 w-4" /> Comprar equipo para piezas
        </Button>
      </div>

      <div className="space-y-3">
        {devices.map((d) => {
          const p = d.purchase;
          const branch = branchName(p.branch_id);
          return (
            <Card key={p.id} data-testid="scrap-device">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {p.device_name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{p.receipt_number}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleString("es-PY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {` · ${p.seller_name}`}
                      {p.imei ? ` · IMEI ${p.imei}` : ""}
                      {branch ? ` · ${branch}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-semibold text-foreground">{formatPYG(p.purchase_price)}</div>
                      <div className={cn("text-[11px]", d.unassigned > 0 ? "text-secondary" : "text-muted-foreground")}>
                        {d.unassigned > 0 ? `${formatPYG(d.unassigned)} sin asignar` : "Todo asignado"}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Reimprimir comprobante" onClick={() => onPrint(p)}>
                      <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                {d.parts.length === 0 ? (
                  <Badge variant="outline" className="border-secondary/50 bg-secondary/10 text-[11px] text-secondary">Sin piezas cargadas</Badge>
                ) : (
                  <ul className="space-y-1">
                    {d.parts.map((part) => {
                      const av = AVAILABILITY[partAvailability(part)];
                      return (
                        <li key={part.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm" data-testid="scrap-part">
                          <span className="min-w-0 truncate">{part.part_name}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge variant="outline" className={cn("text-[10px]", av.className)}>{av.label}</Badge>
                            <span className="text-muted-foreground">{formatPYG(part.allocated_cost)}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <Button size="sm" variant="outline" onClick={() => onExtract(d)} data-testid="extract-part">
                  <Wrench className="h-4 w-4" /> Sacar una pieza
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
