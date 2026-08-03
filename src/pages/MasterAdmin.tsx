import { useEffect, useState } from "react";
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

interface Company {
  id: string;
  name: string;
  created_at: string;
  plan_type: string;
  is_active: boolean;
  founder_cohort: boolean;
  referral_partner_id: string | null;
}

interface Partner {
  id: string;
  name: string;
}

const NO_PARTNER = "__none__";

export default function MasterAdmin() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

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
        .select("id, name, created_at, plan_type, is_active, founder_cohort, referral_partner_id")
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
      return;
    }
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    toast.success("Empresa actualizada");
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.id.slice(0, 8)}…
                      </TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("es-PY")}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={c.plan_type}
                          onValueChange={(v) => updateCompany(c.id, { plan_type: v })}
                          disabled={busy === c.id}
                        >
                          <SelectTrigger className="h-8 w-36">
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
                    </TableRow>
                  ))}
                  {companies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
    </div>
  );
}
