import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS, formatPYG, type OrderStatus } from "@/lib/orders";
import { Plus, Smartphone, Clock, CheckCircle2, Package, Wallet, User as UserIcon } from "lucide-react";
import NewOrderDialog from "@/components/NewOrderDialog";
import { WarrantyBadge } from "@/components/WarrantyBadge";
import OrderActionsMenu from "@/components/OrderActionsMenu";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface CargoAdicional { motivo: string; monto: number }
interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  device_type: string;
  status: string;
  created_at: string;
  problems: string[] | null;
  quote_amount: number | null;
  deposit_amount: number | null;
  cargos_adicionales: CargoAdicional[] | null;
  estimated_delivery_date: string | null;
  current_branch_id: string | null;
  assigned_technician_id: string | null;
  warranty_days: number | null;
  delivered_at: string | null;
}
interface Branch { id: string; name: string }
interface ProfileLite { id: string; full_name: string | null }

const FILTERS: { value: "todos" | OrderStatus; label: string }[] = [
  { value: "todos", label: "Activas" },
  { value: "recibido", label: "Recibidas" },
  { value: "en_diagnostico", label: "Diagnóstico" },
  { value: "en_reparacion", label: "Reparación" },
  { value: "listo", label: "Listas" },
  { value: "garantia", label: "Garantía" },
  { value: "entregado", label: "Entregadas" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { companyId } = useCompany();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"todos" | OrderStatus>("todos");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [techMap, setTechMap] = useState<Record<string, string>>({});

  useEffect(() => { document.title = "Órdenes | F7 Manager Pro"; }, []);

  const load = async () => {
    if (!user || roleLoading || !companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, device_type, status, created_at, problems, quote_amount, deposit_amount, cargos_adicionales, estimated_delivery_date, current_branch_id, assigned_technician_id, warranty_days, delivered_at")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });
    const list = (data ?? []) as unknown as Order[];
    setOrders(list);

    const techIds = Array.from(new Set(list.map((o) => o.assigned_technician_id).filter(Boolean))) as string[];
    if (techIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", companyId)
        .in("id", techIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name || "Técnico"; });
      setTechMap(map);
    } else {
      setTechMap({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, roleLoading, companyId]);

  // Load branches for admin filter
  useEffect(() => {
    if (!isAdmin || !companyId) return;
    supabase.from("branches").select("id, name").eq("company_id", companyId).order("name").then(({ data }) => {
      setBranches((data ?? []) as Branch[]);
    });
  }, [isAdmin, companyId]);

  const collectBalance = async (e: React.MouseEvent, order: Order, total: number) => {
    e.preventDefault();
    e.stopPropagation();
    setCollectingId(order.id);
    // Optimistic update
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, deposit_amount: total } : o));
    const { error } = await supabase
      .from("orders")
      .update({ deposit_amount: total, final_payment_date: new Date().toISOString() })
      .eq("id", order.id);
    setCollectingId(null);
    if (error) {
      toast({ title: "Error al cobrar saldo", description: error.message, variant: "destructive" });
      load();
      return;
    }
    toast({ title: "Saldo cobrado", description: `Orden ${order.order_number} marcada como totalmente pagada.` });
  };

  const branchScoped = useMemo(() => {
    if (!isAdmin) return orders; // staff already scoped by RLS
    if (branchFilter === "all") return orders;
    return orders.filter((o) => o.current_branch_id === branchFilter);
  }, [orders, isAdmin, branchFilter]);

  const stats = useMemo(() => {
    const total = branchScoped.length;
    const pending = branchScoped.filter((o) => ["recibido", "en_diagnostico", "en_reparacion"].includes(o.status)).length;
    const ready = branchScoped.filter((o) => o.status === "listo").length;
    return { total, pending, ready };
  }, [branchScoped]);

  const filtered = filter === "todos"
    ? branchScoped.filter((o) => o.status !== "entregado")
    : branchScoped.filter((o) => o.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Órdenes de reparación</h1>
          <p className="text-sm text-muted-foreground">Gestioná todas tus reparaciones desde un solo lugar.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sucursal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva Orden
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Package} label="Total" value={stats.total} />
        <StatCard icon={Clock} label="En proceso" value={stats.pending} accent="text-[hsl(var(--status-reparacion))]" />
        <StatCard icon={CheckCircle2} label="Listas para retirar" value={stats.ready} accent="text-[hsl(var(--status-listo))]" />
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Smartphone className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {filter === "todos" ? "Aún no tenés órdenes." : `No hay órdenes en ${STATUS_LABELS[filter as OrderStatus]}.`}
            </p>
            {filter === "todos" && (
              <Button onClick={() => setOpen(true)} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Crear la primera
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => {
            const cargosTotal = (o.cargos_adicionales ?? []).reduce((s, c) => s + Number(c?.monto ?? 0), 0);
            const total = Number(o.quote_amount ?? 0) + cargosTotal;
            const deposit = Number(o.deposit_amount ?? 0);
            const saldo = Math.max(0, total - deposit);
            const isFullyPaid = total > 0 && saldo === 0;
            const hasPartial = total > 0 && saldo > 0 && deposit > 0;
            const hasQuoteOnly = total > 0 && deposit === 0;
            return (
            <Link key={o.id} to={`/ordenes/${o.id}`}>
              <Card className={cn(
                "group h-full transition-all hover:shadow-elevated",
                isFullyPaid
                  ? "border-l-4 border-l-emerald-500 shadow-[0_0_12px_-2px_hsl(152_72%_45%/0.5)] hover:border-l-emerald-400"
                  : "hover:border-primary/50"
              )}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono font-medium text-muted-foreground">{o.order_number}</span>
                    <div className="flex items-center gap-1.5">
                      {isFullyPaid && (
                        <Badge variant="outline" className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                          Total Pagado: {formatPYG(total)}
                        </Badge>
                      )}
                      <StatusBadge status={o.status} />
                      <OrderActionsMenu
                        orderId={o.id}
                        orderNumber={o.order_number}
                        onUpdated={load}
                        onDeleted={() => setOrders((prev) => prev.filter((x) => x.id !== o.id))}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold">{o.customer_name}</div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Smartphone className="h-3.5 w-3.5" />
                      {o.device_type}
                    </div>
                  </div>
                  <WarrantyBadge deliveredAt={o.delivered_at} warrantyDays={o.warranty_days} />
                  {o.assigned_technician_id && techMap[o.assigned_technician_id] && (
                    <Badge variant="secondary" className="gap-1 font-normal">
                      <UserIcon className="h-3 w-3" />
                      {techMap[o.assigned_technician_id]}
                    </Badge>
                  )}
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
                  <div className="flex items-end justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {new Date(o.created_at).toLocaleString("es-ES", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    {hasPartial || (total > 0 && saldo > 0) ? (
                      <div className="flex items-end gap-2">
                        <div className="flex flex-col items-end gap-0.5">
                          {deposit > 0 && (
                            <span className="text-[11px] text-muted-foreground">Pagado: <span className="font-medium text-foreground">{formatPYG(deposit)}</span></span>
                          )}
                          <span className="text-sm font-bold text-orange-600 dark:text-orange-400">Saldo: {formatPYG(saldo)}</span>
                        </div>
                        <Button
                          size="sm"
                          disabled={collectingId === o.id}
                          onClick={(e) => collectBalance(e, o, total)}
                          className="h-7 gap-1 bg-secondary px-2 text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/90"
                        >
                          <Wallet className="h-3 w-3" />
                          {collectingId === o.id ? "..." : "Cobrar Saldo"}
                        </Button>
                      </div>
                    ) : hasQuoteOnly ? (
                      <span className="font-semibold text-foreground">{formatPYG(total)}</span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
            );
          })}
        </div>
      )}

      <NewOrderDialog open={open} onOpenChange={setOpen} onCreated={load} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className={cn("text-2xl font-bold", accent)}>{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
