import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import OrderCard, { type OrderListItem } from "@/components/OrderCard";
import { isClosedOrderStatus, priorityRank, resolveStatusLabel } from "@/lib/orders";
import { cn } from "@/lib/utils";

type StatusPreset = { key: string; label: string };

interface OrdersBoardProps {
  orders: OrderListItem[];
  statusPresets: StatusPreset[];
  techMap: Record<string, string>;
  quotesCount: number;
  onPay: (order: OrderListItem) => void;
  onMove: (order: OrderListItem, toStatus: string) => void;
}

const CLOSED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const COLUMN_PREFIX = "col:";

const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCenter(args);
};

function DraggableOrder({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={cn("cursor-grab touch-manipulation select-none [&_a]:cursor-grab", isDragging && "opacity-40")}
    >
      {children}
    </div>
  );
}

function DropZone({
  status, className, overClassName, children,
}: { status: string; className?: string; overClassName?: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${status}` });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && overClassName)}>
      {children}
    </div>
  );
}

// El que más espera va arriba: primero las urgentes, después las que llevan
// más tiempo en el mismo estado.
function byWorkQueue(a: OrderListItem, b: OrderListItem) {
  return priorityRank(a.priority) - priorityRank(b.priority)
    || new Date(a.status_changed_at).getTime() - new Date(b.status_changed_at).getTime();
}

export default function OrdersBoard({ orders, statusPresets, techMap, quotesCount, onPay, onMove }: OrdersBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedClosed, setExpandedClosed] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const { openColumns, closedTiles, others } = useMemo(() => {
    const since = Date.now() - CLOSED_WINDOW_MS;
    const known = new Set(statusPresets.map((p) => p.key));
    const real = orders.filter((o) => o.status !== "presupuesto");

    const openColumns = statusPresets
      .filter((p) => p.key !== "presupuesto" && !isClosedOrderStatus(p.key))
      .map((p) => ({ ...p, orders: real.filter((o) => o.status === p.key).sort(byWorkQueue) }));

    const closedTiles = statusPresets
      .filter((p) => isClosedOrderStatus(p.key))
      .map((p) => ({
        ...p,
        orders: real
          .filter((o) => o.status === p.key && new Date(o.status_changed_at).getTime() >= since)
          .sort((a, b) => new Date(b.status_changed_at).getTime() - new Date(a.status_changed_at).getTime()),
      }));

    const others = real.filter((o) => !known.has(o.status)).sort(byWorkQueue);
    return { openColumns, closedTiles, others };
  }, [orders, statusPresets]);

  const activeOrder = activeId ? orders.find((o) => o.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (!overId.startsWith(COLUMN_PREFIX)) return;
    const order = orders.find((o) => o.id === e.active.id);
    if (order) onMove(order, overId.slice(COLUMN_PREFIX.length));
  };

  const renderCard = (o: OrderListItem) => (
    <DraggableOrder key={o.id} id={o.id}>
      <OrderCard
        order={o}
        variant="board"
        statusPresets={statusPresets}
        technicianName={o.assigned_technician_id ? techMap[o.assigned_technician_id] : undefined}
        onPay={onPay}
        onMove={onMove}
      />
    </DraggableOrder>
  );

  const expanded = closedTiles.find((t) => t.key === expandedClosed) ?? null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="space-y-4">
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          {openColumns.map((col) => (
            <DropZone
              key={col.key}
              status={col.key}
              className="flex min-w-[250px] flex-1 basis-0 flex-col rounded-lg border border-border bg-muted/40 transition-colors"
              overClassName="border-primary bg-primary/5"
            >
              <div className="flex items-center justify-between gap-2 px-3 pt-3">
                <StatusBadge status={col.key} label={col.label} />
                <span className="text-xs font-medium text-muted-foreground">{col.orders.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {col.orders.length === 0 ? (
                  <div className="flex min-h-[96px] flex-1 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                    Sin órdenes
                  </div>
                ) : (
                  col.orders.map(renderCard)
                )}
              </div>
            </DropZone>
          ))}
          {others.length > 0 && (
            <div className="flex min-w-[250px] flex-1 basis-0 flex-col rounded-lg border border-border bg-muted/40">
              <div className="flex items-center justify-between gap-2 px-3 pt-3">
                <span className="text-xs font-medium text-muted-foreground">Otros estados</span>
                <span className="text-xs font-medium text-muted-foreground">{others.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">{others.map(renderCard)}</div>
            </div>
          )}
        </div>

        {closedTiles.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Cerradas · últimos 7 días</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {closedTiles.map((t) => {
                const isOpen = expandedClosed === t.key;
                return (
                  <DropZone
                    key={t.key}
                    status={t.key}
                    className="rounded-lg border border-border bg-muted/40 transition-colors"
                    overClassName="border-primary bg-primary/5"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedClosed(isOpen ? null : t.key)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <StatusBadge status={t.key} label={t.label} />
                      </span>
                      <span className="text-sm font-semibold text-foreground">{t.orders.length}</span>
                    </button>
                  </DropZone>
                );
              })}
            </div>
            {expanded && (
              expanded.orders.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  No hay órdenes en {resolveStatusLabel(expanded.key, statusPresets)} en los últimos 7 días.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {expanded.orders.map(renderCard)}
                </div>
              )
            )}
          </div>
        )}

        {quotesCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {quotesCount === 1 ? "1 presupuesto se ve" : `${quotesCount} presupuestos se ven`} en la vista Lista.
          </p>
        )}
      </div>

      <DragOverlay>
        {activeOrder ? (
          <OrderCard
            order={activeOrder}
            variant="board"
            statusPresets={statusPresets}
            technicianName={activeOrder.assigned_technician_id ? techMap[activeOrder.assigned_technician_id] : undefined}
            dragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
