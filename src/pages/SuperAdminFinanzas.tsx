import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Landmark, RefreshCw, Tags } from "lucide-react";
import { toast } from "sonner";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useF7Finance } from "@/hooks/useF7Finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoriesDialog } from "@/components/finanzas/CategoriesDialog";
import { EntryDialog, type EntryTarget } from "@/components/finanzas/EntryDialog";
import { MarkEntryPaidDialog } from "@/components/finanzas/MarkEntryPaidDialog";
import { MovementsTab } from "@/components/finanzas/MovementsTab";
import { PartnerDialog, type PartnerTarget } from "@/components/finanzas/PartnerDialog";
import { PartnersTab } from "@/components/finanzas/PartnersTab";
import { ReceiptImportDialog } from "@/components/finanzas/ReceiptImportDialog";
import { RecurringDialog, type RecurringTarget } from "@/components/finanzas/RecurringDialog";
import { RecurringTab } from "@/components/finanzas/RecurringTab";
import { ResumeRecurringDialog, type ResumeTarget } from "@/components/finanzas/ResumeRecurringDialog";
import { SettleDialog, type SettleTarget } from "@/components/finanzas/SettleDialog";
import { SummaryTab } from "@/components/finanzas/SummaryTab";
import { VoidEntryDialog } from "@/components/finanzas/VoidEntryDialog";
import type { FinanceActions, PeriodControl } from "@/components/finanzas/helpers";
import { cn } from "@/lib/utils";
import { EMPTY_FINANCE_DATA, generateRecurring, setRecurringActive } from "@/lib/f7FinanceApi";
import {
  DEFAULT_FILTERS,
  computeSnapshot,
  draftFromEntry,
  formatGs,
  isPending,
  missingDues,
  resolvePeriod,
  sharesWarning,
  unregisteredReceipts,
  type EntryFilters,
  type F7Entry,
  type F7Recurring,
  type PeriodKey,
} from "@/lib/f7Finance";

type TabKey = "resumen" | "movimientos" | "fijos" | "socios";

const TAB_CLASS = "min-h-9 gap-1.5 px-2 py-2 text-xs sm:text-sm";

export default function SuperAdminFinanzas() {
  const { isSuperAdmin, loading: roleLoading } = useSuperAdmin();
  const { data, today, loading, failed, generated, reload, putEntries, putRecurring, putPartner, removePartner, putCategory, removeCategory } =
    useF7Finance(isSuperAdmin);

  const [tab, setTab] = useState<TabKey>("resumen");
  const [periodKey, setPeriodKey] = useState<PeriodKey>("este_mes");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [filters, setFilters] = useState<EntryFilters>(DEFAULT_FILTERS);

  const [entryDialog, setEntryDialog] = useState<EntryTarget | null>(null);
  const [payTarget, setPayTarget] = useState<F7Entry | null>(null);
  const [voidTarget, setVoidTarget] = useState<F7Entry | null>(null);
  const [recurringDialog, setRecurringDialog] = useState<RecurringTarget | null>(null);
  const [partnerDialog, setPartnerDialog] = useState<PartnerTarget | null>(null);
  const [settleTarget, setSettleTarget] = useState<SettleTarget | null>(null);
  const [resumeTarget, setResumeTarget] = useState<ResumeTarget | null>(null);
  const [resuming, setResuming] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const dialogKey = useRef(0);
  const nextKey = () => ++dialogKey.current;

  const { partners, categories, entries, recurring, receipts } = data;
  const hasData = data !== EMPTY_FINANCE_DATA;

  const period = useMemo(() => resolvePeriod(periodKey, today, custom), [periodKey, today, custom]);
  const snapshot = useMemo(() => computeSnapshot(entries, partners), [entries, partners]);
  const pendingReceipts = useMemo(() => unregisteredReceipts(receipts, entries), [receipts, entries]);
  const overdueCount = useMemo(() => entries.filter((e) => isPending(e) && e.entry_date < today).length, [entries, today]);

  const warnings = useMemo(() => {
    const list: string[] = [];
    if (Math.abs(snapshot.diferencia) >= 1) {
      list.push(
        `Las cuentas no cuadran: la Caja F7 difiere en ${formatGs(snapshot.diferencia)} de lo que dan los resultados y las cuentas de los socios. Revisá los últimos movimientos cargados.`
      );
    }
    const shares = sharesWarning(partners);
    if (shares) list.push(shares);
    return list;
  }, [snapshot.diferencia, partners]);

  useEffect(() => {
    if (generated > 0) {
      toast.info(
        generated === 1 ? "Se creó 1 gasto fijo pendiente de pago." : `Se crearon ${generated} gastos fijos pendientes de pago.`,
        { id: "finance-generated" }
      );
    }
  }, [generated]);

  useEffect(() => {
    if (failed && hasData) {
      toast.error("No se pudo actualizar. Estás viendo los últimos datos cargados.", { id: "finance-reload-failed" });
    }
  }, [failed, hasData]);

  const periodControl: PeriodControl = {
    key: periodKey,
    custom,
    period,
    setKey: (key) => {
      if (key === "personalizado" && !custom.from && !custom.to) setCustom({ from: `${today.slice(0, 7)}-01`, to: today });
      setPeriodKey(key);
    },
    setCustom,
  };

  const pauseTemplate = async (template: F7Recurring) => {
    try {
      putRecurring(await setRecurringActive(template.id, false));
      toast.success("Gasto fijo pausado: no va a crear vencimientos nuevos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo pausar el gasto fijo.");
    }
  };

  const resumeTemplate = async (template: F7Recurring) => {
    setResuming(true);
    try {
      putRecurring(await setRecurringActive(template.id, true));
      const created = await generateRecurring(template.id);
      if (created > 0) await reload();
      toast.success(
        created === 0
          ? "Gasto fijo reanudado."
          : created === 1
            ? "Gasto fijo reanudado: se creó 1 vencimiento pendiente de pago."
            : `Gasto fijo reanudado: se crearon ${created} vencimientos pendientes de pago.`
      );
      setResumeTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo reanudar el gasto fijo.");
    } finally {
      setResuming(false);
    }
  };

  const toggleRecurring = (template: F7Recurring) => {
    if (template.active) {
      void pauseTemplate(template);
      return;
    }
    const missing = missingDues(template, entries, today);
    if (missing.length === 0) void resumeTemplate(template);
    else setResumeTarget({ template, missing });
  };

  const actions: FinanceActions = {
    newEntry: (draft) => setEntryDialog({ key: nextKey(), entry: null, draft }),
    editEntry: (entry) => setEntryDialog({ key: nextKey(), entry, draft: draftFromEntry(entry) }),
    payEntry: setPayTarget,
    voidEntry: setVoidTarget,
    importReceipts: () => setImportOpen(true),
    newRecurring: () => setRecurringDialog({ key: nextKey(), template: null, scheduleLocked: false }),
    editRecurring: (template) =>
      setRecurringDialog({ key: nextKey(), template, scheduleLocked: entries.some((e) => e.recurring_id === template.id) }),
    toggleRecurring,
    newPartner: () => setPartnerDialog({ key: nextKey(), partner: null }),
    editPartner: (partner) => setPartnerDialog({ key: nextKey(), partner }),
    settle: (transfer) => setSettleTarget({ key: nextKey(), transfer }),
    // Lo pendiente de meses anteriores también tiene que verse: se muestra todo el historial.
    goToPending: () => {
      setFilters({ ...DEFAULT_FILTERS, status: "pendiente" });
      setPeriodKey("todo");
      setTab("movimientos");
    },
  };

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const showSkeleton = loading && !hasData;
  const blocked = failed && !hasData;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" data-testid="finance-page">
      <div className="mx-auto max-w-5xl space-y-5 animate-fade-in">
        <div className="space-y-3">
          <Link
            to="/superadmin"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Super Admin
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Landmark className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">Finanzas F7</h1>
                <p className="text-sm text-muted-foreground">Ingresos, gastos y cuentas entre socios</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCategoriesOpen(true)}
                disabled={!hasData}
                data-testid="finance-categories"
              >
                <Tags className="mr-1.5 h-4 w-4" />
                Categorías
              </Button>
              <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading} data-testid="finance-refresh">
                <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} />
                Actualizar
              </Button>
            </div>
          </div>
        </div>

        {blocked ? (
          <Card className="flex flex-col items-center gap-3 p-8 text-center" data-testid="finance-error">
            <p className="text-sm text-muted-foreground">No se pudieron cargar las finanzas.</p>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Reintentar
            </Button>
          </Card>
        ) : (
          <>
            {hasData && warnings.length > 0 ? (
              <Card className="flex items-start gap-3 border-secondary/40 bg-secondary/10 p-3" role="status" data-testid="finance-warnings">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                <ul className="space-y-1 text-sm">
                  {warnings.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-4">
              <TabsList className="grid h-auto w-full grid-cols-4">
                <TabsTrigger value="resumen" className={TAB_CLASS} data-testid="tab-resumen">
                  Resumen
                </TabsTrigger>
                <TabsTrigger value="movimientos" className={TAB_CLASS} data-testid="tab-movimientos">
                  <span className="sm:hidden">Movim.</span>
                  <span className="hidden sm:inline">Movimientos</span>
                  {overdueCount > 0 ? (
                    <Badge
                      variant="destructive"
                      className="h-5 min-w-5 justify-center px-1.5 tabular-nums"
                      title="Pendientes ya vencidos"
                      data-testid="tab-movimientos-overdue"
                    >
                      {overdueCount}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="fijos" className={TAB_CLASS} data-testid="tab-fijos">
                  <span className="sm:hidden">Fijos</span>
                  <span className="hidden sm:inline">Gastos fijos</span>
                </TabsTrigger>
                <TabsTrigger value="socios" className={TAB_CLASS} data-testid="tab-socios">
                  Socios
                </TabsTrigger>
              </TabsList>

              {showSkeleton ? (
                <div className="space-y-3" aria-hidden data-testid="finance-skeleton">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-muted/30" />
                  ))}
                </div>
              ) : (
                <>
                  <TabsContent value="resumen" className="mt-0 space-y-4">
                    <SummaryTab
                      entries={entries}
                      categories={categories}
                      recurring={recurring}
                      receipts={receipts}
                      snapshot={snapshot}
                      today={today}
                      periodControl={periodControl}
                      actions={actions}
                    />
                  </TabsContent>
                  <TabsContent value="movimientos" className="mt-0 space-y-4">
                    <MovementsTab
                      entries={entries}
                      categories={categories}
                      partners={partners}
                      today={today}
                      periodControl={periodControl}
                      filters={filters}
                      onFiltersChange={setFilters}
                      pendingReceiptsCount={pendingReceipts.length}
                      actions={actions}
                    />
                  </TabsContent>
                  <TabsContent value="fijos" className="mt-0 space-y-4">
                    <RecurringTab
                      recurring={recurring}
                      categories={categories}
                      partners={partners}
                      entries={entries}
                      today={today}
                      actions={actions}
                    />
                  </TabsContent>
                  <TabsContent value="socios" className="mt-0 space-y-4">
                    <PartnersTab snapshot={snapshot} partners={partners} today={today} actions={actions} />
                  </TabsContent>
                </>
              )}
            </Tabs>
          </>
        )}
      </div>

      <EntryDialog
        target={entryDialog}
        today={today}
        categories={categories}
        partners={partners}
        onClose={() => setEntryDialog(null)}
        onSaved={(entry) => putEntries([entry])}
      />
      <MarkEntryPaidDialog target={payTarget} today={today} onClose={() => setPayTarget(null)} onSaved={(entry) => putEntries([entry])} />
      <VoidEntryDialog target={voidTarget} onClose={() => setVoidTarget(null)} onSaved={(entry) => putEntries([entry])} />
      <RecurringDialog
        target={recurringDialog}
        today={today}
        categories={categories}
        partners={partners}
        onClose={() => setRecurringDialog(null)}
        onSaved={putRecurring}
        onGenerated={() => void reload()}
      />
      <PartnerDialog
        target={partnerDialog}
        partners={partners}
        onClose={() => setPartnerDialog(null)}
        onSaved={putPartner}
        onDeleted={removePartner}
      />
      <CategoriesDialog
        open={categoriesOpen}
        categories={categories}
        entries={entries}
        recurring={recurring}
        onClose={() => setCategoriesOpen(false)}
        onSaved={putCategory}
        onDeleted={removeCategory}
      />
      <ReceiptImportDialog
        open={importOpen}
        today={today}
        receipts={receipts}
        entries={entries}
        categories={categories}
        partners={partners}
        onClose={() => setImportOpen(false)}
        onSaved={putEntries}
      />
      <SettleDialog
        target={settleTarget}
        today={today}
        positions={snapshot.partners}
        categories={categories}
        partners={partners}
        onClose={() => setSettleTarget(null)}
        onSaved={putEntries}
      />
      <ResumeRecurringDialog
        target={resumeTarget}
        busy={resuming}
        onClose={() => setResumeTarget(null)}
        onConfirm={() => resumeTarget && void resumeTemplate(resumeTarget.template)}
      />
    </div>
  );
}
