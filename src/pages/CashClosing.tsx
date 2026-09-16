import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatPYG } from "@/lib/orders";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Wallet, CheckCircle2, AlertTriangle, Loader2, ShieldAlert, History, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AmountEvent { amount: number; payment_method: string | null }
interface ClosingRow {
  id: string;
  closing_date: string;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  breakdown: Record<string, number>;
  notes: string | null;
  created_at: string;
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function ymd(d: Date) { return format(d, "yyyy-MM-dd"); }
function isCashLabel(method: string | null) { return (method || "").trim().toLowerCase() === "efectivo"; }

export default function CashClosing() {
  // Todos los hooks van primero, sin condicionar — el early return de plan
  // va después de que todos los hooks ya se ejecutaron (Rules of Hooks).
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { isStarter, loading: planLoading } = usePlan();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [breakdownRows, setBreakdownRows] = useState<AmountEvent[]>([]);
  const [existingClosing, setExistingClosing] = useState<ClosingRow | null>(null);
  const [history, setHistory] = useState<ClosingRow[]>([]);
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [redoing, setRedoing] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!companyId) return;
      setLoading(true);
      const from = startOfDay(selectedDate).toISOString();
      const to = endOfDay(selectedDate).toISOString();
      const dateKey = ymd(selectedDate);
      const [{ data: pay }, { data: sal }, { data: closing }, { data: hist }] = await Promise.all([
        (supabase as any)
          .from("order_payments")
          .select("amount, payment_method")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to),
        (supabase as any)
          .from("product_sales")
          .select("quantity, unit_price, payment_method")
          .eq("company_id", companyId)
          .gte("created_at", from)
          .lte("created_at", to),
        (supabase as any)
          .from("cash_closings")
          .select("id, closing_date, expected_cash, counted_cash, difference, breakdown, notes, created_at")
          .eq("company_id", companyId)
          .eq("closing_date", dateKey)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("cash_closings")
          .select("id, closing_date, expected_cash, counted_cash, difference, breakdown, notes, created_at")
          .eq("company_id", companyId)
          .order("closing_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      const rows: AmountEvent[] = [
        ...((pay ?? []) as { amount: number; payment_method: string | null }[]),
        ...((sal ?? []) as { quantity: number; unit_price: number; payment_method: string | null }[]).map((s) => ({
          amount: s.quantity * Number(s.unit_price || 0),
          payment_method: s.payment_method,
        })),
      ];
      setBreakdownRows(rows);
      setExistingClosing((closing as ClosingRow) ?? null);
      setHistory((hist ?? []) as ClosingRow[]);
      setRedoing(false);
      setCountedCash("");
      setNotes("");
      setLoading(false);
    };
    load();
  }, [companyId, selectedDate]);

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of breakdownRows) {
      const key = r.payment_method?.trim() || "Sin especificar";
      map.set(key, (map.get(key) ?? 0) + r.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [breakdownRows]);

  const expectedCash = useMemo(
    () => breakdown.reduce((s, [method, amount]) => s + (isCashLabel(method) ? amount : 0), 0),
    [breakdown]
  );
  const totalAllMethods = useMemo(() => breakdown.reduce((s, [, amount]) => s + amount, 0), [breakdown]);

  const counted = Math.round(Number(countedCash) || 0);
  const difference = counted - expectedCash;

  const closeCashRegister = async () => {
    if (!user || !companyId) return;
    if (!countedCash.trim()) {
      toast({ title: "Ingresá el efectivo contado", variant: "destructive" });
      return;
    }
    setSaving(true);
    const breakdownObj: Record<string, number> = {};
    breakdown.forEach(([k, v]) => { breakdownObj[k] = v; });
    const { error } = await (supabase as any).from("cash_closings").insert({
      company_id: companyId,
      closing_date: ymd(selectedDate),
      expected_cash: expectedCash,
      counted_cash: counted,
      difference,
      breakdown: breakdownObj,
      notes: notes.trim() || null,
      closed_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error al cerrar caja", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Caja cerrada",
      description: difference === 0
        ? "El efectivo contado coincide con lo esperado."
        : difference > 0
          ? `Sobrante de ${formatPYG(difference)}.`
          : `Faltante de ${formatPYG(Math.abs(difference))}.`,
    });
    setCountedCash(""); setNotes(""); setRedoing(false);
    // Recarga liviana: sólo lo que cambió (el cierre del día + el historial).
    setExistingClosing({
      id: "temp", closing_date: ymd(selectedDate), expected_cash: expectedCash,
      counted_cash: counted, difference, breakdown: breakdownObj, notes: notes.trim() || null,
      created_at: new Date().toISOString(),
    });
    setHistory((prev) => [
      { id: "temp", closing_date: ymd(selectedDate), expected_cash: expectedCash, counted_cash: counted, difference, breakdown: breakdownObj, notes: notes.trim() || null, created_at: new Date().toISOString() },
      ...prev,
    ]);
  };

  if (!roleLoading && !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="text-lg font-semibold">Acceso Denegado</div>
            <p className="text-sm text-muted-foreground">Solo los administradores pueden hacer el cierre de caja.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!planLoading && isStarter) return <Navigate to="/dashboard" replace />;

  const showForm = !existingClosing || redoing;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Wallet className="h-6 w-6 text-primary" />
            Cierre de Caja
          </h1>
          <p className="text-sm text-muted-foreground">
            Compará el efectivo contado con lo que debería haber entrado ese día.
          </p>
        </div>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { if (d) { setSelectedDate(d); setDateOpen(false); } }}
              disabled={(d) => d > new Date()}
              locale={es}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="text-sm font-semibold text-foreground">Ingresos del día por medio de pago</div>
                {breakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hubo movimientos ese día.</p>
                ) : (
                  <div className="space-y-1.5">
                    {breakdown.map(([label, amount]) => (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span className={cn("text-muted-foreground", isCashLabel(label) && "font-medium text-foreground")}>
                          {label}{isCashLabel(label) ? " (a contar)" : ""}
                        </span>
                        <span className={cn(isCashLabel(label) && "font-semibold text-foreground")}>{formatPYG(amount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-border pt-1.5 text-sm font-semibold">
                      <span>Total</span>
                      <span>{formatPYG(totalAllMethods)}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Solo el efectivo necesita contarse a mano — transferencia y tarjeta ya quedan verificadas por el banco/procesador.
                </p>
              </CardContent>
            </Card>

            {showForm ? (
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground">Efectivo esperado</div>
                    <div className="text-lg font-bold text-foreground">{formatPYG(expectedCash)}</div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="counted-cash">Efectivo contado (Gs.)</Label>
                    <Input
                      id="counted-cash"
                      type="number"
                      min={0}
                      step="1"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  {countedCash.trim() && (
                    <div className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
                      difference === 0 ? "border-primary/40 bg-primary/10 text-primary"
                        : difference > 0 ? "border-secondary/40 bg-secondary/10 text-secondary"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                    )}>
                      {difference === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      {difference === 0
                        ? "Cuadra exacto"
                        : difference > 0
                          ? `Sobrante de ${formatPYG(difference)}`
                          : `Faltante de ${formatPYG(Math.abs(difference))}`}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="closing-notes">Notas (opcional)</Label>
                    <Textarea id="closing-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: faltaron Gs. 5.000, posible vuelto mal dado" />
                  </div>
                  <div className="flex gap-2">
                    {redoing && (
                      <Button type="button" variant="outline" onClick={() => setRedoing(false)}>Cancelar</Button>
                    )}
                    <Button type="button" onClick={closeCashRegister} disabled={saving} className="flex-1 gap-2">
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      Cerrar caja
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              existingClosing && (
                <Card className={cn(
                  "border",
                  existingClosing.difference === 0 ? "border-primary/40" : existingClosing.difference > 0 ? "border-secondary/40" : "border-destructive/40"
                )}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" /> Este día ya fue cerrado
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Esperado</div>
                        <div className="font-semibold">{formatPYG(existingClosing.expected_cash)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Contado</div>
                        <div className="font-semibold">{formatPYG(existingClosing.counted_cash)}</div>
                      </div>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
                      existingClosing.difference === 0 ? "border-primary/40 bg-primary/10 text-primary"
                        : existingClosing.difference > 0 ? "border-secondary/40 bg-secondary/10 text-secondary"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                    )}>
                      {existingClosing.difference === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      {existingClosing.difference === 0
                        ? "Cuadró exacto"
                        : existingClosing.difference > 0
                          ? `Sobrante de ${formatPYG(existingClosing.difference)}`
                          : `Faltante de ${formatPYG(Math.abs(existingClosing.difference))}`}
                    </div>
                    {existingClosing.notes && (
                      <p className="text-sm text-muted-foreground">"{existingClosing.notes}"</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Cerrado el {format(new Date(existingClosing.created_at), "d 'de' MMMM, HH:mm", { locale: es })}
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setRedoing(true)} className="gap-2">
                      <RotateCcw className="h-3.5 w-3.5" /> Volver a cerrar este día
                    </Button>
                  </CardContent>
                </Card>
              )
            )}
          </div>

          {history.length > 0 && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <History className="h-4 w-4 text-primary" /> Historial de cierres
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="pb-1 text-left font-normal">Fecha</th>
                        <th className="pb-1 text-right font-normal">Esperado</th>
                        <th className="pb-1 text-right font-normal">Contado</th>
                        <th className="pb-1 text-right font-normal">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id} className="border-t border-border/50">
                          <td className="py-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedDate(new Date(h.closing_date + "T00:00:00"))}
                              className="text-foreground hover:underline"
                            >
                              {format(new Date(h.closing_date + "T00:00:00"), "d MMM yyyy", { locale: es })}
                            </button>
                          </td>
                          <td className="py-1.5 text-right text-muted-foreground">{formatPYG(h.expected_cash)}</td>
                          <td className="py-1.5 text-right text-muted-foreground">{formatPYG(h.counted_cash)}</td>
                          <td className={cn(
                            "py-1.5 text-right font-medium",
                            h.difference === 0 ? "text-primary" : h.difference > 0 ? "text-secondary" : "text-destructive"
                          )}>
                            {h.difference === 0 ? "—" : (h.difference > 0 ? "+" : "") + formatPYG(h.difference)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
