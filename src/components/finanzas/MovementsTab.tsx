import { useMemo, useState } from "react";
import { ChevronDown, Download, MoreHorizontal, Plus, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FILTERS,
  KIND_HINTS,
  KIND_LABELS,
  buildLookups,
  categoryName,
  countByStatus,
  csvFileName,
  emptyDraft,
  entriesToCsv,
  entryState,
  filterEntries,
  flowLabel,
  formatEntryAmount,
  monthShortLabel,
  sourceLabel,
  stateLabel,
  type EntryFilters,
  type EntryKind,
  type EntryState,
  type F7Category,
  type F7Entry,
  type F7Partner,
  type Lookups,
  type StatusFilter,
} from "@/lib/f7Finance";
import { formatDateISO } from "@/lib/subscriptionReceipt";
import { KIND_BADGE, downloadTextFile, type FinanceActions, type PeriodControl } from "./helpers";
import { ChipBar, EmptyState, PeriodPicker, SearchBox, type ChipOption } from "./shared";

interface Props {
  entries: F7Entry[];
  categories: F7Category[];
  partners: F7Partner[];
  today: string;
  periodControl: PeriodControl;
  filters: EntryFilters;
  onFiltersChange: (filters: EntryFilters) => void;
  pendingReceiptsCount: number;
  actions: FinanceActions;
}

const PAGE_SIZE = 50;

const KIND_OPTIONS: ChipOption<EntryKind | "todos">[] = [
  { key: "todos", label: "Todos" },
  { key: "ingreso", label: "Ingresos" },
  { key: "gasto", label: "Gastos" },
  { key: "aporte", label: "Aportes" },
  { key: "reembolso", label: "Reembolsos" },
  { key: "distribucion", label: "Retiros" },
];

const STATE_BADGE: Record<EntryState, string> = {
  pagado: "border-border bg-muted/40 text-muted-foreground",
  pendiente: "border-secondary/40 bg-secondary/10 text-secondary",
  vencido: "border-destructive/40 bg-destructive/10 text-destructive",
  anulado: "border-border bg-muted/40 text-muted-foreground",
};

const OTHER_KINDS: EntryKind[] = ["aporte", "reembolso", "distribucion"];

function statusOptions(kind: EntryFilters["kind"], counts: Record<StatusFilter, number>): ChipOption<StatusFilter>[] {
  const paid = kind === "ingreso" ? "Cobrados" : kind === "gasto" ? "Pagados" : "Cobrados / pagados";
  const open = kind === "ingreso" ? "Por cobrar" : kind === "gasto" ? "Por pagar" : "Pendientes";
  return [
    { key: "activos", label: "Todos", count: counts.activos },
    { key: "pagado", label: paid, count: counts.pagado },
    { key: "pendiente", label: open, count: counts.pendiente, countClass: counts.pendiente > 0 ? "text-secondary" : undefined },
    { key: "vencido", label: "Vencidos", count: counts.vencido, countClass: counts.vencido > 0 ? "text-destructive" : undefined },
    { key: "anulado", label: "Anulados", count: counts.anulado },
  ];
}

export function MovementsTab({
  entries,
  categories,
  partners,
  today,
  periodControl,
  filters,
  onFiltersChange,
  pendingReceiptsCount,
  actions,
}: Props) {
  const { period } = periodControl;
  const lookups = useMemo(() => buildLookups(categories, partners), [categories, partners]);
  const filtered = useMemo(() => filterEntries(entries, filters, period, today, lookups), [entries, filters, period, today, lookups]);
  const counts = useMemo(() => countByStatus(entries, filters, period, today, lookups), [entries, filters, period, today, lookups]);

  // El "mostrar más" vuelve a 50 cuando cambia el período o cualquier filtro.
  const resetKey = JSON.stringify([filters, period.from, period.to]);
  const [shown, setShown] = useState({ key: resetKey, limit: PAGE_SIZE });
  const limit = shown.key === resetKey ? shown.limit : PAGE_SIZE;
  const visible = filtered.slice(0, limit);

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const update = (patch: Partial<EntryFilters>) => {
    const next = { ...filters, ...patch };
    // Una categoría de gastos no tiene sentido si ahora se miran solo los ingresos (y al revés).
    if (patch.kind !== undefined && next.categoryId !== "todas") {
      const category = categories.find((c) => c.id === next.categoryId);
      if (patch.kind !== "todos" && category?.kind !== patch.kind) next.categoryId = "todas";
    }
    onFiltersChange(next);
  };

  const categoryGroups = (["ingreso", "gasto"] as const)
    .filter((kind) => filters.kind === "todos" || filters.kind === kind)
    .map((kind) => ({
      kind,
      label: kind === "ingreso" ? "Ingresos" : "Gastos",
      items: categories.filter((c) => c.kind === kind).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "es")),
    }))
    .filter((group) => group.items.length > 0);
  const categoryDisabled = categoryGroups.length === 0;

  const exportCsv = () => downloadTextFile(csvFileName(period, today), entriesToCsv(filtered, lookups, today));

  return (
    <div className="space-y-4" data-testid="movements-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker control={periodControl} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => actions.newEntry(emptyDraft("ingreso", today))} data-testid="movements-add-ingreso">
            <Plus className="mr-1.5 h-4 w-4" />
            Ingreso
          </Button>
          <Button size="sm" variant="outline" onClick={() => actions.newEntry(emptyDraft("gasto", today))} data-testid="movements-add-gasto">
            <Plus className="mr-1.5 h-4 w-4" />
            Gasto
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" data-testid="movements-add-other">
                Otro movimiento
                <ChevronDown className="ml-1.5 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {OTHER_KINDS.map((kind) => (
                <DropdownMenuItem
                  key={kind}
                  className="flex-col items-start gap-0.5"
                  onSelect={() => actions.newEntry(emptyDraft(kind, today))}
                  data-testid={`movements-add-${kind}`}
                >
                  <span className="font-medium">{KIND_LABELS[kind]}</span>
                  <span className="text-xs text-muted-foreground">{KIND_HINTS[kind]}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {pendingReceiptsCount > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-secondary/40 bg-secondary/5 p-3" data-testid="movements-receipts-notice">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <ReceiptText className="h-4 w-4 shrink-0 text-secondary" />
            <span>
              {pendingReceiptsCount === 1
                ? "1 recibo de suscripción todavía no está registrado como ingreso."
                : `${pendingReceiptsCount} recibos de suscripción todavía no están registrados como ingreso.`}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={actions.importReceipts} data-testid="movements-import">
            Importar recibos
          </Button>
        </Card>
      ) : null}

      <div className="space-y-3">
        <ChipBar label="Tipo de movimiento" options={KIND_OPTIONS} value={filters.kind} onChange={(kind) => update({ kind })} />
        <ChipBar label="Estado" options={statusOptions(filters.kind, counts)} value={filters.status} onChange={(status) => update({ status })} />

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr]">
          <Select value={filters.categoryId} onValueChange={(categoryId) => update({ categoryId })} disabled={categoryDisabled}>
            <SelectTrigger aria-label="Categoría" data-testid="filter-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {categoryGroups.map((group) => (
                <SelectGroup key={group.kind}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.items.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.active ? c.name : `${c.name} (inactiva)`}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.partnerId} onValueChange={(partnerId) => update({ partnerId })}>
            <SelectTrigger aria-label="Socio" data-testid="filter-partner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los socios</SelectItem>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.active ? p.name : `${p.name} (inactivo)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <SearchBox value={filters.query} onChange={(query) => update({ query })} placeholder="Buscar por descripción, socio, monto…" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span data-testid="movements-count">
            {filtered.length === 0
              ? "Sin movimientos"
              : filtered.length === 1
                ? "1 movimiento"
                : `${filtered.length} movimientos`}
            {filtered.length > visible.length ? ` · mostrando ${visible.length}` : ""}
          </span>
          <div className="flex gap-2">
            {filtersActive ? (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onFiltersChange(DEFAULT_FILTERS)} data-testid="movements-clear">
                Limpiar filtros
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              data-testid="movements-export"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState>
          Todavía no hay movimientos. Cargá el primer ingreso o gasto, o importá los recibos de suscripción que ya emitiste.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>
          No hay movimientos con estos filtros en el período elegido. Probá con otro período o limpiá los filtros.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border" data-testid="movements-list">
            {visible.map((entry) => (
              <MovementRow key={entry.id} entry={entry} today={today} lookups={lookups} actions={actions} />
            ))}
          </ul>
          {filtered.length > visible.length ? (
            <div className="border-t border-border p-3 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShown({ key: resetKey, limit: limit + PAGE_SIZE })}
                data-testid="movements-more"
              >
                Mostrar más ({filtered.length - visible.length} restantes)
              </Button>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}

function MovementRow({
  entry,
  today,
  lookups,
  actions,
}: {
  entry: F7Entry;
  today: string;
  lookups: Lookups;
  actions: FinanceActions;
}) {
  const state = entryState(entry, today);
  const voided = state === "anulado";
  const ledger = entry.kind === "ingreso" || entry.kind === "gasto";
  const open = state === "pendiente" || state === "vencido";
  const { main, sub } = formatEntryAmount(entry);
  const category = categoryName(lookups, entry.category_id);
  const amountClass = voided
    ? "text-muted-foreground line-through"
    : entry.kind === "ingreso"
      ? "text-primary"
      : entry.kind === "gasto"
        ? "text-destructive"
        : "text-foreground";

  return (
    <li className="flex items-start gap-3 px-3 py-3 sm:px-4" data-testid="movement-row" data-kind={entry.kind} data-state={state}>
      <div className="hidden w-12 shrink-0 text-center leading-tight sm:block" title={formatDateISO(entry.entry_date)}>
        <div className="text-lg font-bold tabular-nums">{Number(entry.entry_date.slice(8, 10))}</div>
        <div className="text-[11px] uppercase text-muted-foreground">{monthShortLabel(entry.entry_date.slice(0, 7))}</div>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className={cn("min-w-0 break-words text-sm font-medium", voided && "text-muted-foreground line-through")}>
            {entry.description}
          </p>
          <div className="shrink-0 text-right">
            <div className={cn("text-sm font-semibold tabular-nums", amountClass)}>{main}</div>
            {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={KIND_BADGE[entry.kind]}>
            {KIND_LABELS[entry.kind]}
          </Badge>
          {category ? (
            <Badge variant="outline" className="font-normal">
              {category}
            </Badge>
          ) : null}
          {ledger || voided ? (
            <Badge variant="outline" className={STATE_BADGE[state]} data-testid="movement-state">
              {stateLabel(entry, today)}
            </Badge>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          <span className="sm:hidden">{formatDateISO(entry.entry_date)} · </span>
          {flowLabel(entry, lookups)} · {sourceLabel(entry)}
          {entry.payment_method ? ` · ${entry.payment_method}` : ""}
        </p>
        {voided ? <p className="text-xs text-destructive">Anulado: {entry.void_reason}</p> : null}
      </div>

      {voided ? (
        <div className="w-8 shrink-0" />
      ) : (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={`Acciones de ${entry.description}`}
              data-testid="movement-menu"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => actions.editEntry(entry)} data-testid="movement-edit">
              Editar
            </DropdownMenuItem>
            {open ? (
              <DropdownMenuItem onSelect={() => actions.payEntry(entry)} data-testid="movement-pay">
                {entry.kind === "ingreso" ? "Marcar cobrado" : "Marcar pagado"}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => actions.voidEntry(entry)}
              className="text-destructive focus:text-destructive"
              data-testid="movement-void"
            >
              Anular…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
