import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Rocket, Search, Users2 } from "lucide-react";

interface CompanyRow {
  id: string;
  name: string;
  created_at: string;
  plan_type: string;
  is_active: boolean;
  founder_cohort: boolean;
  founder_cohort_at: string | null;
  is_paying: boolean;
  referral_partner_id: string | null;
}

interface Partner {
  id: string;
  name: string;
  commission_rate: number;
}

interface Metrics {
  clientCount: number;
  actionCount: number;
  activeDays: string[];
  activated: boolean;
  activatedAt: string | null;
  daysSinceActivation: number | null;
  trialDaysLeft: number | null;
  trialExpired: boolean;
}

const DAY_MS = 86_400_000;
const FOUNDER_CHALLENGE_DAYS = 45;
const dateKey = (iso: string) => iso.slice(0, 10);
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);

function computeMetrics(clientDates: string[], actionDates: string[]): Metrics {
  const activeDays = Array.from(new Set([...clientDates, ...actionDates].map(dateKey))).sort();
  const activated = clientDates.length > 0 && actionDates.length > 0 && activeDays.length >= 3;
  const activatedAt = activated ? activeDays[2] : null;
  const daysSinceActivation = activatedAt ? daysSince(activatedAt) : null;
  const trialDaysLeft = daysSinceActivation !== null ? Math.max(0, FOUNDER_CHALLENGE_DAYS - daysSinceActivation) : null;
  const trialExpired = daysSinceActivation !== null && daysSinceActivation > FOUNDER_CHALLENGE_DAYS;
  return {
    clientCount: clientDates.length,
    actionCount: actionDates.length,
    activeDays,
    activated,
    activatedAt,
    daysSinceActivation,
    trialDaysLeft,
    trialExpired,
  };
}

export default function SuperAdminFundadores() {
  const { isSuperAdmin, loading: roleLoading } = useSuperAdmin();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [metrics, setMetrics] = useState<Record<string, Metrics>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { document.title = "Panel de Fundadores — F7 Manager Pro"; }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void load();
  }, [isSuperAdmin]);

  async function load() {
    setLoading(true);
    const [{ data: companiesData, error }, { data: partnersData }] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, created_at, plan_type, is_active, founder_cohort, founder_cohort_at, is_paying, referral_partner_id")
        .or("founder_cohort.eq.true,referral_partner_id.not.is.null")
        .order("created_at", { ascending: false }),
      supabase.from("referral_partners").select("id, name, commission_rate").order("name"),
    ]);
    if (error) {
      toast.error("No se pudieron cargar los Fundadores");
      setLoading(false);
      return;
    }
    const rows = (companiesData as CompanyRow[]) ?? [];
    setCompanies(rows);
    setPartners((partnersData as Partner[]) ?? []);

    const ids = rows.map((c) => c.id);
    if (ids.length === 0) {
      setMetrics({});
      setLoading(false);
      return;
    }

    const [{ data: clients }, { data: orders }, { data: sales }] = await Promise.all([
      supabase.from("clients").select("company_id, created_at").in("company_id", ids),
      supabase.from("orders").select("company_id, created_at").in("company_id", ids),
      (supabase as any).from("product_sales").select("company_id, created_at").in("company_id", ids),
    ]);

    const clientDatesByCompany = new Map<string, string[]>();
    (clients ?? []).forEach((r: any) => {
      const arr = clientDatesByCompany.get(r.company_id) ?? [];
      arr.push(r.created_at);
      clientDatesByCompany.set(r.company_id, arr);
    });
    const actionDatesByCompany = new Map<string, string[]>();
    (orders ?? []).forEach((r: any) => {
      const arr = actionDatesByCompany.get(r.company_id) ?? [];
      arr.push(r.created_at);
      actionDatesByCompany.set(r.company_id, arr);
    });
    (sales ?? []).forEach((r: any) => {
      const arr = actionDatesByCompany.get(r.company_id) ?? [];
      arr.push(r.created_at);
      actionDatesByCompany.set(r.company_id, arr);
    });

    const nextMetrics: Record<string, Metrics> = {};
    rows.forEach((c) => {
      nextMetrics[c.id] = computeMetrics(clientDatesByCompany.get(c.id) ?? [], actionDatesByCompany.get(c.id) ?? []);
    });
    setMetrics(nextMetrics);
    setLoading(false);
  }

  async function togglePaying(id: string, value: boolean) {
    setBusy(id);
    const { error } = await supabase.from("companies").update({ is_paying: value }).eq("id", id);
    setBusy(null);
    if (error) { toast.error("Error al actualizar"); return; }
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, is_paying: value } : c)));
    toast.success(value ? "Marcado como pagando" : "Ya no figura como pagando");
  }

  async function toggleFounder(id: string, value: boolean) {
    setBusy(id);
    const { error } = await supabase
      .from("companies")
      .update({ founder_cohort: value, founder_cohort_at: value ? new Date().toISOString() : null })
      .eq("id", id);
    setBusy(null);
    if (error) { toast.error("Error al actualizar"); return; }
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, founder_cohort: value } : c)));
    toast.success(value ? "Marcada como Fundador" : "Ya no es Fundador");
  }

  const partnerName = (id: string | null) => partners.find((p) => p.id === id)?.name ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, search]);

  const summary = useMemo(() => {
    const total = companies.length;
    const activated = companies.filter((c) => metrics[c.id]?.activated).length;
    const paying = companies.filter((c) => c.is_paying).length;
    return { total, activated, paying };
  }, [companies, metrics]);

  const byPartner = useMemo(() => {
    return partners
      .map((p) => {
        const referred = companies.filter((c) => c.referral_partner_id === p.id);
        const paying = referred.filter((c) => c.is_paying).length;
        return { ...p, referred: referred.length, paying };
      })
      .filter((p) => p.referred > 0);
  }, [partners, companies]);

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
      <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Panel de Fundadores</h1>
            <p className="text-sm text-muted-foreground">
              Embudo de activación del Programa Fundadores. Incluye Fundadores marcados a mano y cualquier registro
              que llegó por un link de aliado, ya esté marcado o no.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Fundadores / referidos</div>
            <div className="mt-1 text-2xl font-bold">{summary.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Activados</div>
            <div className="mt-1 text-2xl font-bold text-primary">
              {summary.activated}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                ({summary.total > 0 ? Math.round((summary.activated / summary.total) * 100) : 0}%)
              </span>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Pagando</div>
            <div className="mt-1 text-2xl font-bold text-emerald-500">
              {summary.paying}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                ({summary.total > 0 ? Math.round((summary.paying / summary.total) * 100) : 0}%)
              </span>
            </div>
          </Card>
        </div>

        {byPartner.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users2 className="h-4 w-4 text-muted-foreground" /> Por aliado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {byPartner.map((p) => (
                  <div key={p.id} className="rounded-md border border-border bg-muted/30 p-3">
                    <div className="font-medium text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.referred} referidos · {p.paying} pagando · {p.commission_rate}% de comisión
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      El monto exacto se calcula contra lo efectivamente cobrado — esto es atribución, no facturación.
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-lg">Empresas ({filtered.length})</CardTitle>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Aliado</TableHead>
                    <TableHead className="text-center">Cliente</TableHead>
                    <TableHead className="text-center">Acción real</TableHead>
                    <TableHead className="text-center">Días activos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Trial</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Fundador</TableHead>
                    <TableHead>Paga</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Sin Fundadores ni referidos todavía.</TableCell></TableRow>
                  ) : filtered.map((c) => {
                    const m = metrics[c.id];
                    const partner = partnerName(c.referral_partner_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          {partner ? <Badge variant="outline">{partner}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {m?.clientCount ? <Badge variant="outline">{m.clientCount}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {m?.actionCount ? <Badge variant="outline">{m.actionCount}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">{m?.activeDays.length ?? 0}</TableCell>
                        <TableCell>
                          {m?.activated ? (
                            <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Activado</Badge>
                          ) : (
                            <Badge variant="secondary">Sin activar</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {m?.trialDaysLeft === null ? (
                            <span className="text-xs text-muted-foreground">No arrancó</span>
                          ) : m.trialExpired ? (
                            <span className="text-xs font-medium text-destructive">Vencido</span>
                          ) : (
                            <span className="text-xs">{m.trialDaysLeft} días</span>
                          )}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">{c.plan_type}</TableCell>
                        <TableCell>
                          <Switch checked={c.founder_cohort} disabled={busy === c.id} onCheckedChange={(v) => toggleFounder(c.id, v)} />
                        </TableCell>
                        <TableCell>
                          <Switch checked={c.is_paying} disabled={busy === c.id} onCheckedChange={(v) => togglePaying(c.id, v)} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
