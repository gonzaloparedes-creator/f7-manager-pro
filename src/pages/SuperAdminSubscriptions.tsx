import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  BellRing,
  CalendarCheck,
  FlaskConical,
  MessageCircle,
  Pencil,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useSubscriptionsOverview, type SubscriptionCompany } from "@/hooks/useSubscriptionsOverview";
import { usePlanGraceDays } from "@/hooks/usePlanGraceDays";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlanExpiryBar from "@/components/PlanExpiryBar";
import MarkPaidDialog from "@/components/MarkPaidDialog";
import TrialDialog from "@/components/TrialDialog";
import FollowupMessageDialog, { type FollowupTarget } from "@/components/FollowupMessageDialog";
import { cn } from "@/lib/utils";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import { formatDateISO, todayInAsuncion } from "@/lib/subscriptionReceipt";
import {
  DEFAULT_TRIAL_DAYS,
  companyExpiryInfo,
  dateInAsuncion,
  expirySortKey,
  matchesExpiryFilter,
  timeSinceLabel,
  type ExpiryTone,
  type PlanExpiryInfo,
} from "@/lib/planExpiry";
import {
  CONTACT_COOLDOWN_DAYS,
  GROUP_LABELS,
  SITUATION_GROUP,
  SITUATION_LABELS,
  TRIAL_ENDING_DAYS,
  TRIAL_MIN_DAYS_BEFORE_CONTACT,
  buildFollowupQueue,
  followupSituation,
  wasContactedRecently,
  type FollowupGroup,
  type FollowupSituation,
} from "@/lib/followup";
import { toWhatsAppPhone } from "@/lib/whatsapp";

type TabKey = "pagos" | "pruebas" | "contactar";

interface Row {
  company: SubscriptionCompany;
  info: PlanExpiryInfo | null;
}

const ACCENT: Record<ExpiryTone | "none", string> = {
  ok: "border-l-primary",
  soon: "border-l-secondary",
  expired: "border-l-destructive",
  none: "border-l-border",
};

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");
const fold = (text: string) => text.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();

function haystack(c: SubscriptionCompany): string {
  return fold(
    [c.name, c.admin_name, c.admin_phone, PLAN_LABELS[c.plan_type as PlanType] ?? c.plan_type].filter(Boolean).join(" ")
  );
}

function matchesQuery(c: SubscriptionCompany, query: string): boolean {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const text = haystack(c);
  return tokens.every((t) => text.includes(t));
}

function byUrgency(a: Row, b: Row): number {
  const diff = expirySortKey(a.info) - expirySortKey(b.info);
  if (Number.isNaN(diff) || diff === 0) return a.company.name.localeCompare(b.company.name, "es", { sensitivity: "base" });
  return diff;
}

/* ---------- Filtros (chips con conteo) ---------- */
interface ChipOption<K extends string> {
  key: K;
  label: string;
  count: number;
  countClass?: string;
}

function ChipBar<K extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent/40",
            value === o.key ? "border-primary bg-primary/10" : "border-border"
          )}
        >
          <span className="font-medium">{o.label}</span>
          <span className={cn("font-bold tabular-nums", o.countClass)}>{o.count}</span>
        </button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar por negocio, administrador o teléfono…"
        aria-label="Buscar"
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Borrar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ---------- Tarjeta de empresa ---------- */
function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 px-2.5 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{children}</div>
    </div>
  );
}

interface SubscriptionCardProps {
  company: SubscriptionCompany;
  info: PlanExpiryInfo | null;
  situation: FollowupSituation | null;
  today: string;
  onWrite: () => void;
  onPay: () => void;
  onEditDates: () => void;
  onTrial: () => void;
}

function SubscriptionCard({ company: c, info, situation, today, onWrite, onPay, onEditDates, onTrial }: SubscriptionCardProps) {
  const isTrial = info?.kind === "trial";
  const lapsed = info?.phase === "suspended";
  const phone = toWhatsAppPhone(c.admin_phone);
  const planLabel = PLAN_LABELS[c.plan_type as PlanType] ?? c.plan_type;
  const group = situation ? SITUATION_GROUP[situation] : null;
  const recently = group ? wasContactedRecently(c, group, today) : false;
  const lastContactDay = c.last_contact_at ? dateInAsuncion(c.last_contact_at) : null;
  const lastOrderDay = c.last_order_at ? dateInAsuncion(c.last_order_at) : null;
  const contactKind = c.last_contact_kind === "cobro" || c.last_contact_kind === "prueba" ? c.last_contact_kind : null;

  return (
    <Card className={cn("overflow-hidden border-l-4", ACCENT[info?.tone ?? "none"])}>
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words font-semibold leading-tight">{c.name}</span>
            {c.founder_cohort && <Star className="h-3.5 w-3.5 shrink-0 fill-secondary text-secondary" aria-label="Fundador" />}
            <Badge variant="outline">{planLabel}</Badge>
            {!c.is_active && <Badge variant="destructive">Suspendida</Badge>}
            {c.is_active && lapsed && (
              <Badge variant="destructive">{isTrial ? "Prueba terminada" : "Suspendida por vencimiento"}</Badge>
            )}
            {isTrial && !lapsed && <Badge variant="outline">Prueba gratis</Badge>}
            {situation && <Badge variant="secondary">{SITUATION_LABELS[situation]}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">
            {c.admin_name?.trim() || "Administrador sin nombre"}
            {" · "}
            {phone ? `+${phone}` : <span className="text-destructive">sin teléfono válido</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {c.orders_count > 0
              ? `${c.orders_count} ${c.orders_count === 1 ? "orden" : "órdenes"}${
                  lastOrderDay ? ` · última ${timeSinceLabel(lastOrderDay, today).toLowerCase()}` : ""
                }`
              : "Todavía no cargó órdenes"}
            {lastContactDay && contactKind && (
              <>
                {" · "}
                <span className={cn(recently && "font-medium text-primary")}>
                  Último mensaje ({GROUP_LABELS[contactKind].toLowerCase()}): {timeSinceLabel(lastContactDay, today).toLowerCase()}
                </span>
              </>
            )}
          </div>
        </div>

        {info ? (
          <>
            <PlanExpiryBar info={info} />
            <div className="grid grid-cols-3 gap-2">
              <Stat label={isTrial ? "Empezó" : "Inicio"}>{formatDateISO(info.paidFrom)}</Stat>
              <Stat label={isTrial ? "Termina" : "Vence"}>{formatDateISO(info.expiresAt)}</Stat>
              <Stat label="Acceso hasta">{formatDateISO(info.accessUntil)}</Stat>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin fechas cargadas: no se suspende por tiempo. Cargá un pago o una prueba gratis para controlarla.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {situation && (
            <Button size="sm" onClick={onWrite} disabled={!phone} title={phone ? undefined : "No tiene un teléfono válido"}>
              <MessageCircle className="mr-1.5 h-4 w-4" />
              {recently ? "Escribir de nuevo" : "Escribir por WhatsApp"}
            </Button>
          )}
          {info?.kind === "paid" && (
            <Button size="sm" variant="outline" onClick={onEditDates}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Editar fechas
            </Button>
          )}
          {isTrial && (
            <Button size="sm" variant="outline" onClick={onTrial}>
              <FlaskConical className="mr-1.5 h-4 w-4" />
              Controlar prueba
            </Button>
          )}
          {!info && !c.plan_expires_at && (
            <Button size="sm" variant="outline" onClick={onTrial}>
              <FlaskConical className="mr-1.5 h-4 w-4" />
              Dar prueba gratis
            </Button>
          )}
          <Button size="sm" variant={situation ? "outline" : "default"} onClick={onPay}>
            <CalendarCheck className="mr-1.5 h-4 w-4" />
            {info?.kind === "paid" ? "Registrar nuevo pago" : isTrial ? "Pagado" : "Registrar pago"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="p-8 text-center">
      <p className="mx-auto max-w-prose text-sm text-muted-foreground">{children}</p>
    </Card>
  );
}

/* ---------- Página ---------- */
type PaidFilter = "todos" | "vencidas" | "por-vencer" | "al-dia" | "sin-fechas";
type TrialFilter = "todas" | "en-curso" | "por-terminar" | "terminadas";
type ContactFilter = "todos" | FollowupGroup;

function matchesPaidFilter(info: PlanExpiryInfo | null, filter: PaidFilter): boolean {
  switch (filter) {
    case "todos":
      return true;
    case "sin-fechas":
      return info === null;
    case "vencidas":
      return matchesExpiryFilter(info, "vencidas");
    case "por-vencer":
      return matchesExpiryFilter(info, "por-vencer");
    case "al-dia":
      return matchesExpiryFilter(info, "al-dia");
  }
}

function matchesTrialFilter(info: PlanExpiryInfo, filter: TrialFilter): boolean {
  switch (filter) {
    case "todas":
      return true;
    case "terminadas":
      return info.daysLeft < 0;
    case "por-terminar":
      return info.daysLeft >= 0 && info.daysLeft <= TRIAL_ENDING_DAYS;
    case "en-curso":
      return info.daysLeft > TRIAL_ENDING_DAYS;
  }
}

export default function SuperAdminSubscriptions() {
  const { isSuperAdmin, loading: roleLoading } = useSuperAdmin();
  const { companies, loading, failed, reload, patchCompany } = useSubscriptionsOverview(isSuperAdmin);
  const graceDays = usePlanGraceDays();
  const today = todayInAsuncion();

  const [tab, setTab] = useState<TabKey>("contactar");
  const [query, setQuery] = useState("");
  const [paidFilter, setPaidFilter] = useState<PaidFilter>("todos");
  const [trialFilter, setTrialFilter] = useState<TrialFilter>("todas");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("todos");
  const [payTarget, setPayTarget] = useState<{ company: SubscriptionCompany; editing: boolean } | null>(null);
  const [trialCompany, setTrialCompany] = useState<SubscriptionCompany | null>(null);
  const [writeTarget, setWriteTarget] = useState<FollowupTarget | null>(null);

  useEffect(() => {
    document.title = "Suscripciones y seguimiento — F7 Manager Pro";
  }, []);

  const rows = useMemo<Row[]>(
    () => companies.map((company) => ({ company, info: companyExpiryInfo(company, today, graceDays) })),
    [companies, today, graceDays]
  );

  const paidRows = useMemo(
    () => rows.filter((r) => r.company.is_paying || r.info?.kind === "paid").sort(byUrgency),
    [rows]
  );
  const trialRows = useMemo(
    () => rows.filter((r) => r.info?.kind === "trial" && !r.company.is_paying).sort(byUrgency),
    [rows]
  );
  const queue = useMemo(() => buildFollowupQueue(rows, today), [rows, today]);
  const pending = queue.filter((item) => !item.contactedRecently).length;

  const paidOptions: ChipOption<PaidFilter>[] = (
    [
      ["todos", "Todos", ""],
      ["vencidas", "Vencidos", "text-destructive"],
      ["por-vencer", "Por vencer", "text-secondary"],
      ["al-dia", "Al día", "text-primary"],
      ["sin-fechas", "Sin fechas", "text-muted-foreground"],
    ] as const
  ).map(([key, label, countClass]) => ({
    key,
    label,
    countClass,
    count: paidRows.filter((r) => matchesPaidFilter(r.info, key)).length,
  }));

  const trialOptions: ChipOption<TrialFilter>[] = (
    [
      ["todas", "Todas", ""],
      ["en-curso", "En curso", "text-primary"],
      ["por-terminar", "Por terminar", "text-secondary"],
      ["terminadas", "Terminadas", "text-destructive"],
    ] as const
  ).map(([key, label, countClass]) => ({
    key,
    label,
    countClass,
    count: trialRows.filter((r) => r.info && matchesTrialFilter(r.info, key)).length,
  }));

  const contactOptions: ChipOption<ContactFilter>[] = [
    { key: "todos", label: "Todos", count: queue.length },
    { key: "cobro", label: "Cobros", count: queue.filter((i) => i.group === "cobro").length, countClass: "text-secondary" },
    { key: "prueba", label: "Pruebas", count: queue.filter((i) => i.group === "prueba").length, countClass: "text-primary" },
  ];

  const visiblePaid = paidRows.filter((r) => matchesPaidFilter(r.info, paidFilter) && matchesQuery(r.company, query));
  const visibleTrial = trialRows.filter(
    (r) => r.info && matchesTrialFilter(r.info, trialFilter) && matchesQuery(r.company, query)
  );
  const visibleQueue = queue.filter(
    (item) => (contactFilter === "todos" || item.group === contactFilter) && matchesQuery(item.company, query)
  );

  const renderCard = (company: SubscriptionCompany, info: PlanExpiryInfo | null) => {
    const situation = followupSituation(company, info, today);
    return (
      <SubscriptionCard
        key={company.id}
        company={company}
        info={info}
        situation={situation}
        today={today}
        onWrite={() => info && situation && setWriteTarget({ company, info, situation })}
        onPay={() => setPayTarget({ company, editing: false })}
        onEditDates={() => setPayTarget({ company, editing: true })}
        onTrial={() => setTrialCompany(company)}
      />
    );
  };

  if (roleLoading) {
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">Suscripciones y seguimiento</h1>
                <p className="text-sm text-muted-foreground">Quién paga, quién está probando y a quién escribirle hoy</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
                <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} />
                Actualizar
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/master-admin">Gestión de empresas</Link>
              </Button>
            </div>
          </div>
        </div>

        {failed ? (
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">No se pudieron cargar las suscripciones.</p>
            <Button variant="outline" size="sm" onClick={() => void reload()}>Reintentar</Button>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-3">
              <TabsTrigger value="contactar" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <span className="sm:hidden">Contactar</span>
                <span className="hidden sm:inline">Para contactar</span>
                {pending > 0 && <Badge className="h-5 min-w-5 justify-center px-1.5 tabular-nums">{pending}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="pagos" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <span className="sm:hidden">Pagos</span>
                <span className="hidden sm:inline">Clientes pagos</span>
                <span className="tabular-nums text-muted-foreground">{paidRows.length}</span>
              </TabsTrigger>
              <TabsTrigger value="pruebas" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <span className="sm:hidden">Pruebas</span>
                <span className="hidden sm:inline">Pruebas gratis</span>
                <span className="tabular-nums text-muted-foreground">{trialRows.length}</span>
              </TabsTrigger>
            </TabsList>

            <SearchBox value={query} onChange={setQuery} />

            {loading && companies.length === 0 ? (
              <div className="space-y-3" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-muted/30" />
                ))}
              </div>
            ) : (
              <>
                <TabsContent value="contactar" className="mt-0 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Cobros: planes que vencen en 7 días o menos, vencidos o en gracia. Pruebas: a partir del día{" "}
                    {TRIAL_MIN_DAYS_BEFORE_CONTACT + 1}, en sus últimos {TRIAL_ENDING_DAYS} días y las terminadas. A quien le
                    escribiste hace menos de {CONTACT_COOLDOWN_DAYS} días pasa al final de la lista.
                  </p>
                  <ChipBar<ContactFilter> label="Filtrar por motivo" options={contactOptions} value={contactFilter} onChange={setContactFilter} />
                  {visibleQueue.length === 0 ? (
                    <EmptyState>
                      {queue.length === 0
                        ? "No hay nadie a quien escribirle hoy: ningún plan por vencer ni prueba que seguir."
                        : "Nadie coincide con la búsqueda o el filtro."}
                    </EmptyState>
                  ) : (
                    <div className="space-y-3">{visibleQueue.map((item) => renderCard(item.company, item.info))}</div>
                  )}
                </TabsContent>

                <TabsContent value="pagos" className="mt-0 space-y-4">
                  <ChipBar<PaidFilter> label="Filtrar clientes pagos" options={paidOptions} value={paidFilter} onChange={setPaidFilter} />
                  {visiblePaid.length === 0 ? (
                    <EmptyState>
                      {paidRows.length === 0
                        ? "Todavía no hay clientes que paguen. Cuando registres un pago desde “Registrar pago”, aparece acá con su cuenta regresiva."
                        : "Nadie coincide con la búsqueda o el filtro."}
                    </EmptyState>
                  ) : (
                    <div className="space-y-3">{visiblePaid.map((r) => renderCard(r.company, r.info))}</div>
                  )}
                </TabsContent>

                <TabsContent value="pruebas" className="mt-0 space-y-4">
                  <ChipBar<TrialFilter> label="Filtrar pruebas gratis" options={trialOptions} value={trialFilter} onChange={setTrialFilter} />
                  {visibleTrial.length === 0 ? (
                    <EmptyState>
                      {trialRows.length === 0
                        ? `Todavía no hay pruebas gratis. Las empresas que se registren desde ahora arrancan con ${DEFAULT_TRIAL_DAYS} días de prueba y se suspenden solas al terminar; las anteriores no tienen fecha y no se suspenden. Podés darle una prueba a cualquiera con “Dar prueba gratis” en Gestión de empresas.`
                        : "Nadie coincide con la búsqueda o el filtro."}
                    </EmptyState>
                  ) : (
                    <div className="space-y-3">{visibleTrial.map((r) => renderCard(r.company, r.info))}</div>
                  )}
                </TabsContent>
              </>
            )}
          </Tabs>
        )}
      </div>

      <MarkPaidDialog
        company={payTarget?.company ?? null}
        editing={payTarget?.editing ?? false}
        onClose={() => setPayTarget(null)}
        onSaved={(id, patch) => patchCompany(id, patch)}
      />
      <TrialDialog company={trialCompany} onClose={() => setTrialCompany(null)} onSaved={(id, patch) => patchCompany(id, patch)} />
      <FollowupMessageDialog
        target={writeTarget}
        onClose={() => setWriteTarget(null)}
        onSent={(id, kind, sentAt) => patchCompany(id, { last_contact_at: sentAt, last_contact_kind: kind })}
      />
    </div>
  );
}
