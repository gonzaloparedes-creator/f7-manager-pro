import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, Plus, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  breakdownByCategory,
  computePending,
  computeTotals,
  emptyDraft,
  formatEntryAmount,
  formatGs,
  formatPct,
  monthlyFixedCost,
  monthlySeries,
  unregisteredReceipts,
  upcomingDues,
  type CategorySlice,
  type F7Category,
  type F7Entry,
  type F7Recurring,
  type ReceiptLite,
  type Snapshot,
} from "@/lib/f7Finance";
import { formatDateISO } from "@/lib/subscriptionReceipt";
import { plural, relativeDays, type FinanceActions, type PeriodControl } from "./helpers";
import { Kpi, PeriodPicker, Segmented } from "./shared";

interface Props {
  entries: F7Entry[];
  categories: F7Category[];
  recurring: F7Recurring[];
  receipts: ReceiptLite[];
  snapshot: Snapshot;
  today: string;
  periodControl: PeriodControl;
  actions: FinanceActions;
}

const CHART_TOOLTIP = {
  cursor: { fill: "hsl(var(--accent))", opacity: 0.4 },
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  },
};

// Eje vertical corto: 1,5 M / 350 mil.
function compactGs(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toLocaleString("es-PY", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000).toLocaleString("es-PY")} mil`;
  return String(value);
}

const MAX_DUES = 8;

export function SummaryTab({ entries, categories, recurring, receipts, snapshot, today, periodControl, actions }: Props) {
  const { period } = periodControl;
  const [months, setMonths] = useState<"6" | "12">("6");
  const [detailOpen, setDetailOpen] = useState(false);

  const totals = useMemo(() => computeTotals(entries, period), [entries, period]);
  const pending = useMemo(() => computePending(entries, today), [entries, today]);
  const fixedMonthly = useMemo(() => monthlyFixedCost(recurring, today), [recurring, today]);
  const series = useMemo(() => monthlySeries(entries, today, Number(months)), [entries, today, months]);
  const ingresosSlices = useMemo(() => breakdownByCategory(entries, "ingreso", period, categories), [entries, period, categories]);
  const gastosSlices = useMemo(() => breakdownByCategory(entries, "gasto", period, categories), [entries, period, categories]);
  const dues = useMemo(() => upcomingDues(entries, today, 30), [entries, today]);
  const unregistered = useMemo(() => unregisteredReceipts(receipts, entries).length, [receipts, entries]);

  const dueRows = [...dues.overdue, ...dues.upcoming];
  const chartHasData = series.some((p) => p.ingresos > 0 || p.gastos > 0);
  const resultTone = totals.resultado > 0 ? "good" : totals.resultado < 0 ? "bad" : undefined;
  const resultAccent = totals.resultado > 0 ? "primary" : totals.resultado < 0 ? "destructive" : "neutral";

  return (
    <div className="space-y-4">
      {unregistered > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-secondary/40 bg-secondary/5 p-3" data-testid="receipts-notice">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <ReceiptText className="h-4 w-4 shrink-0 text-secondary" />
            <span>
              {unregistered === 1
                ? "Hay 1 recibo de suscripción que todavía no está registrado como ingreso."
                : `Hay ${unregistered} recibos de suscripción que todavía no están registrados como ingreso.`}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={actions.importReceipts} data-testid="receipts-notice-import">
            Importar recibos
          </Button>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker control={periodControl} />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => actions.newEntry(emptyDraft("ingreso", today))} data-testid="summary-add-ingreso">
            <Plus className="mr-1.5 h-4 w-4" />
            Ingreso
          </Button>
          <Button size="sm" variant="outline" onClick={() => actions.newEntry(emptyDraft("gasto", today))} data-testid="summary-add-gasto">
            <Plus className="mr-1.5 h-4 w-4" />
            Gasto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi
          label="Ingresos"
          value={formatGs(totals.ingresos)}
          hint={plural(totals.ingresosCount, "cobro", "cobros")}
          accent="primary"
          testId="kpi-ingresos"
        />
        <Kpi
          label="Gastos"
          value={formatGs(totals.gastos)}
          hint={plural(totals.gastosCount, "pago", "pagos")}
          accent="destructive"
          testId="kpi-gastos"
        />
        <Kpi
          label="Resultado"
          value={formatGs(totals.resultado)}
          hint={totals.margenPct != null ? `Margen ${formatPct(totals.margenPct)}` : "Sin ingresos en el período"}
          accent={resultAccent}
          tone={resultTone}
          className="col-span-2 md:col-span-1"
          testId="kpi-resultado"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Caja F7"
          value={formatGs(snapshot.caja)}
          hint="Plata disponible hoy"
          accent={snapshot.caja < 0 ? "destructive" : "primary"}
          tone={snapshot.caja < 0 ? "bad" : undefined}
          testId="kpi-caja"
        />
        <Kpi
          label="Por cobrar"
          value={formatGs(pending.porCobrar)}
          hint={
            pending.porCobrarCount === 0
              ? "Nada pendiente"
              : `${plural(pending.porCobrarCount, "cobro", "cobros")}${pending.porCobrarVencidoCount > 0 ? ` · ${pending.porCobrarVencidoCount} vencido${pending.porCobrarVencidoCount === 1 ? "" : "s"}` : ""}`
          }
          accent={pending.porCobrarVencidoCount > 0 ? "destructive" : "secondary"}
          testId="kpi-por-cobrar"
        />
        <Kpi
          label="Por pagar"
          value={formatGs(pending.porPagar)}
          hint={
            pending.porPagarCount === 0
              ? "Nada pendiente"
              : `${plural(pending.porPagarCount, "pago", "pagos")}${pending.porPagarVencidoCount > 0 ? ` · ${pending.porPagarVencidoCount} vencido${pending.porPagarVencidoCount === 1 ? "" : "s"}` : ""}`
          }
          accent={pending.porPagarVencidoCount > 0 ? "destructive" : "secondary"}
          testId="kpi-por-pagar"
        />
        <Kpi label="Costo fijo mensual" value={formatGs(fixedMonthly)} hint="Gastos fijos activos, por mes" testId="kpi-fijo" />
      </div>

      <Card data-testid="finance-chart-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-2">
          <CardTitle className="text-base">Ingresos y gastos por mes</CardTitle>
          <div className="w-44">
            <Segmented
              label="Cantidad de meses"
              value={months}
              onChange={(key) => setMonths(key === "12" ? "12" : "6")}
              options={[
                { key: "6", label: "6 meses" },
                { key: "12", label: "12 meses" },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Ingresos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-destructive" /> Gastos
            </span>
            <span>Solo cuenta lo ya cobrado y pagado.</span>
          </div>

          {chartHasData ? (
            <div className="h-56 w-full" data-testid="finance-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={compactGs}
                  />
                  <Tooltip {...CHART_TOOLTIP} formatter={(value: number, name: string) => [formatGs(value), name]} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gastos" name="Gastos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground" data-testid="finance-chart-empty">
              Todavía no hay ingresos ni gastos cobrados o pagados en estos meses.
            </p>
          )}

          <Collapsible open={detailOpen} onOpenChange={setDetailOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" data-testid="finance-month-detail-toggle">
                <ChevronDown className={cn("mr-1 h-4 w-4 transition-transform", detailOpen && "rotate-180")} />
                {detailOpen ? "Ocultar detalle por mes" : "Ver detalle por mes"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Table data-testid="finance-month-detail">
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">Gastos</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...series].reverse().map((point) => (
                    <TableRow key={point.key}>
                      <TableCell className="whitespace-nowrap font-medium">{point.label}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatGs(point.ingresos)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatGs(point.gastos)}</TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right font-semibold tabular-nums",
                          point.resultado > 0 && "text-primary",
                          point.resultado < 0 && "text-destructive"
                        )}
                      >
                        {formatGs(point.resultado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="Ingresos por categoría"
          slices={ingresosSlices}
          barClass="bg-primary"
          empty="No hay ingresos cobrados en este período."
          testId="breakdown-ingresos"
        />
        <BreakdownCard
          title="Gastos por categoría"
          slices={gastosSlices}
          barClass="bg-destructive"
          empty="No hay gastos pagados en este período."
          testId="breakdown-gastos"
        />
      </div>

      <Card data-testid="dues-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
          <CardTitle className="text-base">Próximos vencimientos</CardTitle>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={actions.goToPending} data-testid="dues-see-all">
            Ver pendientes
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {dueRows.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No hay cobros ni pagos pendientes para los próximos 30 días.</p>
          ) : (
            <>
              <ul className="divide-y divide-border border-t border-border">
                {dueRows.slice(0, MAX_DUES).map((entry) => (
                  <DueRow key={entry.id} entry={entry} today={today} onPay={actions.payEntry} />
                ))}
              </ul>
              {dueRows.length > MAX_DUES ? (
                <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                  y {dueRows.length - MAX_DUES} más en Movimientos.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BreakdownCard({
  title,
  slices,
  barClass,
  empty,
  testId,
}: {
  title: string;
  slices: CategorySlice[];
  barClass: string;
  empty: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-3">
            {slices.map((slice) => (
              <li key={slice.categoryId ?? "sin-categoria"} className="space-y-1" data-testid="breakdown-row">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {slice.name} <span className="text-xs text-muted-foreground">· {slice.count}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold">{formatGs(slice.total)}</span>{" "}
                    <span className="text-xs text-muted-foreground">{formatPct(slice.pct)}</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", barClass)} style={{ width: `${Math.min(100, Math.max(2, Math.round(slice.pct)))}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function dueText(entry: F7Entry, today: string): string {
  const overdue = entry.entry_date < today;
  const when = `${formatDateISO(entry.entry_date)} · ${relativeDays(today, entry.entry_date)}`;
  if (entry.kind === "ingreso") return overdue ? `Se esperaba cobrar el ${when}` : `Se cobra el ${when}`;
  return overdue ? `Venció el ${when}` : `Vence el ${when}`;
}

function DueRow({ entry, today, onPay }: { entry: F7Entry; today: string; onPay: (entry: F7Entry) => void }) {
  const overdue = entry.entry_date < today;
  const income = entry.kind === "ingreso";
  const { main, sub } = formatEntryAmount(entry);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" data-testid="due-row">
      <div className="min-w-0 flex-1 basis-48 space-y-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{entry.description}</span>
          <Badge
            variant="outline"
            className={cn("shrink-0", overdue ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-secondary/40 bg-secondary/10 text-secondary")}
          >
            {income ? "Por cobrar" : "Por pagar"}
          </Badge>
        </div>
        <div className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>{dueText(entry, today)}</div>
      </div>
      <div className="text-right">
        <div className={cn("text-sm font-semibold tabular-nums", income ? "text-primary" : "text-destructive")}>{main}</div>
        {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
      </div>
      <Button size="sm" variant="outline" className="h-8" onClick={() => onPay(entry)} data-testid="due-pay">
        {income ? "Marcar cobrado" : "Marcar pagado"}
      </Button>
    </li>
  );
}
