import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Copy, Link2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PLAN_LABELS, type Cycle, type PlanType } from "@/lib/plans";
import { CYCLE_LABELS, formatDateISO, isValidISODate, todayInAsuncion } from "@/lib/subscriptionReceipt";
import { suggestedExpiry } from "@/lib/planExpiry";
import {
  guaranteeEndsAt,
  INVITE_STATUS_LABELS,
  inviteStatus,
  inviteUrl,
  inviteWhatsAppMessage,
  invitePlanLine,
  type InviteStatus,
  type SignupInvite,
} from "@/lib/signupInvites";

// /superadmin/altas: links de alta pagada. Después de cobrar por WhatsApp se crea un link de
// un solo uso; al registrarse con él, la empresa nace con el plan pagado (sin prueba gratis).

const PLAN_ORDER: PlanType[] = ["starter", "pro", "business", "retail"];
const CYCLES: Cycle[] = ["mensual", "semestral", "anual"];

type InviteRow = SignupInvite & { companies: { name: string } | null };

const STATUS_VARIANT: Record<InviteStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "default",
  used: "secondary",
  revoked: "outline",
  expired: "outline",
};

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copiado`);
  } catch {
    toast.error("No se pudo copiar");
  }
}

export default function SuperAdminAltas() {
  const { isSuperAdmin, loading: roleLoading } = useSuperAdmin();
  const today = todayInAsuncion();
  const origin = window.location.origin;

  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [plan, setPlan] = useState<PlanType>("pro");
  const [cycle, setCycle] = useState<Cycle>("mensual");
  const [paidFrom, setPaidFrom] = useState(today);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<SignupInvite | null>(null);
  const [toRevoke, setToRevoke] = useState<InviteRow | null>(null);

  useEffect(() => { document.title = "Links de alta — Super Admin"; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("signup_invites")
      .select("*, companies:used_company_id(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast.error("No se pudieron cargar los links", { description: error.message });
      return;
    }
    setRows((data ?? []) as unknown as InviteRow[]);
  }, []);

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin, load]);

  const validFrom = isValidISODate(paidFrom);
  const expiresAt = useMemo(() => (validFrom ? suggestedExpiry(paidFrom, cycle) : ""), [validFrom, paidFrom, cycle]);

  const create = async () => {
    if (!validFrom) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("signup_invites")
      .insert({
        plan_type: plan,
        billing_cycle: cycle,
        plan_paid_from: paidFrom,
        plan_expires_at: expiresAt,
        note: note.trim() || null,
      })
      .select("*")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("No se pudo crear el link", { description: error?.message });
      return;
    }
    setCreated(data as SignupInvite);
    setNote("");
    toast.success("Link creado: copiá el mensaje y mandalo por WhatsApp");
    load();
  };

  const revoke = async (row: InviteRow) => {
    const { error } = await supabase
      .from("signup_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("used_at", null);
    setToRevoke(null);
    if (error) {
      toast.error("No se pudo anular el link", { description: error.message });
      return;
    }
    toast.success("Link anulado");
    load();
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
    <div className="container max-w-5xl space-y-6 py-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/superadmin" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Links de alta pagada</h1>
          <p className="text-sm text-muted-foreground">
            Después de cobrar, creá un link de un solo uso: el cliente se registra y su plan ya queda activo, sin prueba gratis.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-primary" /> Nuevo link
          </CardTitle>
          <CardDescription>Mismo cálculo de vencimiento que «Registrar pago».</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="invite-note">Cliente (para acordarte)</Label>
              <Input id="invite-note" placeholder="Ej: hermano de Rocío" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as PlanType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_ORDER.map((p) => <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ciclo</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as Cycle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CYCLES.map((c) => <SelectItem key={c} value={c}>{CYCLE_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-paid-from">Fecha del pago</Label>
              <Input id="invite-paid-from" type="date" value={paidFrom} onChange={(e) => setPaidFrom(e.target.value)} />
            </div>
          </div>
          {validFrom && (
            <p className="text-sm text-muted-foreground">
              Plan activo hasta el <b className="text-foreground">{formatDateISO(expiresAt)}</b> · garantía hasta el{" "}
              <b className="text-foreground">{formatDateISO(guaranteeEndsAt(paidFrom))}</b>
            </p>
          )}
          <Button onClick={create} disabled={creating || !validFrom}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Crear link
          </Button>

          {created && (
            <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
              <p className="text-sm font-semibold">Link listo · {invitePlanLine(created.plan_type, created.billing_cycle)}</p>
              <pre className="whitespace-pre-wrap rounded-md bg-background p-3 text-sm">{inviteWhatsAppMessage(created, origin)}</pre>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => copy(inviteWhatsAppMessage(created, origin), "Mensaje")}>
                  <Copy className="h-4 w-4" /> Copiar mensaje
                </Button>
                <Button size="sm" variant="outline" onClick={() => copy(inviteUrl(created.code, origin), "Link")}>
                  <Copy className="h-4 w-4" /> Copiar solo el link
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Links creados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Todavía no creaste ningún link.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => {
                const status = inviteStatus(row, today);
                return (
                  <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{row.note || "Sin nombre"}</span>
                        <Badge variant={STATUS_VARIANT[status]}>{INVITE_STATUS_LABELS[status]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {invitePlanLine(row.plan_type, row.billing_cycle)} · pagó el {formatDateISO(row.plan_paid_from)} · activo hasta el{" "}
                        {formatDateISO(row.plan_expires_at)}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" /> Garantía hasta el {formatDateISO(guaranteeEndsAt(row.plan_paid_from))}
                        {status === "used" && row.companies?.name ? ` · cuenta: ${row.companies.name}` : ""}
                      </p>
                    </div>
                    {status === "pending" && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" onClick={() => copy(inviteWhatsAppMessage(row, origin), "Mensaje")}>
                          <Copy className="h-4 w-4" /> Mensaje
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setToRevoke(row)}>
                          <XCircle className="h-4 w-4" /> Anular
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!toRevoke}
        onOpenChange={(open) => !open && setToRevoke(null)}
        title="¿Anular este link?"
        description="El cliente ya no va a poder registrarse con él. Si hace falta, podés crear otro."
        confirmLabel="Anular link"
        onConfirm={() => toRevoke && revoke(toRevoke)}
      />
    </div>
  );
}
