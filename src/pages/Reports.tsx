import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPYG } from "@/lib/orders";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Wallet, TrendingUp, PackageMinus, TrendingDown, ShieldAlert } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

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

type Timeframe = "este_mes" | "mes_pasado" | "todo";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth()+1, 0, 23, 59, 59, 999); }

function totalOf(o: OrderRow) {
  const cargos = (o.cargos_adicionales ?? []).reduce((s, c) => s + Number(c?.monto ?? 0), 0);
  return Number(o.quote_amount ?? 0) + cargos;
}

function getRange(tf: Timeframe): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (tf === "este_mes") return { from: startOfMonth(now), to: endOfMonth(now) };
  if (tf === "mes_pasado") {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { from: startOfMonth(prev), to: endOfMonth(prev) };
  }
  return { from: null, to: null };
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

export default function Reports() {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { isStarter, loading: planLoading } = usePlan();
  const { isAdmin, loading: roleLoading } = useUserRole();
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
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>("este_mes");

  useEffect(() => { document.title = "Reportes | F7 Manager Pro"; }, []);

  useEffect(() => {
    const load = async () => {
      if (!user || !companyId) return;
      setLoading(true);
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
      setLoading(false);
    };
    load();
  }, [user, companyId]);

  const { from, to } = useMemo(() => getRange(timeframe), [timeframe]);

  const ingresosBrutos = useMemo(
    () => revenueInRange(orders, from, to),
    [orders, from, to]
  );
  const costoRepuestos = useMemo(
    () => partsCostInRange(orders, parts, from, to),
    [orders, parts, from, to]
  );
  const ingresoNeto = ingresosBrutos - costoRepuestos;

  const chartData = useMemo(() => {
    const now = new Date();
    const data: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      data.push({
        label: d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" }),
        total: revenueInRange(orders, startOfDay(d), endOfDay(d)),
      });
    }
    return data;
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes financieros</h1>
          <p className="text-sm text-muted-foreground">
            Ingresos, costos de repuestos y ganancia neta.
          </p>
        </div>
        <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="este_mes">Este mes</SelectItem>
            <SelectItem value="mes_pasado">Mes pasado</SelectItem>
            <SelectItem value="todo">Todo el tiempo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          icon={Wallet}
          label="Ingresos Brutos"
          value={ingresosBrutos}
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
          icon={ingresoNeto >= 0 ? TrendingUp : TrendingDown}
          label="Ingreso Neto (Ganancia)"
          value={ingresoNeto}
          accent="text-primary"
          iconBg="bg-primary/10 text-primary"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Ingresos últimos 7 días
          </CardTitle>
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
                    formatter={(v: number) => [formatPYG(Number(v)), "Ingresos"]}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
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
