import { useEffect, useMemo, useState } from "react";
import { Boxes, ClipboardList, Clock, MessageCircle, PackageSearch, PackageX, Printer, Timer, Trophy, UserX, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useBranches } from "@/hooks/useBranches";
import { useCategories } from "@/hooks/useCategories";
import { useOrderStatusPresets } from "@/hooks/useOrderStatusPresets";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import KpiHint from "@/components/KpiHint";
import { formatPYG, resolveStatusLabel } from "@/lib/orders";
import { normalizedRealPhone } from "@/lib/clients";
import { openWhatsApp, toWhatsAppPhone } from "@/lib/whatsapp";
import {
  DAY_MS,
  buildCountSheetHtml,
  findIdleStock,
  findReorder,
  formatDaysAmount,
  lapsedClients,
  onTimeDelivery,
  reorderListText,
  stageDurations,
  topServices,
  type HistoryRow,
  type OrderInsightRow,
  type StockItem,
} from "@/lib/reportInsights";

const USAGE_HISTORY_DAYS = 365;
const LAPSED_DAYS = 90;
const HISTORY_CHUNK = 150;
const HISTORY_ORDER_CAP = 600;
const PREVIEW_ROWS = 8;
const ALL_BRANCHES = "all";

type InventoryRow = StockItem & { is_for_repair: boolean; is_for_sale: boolean };
type UsageRow = { inventory_item_id: string | null; created_at: string };

async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await build(offset, offset + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ReportsInsights({
  from,
  to,
  hasTaller,
  hasTienda,
}: {
  from: Date | null;
  to: Date | null;
  hasTaller: boolean;
  hasTienda: boolean;
}) {
  const { companyId } = useCompany();
  const { branches, hasMultipleBranches } = useBranches();
  const { categories } = useCategories();
  const { presets } = useOrderStatusPresets();
  const { toast } = useToast();

  const [items, setItems] = useState<InventoryRow[] | null>(null);
  const [lastUsedAt, setLastUsedAt] = useState<Map<string, number>>(new Map());
  const [orders, setOrders] = useState<OrderInsightRow[] | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [historyCapped, setHistoryCapped] = useState(false);
  const [idleDays, setIdleDays] = useState("60");
  const [showAllIdle, setShowAllIdle] = useState(false);
  const [showAllReorder, setShowAllReorder] = useState(false);
  const [showAllLapsed, setShowAllLapsed] = useState(false);
  const [countBranch, setCountBranch] = useState(ALL_BRANCHES);

  const fromMs = from?.getTime() ?? null;
  const toMs = to?.getTime() ?? null;

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    const load = async () => {
      try {
        const since = new Date(Date.now() - USAGE_HISTORY_DAYS * DAY_MS).toISOString();

        const [itemRows, partRows, saleRows] = await Promise.all([
          fetchAllPages<InventoryRow>((a, b) => {
            const base = supabase
              .from("inventory_items")
              .select("id, name, stock, min_stock_alert, cost_price, created_at, branch_id, category_id, is_for_repair, is_for_sale")
              .eq("company_id", companyId);
            const scoped =
              hasTaller && hasTienda
                ? base.or("is_for_repair.eq.true,is_for_sale.eq.true")
                : hasTaller
                  ? base.eq("is_for_repair", true)
                  : base.eq("is_for_sale", true);
            return scoped.order("id").range(a, b);
          }),
          hasTaller
            ? fetchAllPages<UsageRow>((a, b) =>
                supabase
                  .from("order_parts")
                  .select("inventory_item_id, created_at, inventory_items!inner(company_id)")
                  .eq("inventory_items.company_id", companyId)
                  .gte("created_at", since)
                  .not("inventory_item_id", "is", null)
                  .order("id")
                  .range(a, b),
              )
            : Promise.resolve<UsageRow[]>([]),
          hasTienda
            ? fetchAllPages<UsageRow>((a, b) =>
                supabase
                  .from("product_sales")
                  .select("inventory_item_id, created_at")
                  .eq("company_id", companyId)
                  .gte("created_at", since)
                  .not("inventory_item_id", "is", null)
                  .order("id")
                  .range(a, b),
              )
            : Promise.resolve<UsageRow[]>([]),
        ]);

        const used = new Map<string, number>();
        for (const r of [...partRows, ...saleRows]) {
          if (!r.inventory_item_id) continue;
          const ms = new Date(r.created_at).getTime();
          if (ms > (used.get(r.inventory_item_id) ?? 0)) used.set(r.inventory_item_id, ms);
        }
        if (!active) return;
        setItems(itemRows);
        setLastUsedAt(used);
      } catch (e) {
        console.warn("No se pudo cargar el inventario para los análisis", e);
        if (!active) return;
        setItems([]);
        toast({ title: "No se pudo cargar el análisis de inventario", variant: "destructive" });
      }
    };
    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, hasTaller, hasTienda]);

  useEffect(() => {
    if (!companyId || !hasTaller) return;
    let active = true;
    const load = async () => {
      try {
        const rows = await fetchAllPages<OrderInsightRow>((a, b) =>
          supabase
            .from("orders")
            .select("id, client_id, customer_name, customer_phone, created_at, status, problems, quote_amount, cargos_adicionales, estimated_delivery_date, delivered_at")
            .eq("company_id", companyId)
            .order("id")
            .range(a, b),
        );
        if (active) setOrders(rows);
      } catch (e) {
        console.warn("No se pudieron cargar las órdenes para los análisis", e);
        if (!active) return;
        setOrders([]);
        toast({ title: "No se pudo cargar el análisis del taller", variant: "destructive" });
      }
    };
    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, hasTaller]);

  useEffect(() => {
    if (!orders) return;
    let active = true;
    const load = async () => {
      const inPeriod = orders
        .filter((o) => {
          const t = new Date(o.created_at).getTime();
          return (fromMs === null || t >= fromMs) && (toMs === null || t <= toMs);
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const capped = inPeriod.length > HISTORY_ORDER_CAP;
      const ids = inPeriod.slice(0, HISTORY_ORDER_CAP).map((o) => o.id);
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += HISTORY_CHUNK) chunks.push(ids.slice(i, i + HISTORY_CHUNK));
        const parts = await Promise.all(
          chunks.map((chunk) =>
            supabase
              .from("order_status_history")
              .select("order_id, status, created_at")
              .in("order_id", chunk)
              .order("created_at", { ascending: true })
              .then(({ data, error }) => {
                if (error) throw error;
                return (data ?? []) as HistoryRow[];
              }),
          ),
        );
        if (!active) return;
        setHistory(parts.flat());
        setHistoryCapped(capped);
      } catch (e) {
        console.warn("No se pudo cargar el historial de estados", e);
        if (!active) return;
        setHistory([]);
        setHistoryCapped(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [orders, fromMs, toMs]);

  const statusLabel = (key: string) => resolveStatusLabel(key, presets);
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Sin categoría";
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? null;

  const idle = useMemo(
    () => (items ? findIdleStock(items, lastUsedAt, Number(idleDays), USAGE_HISTORY_DAYS) : null),
    [items, lastUsedAt, idleDays],
  );
  const reorder = useMemo(() => (items ? findReorder(items) : null), [items]);
  const services = useMemo(() => (orders ? topServices(orders, from, to) : []), [orders, from, to]);
  const onTime = useMemo(() => (orders ? onTimeDelivery(orders, from, to) : null), [orders, from, to]);
  const stages = useMemo(() => (history ? stageDurations(history) : []), [history]);
  const lapsed = useMemo(() => (orders ? lapsedClients(orders, LAPSED_DAYS) : []), [orders]);

  const maxStageDays = Math.max(0, ...stages.map((s) => s.avgDays ?? 0));

  const copyReorderList = async () => {
    if (!reorder || reorder.length === 0) return;
    try {
      await navigator.clipboard.writeText(reorderListText(reorder));
      toast({ title: "Lista copiada", description: `${reorder.length} artículos para reponer.` });
    } catch {
      toast({ title: "No se pudo copiar", description: "Tu navegador no permitió acceder al portapapeles.", variant: "destructive" });
    }
  };

  const openCountSheet = () => {
    if (!items) return;
    const rows = items
      .filter((i) => countBranch === ALL_BRANCHES || i.branch_id === countBranch)
      .map((i) => ({ name: i.name, category: categoryName(i.category_id), branch: branchName(i.branch_id), stock: i.stock }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    const branchLabel = countBranch === ALL_BRANCHES ? "Todas las sucursales" : branchName(countBranch) ?? "";
    const html = buildCountSheetHtml({
      title: "Hoja de conteo de inventario",
      subtitle: `${new Date().toLocaleDateString("es-PY")} · ${branchLabel || "Inventario"} · ${rows.length} artículos`,
      rows,
      showBranch: hasMultipleBranches && countBranch === ALL_BRANCHES,
    });
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      toast({ title: "Se bloqueó la ventana", description: "Permití las ventanas emergentes de este sitio para imprimir la hoja.", variant: "destructive" });
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const sendReturnMessage = (name: string, phone: string) => {
    const wa = toWhatsAppPhone(phone);
    if (!wa) return;
    const first = name.trim().split(/\s+/)[0] || "";
    openWhatsApp(
      wa,
      `Hola${first ? ` ${first}` : ""}, ¿cómo estás? Hace un tiempo que no pasás por el taller. ¿Cómo anda tu equipo? Si necesitás algo, escribinos y te ayudamos.`,
    );
  };

  const idleRows = idle?.rows ?? [];
  const reorderRows = reorder ?? [];
  const visibleIdle = showAllIdle ? idleRows : idleRows.slice(0, PREVIEW_ROWS);
  const visibleReorder = showAllReorder ? reorderRows : reorderRows.slice(0, PREVIEW_ROWS);
  const visibleLapsed = showAllLapsed ? lapsed : lapsed.slice(0, PREVIEW_ROWS);

  return (
    <section data-testid="reports-insights" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Para decidir mejor</h2>
        <p className="text-sm text-muted-foreground">
          Lo que ya registrás en el sistema, ordenado para que veas qué mirar primero. Los análisis del taller usan el período elegido arriba.
        </p>
      </div>

      {hasTaller && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-primary" /> Taller
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <InsightCard title="Entregas a tiempo" icon={Timer} testId="insight-on-time" hint="De los equipos entregados en este período que tenían fecha de entrega prometida, cuántos se entregaron el día prometido o antes. Los entregados sin fecha prometida no entran en el porcentaje.">
              {onTime === null ? (
                <Loading />
              ) : onTime.pct === null ? (
                <Empty>
                  Todavía no hay entregas con fecha prometida en este período.
                  {onTime.withoutDate > 0 &&
                    ` (${onTime.withoutDate === 1 ? "1 se entregó" : `${onTime.withoutDate} se entregaron`} sin fecha prometida.)`}
                </Empty>
              ) : (
                <div className="space-y-1">
                  <div className="text-3xl font-bold" data-testid="on-time-pct">{onTime.pct}%</div>
                  <div className="text-sm text-muted-foreground">
                    {onTime.onTime} de {onTime.withDate} entregas llegaron en la fecha prometida o antes.
                  </div>
                  {onTime.late > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {onTime.late === 1
                        ? `La entrega tardía se demoró ${formatDaysAmount(onTime.avgLateDays)}.`
                        : `Las ${onTime.late} tardías se demoraron ${formatDaysAmount(onTime.avgLateDays)} en promedio.`}
                    </div>
                  )}
                  {onTime.withoutDate > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {onTime.withoutDate === 1
                        ? "1 entrega sin fecha prometida no se cuenta."
                        : `${onTime.withoutDate} entregas sin fecha prometida no se cuentan.`}
                    </div>
                  )}
                </div>
              )}
            </InsightCard>

            <InsightCard title="Servicios más pedidos" icon={Trophy} testId="insight-services" hint="Los problemas que más se cargaron en las órdenes creadas en este período, con el ticket promedio (presupuesto más cargos adicionales) de esas órdenes. Una orden con varios problemas cuenta una vez en cada uno. Los presupuestos sin convertir no cuentan.">
              {orders === null ? (
                <Loading />
              ) : services.length === 0 ? (
                <Empty>No hay órdenes con problemas cargados en este período.</Empty>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="pb-1 text-left font-normal">Servicio</th>
                      <th className="pb-1 text-right font-normal">Órdenes</th>
                      <th className="pb-1 text-right font-normal">Ticket prom.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((s) => (
                      <tr key={s.name} className="border-t border-border/50">
                        <td className="py-1.5">{s.name}</td>
                        <td className="py-1.5 text-right font-medium">{s.count}</td>
                        <td className="py-1.5 text-right text-muted-foreground">{s.avgTicket > 0 ? formatPYG(s.avgTicket) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </InsightCard>

            <InsightCard title="Tiempo en cada etapa" icon={Clock} testId="insight-stages" hint="Cuánto estuvieron las órdenes creadas en este período en cada estado, en promedio, según el historial de cambios de estado. La etapa en la que está hoy una orden no cuenta hasta que sale de ella. Sirve para ver dónde se demora el taller.">
              {history === null ? (
                <Loading />
              ) : stages.filter((s) => s.avgDays !== null).length === 0 ? (
                <Empty>Todavía no hay órdenes que hayan cambiado de estado en este período.</Empty>
              ) : (
                <div className="space-y-2">
                  {stages.map((s) => (
                    <div key={s.status} className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span>
                          {statusLabel(s.status)}
                          <span className="ml-1.5 text-xs text-muted-foreground">({s.orders} {s.orders === 1 ? "orden" : "órdenes"})</span>
                        </span>
                        <span className="font-medium">{s.avgDays === null ? "—" : formatDaysAmount(s.avgDays)}</span>
                      </div>
                      {s.avgDays !== null && maxStageDays > 0 && (
                        <div className="h-1.5 w-full rounded-full bg-muted">
                          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.max(4, (s.avgDays / maxStageDays) * 100)}%` }} />
                        </div>
                      )}
                    </div>
                  ))}
                  {historyCapped && (
                    <p className="text-xs text-muted-foreground">Calculado sobre las {HISTORY_ORDER_CAP} órdenes más recientes del período.</p>
                  )}
                </div>
              )}
            </InsightCard>

            <InsightCard title={`Clientes que no volvieron (${LAPSED_DAYS} días)`} icon={UserX} testId="insight-lapsed" hint={`Clientes que ya tuvieron al menos una orden, cuya última orden fue hace más de ${LAPSED_DAYS} días y que no tienen ninguna orden abierta. No depende del período elegido. Tocá WhatsApp para escribirles un mensaje que podés editar antes de enviar.`}>
              {orders === null ? (
                <Loading />
              ) : lapsed.length === 0 ? (
                <Empty>No hay clientes que lleven más de {LAPSED_DAYS} días sin volver.</Empty>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <span className="text-2xl font-bold text-foreground" data-testid="lapsed-count">{lapsed.length}</span>{" "}
                    {lapsed.length === 1 ? "cliente" : "clientes"} sin volver. Los que se fueron hace menos tiempo son los más fáciles de recuperar.
                  </div>
                  <ul className="divide-y divide-border/50 text-sm">
                    {visibleLapsed.map((c) => {
                      const canWrite = !!normalizedRealPhone(c.phone) && !!toWhatsAppPhone(c.phone);
                      return (
                        <li key={c.key} className="flex items-center justify-between gap-2 py-1.5" data-testid="lapsed-row">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Última orden {formatDate(c.lastOrderAt)} · hace {c.daysSince} días · {c.orders} {c.orders === 1 ? "orden" : "órdenes"}
                            </div>
                          </div>
                          {canWrite ? (
                            <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => sendReturnMessage(c.name, c.phone)}>
                              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                            </Button>
                          ) : (
                            <span className="shrink-0 text-xs text-muted-foreground">Sin teléfono</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {lapsed.length > PREVIEW_ROWS && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAllLapsed((v) => !v)}>
                      {showAllLapsed ? "Ver menos" : `Ver los ${lapsed.length}`}
                    </Button>
                  )}
                </div>
              )}
            </InsightCard>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Boxes className="h-4 w-4 text-primary" /> Inventario
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <InsightCard title="Dinero parado" icon={PackageX} testId="insight-idle" hint="Plata inmovilizada en artículos con stock que no tuvieron movimiento en el plazo elegido: no se usaron en ninguna orden ni se vendieron (o se cargaron hace menos que ese plazo, en cuyo caso no cuentan). Se calcula como stock por costo de cada artículo." headerExtra={
            <Select value={idleDays} onValueChange={(v) => { setIdleDays(v); setShowAllIdle(false); }}>
              <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Plazo sin movimiento"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 días</SelectItem>
                <SelectItem value="60">60 días</SelectItem>
                <SelectItem value="90">90 días</SelectItem>
                <SelectItem value="180">180 días</SelectItem>
              </SelectContent>
            </Select>
          }>
            {idle === null ? (
              <Loading />
            ) : idleRows.length === 0 ? (
              <Empty>No hay artículos con stock sin movimiento en {idleDays} días.</Empty>
            ) : (
              <div className="space-y-2">
                <div>
                  <div className="text-3xl font-bold" data-testid="idle-total">{formatPYG(idle.totalValue)}</div>
                  <div className="text-xs text-muted-foreground">
                    en {idleRows.length} {idleRows.length === 1 ? "artículo" : "artículos"} sin movimiento hace {idleDays} días o más.
                  </div>
                </div>
                <ul className="divide-y divide-border/50 text-sm">
                  {visibleIdle.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 py-1.5" data-testid="idle-row">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.stock} en stock · {r.idleDaysIsMinimum ? `más de ${r.idleDays}` : r.idleDays} días sin movimiento
                          {hasMultipleBranches && branchName(r.branch_id) ? ` · ${branchName(r.branch_id)}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 font-medium">{formatPYG(r.value)}</span>
                    </li>
                  ))}
                </ul>
                {idleRows.length > PREVIEW_ROWS && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAllIdle((v) => !v)}>
                    {showAllIdle ? "Ver menos" : `Ver los ${idleRows.length}`}
                  </Button>
                )}
              </div>
            )}
          </InsightCard>

          <InsightCard title="Lista de reposición" icon={PackageSearch} testId="insight-reorder" hint="Artículos cuyo stock llegó al mínimo que definiste (o por debajo), los agotados primero. Es el mismo criterio de la alerta de stock bajo de Inventario." headerExtra={
            reorderRows.length > 0 ? (
              <Button size="sm" variant="outline" className="h-8" onClick={copyReorderList}>Copiar lista</Button>
            ) : undefined
          }>
            {reorder === null ? (
              <Loading />
            ) : reorderRows.length === 0 ? (
              <Empty>Todo el stock está por encima del mínimo.</Empty>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  <span className="text-2xl font-bold text-foreground" data-testid="reorder-count">{reorderRows.length}</span>{" "}
                  {reorderRows.length === 1 ? "artículo" : "artículos"} para reponer.
                </div>
                <ul className="divide-y divide-border/50 text-sm">
                  {visibleReorder.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 py-1.5" data-testid="reorder-row">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Stock {r.stock} · mínimo {r.min_stock_alert}
                          {hasMultipleBranches && branchName(r.branch_id) ? ` · ${branchName(r.branch_id)}` : ""}
                        </div>
                      </div>
                      <Badge variant={r.status === "agotado" ? "destructive" : "secondary"}>{r.status === "agotado" ? "Agotado" : "Bajo"}</Badge>
                    </li>
                  ))}
                </ul>
                {reorderRows.length > PREVIEW_ROWS && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAllReorder((v) => !v)}>
                    {showAllReorder ? "Ver menos" : `Ver los ${reorderRows.length}`}
                  </Button>
                )}
              </div>
            )}
          </InsightCard>

          <InsightCard title="Hoja de conteo" icon={ClipboardList} testId="insight-count" hint="Una hoja imprimible con todos tus artículos y el stock que dice el sistema, con columnas en blanco para anotar lo que contás en el estante y la diferencia.">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Imprimí la lista del inventario, contá el stock físico y anotá la diferencia contra lo que dice el sistema.
              </p>
              {hasMultipleBranches && (
                <Select value={countBranch} onValueChange={setCountBranch}>
                  <SelectTrigger className="h-9" aria-label="Sucursal de la hoja de conteo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_BRANCHES}>Todas las sucursales</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={openCountSheet} disabled={!items || items.length === 0} className="gap-2" data-testid="open-count-sheet">
                <Printer className="h-4 w-4" /> Imprimir hoja de conteo
              </Button>
            </div>
          </InsightCard>
        </div>
      </div>
    </section>
  );
}

function InsightCard({
  title,
  icon: Icon,
  hint,
  testId,
  headerExtra,
  children,
}: {
  title: string;
  icon: LucideIcon;
  hint: string;
  testId: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon className="h-4 w-4 text-primary" /> {title}
            <KpiHint label={title} text={hint} />
          </div>
          {headerExtra}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Loading() {
  return <p className="text-sm text-muted-foreground">Cargando…</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
