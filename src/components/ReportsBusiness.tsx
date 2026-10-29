import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Scale, Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InsightCard, InsightEmpty as Empty, InsightLoading as Loading } from "@/components/InsightCard";
import { fetchAllPages } from "@/lib/fetchAllPages";
import { formatMoney } from "@/lib/currency";
import {
  RFM_AT_RISK_DAYS,
  RFM_RECENT_DAYS,
  abcCurve,
  aggregateProductSales,
  breakEven,
  clientLtv,
  clientProfiles,
  monthlyFixedCosts,
  rfmGroups,
  type AbcClass,
  type AbcSaleRow,
  type BusinessHealth,
  type ClientOrderRow,
  type FixedCostRule,
  type RfmSegment,
} from "@/lib/businessInsights";

const PREVIEW_ROWS = 8;
const FIXED_COST_PREVIEW = 4;

export interface BusinessFinance {
  monthRevenue: number;
  monthCost: number;
  trailingRevenue: number;
  trailingCost: number;
}

const HEALTH: Record<Exclude<BusinessHealth, "sin_costos">, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; bar: string }> = {
  saludable: { label: "Saludable", variant: "default", bar: "bg-primary" },
  atencion: { label: "Atención", variant: "secondary", bar: "bg-secondary" },
  critico: { label: "Crítico", variant: "destructive", bar: "bg-destructive" },
  temprano: { label: "Muy pronto para decir", variant: "outline", bar: "bg-primary" },
};

const SEGMENTS: Record<RfmSegment, { label: string; detail: string; dot: string }> = {
  campeones: { label: "Campeones", detail: `3 o más visitas y volvieron en los últimos ${RFM_RECENT_DAYS} días`, dot: "bg-primary" },
  leales: { label: "Leales", detail: `2 visitas, la última en los últimos ${RFM_RECENT_DAYS} días`, dot: "bg-primary/60" },
  nuevos: { label: "Nuevos", detail: `1 visita en los últimos ${RFM_RECENT_DAYS} días, o una orden abierta`, dot: "bg-muted-foreground/60" },
  en_riesgo: { label: "En riesgo", detail: `Entre ${RFM_RECENT_DAYS + 1} y ${RFM_AT_RISK_DAYS} días sin volver`, dot: "bg-secondary" },
  hibernando: { label: "Dormidos", detail: `Más de ${RFM_AT_RISK_DAYS} días sin volver`, dot: "bg-muted-foreground/30" },
};

const ABC_BADGE: Record<AbcClass, "default" | "secondary" | "outline"> = { A: "default", B: "secondary", C: "outline" };

const pct = (n: number) => `${Math.round(n)}%`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function ReportsBusiness({
  from,
  to,
  hasTaller,
  hasTienda,
  finance,
}: {
  from: Date | null;
  to: Date | null;
  hasTaller: boolean;
  hasTienda: boolean;
  finance: BusinessFinance;
}) {
  const { companyId } = useCompany();
  const { toast } = useToast();

  const [rules, setRules] = useState<FixedCostRule[] | null>(null);
  const [sales, setSales] = useState<AbcSaleRow[] | null>(null);
  const [orders, setOrders] = useState<ClientOrderRow[] | null>(null);
  const [showAllAbc, setShowAllAbc] = useState(false);
  const [showAllFixed, setShowAllFixed] = useState(false);
  const [openSegment, setOpenSegment] = useState<RfmSegment | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("recurring_expenses")
        .select("amount, frequency, category, description")
        .eq("company_id", companyId)
        .eq("active", true);
      if (!active) return;
      if (error) {
        console.warn("No se pudieron cargar los gastos recurrentes", error);
        setRules([]);
        toast({ title: "No se pudo cargar el punto de equilibrio", variant: "destructive" });
        return;
      }
      setRules((data ?? []) as FixedCostRule[]);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    if (!companyId || !hasTienda) return;
    let active = true;
    (async () => {
      try {
        const rows = await fetchAllPages<AbcSaleRow>((a, b) =>
          (supabase as any)
            .from("product_sales")
            .select("inventory_item_id, product_name, quantity, unit_price, unit_cost, created_at")
            .eq("company_id", companyId)
            .order("id")
            .range(a, b),
        );
        if (active) setSales(rows);
      } catch (e) {
        console.warn("No se pudieron cargar las ventas para la curva ABC", e);
        if (!active) return;
        setSales([]);
        toast({ title: "No se pudo cargar la curva ABC", variant: "destructive" });
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, hasTienda]);

  useEffect(() => {
    if (!companyId || !hasTaller) return;
    let active = true;
    (async () => {
      try {
        const rows = await fetchAllPages<ClientOrderRow>((a, b) =>
          supabase
            .from("orders")
            .select("id, client_id, customer_name, customer_phone, created_at, status, quote_amount, cargos_adicionales")
            .eq("company_id", companyId)
            .order("id")
            .range(a, b),
        );
        if (active) setOrders(rows);
      } catch (e) {
        console.warn("No se pudieron cargar las órdenes para el análisis de clientes", e);
        if (!active) return;
        setOrders([]);
        toast({ title: "No se pudo cargar el análisis de clientes", variant: "destructive" });
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, hasTaller]);

  const fixed = useMemo(() => (rules ? monthlyFixedCosts(rules) : null), [rules]);

  const equilibrium = useMemo(() => {
    if (!fixed) return null;
    const now = new Date();
    return breakEven({
      fixedMonthly: fixed.total,
      ...finance,
      dayOfMonth: now.getDate(),
      daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    });
  }, [fixed, finance]);

  const abc = useMemo(() => (sales ? abcCurve(aggregateProductSales(sales, from, to)) : null), [sales, from, to]);
  const profiles = useMemo(() => (orders ? clientProfiles(orders) : null), [orders]);
  const groups = useMemo(() => (profiles ? rfmGroups(profiles) : null), [profiles]);
  const ltv = useMemo(() => (profiles ? clientLtv(profiles) : null), [profiles]);

  const visibleAbc = abc ? (showAllAbc ? abc.rows : abc.rows.slice(0, PREVIEW_ROWS)) : [];
  const fixedRows = fixed?.rows ?? [];
  const visibleFixed = showAllFixed ? fixedRows : fixedRows.slice(0, FIXED_COST_PREVIEW);

  return (
    <section data-testid="reports-business" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Números del negocio</h2>
        <p className="text-sm text-muted-foreground">
          Cuánto tenés que vender para cubrir tus costos fijos, qué productos y qué clientes sostienen el negocio.
        </p>
      </div>

      <InsightCard
        title="Punto de equilibrio"
        icon={Scale}
        testId="insight-break-even"
        hint="Cuánto tenés que cobrar en un mes para que la ganancia cubra tus costos fijos. Los costos fijos son tus gastos recurrentes activos (alquiler, sueldos, internet…; los semanales se pasan a un mes típico). La ganancia es lo cobrado menos el costo de repuestos y productos, igual que en el resto de Reportes. El margen sale de los últimos 90 días. No depende del período elegido arriba. Los gastos sueltos que no son recurrentes no entran."
        headerExtra={
          equilibrium && equilibrium.health !== "sin_costos" ? (
            <Badge variant={HEALTH[equilibrium.health].variant} data-testid="break-even-health">
              {HEALTH[equilibrium.health].label}
            </Badge>
          ) : undefined
        }
      >
        {equilibrium === null || fixed === null ? (
          <Loading />
        ) : equilibrium.health === "sin_costos" ? (
          <div className="space-y-2">
            <Empty>
              Todavía no cargaste costos fijos. Cargá tus gastos recurrentes (alquiler, sueldos, internet…) y acá vas a ver cuánto tenés que
              cobrar por mes para cubrirlos.
            </Empty>
            <Button asChild size="sm" variant="outline">
              <Link to="/gastos">
                <Wallet className="mr-1.5 h-3.5 w-3.5" /> Ir a Gastos recurrentes
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Costos fijos por mes</div>
                <div className="text-2xl font-bold" data-testid="fixed-total">{formatMoney(Math.round(equilibrium.fixedMonthly))}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Tenés que cobrar por mes</div>
                {equilibrium.breakEvenRevenue !== null ? (
                  <div className="text-2xl font-bold" data-testid="break-even-revenue">{formatMoney(Math.round(equilibrium.breakEvenRevenue))}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Todavía no hay un margen positivo para calcularlo.
                  </div>
                )}
                {equilibrium.marginPct !== null && (
                  <div className="text-xs text-muted-foreground">
                    Con un margen de {pct(equilibrium.marginPct)} sobre lo cobrado (últimos 90 días).
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">Este mes</span>
                <span className="text-muted-foreground" data-testid="coverage-pct">
                  {formatMoney(Math.round(equilibrium.monthProfit))} de ganancia · {pct(Math.max(0, equilibrium.coveragePct))} de los costos fijos
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full ${HEALTH[equilibrium.health].bar}`}
                  style={{ width: `${Math.min(100, Math.max(0, equilibrium.coveragePct))}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {equilibrium.remaining === 0
                  ? "Ya cubriste los costos fijos de este mes."
                  : `Te faltan ${formatMoney(Math.round(equilibrium.remaining))} de ganancia para cubrirlos.`}
                {equilibrium.projectedProfit !== null && equilibrium.remaining > 0 && (
                  <>
                    {" "}Al ritmo de hoy cerrarías el mes con {formatMoney(Math.round(Math.max(0, equilibrium.projectedProfit)))} de ganancia.
                  </>
                )}
                {equilibrium.projectedProfit === null && equilibrium.remaining > 0 && " Es muy pronto en el mes para proyectar cómo cerrás."}
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">De qué se compone</div>
              <ul className="divide-y divide-border/50 text-sm">
                {visibleFixed.map((r, i) => (
                  <li key={`${r.label}-${i}`} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="min-w-0 truncate">{r.label}</span>
                    <span className="shrink-0 text-muted-foreground">{formatMoney(Math.round(r.monthly))}</span>
                  </li>
                ))}
              </ul>
              {fixedRows.length > FIXED_COST_PREVIEW && (
                <Button variant="ghost" size="sm" onClick={() => setShowAllFixed((v) => !v)}>
                  {showAllFixed ? "Ver menos" : `Ver los ${fixedRows.length}`}
                </Button>
              )}
            </div>
          </div>
        )}
      </InsightCard>

      <div className="grid gap-4 md:grid-cols-2">
        {hasTienda && (
          <InsightCard
            title="Curva ABC de productos"
            icon={Crown}
            testId="insight-abc"
            hint="Ordena los productos vendidos en el período elegido de más a menos facturado. A son los pocos productos que juntan el 80 % de lo vendido: nunca deberían faltar. B son los que siguen hasta el 95 %. C es la cola larga: muchos productos que aportan poco."
          >
            {abc === null ? (
              <Loading />
            ) : abc.rows.length === 0 ? (
              <Empty>No hay ventas de productos en este período.</Empty>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2" data-testid="abc-summary">
                  {abc.summary.map((s) => (
                    <div key={s.klass} className="rounded-md border border-border/60 p-2">
                      <Badge variant={ABC_BADGE[s.klass]}>{s.klass}</Badge>
                      <div className="mt-1 text-sm font-semibold">{plural(s.products, "producto", "productos")}</div>
                      <div className="text-xs text-muted-foreground">{pct(s.revenuePct)} de lo vendido</div>
                    </div>
                  ))}
                </div>
                <ul className="divide-y divide-border/50 text-sm">
                  {visibleAbc.map((r) => (
                    <li key={r.key} className="flex items-center justify-between gap-2 py-1.5" data-testid="abc-row">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant={ABC_BADGE[r.klass]} className="shrink-0">{r.klass}</Badge>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {plural(r.units, "unidad", "unidades")} · {pct(r.sharePct)} del total · acumulado {pct(r.cumulativePct)}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-medium">{formatMoney(Math.round(r.revenue))}</div>
                        <div className="text-xs text-muted-foreground">gan. {formatMoney(Math.round(r.profit))}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                {abc.rows.length > PREVIEW_ROWS && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAllAbc((v) => !v)}>
                    {showAllAbc ? "Ver menos" : `Ver los ${abc.rows.length}`}
                  </Button>
                )}
              </div>
            )}
          </InsightCard>
        )}

        {hasTaller && (
          <>
            <InsightCard
              title="Clientes por grupo"
              icon={Users}
              testId="insight-rfm"
              hint={`Agrupa a tus clientes según cuánto hace que no vienen y cuántas veces vinieron (solo órdenes reales, sin presupuestos). Campeones y Leales vienen seguido; Nuevos son de una sola visita reciente; En riesgo y Dormidos son los que conviene recuperar. Mira toda la historia, no depende del período elegido. Tocá un grupo para ver sus mejores clientes.`}
            >
              {groups === null ? (
                <Loading />
              ) : groups.every((g) => g.count === 0) ? (
                <Empty>Todavía no hay órdenes para agrupar clientes.</Empty>
              ) : (
                <ul className="space-y-1">
                  {groups.map((g) => {
                    const meta = SEGMENTS[g.segment];
                    const isOpen = openSegment === g.segment;
                    return (
                      <li key={g.segment} data-testid={`rfm-${g.segment}`}>
                        <button
                          type="button"
                          disabled={g.count === 0}
                          onClick={() => setOpenSegment(isOpen ? null : g.segment)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center gap-3 rounded-md px-1 py-1.5 text-left hover:bg-muted/40 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                        >
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{meta.label}</span>
                            <span className="block text-xs text-muted-foreground">{meta.detail}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-semibold" data-testid="rfm-count">
                              {g.count} <span className="text-xs font-normal text-muted-foreground">({pct(g.pct)})</span>
                            </span>
                            <span className="block text-xs text-muted-foreground">{formatMoney(Math.round(g.value))}</span>
                          </span>
                        </button>
                        {isOpen && (
                          <ul className="mb-1 ml-6 divide-y divide-border/50 border-l border-border/60 pl-3 text-sm">
                            {g.clients.slice(0, 5).map((c) => (
                              <li key={c.key} className="flex items-center justify-between gap-2 py-1">
                                <div className="min-w-0">
                                  <div className="truncate">{c.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {plural(c.visits, "visita", "visitas")} · hace {c.daysSince} {c.daysSince === 1 ? "día" : "días"}
                                  </div>
                                </div>
                                <span className="shrink-0 text-muted-foreground">{formatMoney(Math.round(c.value))}</span>
                              </li>
                            ))}
                            {g.count > 5 && <li className="py-1 text-xs text-muted-foreground">y {g.count - 5} más</li>}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </InsightCard>

            <InsightCard
              title="Valor de cada cliente (LTV)"
              icon={Wallet}
              testId="insight-ltv"
              hint="Lo que dejó en promedio cada cliente que ya pagó al menos una orden, en toda su historia. Es lo facturado (presupuesto más cargos adicionales de las órdenes entregadas), sin descontar costos. Sirve para saber cuánto vale conseguir y cuidar a un cliente. No depende del período elegido."
            >
              {profiles === null ? (
                <Loading />
              ) : ltv === null ? (
                <Empty>Todavía no hay clientes con órdenes entregadas.</Empty>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold" data-testid="ltv-avg">{formatMoney(Math.round(ltv.avgValue))}</div>
                    <div className="text-xs text-muted-foreground">
                      en promedio por cliente, entre {plural(ltv.clients, "cliente", "clientes")} que ya pagaron.
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-lg font-semibold" data-testid="ltv-return">{pct(ltv.returnRatePct)}</div>
                      <div className="text-xs text-muted-foreground">volvió a pagar otra orden</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{ltv.avgOrders.toFixed(1).replace(".", ",")}</div>
                      <div className="text-xs text-muted-foreground">órdenes por cliente</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid="ltv-top">
                    El {ltv.topTenCount === 1 ? "mejor cliente aporta" : `10 % de arriba (${ltv.topTenCount} clientes) aporta`}{" "}
                    <span className="font-semibold text-foreground">{pct(ltv.topTenSharePct)}</span> de lo facturado.
                  </p>
                  <ul className="divide-y divide-border/50 text-sm">
                    {ltv.topClients.map((c) => (
                      <li key={c.key} className="flex items-center justify-between gap-2 py-1.5" data-testid="ltv-row">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{plural(c.delivered, "orden entregada", "órdenes entregadas")}</div>
                        </div>
                        <span className="shrink-0 font-medium">{formatMoney(Math.round(c.value))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </InsightCard>
          </>
        )}
      </div>
    </section>
  );
}
