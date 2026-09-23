import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatPYG, isCashLabel } from "@/lib/orders";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Wallet, CheckCircle2, AlertTriangle, Loader2, History, RotateCcw, DoorOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PaymentRow { amount: number; payment_method: string | null }
interface AmountEvent extends PaymentRow { source: "orden" | "venta" }
interface ClosingRow {
  id: string;
  closing_date: string;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  breakdown: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}
interface OpeningRow {
  id: string;
  opening_date: string;
  opening_cash: number;
  notes: string | null;
  created_at: string;
}

function groupByMethod(rows: PaymentRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.payment_method?.trim() || "Sin especificar";
    map.set(key, (map.get(key) ?? 0) + r.amount);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function ymd(d: Date) { return format(d, "yyyy-MM-dd"); }

export default function CashClosing() {
  // Todos los hooks van primero, sin condicionar — el early return de plan
  // va después de que todos los hooks ya se ejecutaron (Rules of Hooks).
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { isStarter, loading: planLoading } = usePlan();
  const { canCloseCaja, loading: permLoading } = useStaffPermissions();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cierre (solo admin)
  const [breakdownRows, setBreakdownRows] = useState<AmountEvent[]>([]);
  const [expenseRows, setExpenseRows] = useState<PaymentRow[]>([]);
  const [existingClosing, setExistingClosing] = useState<ClosingRow | null>(null);
  const [closingHistory, setClosingHistory] = useState<ClosingRow[]>([]);
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [redoing, setRedoing] = useState(false);

  // Apertura (cualquier miembro del equipo)
  const [existingOpening, setExistingOpening] = useState<OpeningRow | null>(null);
  const [openingHistory, setOpeningHistory] = useState<OpeningRow[]>([]);
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [savingOpening, setSavingOpening] = useState(false);
  const [redoingOpening, setRedoingOpening] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!companyId || permLoading) return;
      setLoading(true);
      const from = startOfDay(selectedDate).toISOString();
      const to = endOfDay(selectedDate).toISOString();
      const dateKey = ymd(selectedDate);

      const openingQueries = [
        (supabase as any)
          .from("cash_openings")
          .select("id, opening_date, opening_cash, notes, created_at")
          .eq("company_id", companyId)
          .eq("opening_date", dateKey)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("cash_openings")
          .select("id, opening_date, opening_cash, notes, created_at")
          .eq("company_id", companyId)
          .order("opening_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(30),
      ];
      // El resto (ingresos, gastos, cierres) es información de la pestaña
      // Cierre — no tiene sentido pedirla para alguien que ni la ve, y RLS
      // la bloquearía igual si no tiene el permiso habilitado.
      const adminQueries = canCloseCaja
        ? [
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
              .from("expense_payments")
              .select("amount, payment_method")
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
          ]
        : [];

      const [openingRes, openingHistRes, ...adminRes] = await Promise.all([...openingQueries, ...adminQueries]);

      setExistingOpening((openingRes.data as OpeningRow) ?? null);
      setOpeningHistory((openingHistRes.data ?? []) as OpeningRow[]);
      setRedoingOpening(false);
      setOpeningCashInput("");
      setOpeningNotes("");

      if (canCloseCaja) {
        const [{ data: pay }, { data: sal }, { data: exp }, { data: closing }, { data: hist }] = adminRes;
        const rows: AmountEvent[] = [
          ...((pay ?? []) as { amount: number; payment_method: string | null }[]).map((p) => ({
            amount: Number(p.amount || 0),
            payment_method: p.payment_method,
            source: "orden" as const,
          })),
          ...((sal ?? []) as { quantity: number; unit_price: number; payment_method: string | null }[]).map((s) => ({
            amount: s.quantity * Number(s.unit_price || 0),
            payment_method: s.payment_method,
            source: "venta" as const,
          })),
        ];
        setBreakdownRows(rows);
        setExpenseRows(((exp ?? []) as { amount: number; payment_method: string | null }[]).map((e) => ({
          amount: Number(e.amount || 0),
          payment_method: e.payment_method,
        })));
        setExistingClosing((closing as ClosingRow) ?? null);
        setClosingHistory((hist ?? []) as ClosingRow[]);
        setRedoing(false);
        setCountedCash("");
        setNotes("");
      }
      setLoading(false);
    };
    load();
  }, [companyId, selectedDate, canCloseCaja, permLoading]);

  const breakdown = useMemo(() => groupByMethod(breakdownRows), [breakdownRows]);
  const breakdownByOrdenes = useMemo(
    () => groupByMethod(breakdownRows.filter((r) => r.source === "orden")),
    [breakdownRows]
  );
  const breakdownByVentas = useMemo(
    () => groupByMethod(breakdownRows.filter((r) => r.source === "venta")),
    [breakdownRows]
  );
  const breakdownByGastos = useMemo(() => groupByMethod(expenseRows), [expenseRows]);

  const cashIncome = useMemo(
    () => breakdown.reduce((s, [method, amount]) => s + (isCashLabel(method) ? amount : 0), 0),
    [breakdown]
  );
  const cashExpenses = useMemo(
    () => breakdownByGastos.reduce((s, [method, amount]) => s + (isCashLabel(method) ? amount : 0), 0),
    [breakdownByGastos]
  );
  const totalIncome = useMemo(() => breakdown.reduce((s, [, amount]) => s + amount, 0), [breakdown]);
  const totalExpenses = useMemo(() => breakdownByGastos.reduce((s, [, amount]) => s + amount, 0), [breakdownByGastos]);
  const openingCashForDate = existingOpening?.opening_cash ?? 0;
  const expectedCash = openingCashForDate + cashIncome - cashExpenses;

  const counted = Math.round(Number(countedCash) || 0);
  const difference = counted - expectedCash;

  const openCashRegister = async () => {
    if (!user || !companyId) return;
    if (!openingCashInput.trim()) {
      toast({ title: "Ingresá el efectivo de apertura", variant: "destructive" });
      return;
    }
    setSavingOpening(true);
    const openingCash = Math.round(Number(openingCashInput) || 0);
    const { error } = await (supabase as any).from("cash_openings").insert({
      company_id: companyId,
      opening_date: ymd(selectedDate),
      opening_cash: openingCash,
      notes: openingNotes.trim() || null,
      opened_by: user.id,
    });
    setSavingOpening(false);
    if (error) {
      toast({ title: "Error al abrir caja", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Caja abierta", description: `Efectivo inicial: ${formatPYG(openingCash)}.` });
    setOpeningCashInput(""); setOpeningNotes(""); setRedoingOpening(false);
    const fresh: OpeningRow = {
      id: "temp", opening_date: ymd(selectedDate), opening_cash: openingCash,
      notes: openingNotes.trim() || null, created_at: new Date().toISOString(),
    };
    setExistingOpening(fresh);
    setOpeningHistory((prev) => [fresh, ...prev]);
  };

  const closeCashRegister = async () => {
    if (!user || !companyId) return;
    if (!countedCash.trim()) {
      toast({ title: "Ingresá el efectivo contado", variant: "destructive" });
      return;
    }
    setSaving(true);
    const breakdownObj = {
      ordenes: Object.fromEntries(breakdownByOrdenes),
      ventas: Object.fromEntries(breakdownByVentas),
      gastos: Object.fromEntries(breakdownByGastos),
      apertura: openingCashForDate,
    };
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
    setClosingHistory((prev) => [
      { id: "temp", closing_date: ymd(selectedDate), expected_cash: expectedCash, counted_cash: counted, difference, breakdown: breakdownObj, notes: notes.trim() || null, created_at: new Date().toISOString() },
      ...prev,
    ]);
  };

  if (!planLoading && isStarter) return <Navigate to="/dashboard" replace />;

  const showClosingForm = !existingClosing || redoing;
  const showOpeningForm = !existingOpening || redoingOpening;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Wallet className="h-6 w-6 text-primary" />
            Caja
          </h1>
          <p className="text-sm text-muted-foreground">
            Apertura del día y, para administradores, el cierre y la reconciliación de efectivo.
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
        <Tabs defaultValue="apertura">
          <TabsList>
            <TabsTrigger value="apertura" className="gap-2"><DoorOpen className="h-4 w-4" /> Apertura</TabsTrigger>
            {!permLoading && canCloseCaja && (
              <TabsTrigger value="cierre" className="gap-2"><Wallet className="h-4 w-4" /> Cierre</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="apertura" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {showOpeningForm ? (
                <Card>
                  <CardContent className="space-y-4 p-5">
                    <div className="text-sm font-semibold text-foreground">Efectivo con el que abrís hoy</div>
                    <div className="space-y-2">
                      <Label htmlFor="opening-cash">Efectivo de apertura (Gs.)</Label>
                      <Input
                        id="opening-cash"
                        type="number"
                        min={0}
                        step="1"
                        value={openingCashInput}
                        onChange={(e) => setOpeningCashInput(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="opening-notes">Notas (opcional)</Label>
                      <Textarea id="opening-notes" rows={2} value={openingNotes} onChange={(e) => setOpeningNotes(e.target.value)} placeholder="Ej: fondo fijo de siempre" />
                    </div>
                    <div className="flex gap-2">
                      {redoingOpening && (
                        <Button type="button" variant="outline" onClick={() => setRedoingOpening(false)}>Cancelar</Button>
                      )}
                      <Button type="button" onClick={openCashRegister} disabled={savingOpening} className="flex-1 gap-2">
                        {savingOpening && <Loader2 className="h-4 w-4 animate-spin" />}
                        Abrir caja
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                existingOpening && (
                  <Card className="border-primary/40">
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary" /> Caja abierta este día
                      </div>
                      <div className="text-2xl font-bold text-foreground">{formatPYG(existingOpening.opening_cash)}</div>
                      {existingOpening.notes && (
                        <p className="text-sm text-muted-foreground">"{existingOpening.notes}"</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Abierta el {format(new Date(existingOpening.created_at), "d 'de' MMMM, HH:mm", { locale: es })}
                      </p>
                      <Button type="button" variant="outline" size="sm" onClick={() => setRedoingOpening(true)} className="gap-2">
                        <RotateCcw className="h-3.5 w-3.5" /> Volver a abrir este día
                      </Button>
                    </CardContent>
                  </Card>
                )
              )}
            </div>

            {openingHistory.length > 0 && (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <History className="h-4 w-4 text-primary" /> Historial de aperturas
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground">
                          <th className="pb-1 text-left font-normal">Fecha</th>
                          <th className="pb-1 text-right font-normal">Efectivo de apertura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openingHistory.map((h) => (
                          <tr key={h.id} className="border-t border-border/50">
                            <td className="py-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedDate(new Date(h.opening_date + "T00:00:00"))}
                                className="text-foreground hover:underline"
                              >
                                {format(new Date(h.opening_date + "T00:00:00"), "d MMM yyyy", { locale: es })}
                              </button>
                            </td>
                            <td className="py-1.5 text-right text-muted-foreground">{formatPYG(h.opening_cash)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {!permLoading && canCloseCaja && (
            <TabsContent value="cierre" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="space-y-3 p-5">
                    <div className="text-sm font-semibold text-foreground">Ingresos del día por medio de pago</div>
                    {breakdown.length === 0 && breakdownByGastos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hubo movimientos ese día.</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reparaciones (órdenes)</div>
                          {breakdownByOrdenes.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin pagos de órdenes ese día.</p>
                          ) : (
                            <>
                              {breakdownByOrdenes.map(([label, amount]) => (
                                <div key={label} className="flex items-center justify-between text-sm">
                                  <span className={cn("text-muted-foreground", isCashLabel(label) && "font-medium text-foreground")}>
                                    {label}{isCashLabel(label) ? " (a contar)" : ""}
                                  </span>
                                  <span className={cn(isCashLabel(label) && "font-semibold text-foreground")}>{formatPYG(amount)}</span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                                <span>Subtotal reparaciones</span>
                                <span>{formatPYG(breakdownByOrdenes.reduce((s, [, a]) => s + a, 0))}</span>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="space-y-1.5 border-t border-border/60 pt-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ventas de productos</div>
                          {breakdownByVentas.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin ventas de productos ese día.</p>
                          ) : (
                            <>
                              {breakdownByVentas.map(([label, amount]) => (
                                <div key={label} className="flex items-center justify-between text-sm">
                                  <span className={cn("text-muted-foreground", isCashLabel(label) && "font-medium text-foreground")}>
                                    {label}{isCashLabel(label) ? " (a contar)" : ""}
                                  </span>
                                  <span className={cn(isCashLabel(label) && "font-semibold text-foreground")}>{formatPYG(amount)}</span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                                <span>Subtotal ventas</span>
                                <span>{formatPYG(breakdownByVentas.reduce((s, [, a]) => s + a, 0))}</span>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="space-y-1.5 border-t border-border/60 pt-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gastos</div>
                          {breakdownByGastos.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin gastos ese día.</p>
                          ) : (
                            <>
                              {breakdownByGastos.map(([label, amount]) => (
                                <div key={label} className="flex items-center justify-between text-sm">
                                  <span className={cn("text-muted-foreground", isCashLabel(label) && "font-medium text-foreground")}>
                                    {label}{isCashLabel(label) ? " (a contar)" : ""}
                                  </span>
                                  <span className={cn("text-destructive", isCashLabel(label) && "font-semibold")}>-{formatPYG(amount)}</span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                                <span>Subtotal gastos</span>
                                <span className="text-destructive">-{formatPYG(totalExpenses)}</span>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                          <span>Total (ingresos - gastos)</span>
                          <span>{formatPYG(totalIncome - totalExpenses)}</span>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Solo el efectivo necesita contarse a mano — transferencia y tarjeta ya quedan verificadas por el banco/procesador.
                    </p>
                  </CardContent>
                </Card>

                {showClosingForm ? (
                  <Card>
                    <CardContent className="space-y-4 p-5">
                      <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-3 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Apertura</span>
                          <span>{formatPYG(openingCashForDate)}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>+ Ingresos en efectivo</span>
                          <span>{formatPYG(cashIncome)}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>- Gastos en efectivo</span>
                          <span>{formatPYG(cashExpenses)}</span>
                        </div>
                      </div>
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

              {closingHistory.length > 0 && (
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
                          {closingHistory.map((h) => (
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
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
