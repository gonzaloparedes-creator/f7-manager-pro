import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { Wrench, CheckCircle2, Clock, Stethoscope, PackageCheck, Truck, CalendarDays, Smartphone, Wallet, XCircle, MessageSquareText, Loader2, Hash } from "lucide-react";
import { STATUS_LABELS, formatPYG, QUOTE_RESPONSE_LABELS, quoteResponseBadgeClasses, type OrderStatus, type QuoteResponse } from "@/lib/orders";
import f7Logo from "@/assets/f7-logo.png";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CargoAdicional { motivo: string; monto: number; }
interface PublicOrder {
  id: string;
  order_number: string;
  device_type: string;
  status: string;
  status_label?: string | null;
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
  accessories?: string[] | null;
  checklist?: { label: string; status: "ok" | "fail" }[] | null;
  quote_response?: QuoteResponse | null;
  quote_response_note?: string | null;
  quote_responded_at?: string | null;
  company_name?: string | null;
  company_logo_url?: string | null;
  marca?: string | null;
  modelo?: string | null;
  imei?: string | null;
}
interface PublicHistory { id: string; status: string; status_label?: string | null; note: string | null; created_at: string; image_urls?: string[] | null; }
interface PublicTechNote { id: string; note: string; created_at: string; }

const ICONS: Record<string, any> = {
  recibido: Clock,
  en_diagnostico: Stethoscope,
  en_reparacion: Wrench,
  listo: PackageCheck,
  enviado: Truck,
  entregado: CheckCircle2,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PublicTrackingByCode() {
  const { orderCode } = useParams();
  const isToken = !!orderCode && UUID_RE.test(orderCode);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [history, setHistory] = useState<PublicHistory[]>([]);
  const [techNotes, setTechNotes] = useState<PublicTechNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Responder un Presupuesto (aceptar/rechazar/pedir cambios) solo se
  // habilita con tracking_token (isToken) — nunca con el código corto
  // ORD-XXXX, que es adivinable/enumerable. Ver respond-to-quote (Edge Fn).
  const [responding, setResponding] = useState<QuoteResponse | null>(null);
  const [showChangesInput, setShowChangesInput] = useState(false);
  const [changesNote, setChangesNote] = useState("");
  const [respondError, setRespondError] = useState<string | null>(null);

  const submitQuoteResponse = async (response: QuoteResponse, note?: string) => {
    if (!orderCode || responding) return;
    setResponding(response);
    setRespondError(null);
    try {
      const { error } = await supabase.functions.invoke("respond-to-quote", {
        body: { tracking_token: orderCode, response, note: note || undefined },
      });
      if (error) throw error;
      setOrder((prev) =>
        prev
          ? { ...prev, quote_response: response, quote_response_note: note || null, quote_responded_at: new Date().toISOString() }
          : prev
      );
      setShowChangesInput(false);
    } catch {
      setRespondError("No pudimos registrar tu respuesta. Probá de nuevo en un momento.");
    } finally {
      setResponding(null);
    }
  };

  useEffect(() => {
    document.title = "Seguimiento de reparación | F7 Manager Pro";

    (async () => {
      if (!orderCode) {
        setLoading(false);
        return;
      }
      // Los links nuevos (QR/recibos generados hoy en adelante) usan el
      // tracking_token (uuid, no adivinable). Los links con el código
      // correlativo ORD-XXXX (ya impresos/entregados antes de este cambio)
      // se siguen resolviendo, pero sin exponer la bitácora técnica interna.
      const isToken = UUID_RE.test(orderCode);
      const [{ data: o }, { data: h }, { data: tn }] = isToken
        ? await Promise.all([
            supabase.rpc("get_order_by_tracking", { _token: orderCode }),
            supabase.rpc("get_order_history_by_tracking", { _token: orderCode }),
            supabase.rpc("get_technical_notes_by_tracking", { _token: orderCode }),
          ])
        : await Promise.all([
            supabase.rpc("get_order_by_code", { _code: orderCode }),
            supabase.rpc("get_history_by_code", { _code: orderCode }),
            Promise.resolve({ data: [] as PublicTechNote[] }),
          ]);
      const found: any = Array.isArray(o) ? o[0] : null;
      if (found?.company_name) document.title = `Seguimiento ${found.order_number} | ${found.company_name}`;
      setOrder(found ? { ...found, cargos_adicionales: Array.isArray(found.cargos_adicionales) ? found.cargos_adicionales : [] } : null);
      setHistory((h ?? []) as PublicHistory[]);
      setTechNotes((tn ?? []) as PublicTechNote[]);
      setLoading(false);
    })();
  }, [orderCode]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="sr-only">Cargando...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent/10 p-4">
        <Card className="max-w-md text-center">
          <CardContent className="space-y-3 p-8">
            <h1 className="text-xl font-bold">Orden no encontrada</h1>
            <p className="text-sm text-muted-foreground">
              No encontramos ninguna orden con el código <span className="font-mono">{orderCode}</span>.
            </p>
            <Link to="/" className="inline-block text-sm font-medium text-primary hover:underline">
              Volver al inicio
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Icon = ICONS[order.status] ?? Wrench;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
            <img src={order.company_logo_url || f7Logo} alt={order.company_name || "F7 Manager Pro"} className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="font-bold leading-tight">{order.company_name || "F7 Manager Pro"}</div>
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
            {(order.marca || order.modelo) && (
              <div className="mt-1 text-sm font-medium opacity-90">
                {[order.marca, order.modelo].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <CardContent className="space-y-4 p-6">
            {order.imei && (
              <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                <Hash className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">IMEI / Nº de serie</div>
                  <div className="font-mono font-medium">{order.imei}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 rounded-lg bg-accent p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Estado actual</div>
                <div className="font-semibold">
                  {order.status_label ?? STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                </div>
              </div>
              <StatusBadge status={order.status} label={order.status_label ?? undefined} />
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
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalles a la vista</div>
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

            {order.accessories && order.accessories.length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accesorios entregados</div>
                <div className="flex flex-wrap gap-1.5">
                  {order.accessories.map((a) => (
                    <span key={a} className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium border border-primary/20">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {order.checklist && order.checklist.length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Checklist de recepción</div>
                <div className="flex flex-wrap gap-1.5">
                  {order.checklist.map((c) => (
                    <span
                      key={c.label}
                      className={
                        c.status === "ok"
                          ? "rounded-full bg-[hsl(var(--status-listo-bg))] text-[hsl(var(--status-listo))] px-3 py-1 text-xs font-medium"
                          : "rounded-full bg-destructive/10 text-destructive px-3 py-1 text-xs font-medium"
                      }
                    >
                      {c.status === "ok" ? "✓" : "✗"} {c.label}
                    </span>
                  ))}
                </div>
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

        {isToken && order.status === "presupuesto" && (
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-semibold">¿Qué querés hacer con este presupuesto?</h2>

              {order.quote_response ? (
                <div className="space-y-1.5">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${quoteResponseBadgeClasses(order.quote_response)}`}>
                    {QUOTE_RESPONSE_LABELS[order.quote_response]}
                  </span>
                  {order.quote_response_note && (
                    <p className="text-sm text-muted-foreground">"{order.quote_response_note}"</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Si necesitás cambiar tu respuesta, contactanos directamente.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => submitQuoteResponse("aceptado")}
                      disabled={!!responding}
                      className="gap-2"
                    >
                      {responding === "aceptado" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Aceptar presupuesto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowChangesInput((s) => !s)}
                      disabled={!!responding}
                      className="gap-2"
                    >
                      <MessageSquareText className="h-4 w-4" />
                      Pedir cambios
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (window.confirm("¿Seguro que querés rechazar este presupuesto? Se le va a avisar al taller.")) {
                          submitQuoteResponse("rechazado");
                        }
                      }}
                      disabled={!!responding}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      {responding === "rechazado" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Rechazar
                    </Button>
                  </div>

                  {showChangesInput && (
                    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                      <Textarea
                        placeholder="Contanos qué te gustaría cambiar (opcional)…"
                        rows={3}
                        value={changesNote}
                        onChange={(e) => setChangesNote(e.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => submitQuoteResponse("cambios_solicitados", changesNote)}
                        disabled={!!responding}
                        className="gap-2"
                      >
                        {responding === "cambios_solicitados" && <Loader2 className="h-4 w-4 animate-spin" />}
                        Enviar
                      </Button>
                    </div>
                  )}

                  {respondError && <p className="text-sm text-destructive">{respondError}</p>}
                </>
              )}
            </CardContent>
          </Card>
        )}

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
                        {h.status_label ?? STATUS_LABELS[h.status as OrderStatus] ?? h.status}
                      </span>
                      <StatusBadge status={h.status} label={h.status_label ?? undefined} />
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
