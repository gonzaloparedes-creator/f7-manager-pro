import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Wrench, CheckCircle2, Clock, Stethoscope, PackageCheck, CalendarDays, Smartphone, Wallet } from "lucide-react";
import { STATUS_LABELS, formatPYG, type OrderStatus } from "@/lib/orders";
import f7Logo from "@/assets/f7-logo.png";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CargoAdicional { motivo: string; monto: number; }
interface PublicOrder {
  id: string;
  order_number: string;
  device_type: string;
  status: string;
  technician_notes: string | null;
  estimated_delivery_date: string | null;
  created_at: string;
  updated_at: string;
  quote_amount?: number | null;
  deposit_amount?: number | null;
  cargos_adicionales?: CargoAdicional[] | null;
  problems?: string[] | null;
  problem_other?: string | null;
  problem_description?: string | null;
}
interface PublicHistory { id: string; status: string; note: string | null; created_at: string; image_urls?: string[] | null; }
interface PublicTechNote { id: string; note: string; created_at: string; }

const ICONS: Record<string, any> = {
  recibido: Clock,
  en_diagnostico: Stethoscope,
  en_reparacion: Wrench,
  listo: PackageCheck,
  entregado: CheckCircle2,
};

export default function PublicTrackingByCode() {
  const { orderCode } = useParams();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [history, setHistory] = useState<PublicHistory[]>([]);
  const [techNotes, setTechNotes] = useState<PublicTechNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = orderCode
      ? `Seguimiento ${orderCode} | F7 Manager Pro`
      : "Seguimiento de reparación | F7 Manager Pro";

    (async () => {
      if (!orderCode) {
        setLoading(false);
        return;
      }
      const [{ data: o }, { data: h }, { data: tn }] = await Promise.all([
        supabase.rpc("get_order_by_code", { _code: orderCode }),
        supabase.rpc("get_history_by_code", { _code: orderCode }),
        supabase.rpc("get_technical_notes_by_code", { _code: orderCode }),
      ]);
      const found: any = Array.isArray(o) ? o[0] : null;
      setOrder(found ? { ...found, cargos_adicionales: Array.isArray(found.cargos_adicionales) ? found.cargos_adicionales : [] } : null);
      setHistory((h ?? []) as PublicHistory[]);
      setTechNotes((tn ?? []) as PublicTechNote[]);
      setLoading(false);
    })();
  }, [orderCode]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent p-4">
        <Card className="max-w-md text-center">
          <CardContent className="space-y-2 p-8">
            <h1 className="text-xl font-bold">Orden no encontrada</h1>
            <p className="text-sm text-muted-foreground">
              No encontramos ninguna orden con el código <span className="font-mono">{orderCode}</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Icon = ICONS[order.status] ?? Wrench;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
            <img src={f7Logo} alt="F7 Manager Pro" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="font-bold leading-tight">F7 Manager Pro</div>
            <div className="text-xs text-muted-foreground">Seguimiento de reparación</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 p-4 py-8">
        <Card className="overflow-hidden shadow-elevated">
          <div className="bg-gradient-primary p-6 text-primary-foreground">
            <div className="text-xs uppercase tracking-wide opacity-80">Orden</div>
            <div className="font-mono text-lg font-semibold">{order.order_number}</div>
            <div className="mt-3 flex items-center gap-2 text-2xl font-bold">
              <Smartphone className="h-6 w-6" />
              {order.device_type}
            </div>
          </div>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3 rounded-lg bg-accent p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Estado actual</div>
                <div className="font-semibold">
                  {STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                </div>
              </div>
              <StatusBadge status={order.status} />
            </div>

            {order.estimated_delivery_date && (
              <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                <CalendarDays className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">Entrega estimada</div>
                  <div className="font-medium">
                    {format(
                      new Date(order.estimated_delivery_date + "T00:00:00"),
                      "PPP",
                      { locale: es }
                    )}
                  </div>
                </div>
              </div>
            )}

            {((order.problems && order.problems.length > 0) || order.problem_description) && (
              <div className="border-t border-border pt-4 space-y-4">
                {order.problems && order.problems.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Problemas detectados</div>
                    <div className="flex flex-wrap gap-1.5">
                      {order.problems.map((p) => (
                        <span key={p} className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium border border-primary/20">
                          {p === "Otro" && order.problem_other ? `Otro: ${order.problem_other}` : p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {order.problem_description && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observaciones iniciales</div>
                    <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 border border-border/50 whitespace-pre-wrap leading-relaxed">
                      {order.problem_description}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {(() => {
          const cargos = order.cargos_adicionales ?? [];
          const quote = Number(order.quote_amount ?? 0);
          const deposit = Number(order.deposit_amount ?? 0);
          const cargosTotal = cargos.reduce((s, c) => s + Number(c.monto || 0), 0);
          const totalAjustado = quote + cargosTotal;
          const saldo = Math.max(0, totalAjustado - deposit);
          if (quote <= 0 && deposit <= 0 && cargos.length === 0) return null;
          return (
            <Card>
              <CardContent className="space-y-3 p-6">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Wallet className="h-4 w-4 text-primary" /> Información financiera
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Presupuesto inicial</span>
                    <span className="font-medium">{formatPYG(quote)}</span>
                  </div>
                  {cargos.length > 0 && (
                    <div className="space-y-1.5 rounded-md border border-dashed border-border p-2">
                      <div className="text-xs font-medium text-muted-foreground">Cargos adicionales</div>
                      {cargos.map((c, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{c.motivo}</span>
                          <span className="font-medium">{formatPYG(c.monto)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">Total ajustado</span>
                    <span className="font-semibold">{formatPYG(totalAjustado)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Seña</span>
                    <span className="font-medium">- {formatPYG(deposit)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm font-semibold">Saldo</span>
                    <span className="text-base font-bold text-primary">{formatPYG(saldo)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {techNotes.length > 0 && (
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <Wrench className="h-4 w-4 text-primary" /> Bitácora técnica
              </h2>
              <ol className="relative space-y-4 border-l-2 border-border pl-5">
                {techNotes.map((tn) => (
                  <li key={tn.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20" />
                    <div className="rounded-md border border-border bg-card p-3">
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(tn.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{tn.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="font-semibold">Historial de estados</h2>
            <ol className="space-y-4">
              {history.map((h, i) => {
                const HIcon = ICONS[h.status] ?? Wrench;
                const isLast = i === history.length - 1;
                return (
                  <li key={h.id} className="relative pl-10">
                    {!isLast && <span className="absolute left-[18px] top-9 h-full w-px bg-border" />}
                    <span className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <HIcon className="h-4 w-4" />
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {STATUS_LABELS[h.status as OrderStatus] ?? h.status}
                      </span>
                      <StatusBadge status={h.status} />
                    </div>
                    {h.note && <p className="mt-1 text-sm text-muted-foreground">{h.note}</p>}
                    {h.image_urls && h.image_urls.length > 0 && (
                      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {h.image_urls.map((src, idx) => (
                          <a
                            key={idx}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-square overflow-hidden rounded-md border border-border"
                          >
                            <img src={src} alt={`Evidencia ${idx + 1}`} className="h-full w-full object-cover transition hover:opacity-80" />
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("es-ES")}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Powered by F7 Manager Pro 🔧
        </p>
      </main>
    </div>
  );
}
