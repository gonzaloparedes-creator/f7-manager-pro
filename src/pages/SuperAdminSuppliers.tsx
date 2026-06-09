import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe2, TrendingUp, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface PartRow {
  id: string;
  created_at: string;
  part_details: string | null;
  supplier_name: string | null;
  historical_cost: number;
  order_id: string;
  company_name: string;
}

const fmtGs = (n: number) =>
  new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n || 0);

export default function SuperAdminSuppliers() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [rows, setRows] = useState<PartRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = "Comparativa de Proveedores — Super Admin";
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void load();
  }, [isSuperAdmin]);

  async function load() {
    setBusy(true);
    const { data, error } = await supabase
      .from("order_parts")
      .select("id, created_at, part_details, supplier_name, historical_cost, order_id, orders!inner(company_id, companies!inner(name))")
      .not("supplier_name", "is", null)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("No se pudieron cargar los datos");
      setBusy(false);
      return;
    }
    const mapped: PartRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      part_details: r.part_details,
      supplier_name: r.supplier_name,
      historical_cost: Number(r.historical_cost) || 0,
      order_id: r.order_id,
      company_name: r.orders?.companies?.name ?? "—",
    }));
    setRows(mapped);
    setBusy(false);
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.part_details, r.supplier_name, r.company_name].some((v) =>
        (v ?? "").toLowerCase().includes(t)
      )
    );
  }, [rows, q]);

  const aggregates = useMemo(() => {
    const map = new Map<string, { supplier: string; part: string; costs: number[] }>();
    for (const r of rows) {
      const key = `${(r.supplier_name ?? "").toLowerCase()}__${(r.part_details ?? "").toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, { supplier: r.supplier_name ?? "—", part: r.part_details ?? "—", costs: [] });
      }
      map.get(key)!.costs.push(r.historical_cost);
    }
    return Array.from(map.values())
      .map((g) => ({
        supplier: g.supplier,
        part: g.part,
        count: g.costs.length,
        avg: g.costs.reduce((a, b) => a + b, 0) / g.costs.length,
        min: Math.min(...g.costs),
        max: Math.max(...g.costs),
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

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
      <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Comparativa de Proveedores</h1>
              <p className="text-sm text-muted-foreground">
                Inteligencia de mercado global · {rows.length} compras registradas
              </p>
            </div>
          </div>
          <Link
            to="/superadmin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Super Admin
          </Link>
        </div>

        {/* Aggregates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Resumen por Proveedor · Repuesto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aggregates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay datos de proveedores externos.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {aggregates.slice(0, 12).map((a, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{a.supplier}</div>
                        <div className="truncate text-xs text-muted-foreground">{a.part}</div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">{a.count}×</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">Min</div>
                        <div className="text-xs font-semibold text-emerald-400">{fmtGs(a.min)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">Prom</div>
                        <div className="text-xs font-semibold text-primary">{fmtGs(a.avg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">Max</div>
                        <div className="text-xs font-semibold text-orange-400">{fmtGs(a.max)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Compras registradas</CardTitle>
            <Input
              placeholder="Buscar repuesto, proveedor o taller…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="sm:max-w-sm"
            />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repuesto / Calidad</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Taller (Cliente)</TableHead>
                    <TableHead className="text-right">Costo (Gs.)</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {busy ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Cargando…
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Sin resultados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="max-w-xs truncate">{r.part_details ?? "—"}</TableCell>
                        <TableCell className="font-medium">{r.supplier_name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.company_name}</TableCell>
                        <TableCell className="text-right font-mono">{fmtGs(r.historical_cost)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("es-PY")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
