import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BarChart3, MapPin, Smartphone, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { countryLabel } from "@/lib/locations";
import { monthKey, monthLabel, lastMonths, daysSince } from "@/lib/dateBuckets";

interface CompanyRow {
  id: string;
  name: string;
  created_at: string;
  plan_type: string;
  is_active: boolean;
  founder_cohort: boolean;
  is_paying: boolean;
  country: string;
  department: string | null;
  city: string | null;
}
interface OrderRow { company_id: string; created_at: string; device_type: string }

const chartTooltip = {
  cursor: { fill: "hsl(var(--accent))", opacity: 0.4 },
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  },
};

export default function SuperAdminMetrics() {
  const { isSuperAdmin, loading: roleLoading } = useSuperAdmin();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Panel de Métricas — F7 Manager Pro"; }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void load();
  }, [isSuperAdmin]);

  async function load() {
    setLoading(true);
    const [{ data: companiesData, error }, { data: ordersData }] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, created_at, plan_type, is_active, founder_cohort, is_paying, country, department, city")
        .order("created_at", { ascending: false }),
      supabase.from("orders").select("company_id, created_at, device_type"),
    ]);
    if (error) {
      toast.error("No se pudieron cargar las métricas");
      setLoading(false);
      return;
    }
    setCompanies((companiesData as CompanyRow[]) ?? []);
    setOrders((ordersData as OrderRow[]) ?? []);
    setLoading(false);
  }

  const months = useMemo(() => lastMonths(6), []);

  const summary = useMemo(() => {
    const thisMonth = months[months.length - 1];
    return {
      total: companies.length,
      active: companies.filter((c) => c.is_active).length,
      paying: companies.filter((c) => c.is_paying).length,
      newThisMonth: companies.filter((c) => monthKey(c.created_at) === thisMonth).length,
    };
  }, [companies, months]);

  const companiesByMonth = useMemo(() => {
    const counts = new Map<string, number>();
    companies.forEach((c) => counts.set(monthKey(c.created_at), (counts.get(monthKey(c.created_at)) ?? 0) + 1));
    return months.map((k) => ({ label: monthLabel(k), value: counts.get(k) ?? 0 }));
  }, [companies, months]);

  const ordersByMonth = useMemo(() => {
    const counts = new Map<string, number>();
    orders.forEach((o) => counts.set(monthKey(o.created_at), (counts.get(monthKey(o.created_at)) ?? 0) + 1));
    return months.map((k) => ({ label: monthLabel(k), value: counts.get(k) ?? 0 }));
  }, [orders, months]);

  const planMix = useMemo(() => {
    const counts = new Map<string, number>();
    companies.forEach((c) => counts.set(c.plan_type, (counts.get(c.plan_type) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [companies]);

  const byDepartment = useMemo(() => {
    const companyDept = new Map<string, string>();
    companies.forEach((c) => {
      if (c.country === "PY") companyDept.set(c.id, c.department || "Sin especificar");
    });
    const rows = new Map<string, { companies: number; orders: number }>();
    companies.forEach((c) => {
      if (c.country !== "PY") return;
      const dept = c.department || "Sin especificar";
      const row = rows.get(dept) ?? { companies: 0, orders: 0 };
      row.companies += 1;
      rows.set(dept, row);
    });
    orders.forEach((o) => {
      const dept = companyDept.get(o.company_id);
      if (!dept) return;
      const row = rows.get(dept) ?? { companies: 0, orders: 0 };
      row.orders += 1;
      rows.set(dept, row);
    });
    return Array.from(rows.entries())
      .map(([department, v]) => ({ department, ...v }))
      .sort((a, b) => b.orders - a.orders || b.companies - a.companies);
  }, [companies, orders]);

  const otherCountries = useMemo(() => {
    const counts = new Map<string, number>();
    companies.forEach((c) => { if (c.country !== "PY") counts.set(c.country, (counts.get(c.country) ?? 0) + 1); });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [companies]);

  const deviceTypes = useMemo(() => {
    const counts = new Map<string, number>();
    orders.forEach((o) => {
      const key = o.device_type || "Sin especificar";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [orders]);

  const inactive = useMemo(() => {
    const lastOrder = new Map<string, string>();
    orders.forEach((o) => {
      const cur = lastOrder.get(o.company_id);
      if (!cur || o.created_at > cur) lastOrder.set(o.company_id, o.created_at);
    });
    return companies
      .filter((c) => c.is_active)
      .map((c) => {
        const last = lastOrder.get(c.id) ?? null;
        const days = last ? daysSince(last) : daysSince(c.created_at);
        return { ...c, lastOrder: last, days };
      })
      .filter((c) => c.days > 30)
      .sort((a, b) => b.days - a.days);
  }, [companies, orders]);

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
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Panel de Métricas</h1>
            <p className="text-sm text-muted-foreground">Vista general de todos los talleres, no solo Fundadores.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Talleres totales</div>
                <div className="mt-1 text-2xl font-bold">{summary.total}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Activos</div>
                <div className="mt-1 text-2xl font-bold text-primary">{summary.active}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Pagando</div>
                <div className="mt-1 text-2xl font-bold text-emerald-500">{summary.paying}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Altas este mes</div>
                <div className="mt-1 text-2xl font-bold">{summary.newThisMonth}</div>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Altas de talleres por mes</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={companiesByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                        <Tooltip {...chartTooltip} formatter={(v: number) => [v, "Talleres nuevos"]} />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Órdenes creadas por mes (todos los talleres)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ordersByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                        <Tooltip {...chartTooltip} formatter={(v: number) => [v, "Órdenes"]} />
                        <Bar dataKey="value" fill="hsl(var(--secondary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-muted-foreground" /> Por departamento (Paraguay)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Departamento</TableHead><TableHead className="text-right">Talleres</TableHead><TableHead className="text-right">Órdenes</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {byDepartment.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sin datos todavía.</TableCell></TableRow>
                        ) : byDepartment.map((r) => (
                          <TableRow key={r.department}>
                            <TableCell className="font-medium">{r.department}</TableCell>
                            <TableCell className="text-right">{r.companies}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{r.orders}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {otherCountries.length > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Fuera de Paraguay: {otherCountries.map(([code, n]) => `${countryLabel(code)} (${n})`).join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><Smartphone className="h-4 w-4 text-muted-foreground" /> Dispositivos más reparados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Dispositivo</TableHead><TableHead className="text-right">Órdenes</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {deviceTypes.length === 0 ? (
                          <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Sin datos todavía.</TableCell></TableRow>
                        ) : deviceTypes.map(([device, n]) => (
                          <TableRow key={device}>
                            <TableCell className="font-medium">{device}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{n}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Mezcla de planes</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {planMix.map(([plan, n]) => (
                    <Badge key={plan} variant="outline" className="text-sm capitalize">
                      {plan}: <span className="ml-1 font-semibold">{n}</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Talleres activos sin órdenes en 30+ días ({inactive.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead className="text-right">Última orden</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactive.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Ninguno — todos los talleres activos tuvieron actividad reciente.</TableCell></TableRow>
                      ) : inactive.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="capitalize text-muted-foreground">{c.plan_type}</TableCell>
                          <TableCell className="text-muted-foreground">{c.country === "PY" ? (c.department ?? "—") : countryLabel(c.country)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {c.lastOrder ? `hace ${c.days} días` : "nunca creó una orden"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
