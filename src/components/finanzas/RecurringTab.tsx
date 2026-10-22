import { useMemo } from "react";
import { CalendarClock, Info, Pause, Pencil, Play, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  FREQUENCY_LABELS,
  buildLookups,
  categoryName,
  formatEntryAmount,
  formatGs,
  isPending,
  monthlyEquivalent,
  monthlyFixedCost,
  nextDue,
  partnerName,
  recurringPyg,
  type F7Category,
  type F7Entry,
  type F7Partner,
  type F7Recurring,
} from "@/lib/f7Finance";
import { formatDateISO } from "@/lib/subscriptionReceipt";
import { plural, relativeDays, type FinanceActions } from "./helpers";
import { EmptyState, Kpi } from "./shared";

interface Props {
  recurring: F7Recurring[];
  categories: F7Category[];
  partners: F7Partner[];
  entries: F7Entry[];
  today: string;
  actions: FinanceActions;
}

type TemplateState = "activo" | "pausado" | "terminado";

function templateState(t: F7Recurring, today: string): TemplateState {
  if (t.end_date != null && t.end_date < today) return "terminado";
  return t.active ? "activo" : "pausado";
}

const STATE_ORDER: Record<TemplateState, number> = { activo: 0, pausado: 1, terminado: 2 };

const STATE_BADGE: Record<TemplateState, string> = {
  activo: "border-primary/40 bg-primary/10 text-primary",
  pausado: "border-border bg-muted/40 text-muted-foreground",
  terminado: "border-border bg-muted/40 text-muted-foreground",
};

const STATE_LABEL: Record<TemplateState, string> = { activo: "Activo", pausado: "Pausado", terminado: "Terminado" };

export function RecurringTab({ recurring, categories, partners, entries, today, actions }: Props) {
  const lookups = useMemo(() => buildLookups(categories, partners), [categories, partners]);
  const fixedMonthly = useMemo(() => monthlyFixedCost(recurring, today), [recurring, today]);
  const activeCount = recurring.filter((t) => templateState(t, today) === "activo").length;

  const unpaidByTemplate = useMemo(() => {
    const map = new Map<string, { count: number; overdue: number }>();
    for (const e of entries) {
      if (!e.recurring_id || !isPending(e)) continue;
      const current = map.get(e.recurring_id) ?? { count: 0, overdue: 0 };
      current.count += 1;
      if (e.entry_date < today) current.overdue += 1;
      map.set(e.recurring_id, current);
    }
    return map;
  }, [entries, today]);

  const sorted = useMemo(
    () =>
      [...recurring].sort((a, b) => {
        const byState = STATE_ORDER[templateState(a, today)] - STATE_ORDER[templateState(b, today)];
        if (byState !== 0) return byState;
        const nextA = nextDue(a, today) ?? "9999-12-31";
        const nextB = nextDue(b, today) ?? "9999-12-31";
        return nextA.localeCompare(nextB) || a.name.localeCompare(b.name, "es");
      }),
    [recurring, today]
  );

  return (
    <div className="space-y-4" data-testid="recurring-tab">
      <div className="flex flex-wrap items-stretch gap-3">
        <Kpi
          label="Costo fijo mensual"
          value={formatGs(fixedMonthly)}
          hint={activeCount === 0 ? "Ningún gasto fijo activo" : `${plural(activeCount, "gasto fijo activo", "gastos fijos activos")}`}
          accent="destructive"
          className="min-w-[14rem] flex-1"
          testId="recurring-total"
        />
        <div className="flex items-center">
          <Button onClick={actions.newRecurring} data-testid="recurring-new">
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo gasto fijo
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Cada vencimiento se crea solo, unos 10 días antes, como un gasto pendiente de pago. Cuando lo pagás lo marcás como pagado y recién
          ahí cuenta en los totales.
        </span>
      </p>

      {sorted.length === 0 ? (
        <EmptyState>
          Todavía no cargaste gastos fijos. Sumá los que se repiten (hosting, dominio, publicidad, sueldos…) y los vencimientos aparecen solos.
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2" data-testid="recurring-list">
          {sorted.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              today={today}
              category={categoryName(lookups, template.category_id)}
              payer={template.default_partner_id ? `Lo adelanta ${partnerName(lookups, template.default_partner_id)}` : "Sale de la Caja F7"}
              unpaid={unpaidByTemplate.get(template.id)}
              actions={actions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  today,
  category,
  payer,
  unpaid,
  actions,
}: {
  template: F7Recurring;
  today: string;
  category: string;
  payer: string;
  unpaid: { count: number; overdue: number } | undefined;
  actions: FinanceActions;
}) {
  const state = templateState(template, today);
  const pyg = recurringPyg(template);
  const { main, sub } = formatEntryAmount({ amount: template.amount, currency: template.currency, amount_pyg: pyg });
  const next = nextDue(template, today);
  const monthly = monthlyEquivalent(pyg, template.frequency);
  const finished = state === "terminado";

  return (
    <Card className={cn("space-y-3 p-4", state !== "activo" && "opacity-80")} data-testid="recurring-card" data-state={state}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h3 className="break-words text-sm font-semibold">{template.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={STATE_BADGE[state]}>
              {STATE_LABEL[state]}
            </Badge>
            {category ? (
              <Badge variant="outline" className="font-normal">
                {category}
              </Badge>
            ) : null}
            <Badge variant="outline" className="font-normal">
              {FREQUENCY_LABELS[template.frequency]}
            </Badge>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-bold tabular-nums text-destructive">{main}</div>
          {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
          {template.frequency !== "mensual" ? (
            <div className="text-xs text-muted-foreground">≈ {formatGs(monthly)} por mes</div>
          ) : null}
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          {finished
            ? `Terminó el ${formatDateISO(template.end_date as string)}`
            : state === "pausado"
              ? "Pausado: no genera vencimientos nuevos"
              : next
                ? `Próximo vencimiento: ${formatDateISO(next)} · ${relativeDays(today, next)}`
                : "Sin próximos vencimientos"}
        </p>
        <p>{payer}</p>
      </div>

      {unpaid && unpaid.count > 0 ? (
        <p
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-xs",
            unpaid.overdue > 0
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-secondary/40 bg-secondary/10 text-secondary"
          )}
          data-testid="recurring-unpaid"
        >
          {plural(unpaid.count, "vencimiento sin pagar", "vencimientos sin pagar")}
          {unpaid.overdue > 0 ? ` · ${unpaid.overdue} ${unpaid.overdue === 1 ? "ya venció" : "ya vencieron"}` : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => actions.editRecurring(template)} data-testid="recurring-edit">
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Editar
        </Button>
        {finished ? null : (
          <Button size="sm" variant="outline" onClick={() => actions.toggleRecurring(template)} data-testid="recurring-toggle">
            {template.active ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
            {template.active ? "Pausar" : "Reanudar"}
          </Button>
        )}
      </div>
    </Card>
  );
}
