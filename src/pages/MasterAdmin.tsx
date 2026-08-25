import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { COUNTRIES, PY_DEPARTMENTS, countryLabel } from "@/lib/locations";
import { monthKey, monthLabel, lastMonths, daysSince } from "@/lib/dateBuckets";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Company {
  id: string;
  name: string;
  created_at: string;
  plan_type: string;
  is_active: boolean;
  founder_cohort: boolean;
  referral_partner_id: string | null;
  country: string;
  department: string | null;
  city: string | null;
}

interface Partner {
  id: string;
  name: string;
}

const NO_PARTNER = "__none__";
const NO_DEPARTMENT = "__unset__";

export default function MasterAdmin() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [cityDrafts, setCityDrafts] = useState<Record<string, string>>({});
  const [detailCompany, setDetailCompany] = useState<Company | null>(null);

  useEffect(() => {
    document.title = "Master Admin — F7 Manager Pro";
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void load();
  }, [isSuperAdmin]);

  async function load() {
    const [{ data, error }, { data: partnersData }] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, created_at, plan_type, is_active, founder_cohort, referral_partner_id, country, department, city")
        .order("created_at", { ascending: false }),
      supabase.from("referral_partners").select("id, name").order("name"),
    ]);
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
      <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Master Admin</h1>
            <p className="text-sm text-muted-foreground">Gestión global de inquilinos SaaS</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Empresas ({companies.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Creada</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fundador</TableHead>
                    <TableHead>Aliado</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Ciudad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.id.slice(0, 8)}…
                      </TableCell>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => setDetailCompany(c)}
                        >
                          {c.name}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("es-PY")}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={c.plan_type}
                          onValueChange={(v) => updateCompany(c.id, { plan_type: v })}
                          disabled={busy === c.id}
                        >
                          <SelectTrigger className="h-8 w-36" aria-label={`Plan de ${c.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="retail">Retail</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={c.is_active}
                            disabled={busy === c.id}
                            onCheckedChange={(v) => updateCompany(c.id, { is_active: v })}
                            aria-label={`${c.is_active ? "Desactivar" : "Activar"} ${c.name}`}
                          />
                          <Badge variant={c.is_active ? "default" : "destructive"}>
                            {c.is_active ? "Activa" : "Suspendida"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.founder_cohort}
                          disabled={busy === c.id}
                          onCheckedChange={(v) => toggleFounder(c.id, v)}
                          aria-label={`${c.founder_cohort ? "Quitar" : "Agregar"} ${c.name} del cohorte fundadores`}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={c.referral_partner_id ?? NO_PARTNER}
                          onValueChange={(v) => updateCompany(c.id, { referral_partner_id: v === NO_PARTNER ? null : v })}
                          disabled={busy === c.id}
                        >
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_PARTNER}>Ninguno</SelectItem>
                            {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={c.country}
                          onValueChange={(v) => {
                            if (v !== "PY") setCityDrafts((prev) => ({ ...prev, [c.id]: "" }));
                            updateCompany(c.id, { country: v, ...(v !== "PY" ? { department: null, city: null } : {}) });
                          }}
                          disabled={busy === c.id}
                        >
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((co) => <SelectItem key={co.code} value={co.code}>{co.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {c.country === "PY" ? (
                          <Select
                            value={c.department ?? NO_DEPARTMENT}
                            onValueChange={(v) => updateCompany(c.id, { department: v === NO_DEPARTMENT ? null : v })}
                            disabled={busy === c.id}
                          >
                            <SelectTrigger className="h-8 w-36"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_DEPARTMENT}>—</SelectItem>
                              {PY_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.country === "PY" ? (
                          <Input
                            className="h-8 w-32"
                            value={cityDrafts[c.id] ?? c.city ?? ""}
                            disabled={busy === c.id}
                            onChange={(e) => setCityDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                            onBlur={async () => {
                              const draft = cityDrafts[c.id];
                              if (draft !== undefined && draft !== (c.city ?? "")) {
                                const ok = await updateCompany(c.id, { city: draft || null });
                                if (!ok) {
                                  setCityDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[c.id];
                                    return next;
                                  });
                                }
                              }
                            }}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {companies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        Sin empresas registradas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <CompanyDetailDialog company={detailCompany} onClose={() => setDetailCompany(null)} />
    </div>
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
