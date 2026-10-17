import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCompany } from "@/hooks/useCompany";
import { useBranchRestriction } from "@/hooks/useBranchRestriction";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMoveOrder } from "@/hooks/useMoveOrder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveStatusLabel, isClosedOrderStatus, normalizePriority, priorityRank } from "@/lib/orders";
import { useOrderStatusPresets } from "@/hooks/useOrderStatusPresets";
import { Plus, Smartphone, Clock, CheckCircle2, Package, Layers, Search, X, CalendarDays, Flag, LayoutDashboard, List, Columns3 } from "lucide-react";
import NewQuoteDialog from "@/components/NewQuoteDialog";
import NewBatchOrderDialog from "@/components/NewBatchOrderDialog";
import DeliveryCalendarDialog from "@/components/DeliveryCalendarDialog";
import RegisterPaymentDialog from "@/components/RegisterPaymentDialog";
import EvolutionMigrationBanner from "@/components/EvolutionMigrationBanner";
import OrderCard, { type OrderListItem } from "@/components/OrderCard";
import OrdersBoard from "@/components/OrdersBoard";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Order = OrderListItem;
interface Branch { id: string; name: string }

const VIEW_STORAGE_KEY = "f7:orders-view";

function readStoredView(): "lista" | "tablero" {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "tablero" ? "tablero" : "lista";
  } catch {
    return "lista";
  }
}

const FIXED_FILTERS: { value: string; label: string }[] = [
  { value: "todos", label: "Activas" },
  { value: "presupuesto", label: "Presupuestos" },
];

// Estados que cuentan como "En proceso" en la tarjeta resumen — se
// comparten entre el cálculo del número y el filtro que dispara al tocarla.
const EN_PROCESO_STATUSES = ["recibido", "en_diagnostico", "en_reparacion"];

export default function Dashboard() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { companyId } = useCompany();
  const { restricted: branchRestricted, loading: restrictionLoading } = useBranchRestriction();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("todos");
  const { presets: statusPresets } = useOrderStatusPresets();
  const FILTERS = useMemo(
    () => [...FIXED_FILTERS, ...statusPresets.map((p) => ({ value: p.key, label: p.label }))],
    [statusPresets]
  );
  const [loading, setLoading] = useState(true);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [onlyHighPriority, setOnlyHighPriority] = useState(false);
  const [techMap, setTechMap] = useState<Record<string, string>>({});
  const [view, setView] = useState<"lista" | "tablero">(readStoredView);
  const isMobile = useIsMobile();
  const { requestMove, dialogs: moveDialogs } = useMoveOrder({ setOrders, statusPresets });
  const location = useLocation();
  const navigate = useNavigate();

  const changeView = (next: "lista" | "tablero") => {
    setView(next);
    try { localStorage.setItem(VIEW_STORAGE_KEY, next); } catch { /* sin storage: queda solo para esta sesión */ }
  };
  const showBoard = view === "tablero" && !isMobile;

  useEffect(() => { document.title = "Órdenes | F7 Manager Pro"; }, []);

  // El FAB de acciones rápidas navega acá con state.openNewQuote o
  // state.openBatchOrder cuando se toca esa acción desde otra página — se
  // limpia el state al abrir para que no se re-dispare con el botón atrás.
  useEffect(() => {
    const state = location.state as { openNewQuote?: boolean; openBatchOrder?: boolean } | null;
    if (state?.openNewQuote) {
      setQuoteOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    } else if (state?.openBatchOrder) {
      setBatchOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const load = async () => {
    if (!user || roleLoading || !companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, device_type, imei, marca, modelo, status, status_changed_at, created_at, problems, quote_amount, deposit_amount, deposit_payment_method, cargos_adicionales, estimated_delivery_date, current_branch_id, assigned_technician_id, warranty_days, delivered_at, quote_response, priority")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Error al cargar órdenes", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
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

  // user?.id (no el objeto user): Supabase entrega un `user` con nueva
  // referencia en cada refresh de token (p. ej. al volver de otra pestaña),
  // y depender del objeto reiniciaba todo el listado de órdenes de la nada.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [user?.id, roleLoading, companyId]);

  // Load branches for admin filter (un encargado "solo su sucursal" no filtra: la RLS ya le recorta todo)
  const showBranchFilter = isAdmin && !restrictionLoading && !branchRestricted;
  useEffect(() => {
    if (!showBranchFilter || !companyId) return;
    supabase.from("branches").select("id, name").eq("company_id", companyId).order("name").then(({ data }) => {
      setBranches((data ?? []) as Branch[]);
    });
  }, [showBranchFilter, companyId]);

  const openPayDialog = (order: Order) => {
    setPayingOrder(order);
    setPayDialogOpen(true);
  };

  const branchScoped = useMemo(() => {
    if (!isAdmin) return orders; // staff already scoped by RLS
    if (branchFilter === "all") return orders;
    return orders.filter((o) => o.current_branch_id === branchFilter);
  }, [orders, isAdmin, branchFilter]);

  const stats = useMemo(() => {
    const real = branchScoped.filter((o) => o.status !== "presupuesto");
    const total = real.length;
    const pending = real.filter((o) => EN_PROCESO_STATUSES.includes(o.status)).length;
    const ready = real.filter((o) => o.status === "listo").length;
    return { total, pending, ready };
  }, [branchScoped]);

  // "total" y "en_proceso" son filtros virtuales que solo disparan las
  // tarjetas resumen de arriba (no tienen chip propio) — representan
  // exactamente los mismos criterios usados para calcular stats.total/pending.
  const filteredByStatus = filter === "todos"
    ? branchScoped.filter((o) => o.status !== "presupuesto" && !isClosedOrderStatus(o.status))
    : filter === "total"
    ? branchScoped.filter((o) => o.status !== "presupuesto")
    : filter === "en_proceso"
    ? branchScoped.filter((o) => EN_PROCESO_STATUSES.includes(o.status))
    : branchScoped.filter((o) => o.status === filter);

  const searchQuery = search.trim().toLowerCase();
  const matchesSearch = (o: Order) => {
    const digits = searchQuery.replace(/\D/g, "");
    return (
      o.order_number.toLowerCase().includes(searchQuery) ||
      o.customer_name.toLowerCase().includes(searchQuery) ||
      o.device_type.toLowerCase().includes(searchQuery) ||
      (o.imei ?? "").toLowerCase().includes(searchQuery) ||
      (o.marca ?? "").toLowerCase().includes(searchQuery) ||
      (o.modelo ?? "").toLowerCase().includes(searchQuery) ||
      (!!digits && (o.customer_phone ?? "").includes(digits))
    );
  };
  const passesPriority = (o: Order) =>
    !onlyHighPriority || (normalizePriority(o.priority) === "alta" && !isClosedOrderStatus(o.status));
  const filtered = searchQuery ? filteredByStatus.filter(matchesSearch) : filteredByStatus;

  // Las urgentes arriba y las de prioridad baja al final; el resto conserva el
  // orden de siempre (última actividad). Una orden ya cerrada no se reordena.
  const rankOf = (o: Order) => (isClosedOrderStatus(o.status) ? 1 : priorityRank(o.priority));
  const visibleOrders = filtered.filter(passesPriority).sort((a, b) => rankOf(a) - rankOf(b));

  // El tablero ignora el filtro de estado (las columnas ya son los estados) y
  // respeta sucursal, búsqueda y prioridad. Los presupuestos quedan en la Lista.
  const boardOrders = showBoard
    ? branchScoped.filter((o) => o.status !== "presupuesto" && (!searchQuery || matchesSearch(o)) && passesPriority(o))
    : [];
  const quotesCount = branchScoped.filter((o) => o.status === "presupuesto").length;
  const noRealOrders = branchScoped.length === quotesCount;
  const isEmpty = showBoard
    ? boardOrders.length === 0 && (!!searchQuery || onlyHighPriority || noRealOrders)
    : visibleOrders.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            Órdenes de reparación
          </h1>
          <p className="text-sm text-muted-foreground">Gestioná todas tus reparaciones desde un solo lugar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showBranchFilter && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[160px] sm:w-[200px]">
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
          <Button variant="outline" onClick={() => setCalendarOpen(true)} className="gap-2">
            <CalendarDays className="h-4 w-4" /> Calendario
          </Button>
          {/* En mobile el FAB (nav inferior) ya cubre Nueva Orden/Presupuesto/
              Lote — mostrar estos botones también acá desbordaba el header
              en pantallas chicas. Se muestran recién desde md, que es
              donde el FAB deja de estar disponible (ver AppLayout). El
              calendario no tiene equivalente en el FAB, así que se ve siempre. */}
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="outline" onClick={() => setBatchOpen(true)} className="gap-2">
              <Layers className="h-4 w-4" /> Modo Lote
            </Button>
            <Button variant="outline" onClick={() => setQuoteOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo Presupuesto
            </Button>
            <Button onClick={() => navigate("/ordenes/nueva")} className="gap-2">
              <Plus className="h-4 w-4" /> Nueva Orden
            </Button>
          </div>
        </div>
      </div>

      <EvolutionMigrationBanner />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          icon={Package} label="Total" value={stats.total}
          active={!showBoard && filter === "total"}
          onClick={showBoard ? undefined : () => setFilter((f) => (f === "total" ? "todos" : "total"))}
        />
        <StatCard
          icon={Clock} label="En proceso" value={stats.pending} accent="text-[hsl(var(--status-reparacion))]"
          active={!showBoard && filter === "en_proceso"}
          onClick={showBoard ? undefined : () => setFilter((f) => (f === "en_proceso" ? "todos" : "en_proceso"))}
        />
        <StatCard
          icon={CheckCircle2} label="Listas para retirar" value={stats.ready} accent="text-[hsl(var(--status-listo))]"
          active={!showBoard && filter === "listo"}
          onClick={showBoard ? undefined : () => setFilter((f) => (f === "listo" ? "todos" : "listo"))}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, N° de orden, equipo, IMEI o teléfono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="hidden shrink-0 items-center rounded-md border border-border bg-card p-0.5 md:flex" role="group" aria-label="Vista de órdenes">
          {([["lista", "Lista", List], ["tablero", "Tablero", Columns3]] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => changeView(value)}
              aria-pressed={view === value}
              data-testid={`view-${value}`}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                view === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:-mx-1 md:px-1">
        {!showBoard && FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setOnlyHighPriority((v) => !v)}
          aria-pressed={onlyHighPriority}
          data-testid="filter-high-priority"
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            onlyHighPriority
              ? "border-destructive bg-destructive text-destructive-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          <Flag className="h-3.5 w-3.5" /> Prioridad alta
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Smartphone className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {onlyHighPriority
                ? "No hay órdenes de prioridad alta en esta vista."
                : searchQuery
                ? `Ninguna orden coincide con "${search.trim()}".`
                : showBoard || filter === "todos" ? "Aún no tenés órdenes." : `No hay órdenes en ${resolveStatusLabel(filter, statusPresets)}.`}
            </p>
            {(showBoard || filter === "todos") && !searchQuery && !onlyHighPriority && (
              <Button onClick={() => navigate("/ordenes/nueva")} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Crear la primera
              </Button>
            )}
          </CardContent>
        </Card>
      ) : showBoard ? (
        <OrdersBoard
          orders={boardOrders}
          statusPresets={statusPresets}
          techMap={techMap}
          quotesCount={quotesCount}
          onPay={openPayDialog}
          onMove={requestMove}
        />
      ) : (
        <>
          {/* Mobile: filas compactas, una línea de info por orden */}
          <div className="flex flex-col gap-2 sm:hidden">
            {visibleOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                variant="row"
                statusPresets={statusPresets}
                technicianName={o.assigned_technician_id ? techMap[o.assigned_technician_id] : undefined}
                onPay={openPayDialog}
                onMove={requestMove}
              />
            ))}
          </div>

          {/* Desktop/tablet: cards completas con toda la info */}
          <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3">
            {visibleOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                variant="card"
                statusPresets={statusPresets}
                technicianName={o.assigned_technician_id ? techMap[o.assigned_technician_id] : undefined}
                onPay={openPayDialog}
                onMove={requestMove}
                onUpdated={load}
                onDeleted={(id) => setOrders((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        </>
      )}

      <NewQuoteDialog open={quoteOpen} onOpenChange={setQuoteOpen} onCreated={load} />
      <NewBatchOrderDialog open={batchOpen} onOpenChange={setBatchOpen} onCreated={load} />
      <DeliveryCalendarDialog
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        orders={branchScoped}
        statusPresets={statusPresets}
      />
      <RegisterPaymentDialog order={payingOrder} open={payDialogOpen} onOpenChange={setPayDialogOpen} onRegistered={load} />
      {moveDialogs}
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, accent, active, onClick,
}: { icon: any; label: string; value: number; accent?: string; active?: boolean; onClick?: () => void }) {
  const clickable = !!onClick;
  return (
    <Card
      className={cn(
        clickable && "cursor-pointer transition-colors hover:border-primary/50",
        active && "border-primary bg-primary/5"
      )}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={clickable ? !!active : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <CardContent className="flex items-center justify-between gap-2 p-3 sm:p-4">
        <div>
          <div className="text-xs leading-tight text-muted-foreground sm:text-sm">{label}</div>
          <div className={cn("text-2xl font-bold", accent)}>{value}</div>
        </div>
        <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground sm:flex">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
