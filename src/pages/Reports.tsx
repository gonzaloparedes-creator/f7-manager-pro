import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatPYG } from "@/lib/orders";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Wallet, TrendingUp, PackageMinus, TrendingDown, ShieldAlert, Wrench, ShoppingBag, CalendarDays } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface CargoAdicional { motivo: string; monto: number }
interface OrderRow {
  id: string;
  quote_amount: number | null;
  senia_amount: number | null;
  cargos_adicionales: CargoAdicional[] | null;
  deposit_date: string | null;
  final_payment_date: string | null;
}
interface PartRow {
  order_id: string;
  quantity: number;
  historical_cost: number | null;
}
interface SaleRow {
  quantity: number;
  unit_price: number;
  unit_cost: number;
  created_at: string;
}

type PresetKey = "hoy" | "ayer" | "esta_semana" | "semana_pasada" | "este_mes" | "mes_pasado" | "este_anio" | "todo";
type Timeframe = PresetKey | "personalizado";
type ChartScope = "todo" | "taller" | "tienda";
type Granularity = "day" | "week" | "month";

const PRESET_ORDER: PresetKey[] = ["hoy", "ayer", "esta_semana", "semana_pasada", "este_mes", "mes_pasado", "este_anio", "todo"];
const PRESET_LABELS: Record<PresetKey, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  esta_semana: "Esta semana",
  semana_pasada: "Semana pasada",
  este_mes: "Este mes",
  mes_pasado: "Mes pasado",
  este_anio: "Este año",
  todo: "Todo el tiempo",
};

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth()+1, 0, 23, 59, 59, 999); }
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=domingo..6=sábado
  const diff = day === 0 ? -6 : 1 - day; // arranca lunes
  x.setDate(x.getDate() + diff);
  return x;
}
function endOfWeek(d: Date) { return endOfDay(addDays(startOfWeek(d), 6)); }
function startOfYear(d: Date) { return new Date(d.getFullYear(), 0, 1); }
function endOfYear(d: Date) { return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999); }

function totalOf(o: OrderRow) {
  const cargos = (o.cargos_adicionales ?? []).reduce((s, c) => s + Number(c?.monto ?? 0), 0);
  return Number(o.quote_amount ?? 0) + cargos;
}

function getRange(tf: Timeframe, customRange?: DateRange): { from: Date | null; to: Date | null } {
  const now = new Date();
  const cap = (d: Date) => (d > now ? endOfDay(now) : d);
  switch (tf) {
    case "hoy": return { from: startOfDay(now), to: endOfDay(now) };
    case "ayer": { const y = addDays(now, -1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case "esta_semana": return { from: startOfWeek(now), to: cap(endOfWeek(now)) };
    case "semana_pasada": { const s = addDays(startOfWeek(now), -7); return { from: startOfDay(s), to: endOfDay(addDays(s, 6)) }; }
    case "este_mes": return { from: startOfMonth(now), to: cap(endOfMonth(now)) };
    case "mes_pasado": { const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { from: startOfMonth(prev), to: endOfMonth(prev) }; }
    case "este_anio": return { from: startOfYear(now), to: cap(endOfYear(now)) };
    case "todo": return { from: null, to: null };
    case "personalizado":
      if (!customRange?.from) return { from: null, to: null };
      return { from: startOfDay(customRange.from), to: endOfDay(customRange.to ?? customRange.from) };
  }
}

function inRange(dateStr: string | null, from: Date | null, to: Date | null) {
  if (!dateStr) return false;
  if (!from || !to) return true;
  const t = new Date(dateStr).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function revenueInRange(orders: OrderRow[], from: Date | null, to: Date | null) {
  let total = 0;
  for (const o of orders) {
    const senia = Number(o.senia_amount ?? 0);
    if (inRange(o.deposit_date, from, to)) total += senia;
    if (inRange(o.final_payment_date, from, to)) {
      total += Math.max(0, totalOf(o) - senia);
    }
  }
  return total;
}

/** Parts cost: sum cost*qty for parts whose order was fully paid in range (final_payment_date in range). */
function partsCostInRange(orders: OrderRow[], parts: PartRow[], from: Date | null, to: Date | null) {
  const includedOrderIds = new Set(
    orders.filter(o => inRange(o.final_payment_date, from, to)).map(o => o.id)
  );
  let total = 0;
  for (const p of parts) {
    if (includedOrderIds.has(p.order_id)) {
      total += Number(p.historical_cost ?? 0) * Number(p.quantity ?? 0);
    }
  }
  return total;
}

function salesRevenueInRange(sales: SaleRow[], from: Date | null, to: Date | null) {
  return sales.reduce((s, sale) => inRange(sale.created_at, from, to) ? s + sale.quantity * Number(sale.unit_price || 0) : s, 0);
}

function salesCostInRange(sales: SaleRow[], from: Date | null, to: Date | null) {
  return sales.reduce((s, sale) => inRange(sale.created_at, from, to) ? s + sale.quantity * Number(sale.unit_cost || 0) : s, 0);
}

function earliestActivityDate(orders: OrderRow[], sales: SaleRow[]): Date | null {
  let min: number | null = null;
  const consider = (s: string | null) => {
    if (!s) return;
    const t = new Date(s).getTime();
    if (min === null || t < min) min = t;
  };
  orders.forEach((o) => { consider(o.deposit_date); consider(o.final_payment_date); });
  sales.forEach((s) => consider(s.created_at));
  return min !== null ? new Date(min) : null;
}

function pickGranularity(from: Date, to: Date): Granularity {
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  if (days <= 31) return "day";
  if (days <= 180) return "week";
  return "month";
}

function buildChartBuckets(from: Date, to: Date, granularity: Granularity) {
  const buckets: { start: Date; end: Date; label: string }[] = [];
  const MAX_BUCKETS = 60; // salvaguarda defensiva, en la práctica los umbrales de arriba ya lo acotan
  if (granularity === "day") {
    let cur = startOfDay(from);
    while (cur <= to && buckets.length < MAX_BUCKETS) {
      buckets.push({ start: startOfDay(cur), end: endOfDay(cur), label: cur.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" }) });
      cur = addDays(cur, 1);
    }
  } else if (granularity === "week") {
    let cur = startOfWeek(from);
    while (cur <= to && buckets.length < MAX_BUCKETS) {
      const end = endOfWeek(cur);
      const fmt = (x: Date) => x.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
      buckets.push({ start: cur, end, label: `${fmt(cur)} - ${fmt(end)}` });
      cur = addDays(cur, 7);
    }
  } else {
    let cur = startOfMonth(from);
    while (cur <= to && buckets.length < MAX_BUCKETS) {
      buckets.push({ start: cur, end: endOfMonth(cur), label: cur.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }) });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }
  return buckets;
}

export default function Reports() {
  // Todos los hooks van primero, sin condicionar — los early return de
  // permisos/plan van después de que todos los hooks ya se ejecutaron.
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { isStarter, isPro, isBusiness, isRetail, loading: planLoading } = usePlan();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>("este_mes");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [chartScope, setChartScope] = useState<ChartScope>("todo");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  // Taller: todo lo que no sea Retail puro. Tienda: Business y Retail.
  const hasTaller = isPro || isBusiness;
  const hasTienda = isBusiness || isRetail;

  useEffect(() => { document.title = "Reportes | F7 Manager Pro"; }, []);

  useEffect(() => {
    const load = async () => {
      if (!user || !companyId || planLoading) return;
      setLoading(true);

      if (hasTaller) {
        const { data: o } = await supabase
          .from("orders")
          .select("id, quote_amount, senia_amount, cargos_adicionales, deposit_date, final_payment_date")
          .eq("company_id", companyId);
        const orderIds = (o ?? []).map((x: any) => x.id);
        let p: any[] = [];
        if (orderIds.length > 0) {
          const { data } = await (supabase as any)
            .from("order_parts")
            .select("order_id, quantity, historical_cost")
            .in("order_id", orderIds);
          p = data ?? [];
        }
        setOrders((o ?? []) as unknown as OrderRow[]);
        setParts(p as unknown as PartRow[]);
      }

      if (hasTienda) {
        const { data: s } = await (supabase as any)
          .from("product_sales")
          .select("quantity, unit_price, unit_cost, created_at")
          .eq("company_id", companyId);
        setSales((s ?? []) as SaleRow[]);
      }

      setLoading(false);
    };
    load();
  }, [user, companyId, planLoading, hasTaller, hasTienda]);

  const { from, to } = useMemo(() => getRange(timeframe, customRange), [timeframe, customRange]);

  const ingresosBrutosTaller = useMemo(() => revenueInRange(orders, from, to), [orders, from, to]);
  const costoRepuestos = useMemo(() => partsCostInRange(orders, parts, from, to), [orders, parts, from, to]);
  const ingresoNetoTaller = ingresosBrutosTaller - costoRepuestos;

  const ventasBrutasTienda = useMemo(() => salesRevenueInRange(sales, from, to), [sales, from, to]);
  const costoProductosVendidos = useMemo(() => salesCostInRange(sales, from, to), [sales, from, to]);
  const gananciaNetaTienda = ventasBrutasTienda - costoProductosVendidos;

  const gananciaNetaTotal = (hasTaller ? ingresoNetoTaller : 0) + (hasTienda ? gananciaNetaTienda : 0);

  const effectiveScope: ChartScope = hasTaller && hasTienda ? chartScope : hasTaller ? "taller" : "tienda";

  const chartRange = useMemo(() => {
    const now = new Date();
    const effFrom = from ?? earliestActivityDate(orders, sales) ?? startOfMonth(now);
    const effTo = to ?? now;
    return { from: effFrom, to: effTo };
  }, [from, to, orders, sales]);

  const granularity = useMemo(() => pickGranularity(chartRange.from, chartRange.to), [chartRange]);

  const chartData = useMemo(() => {
    const buckets = buildChartBuckets(chartRange.from, chartRange.to, granularity);
    return buckets.map((b) => {
      const taller = hasTaller ? revenueInRange(orders, b.start, b.end) : 0;
      const tienda = hasTienda ? salesRevenueInRange(sales, b.start, b.end) : 0;
      return { label: b.label, taller, tienda, total: taller + tienda };
    });
  }, [chartRange, granularity, orders, sales, hasTaller, hasTienda]);

  const chartKey = effectiveScope === "todo" ? "total" : effectiveScope === "taller" ? "taller" : "tienda";
  const chartLabel = effectiveScope === "todo" ? "Total" : effectiveScope === "taller" ? "Taller" : "Tienda";
  const granularityLabel = granularity === "day" ? "por día" : granularity === "week" ? "por semana" : "por mes";

  const rangeLabel = useMemo(() => {
    if (timeframe === "personalizado") {
      if (customRange?.from && customRange?.to) {
        return `${format(customRange.from, "d MMM", { locale: es })} – ${format(customRange.to, "d MMM", { locale: es })}`;
      }
      if (customRange?.from) return format(customRange.from, "d MMM", { locale: es });
      return "Elegí un rango";
    }
    return PRESET_LABELS[timeframe];
  }, [timeframe, customRange]);

  if (!roleLoading && !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="text-lg font-semibold">Acceso Denegado</div>
            <p className="text-sm text-muted-foreground">
              Solo los administradores pueden ver los reportes financieros.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!planLoading && isStarter) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes financieros</h1>
          <p className="text-sm text-muted-foreground">
            {hasTaller && hasTienda
              ? "Taller y tienda, juntos: ingresos, costos y ganancia real."
              : hasTienda
                ? "Ventas, costos y ganancia neta de tu tienda."
                : "Ingresos, costos de repuestos y ganancia neta."}
          </p>
        </div>

        <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2" aria-label="Filtro de fecha">
              <CalendarDays className="h-4 w-4" />
              {rangeLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="flex flex-col sm:flex-row">
              <div className="flex w-full shrink-0 flex-col gap-0.5 border-b border-border p-2 sm:w-40 sm:border-b-0 sm:border-r">
                {PRESET_ORDER.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setTimeframe(key); setDateFilterOpen(false); }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                      timeframe === key ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                    )}
                  >
                    {PRESET_LABELS[key]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTimeframe("personalizado")}
                  className={cn(
                    "mt-1 rounded-md border-t border-border px-3 py-1.5 pt-2.5 text-left text-sm transition-colors",
                    timeframe === "personalizado" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                  )}
                >
                  Rango personalizado
                </button>
              </div>
              {timeframe === "personalizado" && (
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => {
                    setCustomRange(range);
                    if (range?.from && range?.to) setDateFilterOpen(false);
                  }}
                  numberOfMonths={2}
                  locale={es}
                  disabled={{ after: new Date() }}
                  initialFocus
                />
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {hasTaller && hasTienda && (
        <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <div className="text-sm text-muted-foreground">Ganancia Neta Total (Taller + Tienda)</div>
              <div className={`mt-1 text-3xl font-bold ${gananciaNetaTotal >= 0 ? "text-primary" : "text-destructive"}`}>
                {formatPYG(gananciaNetaTotal)}
              </div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-primary">
              {gananciaNetaTotal >= 0 ? <TrendingUp className="h-7 w-7" /> : <TrendingDown className="h-7 w-7" />}
            </div>
          </CardContent>
        </Card>
      )}

      <div className={`grid gap-6 ${hasTaller && hasTienda ? "lg:grid-cols-2" : ""}`}>
        {hasTaller && (
          <ReportBlock title="Taller" icon={Wrench}>
            <SummaryCard
              icon={Wallet}
              label="Ingresos Brutos"
              value={ingresosBrutosTaller}
              accent="text-foreground"
              iconBg="bg-accent text-accent-foreground"
            />
            <SummaryCard
              icon={PackageMinus}
              label="Costo de Repuestos"
              value={costoRepuestos}
              accent="text-orange-500 dark:text-orange-400"
              iconBg="bg-orange-500/10 text-orange-500 dark:text-orange-400"
              prefix="-"
            />
            <SummaryCard
              icon={ingresoNetoTaller >= 0 ? TrendingUp : TrendingDown}
              label="Ingreso Neto"
              value={ingresoNetoTaller}
              accent="text-primary"
              iconBg="bg-primary/10 text-primary"
            />
          </ReportBlock>
        )}

        {hasTienda && (
          <ReportBlock title="Tienda" icon={ShoppingBag}>
            <SummaryCard
              icon={Wallet}
              label="Ventas Brutas"
              value={ventasBrutasTienda}
              accent="text-foreground"
              iconBg="bg-accent text-accent-foreground"
            />
            <SummaryCard
              icon={PackageMinus}
              label="Costo de Productos"
              value={costoProductosVendidos}
              accent="text-orange-500 dark:text-orange-400"
              iconBg="bg-orange-500/10 text-orange-500 dark:text-orange-400"
              prefix="-"
            />
            <SummaryCard
              icon={gananciaNetaTienda >= 0 ? TrendingUp : TrendingDown}
              label="Ganancia Neta"
              value={gananciaNetaTienda}
              accent="text-primary"
              iconBg="bg-primary/10 text-primary"
            />
          </ReportBlock>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {chartLabel} · {granularityLabel}
          </CardTitle>
          {hasTaller && hasTienda && (
            <Select value={chartScope} onValueChange={(v) => setChartScope(v as ChartScope)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="taller">Solo Taller</SelectItem>
                <SelectItem value="tienda">Solo Tienda</SelectItem>
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      const n = Number(v);
                      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                      if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
                      return String(n);
                    }}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--accent))", opacity: 0.4 }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [formatPYG(Number(v)), chartLabel]}
                  />
                  <Bar dataKey={chartKey} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportBlock({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="grid gap-3">
        {children}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
  iconBg,
  prefix,
}: {
  icon: any;
  label: string;
  value: number;
  accent?: string;
  iconBg?: string;
  prefix?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className={`text-2xl font-bold ${accent ?? ""}`}>
            {prefix}{formatPYG(value)}
          </div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${iconBg ?? "bg-accent text-accent-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
