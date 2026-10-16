import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock, CalendarPlus, MessageCircle, ShoppingCart, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPYG } from "@/lib/orders";
import {
  balanceDue,
  depositOf,
  displayDate,
  expiryText,
  isOverdue,
  statusLabel,
  type DeviceReservation,
} from "@/lib/reservations";

export default function ReservationsPanel({
  reservations,
  branchName,
  onSell,
  onExtend,
  onCancel,
  onWhatsApp,
}: {
  reservations: DeviceReservation[];
  branchName: (id: string | null) => string | null;
  onSell: (r: DeviceReservation) => void;
  onExtend: (r: DeviceReservation) => void;
  onCancel: (r: DeviceReservation) => void;
  onWhatsApp: (r: DeviceReservation) => void;
}) {
  const now = new Date();
  const active = reservations.filter((r) => r.status === "activa");
  const history = reservations.filter((r) => r.status !== "activa");

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-foreground">Reservas activas ({active.length})</h3>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay equipos reservados. Desde el catálogo, tocá "Reservar" en un equipo para apartarlo con o sin seña.
            </p>
          ) : (
            <div className="space-y-2">
              {active.map((r) => {
                const overdue = isOverdue(r, now);
                const deposit = depositOf(r);
                const branch = branchName(r.branch_id);
                return (
                  <div key={r.id} data-testid="reservation-row" className={cn("space-y-2 rounded-md border bg-muted/30 p-3 text-sm", overdue ? "border-secondary/60" : "border-border")}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {r.device_name}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">{r.receipt_number}</span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.customer_name}
                          {r.customer_phone ? ` · ${r.customer_phone}` : ""}
                          {branch ? ` · ${branch}` : ""}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        data-testid="reservation-expiry"
                        className={cn("gap-1 text-[11px]", overdue ? "border-secondary/60 bg-secondary/10 text-secondary" : "text-muted-foreground")}
                      >
                        <CalendarClock className="h-3 w-3" /> {expiryText(r.expires_on, now)} · {displayDate(r.expires_on)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Precio: <span className="font-medium text-foreground">{formatPYG(Number(r.agreed_price))}</span></span>
                      <span>Seña: <span className="font-medium text-foreground">{deposit > 0 ? formatPYG(deposit) : "sin seña"}</span></span>
                      {deposit > 0 && <span>Saldo: <span className="font-medium text-foreground">{formatPYG(balanceDue(r))}</span></span>}
                    </div>
                    {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" className="gap-1.5" onClick={() => onSell(r)}>
                        <ShoppingCart className="h-3.5 w-3.5" /> Vender
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onExtend(r)}>
                        <CalendarPlus className="h-3.5 w-3.5" /> Extender
                      </Button>
                      {r.customer_phone && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onWhatsApp(r)}>
                          <MessageCircle className="h-3.5 w-3.5 text-green-600" /> WhatsApp
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => onCancel(r)}>
                        <XCircle className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-semibold text-foreground">Historial</h3>
            <div className="space-y-1.5">
              {history.map((r) => {
                const deposit = depositOf(r);
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">
                        {r.device_name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{r.receipt_number}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.customer_name}
                        {r.status === "cancelada" && deposit > 0
                          ? ` · devuelto ${formatPYG(Number(r.refunded_amount))} · retenido ${formatPYG(Number(r.retained_amount))}`
                          : r.status === "vendida" && deposit > 0
                            ? ` · seña aplicada ${formatPYG(deposit)}`
                            : ""}
                        {r.cancel_reason ? ` · ${r.cancel_reason}` : ""}
                      </div>
                    </div>
                    <Badge variant={r.status === "vendida" ? "secondary" : "outline"} className="shrink-0 text-[11px]">
                      {statusLabel(r, now)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
