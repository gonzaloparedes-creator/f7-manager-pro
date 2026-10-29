import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fetchAllPages } from "@/lib/fetchAllPages";
import { formatMoney } from "@/lib/currency";
import { revenueByStaffId, type StaffOrderFields, type StaffSaleFields } from "@/lib/staffRevenue";
import { commissionAmount, formatPeriod, type CommissionSettlement } from "@/lib/commissionSettlements";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/** "2026-10-05" como inicio o fin de día local, para comparar con los instantes de cobro. */
function dayBounds(fromKey: string, toKey: string) {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return { from: new Date(fy, fm - 1, fd, 0, 0, 0, 0), to: new Date(ty, tm - 1, td, 23, 59, 59, 999) };
}

// Los tipos generados de Supabase no incluyen todavía commission_settlements.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface SettlePerson {
  id: string;
  name: string;
  rate: number;
}

export function SettleDialog({
  open,
  onOpenChange,
  person,
  periodFrom,
  periodTo,
  includesToday,
  skipsSettled,
  companyId,
  hasTienda,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  person: SettlePerson | null;
  periodFrom: string;
  periodTo: string;
  includesToday: boolean;
  skipsSettled: boolean;
  companyId: string;
  hasTienda: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [base, setBase] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !person) return;
    let active = true;
    setBase(null);
    setLoadError(false);
    setNotes("");
    (async () => {
      try {
        const { from, to } = dayBounds(periodFrom, periodTo);
        const a = from.toISOString();
        const b = to.toISOString();
        // La base se vuelve a leer del servidor para esta persona y este período (en vez
        // de reusar lo que muestra Reportes), así el monto a pagar nunca depende del
        // tope de 1000 filas de esa pantalla.
        const orders = await fetchAllPages<StaffOrderFields>((x, y) =>
          db
            .from("orders")
            .select("quote_amount, senia_amount, cargos_adicionales, deposit_date, final_payment_date, assigned_technician_id")
            .eq("company_id", companyId)
            .eq("assigned_technician_id", person.id)
            .or(`and(deposit_date.gte.${a},deposit_date.lte.${b}),and(final_payment_date.gte.${a},final_payment_date.lte.${b})`)
            .order("id", { ascending: true })
            .range(x, y),
        );
        const sales = hasTienda
          ? await fetchAllPages<StaffSaleFields>((x, y) =>
              db
                .from("product_sales")
                .select("quantity, unit_price, created_at, created_by")
                .eq("company_id", companyId)
                .eq("created_by", person.id)
                .gte("created_at", a)
                .lte("created_at", b)
                .order("id", { ascending: true })
                .range(x, y),
            )
          : [];
        const total = revenueByStaffId(orders, sales, from, to).get(person.id) ?? 0;
        if (active) setBase(Math.round(total * 100) / 100);
      } catch {
        if (active) setLoadError(true);
      }
    })();
    return () => { active = false; };
  }, [open, person, periodFrom, periodTo, companyId, hasTienda]);

  const amount = base != null && person ? commissionAmount(base, person.rate) : 0;

  const save = async () => {
    if (!person || base == null || amount <= 0) return;
    setSaving(true);
    const { error } = await db.from("commission_settlements").insert({
      company_id: companyId,
      user_id: person.id,
      user_name: person.name,
      period_from: periodFrom,
      period_to: periodTo,
      base_amount: base,
      rate: person.rate,
      amount,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "No se pudo registrar la liquidación", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Liquidación registrada", description: `${person.name}: ${formatMoney(amount)} (${formatPeriod(periodFrom, periodTo)})` });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-md" data-testid="settle-dialog">
        <DialogHeader>
          <DialogTitle>Liquidar comisión</DialogTitle>
          <DialogDescription>
            {person?.name} · {formatPeriod(periodFrom, periodTo)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Lo atribuido en el período</span>
              <span data-testid="settle-base" className="font-medium">
                {base == null ? (loadError ? "—" : <Loader2 className="h-4 w-4 animate-spin" />) : formatMoney(base)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Comisión</span>
              <span className="font-medium">{person?.rate}%</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
              <span className="font-semibold">A pagar</span>
              <span data-testid="settle-amount" className="text-lg font-bold text-primary">
                {base == null ? "—" : formatMoney(amount)}
              </span>
            </div>
          </div>

          {loadError && (
            <p className="text-sm text-destructive">No se pudo calcular lo atribuido. Cerrá y volvé a intentar.</p>
          )}
          {base != null && amount <= 0 && (
            <p className="text-sm text-muted-foreground">No hay nada para liquidar en este período.</p>
          )}

          <div className="space-y-1">
            <Label htmlFor="settle-notes">Nota (opcional)</Label>
            <Textarea
              id="settle-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="Ej: pagado en efectivo el viernes"
              rows={2}
            />
          </div>

          <ul className="space-y-1 text-xs text-muted-foreground">
            {includesToday && <li>Se liquida hasta ayer: lo de hoy queda para la próxima.</li>}
            {skipsSettled && <li>Se saltearon los días que ya estaban liquidados.</li>}
            <li>Esto deja constancia del pago de la comisión. No mueve la caja ni crea un gasto.</li>
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || base == null || amount <= 0} data-testid="settle-confirm">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar liquidación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SettlementHistoryDialog({
  open,
  onOpenChange,
  settlements,
  companyId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settlements: CommissionSettlement[];
  companyId: string;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [toVoid, setToVoid] = useState<CommissionSettlement | null>(null);
  const [voiding, setVoiding] = useState(false);

  const sorted = useMemo(
    () => [...settlements].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0)),
    [settlements],
  );

  const confirmVoid = async () => {
    if (!toVoid) return;
    setVoiding(true);
    const { data, error } = await db
      .from("commission_settlements")
      .update({ voided_at: new Date().toISOString() })
      .eq("id", toVoid.id)
      .eq("company_id", companyId)
      .select("id");
    setVoiding(false);
    if (error || !data?.length) {
      toast({ title: "No se pudo anular", description: error?.message ?? "No tenés permiso para anular esta liquidación.", variant: "destructive" });
      return;
    }
    toast({ title: "Liquidación anulada", description: "Esos días vuelven a quedar sin liquidar." });
    setToVoid(null);
    onChanged();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg" data-testid="settlement-history">
          <DialogHeader>
            <DialogTitle>Liquidaciones de comisiones</DialogTitle>
            <DialogDescription>Lo que ya se le liquidó a cada persona, de la más reciente a la más antigua.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {sorted.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay liquidaciones.</p>}
            {sorted.map((s) => (
              <div
                key={s.id}
                data-testid="settlement-row"
                className={`rounded-lg border border-border p-3 text-sm ${s.voided_at ? "opacity-60" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">{s.user_name}</div>
                    <div className="text-xs text-muted-foreground">{formatPeriod(s.period_from, s.period_to)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${s.voided_at ? "line-through" : "text-primary"}`}>{formatMoney(s.amount)}</div>
                    <div className="text-xs text-muted-foreground">{formatMoney(s.base_amount)} × {s.rate}%</div>
                  </div>
                </div>
                {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Registrada el {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                  </span>
                  {s.voided_at ? (
                    <Badge variant="outline" className="text-muted-foreground">Anulada</Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setToVoid(s)} data-testid="void-settlement">
                      Anular
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toVoid}
        onOpenChange={(o) => { if (!o) setToVoid(null); }}
        title="¿Anular esta liquidación?"
        description={
          toVoid
            ? `Los días ${formatPeriod(toVoid.period_from, toVoid.period_to)} de ${toVoid.user_name} vuelven a quedar sin liquidar. La liquidación queda en el historial como anulada.`
            : ""
        }
        confirmLabel="Anular"
        confirmingLabel="Anulando..."
        loading={voiding}
        onConfirm={confirmVoid}
      />
    </>
  );
}
