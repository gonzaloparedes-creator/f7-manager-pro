import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Activity, ArrowLeft, CalendarCheck, ChevronDown, Receipt, Search, ShieldCheck, Star, X } from "lucide-react";
import { COUNTRIES, PY_DEPARTMENTS, countryLabel } from "@/lib/locations";
import { monthKey, monthLabel, lastMonths, daysSince } from "@/lib/dateBuckets";
import { cn } from "@/lib/utils";
import { PLAN_LABELS, type Cycle, type PlanType } from "@/lib/plans";
import { CYCLE_LABELS, formatDateISO, todayInAsuncion } from "@/lib/subscriptionReceipt";
import {
  expirySortKey,
  matchesExpiryFilter,
  planExpiryInfo,
  timeSinceLabel,
  type ExpiryFilter,
  type ExpiryTone,
  type PlanExpiryInfo,
} from "@/lib/planExpiry";
import PlanExpiryBar from "@/components/PlanExpiryBar";
import { usePlanGraceDays } from "@/hooks/usePlanGraceDays";
import MarkPaidDialog, { type PaymentPatch } from "@/components/MarkPaidDialog";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Company {
  id: string;
  name: string;
  created_at: string;
  plan_type: string;
  is_active: boolean;
  is_paying: boolean;
  founder_cohort: boolean;
  referral_partner_id: string | null;
  country: string;
  department: string | null;
  city: string | null;
  billing_cycle: string | null;
  plan_paid_from: string | null;
  plan_expires_at: string | null;
}

interface Partner {
  id: string;
  name: string;
}

const NO_PARTNER = "__none__";
const NO_DEPARTMENT = "__unset__";

type SortMode = "vencimiento" | "recientes" | "nombre";

const SORT_LABELS: Record<SortMode, string> = {
  vencimiento: "Vencimiento más próximo",
  recientes: "Más recientes",
  nombre: "Nombre (A–Z)",
};

const FILTERS: { key: ExpiryFilter; label: string; countClass: string }[] = [
  { key: "todas", label: "Todas", countClass: "text-foreground" },
  { key: "vencidas", label: "Vencidas", countClass: "text-destructive" },
  { key: "por-vencer", label: "Por vencer", countClass: "text-secondary" },
  { key: "al-dia", label: "Al día", countClass: "text-primary" },
  { key: "sin-pago", label: "Sin pago", countClass: "text-muted-foreground" },
];

const ACCENT: Record<ExpiryTone | "none", string> = {
  ok: "border-l-primary",
  soon: "border-l-secondary",
  expired: "border-l-destructive",
  none: "border-l-border",
};

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");
const fold = (text: string) => text.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();

function companyHaystack(c: Company): string {
  return fold(
    [c.name, c.city, c.department, countryLabel(c.country), PLAN_LABELS[c.plan_type as PlanType] ?? c.plan_type, c.id]
      .filter(Boolean)
      .join(" ")
  );
}

function locationLabel(c: Company): string {
  if (c.country === "PY") return [c.city, c.department].filter(Boolean).join(", ") || "Paraguay";
  return countryLabel(c.country);
}

export default function MasterAdmin() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [cityDrafts, setCityDrafts] = useState<Record<string, string>>({});
  const [detailCompany, setDetailCompany] = useState<Company | null>(null);
  const [payCompany, setPayCompany] = useState<Company | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ExpiryFilter>("todas");
  const [sort, setSort] = useState<SortMode>("vencimiento");

  useEffect(() => {
    document.title = "Gestión de empresas — F7 Manager Pro";
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void load();
  }, [isSuperAdmin]);

  async function load() {
    setListLoading(true);
    const [{ data, error }, { data: partnersData }] = await Promise.all([
      supabase
        .from("companies")
        .select(
          "id, name, created_at, plan_type, is_active, is_paying, founder_cohort, referral_partner_id, country, department, city, billing_cycle, plan_paid_from, plan_expires_at"
        )
        .order("created_at", { ascending: false }),
      supabase.from("referral_partners").select("id, name").order("name"),
    ]);
    setListLoading(false);
    if (error) {
      toast.error("No se pudieron cargar las empresas");
      return;
    }
    setCompanies((data as Company[]) ?? []);
    setPartners((partnersData as Partner[]) ?? []);
  }

  async function updateCompany(id: string, patch: Partial<Company>) {
    setBusy(id);
    const { error } = await supabase.from("companies").update(patch).eq("id", id);
    setBusy(null);
    if (error) {
      toast.error("Error al actualizar");
      return false;
    }
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    toast.success("Empresa actualizada");
    return true;
  }

  async function toggleFounder(id: string, value: boolean) {
    setBusy(id);
    const { error } = await supabase
      .from("companies")
      .update({ founder_cohort: value, founder_cohort_at: value ? new Date().toISOString() : null })
      .eq("id", id);
    setBusy(null);
    if (error) {
      toast.error("Error al actualizar");
      return;
    }
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, founder_cohort: value } : c)));
    toast.success(value ? "Marcada como Fundador" : "Ya no es Fundador");
  }

  function applyPayment(id: string, patch: PaymentPatch) {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  const today = todayInAsuncion();
  const graceDays = usePlanGraceDays();
  const infos = useMemo(() => {
    const map = new Map<string, PlanExpiryInfo | null>();
    companies.forEach((c) => map.set(c.id, planExpiryInfo(c, today, graceDays)));
    return map;
  }, [companies, today, graceDays]);

  const counts = useMemo(() => {
    const result: Record<ExpiryFilter, number> = { todas: 0, vencidas: 0, "por-vencer": 0, "al-dia": 0, "sin-pago": 0 };
    (Object.keys(result) as ExpiryFilter[]).forEach((key) => {
      result[key] = companies.filter((c) => matchesExpiryFilter(infos.get(c.id) ?? null, key)).length;
    });
    return result;
  }, [companies, infos]);

  const visible = useMemo(() => {
    const tokens = fold(query).split(/\s+/).filter(Boolean);
    const rows = companies.filter((c) => {
      if (!matchesExpiryFilter(infos.get(c.id) ?? null, filter)) return false;
      if (tokens.length === 0) return true;
      const haystack = companyHaystack(c);
      return tokens.every((t) => haystack.includes(t));
    });
    const byRecent = (a: Company, b: Company) => b.created_at.localeCompare(a.created_at);
    rows.sort((a, b) => {
      if (sort === "nombre") return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      if (sort === "recientes") return byRecent(a, b);
      const diff = expirySortKey(infos.get(a.id) ?? null) - expirySortKey(infos.get(b.id) ?? null);
      return Number.isNaN(diff) || diff === 0 ? byRecent(a, b) : diff;
    });
    return rows;
  }, [companies, infos, query, filter, sort]);

  const hasFilters = query.trim() !== "" || filter !== "todas";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5 animate-fade-in">
        <div className="space-y-3">
          <Link
            to="/superadmin"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Super Admin
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">Gestión de empresas</h1>
              <p className="text-sm text-muted-foreground">Cuentas, planes y vencimientos de cada negocio</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Filtrar por estado del plan">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/40",
                filter === f.key ? "border-primary bg-primary/10" : "border-border",
                f.key === "todas" && "col-span-2 sm:col-span-1"
              )}
            >
              <span className="text-sm font-medium">{f.label}</span>
              <span className={cn("text-xl font-bold tabular-nums", f.countClass)}>{counts[f.key]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, ciudad, plan o ID…"
              aria-label="Buscar empresa"
              className="pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Borrar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
            <SelectTrigger className="sm:w-56" aria-label="Ordenar empresas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                <SelectItem key={mode} value={mode}>{SORT_LABELS[mode]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground">
          {listLoading
            ? "Cargando empresas…"
            : hasFilters
              ? `Mostrando ${visible.length} de ${companies.length} empresas`
              : `${companies.length} ${companies.length === 1 ? "empresa" : "empresas"}`}
        </div>

        {listLoading ? (
          <div className="space-y-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-muted/30" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {companies.length === 0 ? "Sin empresas registradas." : "Ninguna empresa coincide con la búsqueda."}
            </p>
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setFilter("todas");
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {visible.map((c) => (
              <CompanyCard
                key={c.id}
                company={c}
                info={infos.get(c.id) ?? null}
                today={today}
                expanded={expandedId === c.id}
                onToggle={() => setExpandedId((current) => (current === c.id ? null : c.id))}
                busy={busy === c.id}
                partners={partners}
                cityDraft={cityDrafts[c.id]}
                setCityDraft={(value) =>
                  setCityDrafts((prev) => {
                    if (value === undefined) {
                      const next = { ...prev };
                      delete next[c.id];
                      return next;
                    }
                    return { ...prev, [c.id]: value };
                  })
                }
                onUpdate={(patch) => updateCompany(c.id, patch)}
                onToggleFounder={(value) => toggleFounder(c.id, value)}
                onPay={() => setPayCompany(c)}
                onActivity={() => setDetailCompany(c)}
              />
            ))}
          </div>
        )}
      </div>

      <MarkPaidDialog company={payCompany} onClose={() => setPayCompany(null)} onSaved={applyPayment} />
      <CompanyDetailDialog company={detailCompany} onClose={() => setDetailCompany(null)} />
    </div>
  );
}

/* ---------- Tarjeta de empresa ---------- */
interface CompanyCardProps {
  company: Company;
  info: PlanExpiryInfo | null;
  today: string;
  expanded: boolean;
  onToggle: () => void;
  busy: boolean;
  partners: Partner[];
  cityDraft: string | undefined;
  setCityDraft: (value: string | undefined) => void;
  onUpdate: (patch: Partial<Company>) => Promise<boolean>;
  onToggleFounder: (value: boolean) => void;
  onPay: () => void;
  onActivity: () => void;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function CompanyCard({
  company: c,
  info,
  today,
  expanded,
  onToggle,
  busy,
  partners,
  cityDraft,
  setCityDraft,
  onUpdate,
  onToggleFounder,
  onPay,
  onActivity,
}: CompanyCardProps) {
  const planLabel = PLAN_LABELS[c.plan_type as PlanType] ?? c.plan_type;
  const cycleLabel = info ? CYCLE_LABELS[info.cycle as Cycle] : null;
  const createdIso = c.created_at.slice(0, 10);
  const lapsed = info?.phase === "suspended";
  const panelId = `empresa-${c.id}`;

  return (
    <Collapsible open={expanded}>
      <Card className={cn("overflow-hidden border-l-4 transition-colors", ACCENT[info?.tone ?? "none"], expanded && "border-y-primary/50 border-r-primary/50")}>
        <div className="cursor-pointer space-y-3 p-4 transition-colors hover:bg-muted/20" onClick={onToggle}>
          <div className="flex items-start gap-3">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              className="flex min-w-0 flex-1 items-start gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDown
                className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="break-words font-semibold leading-tight">{c.name}</span>
                  {c.founder_cohort && <Star className="h-3.5 w-3.5 shrink-0 fill-secondary text-secondary" aria-label="Fundador" />}
                  {!c.is_active && <Badge variant="destructive">Suspendida</Badge>}
                  {c.is_active && lapsed && <Badge variant="destructive">Suspendida por vencimiento</Badge>}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {planLabel}
                  {cycleLabel ? ` · ${cycleLabel}` : ""} · Alta {timeSinceLabel(createdIso, today).toLowerCase()} · {locationLabel(c)}
                </span>
              </span>
            </button>
            <Button
              size="sm"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onPay();
              }}
            >
              <CalendarCheck className="mr-1.5 h-4 w-4" />
              Pagado
            </Button>
          </div>
          {info ? (
            <PlanExpiryBar info={info} />
          ) : (
            <div className="text-xs text-muted-foreground">Sin pago registrado</div>
          )}
        </div>

        <CollapsibleContent id={panelId}>
          <div className="border-t border-border bg-muted/10 p-4">
            <div className="grid gap-6 md:grid-cols-2">
              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suscripción</h3>
                {info ? (
                  <PlanExpiryBar info={info} variant="large" />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Todavía no tiene un pago registrado. Con <span className="font-medium text-foreground">Pagado</span> cargás desde
                    cuándo pagó y se arma la cuenta regresiva.
                  </p>
                )}
                <dl className="space-y-2 border-t border-border pt-3">
                  <DetailRow label="Plan">{planLabel}</DetailRow>
                  {info && cycleLabel && <DetailRow label="Ciclo">{cycleLabel}</DetailRow>}
                  {info && <DetailRow label="Pagó desde">{formatDateISO(info.paidFrom)}</DetailRow>}
                  {info && <DetailRow label="Vence">{formatDateISO(info.expiresAt)}</DetailRow>}
                  {info && (
                    <DetailRow label="Acceso hasta">
                      {formatDateISO(info.accessUntil)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {lapsed
                          ? "Bloqueada por vencimiento"
                          : info.graceDays > 0
                            ? `Incluye ${info.graceDays} ${info.graceDays === 1 ? "día" : "días"} de gracia`
                            : "Sin días de gracia"}
                      </span>
                    </DetailRow>
                  )}
                  <DetailRow label="Cliente que paga">
                    {c.is_paying ? <Badge>Sí</Badge> : <Badge variant="outline">No</Badge>}
                  </DetailRow>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={onPay}>
                    <CalendarCheck className="mr-1.5 h-4 w-4" />
                    {info ? "Registrar nuevo pago" : "Registrar pago"}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/superadmin/recibos?empresa=${c.id}`}>
                      <Receipt className="mr-1.5 h-4 w-4" />
                      Emitir recibo
                    </Link>
                  </Button>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cuenta</h3>
                <dl className="space-y-2">
                  <DetailRow label="Alta">
                    {formatDateISO(createdIso)}
                    <span className="block text-xs font-normal text-muted-foreground">{timeSinceLabel(createdIso, today)}</span>
                  </DetailRow>
                  <DetailRow label="ID">
                    <span className="break-all font-mono text-xs text-muted-foreground">{c.id}</span>
                  </DetailRow>
                </dl>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
                    <Label htmlFor={`${panelId}-activa`} className="text-sm">
                      {!c.is_active ? "Suspendida" : lapsed ? "Activa (vencida)" : "Activa"}
                    </Label>
                    <Switch
                      id={`${panelId}-activa`}
                      checked={c.is_active}
                      disabled={busy}
                      onCheckedChange={(v) => onUpdate({ is_active: v })}
                      aria-label={`${c.is_active ? "Desactivar" : "Activar"} ${c.name}`}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
                    <Label htmlFor={`${panelId}-fundador`} className="text-sm">Fundador</Label>
                    <Switch
                      id={`${panelId}-fundador`}
                      checked={c.founder_cohort}
                      disabled={busy}
                      onCheckedChange={onToggleFounder}
                      aria-label={`${c.founder_cohort ? "Quitar" : "Agregar"} ${c.name} del cohorte fundadores`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${panelId}-plan`} className="text-xs text-muted-foreground">Plan</Label>
                    <Select value={c.plan_type} onValueChange={(v) => onUpdate({ plan_type: v })} disabled={busy}>
                      <SelectTrigger id={`${panelId}-plan`} className="h-9" aria-label={`Plan de ${c.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="retail">Retail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${panelId}-aliado`} className="text-xs text-muted-foreground">Aliado</Label>
                    <Select
                      value={c.referral_partner_id ?? NO_PARTNER}
                      onValueChange={(v) => onUpdate({ referral_partner_id: v === NO_PARTNER ? null : v })}
                      disabled={busy}
                    >
                      <SelectTrigger id={`${panelId}-aliado`} className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_PARTNER}>Ninguno</SelectItem>
                        {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${panelId}-pais`} className="text-xs text-muted-foreground">País</Label>
                    <Select
                      value={c.country}
                      onValueChange={(v) => {
                        if (v !== "PY") setCityDraft("");
                        void onUpdate({ country: v, ...(v !== "PY" ? { department: null, city: null } : {}) });
                      }}
                      disabled={busy}
                    >
                      <SelectTrigger id={`${panelId}-pais`} className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((co) => <SelectItem key={co.code} value={co.code}>{co.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {c.country === "PY" && (
                    <div className="space-y-1.5">
                      <Label htmlFor={`${panelId}-depto`} className="text-xs text-muted-foreground">Departamento</Label>
                      <Select
                        value={c.department ?? NO_DEPARTMENT}
                        onValueChange={(v) => onUpdate({ department: v === NO_DEPARTMENT ? null : v })}
                        disabled={busy}
                      >
                        <SelectTrigger id={`${panelId}-depto`} className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_DEPARTMENT}>—</SelectItem>
                          {PY_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {c.country === "PY" && (
                    <div className="space-y-1.5">
                      <Label htmlFor={`${panelId}-ciudad`} className="text-xs text-muted-foreground">Ciudad</Label>
                      <Input
                        id={`${panelId}-ciudad`}
                        className="h-9"
                        value={cityDraft ?? c.city ?? ""}
                        disabled={busy}
                        onChange={(e) => setCityDraft(e.target.value)}
                        onBlur={async () => {
                          if (cityDraft !== undefined && cityDraft !== (c.city ?? "")) {
                            const ok = await onUpdate({ city: cityDraft || null });
                            if (!ok) setCityDraft(undefined);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>

                <Button size="sm" variant="outline" onClick={onActivity}>
                  <Activity className="mr-1.5 h-4 w-4" />
                  Ver actividad
                </Button>
              </section>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ---------- Detalle por empresa ---------- */
interface DetailOrder { created_at: string; device_type: string; quote_amount: number }
interface DetailData {
  clients: number;
  branches: number;
  staff: number;
  orders: DetailOrder[];
}

function CompanyDetailDialog({ company, onClose }: { company: Company | null; onClose: () => void }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!company) { setData(null); return; }
    setLoading(true);
    setData(null);
    const id = company.id;
    Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("company_id", id),
      supabase.from("branches").select("id", { count: "exact", head: true }).eq("company_id", id),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", id),
      supabase.from("orders").select("created_at, device_type, quote_amount").eq("company_id", id),
    ]).then(([clientsRes, branchesRes, staffRes, ordersRes]) => {
      setData({
        clients: clientsRes.count ?? 0,
        branches: branchesRes.count ?? 0,
        staff: staffRes.count ?? 0,
        orders: (ordersRes.data as DetailOrder[]) ?? [],
      });
      setLoading(false);
    });
  }, [company]);

  const months = useMemo(() => lastMonths(6), []);
  const ordersByMonth = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    data.orders.forEach((o) => counts.set(monthKey(o.created_at), (counts.get(monthKey(o.created_at)) ?? 0) + 1));
    return months.map((k) => ({ label: monthLabel(k), value: counts.get(k) ?? 0 }));
  }, [data, months]);

  const topDevices = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    data.orders.forEach((o) => {
      const key = o.device_type || "Sin especificar";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data]);

  const lastOrderAt = useMemo(() => {
    if (!data || data.orders.length === 0) return null;
    return data.orders.reduce((max, o) => (o.created_at > max ? o.created_at : max), data.orders[0].created_at);
  }, [data]);

  return (
    <Dialog open={!!company} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {company && (
          <>
            <DialogHeader>
              <DialogTitle>{company.name}</DialogTitle>
              <DialogDescription>
                {company.country === "PY"
                  ? [company.department, company.city].filter(Boolean).join(" · ") || "Paraguay"
                  : countryLabel(company.country)}
                {" · "}Alta {new Date(company.created_at).toLocaleDateString("es-PY")}
              </DialogDescription>
            </DialogHeader>

            {loading || !data ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs text-muted-foreground">Clientes</div>
                    <div className="text-lg font-bold">{data.clients}</div>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs text-muted-foreground">Sucursales</div>
                    <div className="text-lg font-bold">{data.branches}</div>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs text-muted-foreground">Usuarios</div>
                    <div className="text-lg font-bold">{data.staff}</div>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs text-muted-foreground">Órdenes totales</div>
                    <div className="text-lg font-bold">{data.orders.length}</div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Última orden: {lastOrderAt ? `hace ${daysSince(lastOrderAt)} días` : "nunca"}
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium">Órdenes por mes</div>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ordersByMonth} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number) => [v, "Órdenes"]}
                        />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {topDevices.length > 0 && (
                  <div>
                    <div className="mb-2 text-sm font-medium">Dispositivos más frecuentes</div>
                    <div className="flex flex-wrap gap-2">
                      {topDevices.map(([device, n]) => (
                        <Badge key={device} variant="outline">{device} · {n}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
