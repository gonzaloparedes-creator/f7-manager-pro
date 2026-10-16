import { Link } from "react-router-dom";
import { Check, Clock, Flag, Smartphone, User as UserIcon, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { WarrantyBadge } from "@/components/WarrantyBadge";
import OrderActionsMenu from "@/components/OrderActionsMenu";
import MoveOrderMenu from "@/components/MoveOrderMenu";
import {
  PRIORITY_LABELS, QUOTE_RESPONSE_LABELS, STALE_AFTER_DAYS, elapsedSince, formatElapsedShort, formatPYG,
  isClosedOrderStatus, normalizePriority, orderMoney, quoteResponseBadgeClasses, resolveStatusLabel,
  type QuoteResponse,
} from "@/lib/orders";
import { cn } from "@/lib/utils";

export interface CargoAdicional { motivo: string; monto: number }

export interface OrderListItem {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  device_type: string;
  imei: string | null;
  marca: string | null;
  modelo: string | null;
  status: string;
  status_changed_at: string;
  created_at: string;
  problems: string[] | null;
  quote_amount: number | null;
  deposit_amount: number | null;
  deposit_payment_method: string | null;
  cargos_adicionales: CargoAdicional[] | null;
  estimated_delivery_date: string | null;
  current_branch_id: string | null;
  assigned_technician_id: string | null;
  warranty_days: number | null;
  delivered_at: string | null;
  quote_response: QuoteResponse | null;
  priority: string | null;
}

type StatusPreset = { key: string; label: string };

interface OrderCardProps {
  order: OrderListItem;
  variant: "row" | "card" | "board";
  statusPresets: StatusPreset[];
  technicianName?: string;
  onPay?: (order: OrderListItem) => void;
  onMove?: (order: OrderListItem, toStatus: string) => void;
  onUpdated?: () => void;
  onDeleted?: (orderId: string) => void;
  dragging?: boolean;
}

function PriorityBar({ priority, closed }: { priority: string | null; closed: boolean }) {
  const p = normalizePriority(priority);
  if (closed || p === "normal") return null;
  return (
    <span
      aria-hidden
      className={cn("absolute inset-y-0 left-0 w-1", p === "alta" ? "bg-destructive" : "bg-muted-foreground/30")}
    />
  );
}

function PriorityLabel({ priority, closed }: { priority: string | null; closed: boolean }) {
  const p = normalizePriority(priority);
  if (closed || p === "normal") return null;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap font-medium", p === "alta" ? "text-destructive" : "text-muted-foreground")}>
      <Flag className="h-3 w-3" />
      Prioridad {PRIORITY_LABELS[p].toLowerCase()}
    </span>
  );
}

function TimeInState({ order }: { order: OrderListItem }) {
  const text = formatElapsedShort(order.status_changed_at);
  if (!text) return null;
  const days = elapsedSince(order.status_changed_at)?.days ?? 0;
  const stale = !isClosedOrderStatus(order.status) && order.status !== "presupuesto" && days >= STALE_AFTER_DAYS;
  const since = new Date(order.status_changed_at).toLocaleString("es-ES", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
  return (
    <span
      title={`En este estado desde el ${since}`}
      className={cn("inline-flex items-center gap-1 whitespace-nowrap", stale ? "font-medium text-secondary" : "text-muted-foreground")}
    >
      <Clock className="h-3 w-3" />
      {text === "recién" ? "recién" : `hace ${text}`}
    </span>
  );
}

function Money({
  order, compact, onPay,
}: { order: OrderListItem; compact?: boolean; onPay?: (order: OrderListItem) => void }) {
  const { total, deposit, saldo, isFullyPaid } = orderMoney(order);
  if (order.status === "presupuesto") {
    return total > 0 ? <span className="whitespace-nowrap font-medium text-foreground">{formatPYG(total)}</span> : null;
  }
  if (saldo > 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end leading-tight">
          {!compact && deposit > 0 && (
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              Pagado: <span className="font-medium text-foreground">{formatPYG(deposit)}</span>
            </span>
          )}
          <span className={cn("whitespace-nowrap font-semibold text-secondary", compact ? "text-[11px]" : "text-sm font-bold")}>
            Saldo: {formatPYG(saldo)}
          </span>
        </div>
        {onPay && (
          <Button
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPay(order);
            }}
            className="h-7 shrink-0 gap-1 bg-secondary px-2 text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/90"
          >
            <Wallet className="h-3 w-3" />
            {compact ? "Cobrar" : "Cobrar saldo"}
          </Button>
        )}
      </div>
    );
  }
  if (isFullyPaid) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-success">
        <Check className="h-3 w-3" />
        Pagado{!compact && ` ${formatPYG(total)}`}
      </span>
    );
  }
  return null;
}

function QuoteResponseChip({ order }: { order: OrderListItem }) {
  if (order.status !== "presupuesto" || !order.quote_response) return null;
  return (
    <span className={cn("whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium", quoteResponseBadgeClasses(order.quote_response))}>
      {QUOTE_RESPONSE_LABELS[order.quote_response]}
    </span>
  );
}

function deviceLine(o: OrderListItem) {
  return `${o.device_type}${o.marca || o.modelo ? ` · ${[o.marca, o.modelo].filter(Boolean).join(" ")}` : ""}`;
}

export default function OrderCard({
  order: o, variant, statusPresets, technicianName, onPay, onMove, onUpdated, onDeleted, dragging,
}: OrderCardProps) {
  const closed = isClosedOrderStatus(o.status);
  const statusLabel = resolveStatusLabel(o.status, statusPresets);
  const moveMenu = onMove ? (
    <MoveOrderMenu status={o.status} presets={statusPresets} onMove={(to) => onMove(o, to)} />
  ) : null;

  if (variant === "row") {
    return (
      <Link to={`/ordenes/${o.id}`} className="block">
        <div className="relative space-y-2 overflow-hidden rounded-lg border border-border bg-card p-3 pl-4 transition-colors active:bg-accent">
          <PriorityBar priority={o.priority} closed={closed} />
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {o.customer_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{o.customer_name}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Smartphone className="h-3 w-3 shrink-0" />
                <span className="shrink-0 whitespace-nowrap font-mono text-[11px]">{o.order_number}</span>
                <span className="truncate">· {deviceLine(o)}</span>
              </div>
              {o.imei && <div className="truncate font-mono text-[11px] text-muted-foreground">{o.imei}</div>}
            </div>
            <div className="-mr-1 flex shrink-0 items-center gap-0.5">
              <StatusBadge status={o.status} label={statusLabel} />
              {moveMenu}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pl-[52px] text-[11px]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <TimeInState order={o} />
              <PriorityLabel priority={o.priority} closed={closed} />
              <QuoteResponseChip order={o} />
            </div>
            <Money order={o} compact onPay={onPay} />
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "card") {
    return (
      <Link to={`/ordenes/${o.id}`} draggable={false} className="block h-full">
        <Card className="group relative h-full overflow-hidden transition-all hover:border-primary/50 hover:shadow-elevated">
          <PriorityBar priority={o.priority} closed={closed} />
          <CardContent className="space-y-3 p-4 pl-5">
            <div className="flex items-start justify-between gap-2">
              <span className="shrink-0 whitespace-nowrap font-mono text-xs font-medium text-muted-foreground">{o.order_number}</span>
              <div className="-mr-1 flex shrink-0 items-center gap-0.5">
                {moveMenu}
                <OrderActionsMenu
                  orderId={o.id}
                  orderNumber={o.order_number}
                  onUpdated={onUpdated}
                  onDeleted={() => onDeleted?.(o.id)}
                />
              </div>
            </div>
            <div>
              <div className="font-semibold">{o.customer_name}</div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0">{deviceLine(o)}</span>
              </div>
              {o.imei && <div className="font-mono text-xs text-muted-foreground">{o.imei}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <StatusBadge status={o.status} label={statusLabel} />
              <QuoteResponseChip order={o} />
              <TimeInState order={o} />
            </div>
            {(technicianName || (!closed && normalizePriority(o.priority) !== "normal")) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {technicianName && (
                  <span className="inline-flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    {technicianName}
                  </span>
                )}
                <PriorityLabel priority={o.priority} closed={closed} />
              </div>
            )}
            <WarrantyBadge deliveredAt={o.delivered_at} warrantyDays={o.warranty_days} />
            {o.problems && o.problems.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {o.problems.slice(0, 3).map((p) => (
                  <span key={p} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                    {p}
                  </span>
                ))}
                {o.problems.length > 3 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    +{o.problems.length - 3}
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>
                {new Date(o.created_at).toLocaleString("es-ES", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
              <Money order={o} onPay={onPay} />
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link to={`/ordenes/${o.id}`} draggable={false} className="block">
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-card p-3 pl-4 text-left transition-colors hover:border-primary/50",
          dragging && "rotate-1 border-primary shadow-elevated ring-2 ring-primary/30"
        )}
      >
        <PriorityBar priority={o.priority} closed={closed} />
        <div className="flex items-center justify-between gap-1">
          <span className="shrink-0 whitespace-nowrap font-mono text-[11px] font-medium text-muted-foreground">{o.order_number}</span>
          <div className="-mr-1 flex min-w-0 items-center gap-0.5 text-[11px]">
            <TimeInState order={o} />
            {moveMenu}
          </div>
        </div>
        <div className="truncate text-sm font-semibold">{o.customer_name}</div>
        <div className="truncate text-xs text-muted-foreground">{deviceLine(o)}</div>
        {(technicianName || (!closed && normalizePriority(o.priority) !== "normal")) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {technicianName && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <UserIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{technicianName}</span>
              </span>
            )}
            <PriorityLabel priority={o.priority} closed={closed} />
          </div>
        )}
        <div className="mt-2 flex items-center justify-end empty:hidden">
          <Money order={o} compact onPay={onPay} />
        </div>
      </div>
    </Link>
  );
}
