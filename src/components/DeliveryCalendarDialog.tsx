import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { StatusBadge } from "@/components/StatusBadge";
import { resolveStatusLabel } from "@/lib/orders";
import { CalendarDays, Smartphone, X } from "lucide-react";
import { isBefore, isSameDay, startOfDay } from "date-fns";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type DeliveryCalendarOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  device_type: string;
  status: string;
  estimated_delivery_date: string | null;
};

interface DeliveryCalendarDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orders: DeliveryCalendarOrder[];
  statusPresets?: { key: string; label: string }[];
}

// Entregas pendientes, ordenadas por prioridad (fecha más próxima primero).
// No hace query propia: reusa la lista de órdenes que el Dashboard ya cargó.
export default function DeliveryCalendarDialog({ open, onOpenChange, orders, statusPresets }: DeliveryCalendarDialogProps) {
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);

  const deliveries = useMemo(() => {
    return orders
      .filter((o) => o.estimated_delivery_date && o.status !== "entregado" && o.status !== "presupuesto")
      .map((o) => ({ ...o, date: new Date(o.estimated_delivery_date + "T00:00:00") }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [orders]);

  const deliveryDates = useMemo(() => deliveries.map((d) => d.date), [deliveries]);

  const today = startOfDay(new Date());
  const visible = selectedDay
    ? deliveries.filter((d) => isSameDay(d.date, selectedDay))
    : deliveries;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Calendario de entregas
          </DialogTitle>
          <DialogDescription>
            Equipos ordenados por prioridad según su fecha de entrega estimada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid flex-1 gap-4 overflow-hidden sm:grid-cols-[auto_1fr]">
          <div className="flex justify-center sm:justify-start">
            <Calendar
              mode="single"
              locale={es}
              selected={selectedDay}
              onSelect={(d) => setSelectedDay((prev) => (d && prev && isSameDay(d, prev) ? undefined : d))}
              modifiers={{ hasDelivery: deliveryDates }}
              modifiersClassNames={{ hasDelivery: "font-bold underline decoration-2 decoration-primary underline-offset-4" }}
              className="rounded-md border"
            />
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {selectedDay
                  ? format(selectedDay, "PPP", { locale: es })
                  : `Todas las entregas pendientes (${deliveries.length})`}
              </span>
              {selectedDay && (
                <button
                  type="button"
                  onClick={() => setSelectedDay(undefined)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" /> Ver todas
                </button>
              )}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {visible.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                  No hay entregas {selectedDay ? "ese día" : "pendientes"}.
                </div>
              ) : (
                visible.map((o) => {
                  const overdue = isBefore(o.date, today);
                  return (
                    <Link
                      key={o.id}
                      to={`/ordenes/${o.id}`}
                      onClick={() => onOpenChange(false)}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{o.customer_name}</div>
                        <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Smartphone className="h-3 w-3 shrink-0" />
                          <span className="truncate">{o.device_type} · {o.order_number}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={cn("text-xs font-medium", overdue ? "text-destructive" : "text-muted-foreground")}>
                          {format(o.date, "dd/MM/yyyy")}
                        </span>
                        {overdue ? (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                            Atrasada
                          </span>
                        ) : (
                          <StatusBadge status={o.status} label={resolveStatusLabel(o.status, statusPresets)} />
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
