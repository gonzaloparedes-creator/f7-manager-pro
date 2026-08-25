import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { PROBLEM_OPTIONS, formatPYG } from "@/lib/orders";
import WarrantySelector from "@/components/WarrantySelector";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccessoryPresets } from "@/hooks/useAccessoryPresets";
import { useChecklistPresets } from "@/hooks/useChecklistPresets";

interface CargoAdicional { motivo: string; monto: number }

interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string | null;
  onUpdated?: () => void;
}

type FormState = {
  customer_name: string;
  customer_phone: string;
  device_type: string;
  imei: string;
  problems: string[];
  problem_other: string;
  problem_description: string;
  quote_amount: string;
  deposit_amount: string;
  estimated_delivery_date: Date | undefined;
  accessories: string[];
  checklist: Record<string, "ok" | "fail">;
  warranty_days: number;
};

const EMPTY: FormState = {
  customer_name: "",
  customer_phone: "",
  device_type: "",
  imei: "",
  problems: [],
  problem_other: "",
  problem_description: "",
  quote_amount: "",
  deposit_amount: "",
  estimated_delivery_date: undefined,
  accessories: [],
  checklist: {},
  warranty_days: 30,
};

const parseAmount = (s: string) => {
  const digits = s.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
};
const formatThousands = (s: string) => {
  const n = parseAmount(s);
  return n ? n.toLocaleString("es-PY") : "";
};

export default function EditOrderDialog({ open, onOpenChange, orderId, onUpdated }: EditOrderDialogProps) {
  const { toast } = useToast();
  const { presets: accessoryPresets } = useAccessoryPresets();
  const { presets: checklistPresets } = useChecklistPresets();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [cargos, setCargos] = useState<CargoAdicional[]>([]);

  useEffect(() => {
    if (!open || !orderId) return;
    setFetching(true);
    supabase
      .from("orders")
      .select("customer_name, customer_phone, device_type, imei, problems, problem_other, problem_description, quote_amount, deposit_amount, estimated_delivery_date, accessories, checklist, cargos_adicionales, warranty_days")
      .eq("id", orderId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          toast({ title: "Error", description: error?.message ?? "No se pudo cargar la orden", variant: "destructive" });
          setFetching(false);
          return;
        }
        const o: any = data;
        const checklistArr = (o.checklist ?? []) as { label: string; status: "ok" | "fail" }[];
        setForm({
          customer_name: o.customer_name ?? "",
          customer_phone: o.customer_phone ?? "",
          device_type: o.device_type ?? "",
          imei: o.imei ?? "",
          problems: o.problems ?? [],
          problem_other: o.problem_other ?? "",
          problem_description: o.problem_description ?? "",
          quote_amount: String(o.quote_amount ?? ""),
          deposit_amount: String(o.deposit_amount ?? ""),
          estimated_delivery_date: o.estimated_delivery_date ? new Date(o.estimated_delivery_date) : undefined,
          accessories: (o.accessories ?? []) as string[],
          checklist: Object.fromEntries(checklistArr.map((c) => [c.label, c.status])),
          warranty_days: typeof o.warranty_days === "number" ? o.warranty_days : 30,
        });
        setCargos((o.cargos_adicionales ?? []) as CargoAdicional[]);
        setFetching(false);
      });
  }, [open, orderId, toast]);

  const quote = useMemo(() => parseAmount(form.quote_amount), [form.quote_amount]);
  const deposit = useMemo(() => parseAmount(form.deposit_amount), [form.deposit_amount]);
  const cargosTotal = useMemo(() => cargos.reduce((s, c) => s + Number(c?.monto ?? 0), 0), [cargos]);
  const total = quote + cargosTotal;
  const balance = Math.max(0, total - deposit);

  const toggleProblem = (p: string) => {
    setForm((f) => ({
      ...f,
      problems: f.problems.includes(p) ? f.problems.filter((x) => x !== p) : [...f.problems, p],
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return;
    if (form.problems.length === 0) {
      toast({ title: "Faltan datos", description: "Seleccioná al menos un problema.", variant: "destructive" });
      return;
    }
    if (deposit > total) {
      toast({ title: "Importes inválidos", description: "La seña no puede superar al total (presupuesto + cargos).", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("orders")
      .update({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        device_type: form.device_type,
        imei: form.imei || null,
        problems: form.problems,
        problem_other: form.problems.includes("Otro") ? form.problem_other : null,
        problem_description: form.problem_description || "",
        quote_amount: quote,
        deposit_amount: deposit,
        estimated_delivery_date: form.estimated_delivery_date ? format(form.estimated_delivery_date, "yyyy-MM-dd") : null,
        accessories: form.accessories,
        checklist: Object.entries(form.checklist).map(([label, status]) => ({ label, status })),
        warranty_days: form.warranty_days,
      })
      .eq("id", orderId);
    setLoading(false);
    if (error) {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Orden actualizada", description: "Los cambios se guardaron correctamente." });
    onOpenChange(false);
    onUpdated?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar orden</DialogTitle>
          <DialogDescription>Modificá los datos del cliente, equipo o financieros.</DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Cliente */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Datos del cliente</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="e_name">Cliente *</Label>
                  <Input id="e_name" required value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e_phone">Teléfono *</Label>
                  <Input id="e_phone" required value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
                </div>
              </div>
            </section>

            {/* Equipo */}
            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground">Equipo y problemas</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="e_device">Equipo *</Label>
                  <Input id="e_device" required value={form.device_type}
                    onChange={(e) => setForm({ ...form, device_type: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e_imei">IMEI / Nº de Serie</Label>
                  <Input id="e_imei" value={form.imei}
                    onChange={(e) => setForm({ ...form, imei: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Problemas detectados *</Label>
                <div className="flex flex-wrap gap-2">
                  {PROBLEM_OPTIONS.map((p) => {
                    const active = form.problems.includes(p);
                    return (
                      <button key={p} type="button" onClick={() => toggleProblem(p)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.problems.includes("Otro") && (
                <div className="space-y-2">
                  <Label htmlFor="e_other">Especificá "Otro" *</Label>
                  <Input id="e_other" value={form.problem_other}
                    onChange={(e) => setForm({ ...form, problem_other: e.target.value })} />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="e_obs">Observaciones</Label>
                <Textarea id="e_obs" rows={3} value={form.problem_description}
                  onChange={(e) => setForm({ ...form, problem_description: e.target.value })} />
              </div>
            </section>

            {/* Accesorios */}
            {accessoryPresets.length > 0 && (
              <section className="space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">Accesorios y Componentes</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {accessoryPresets.map((acc) => {
                    const checked = form.accessories.includes(acc.label);
                    return (
                      <div key={acc.id} className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2">
                        <Label htmlFor={`e_acc_${acc.id}`} className="text-sm font-normal cursor-pointer">{acc.label}</Label>
                        <Switch
                          id={`e_acc_${acc.id}`}
                          checked={checked}
                          onCheckedChange={(c) => setForm({
                            ...form,
                            accessories: c ? [...form.accessories, acc.label] : form.accessories.filter((x) => x !== acc.label),
                          })}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Checklist de recepción */}
            {checklistPresets.length > 0 && (
              <section className="space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">Checklist de Recepción</h3>
                <div className="space-y-2">
                  {checklistPresets.map((c) => {
                    const status = form.checklist[c.label];
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2">
                        <span className="text-sm">{c.label}</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, checklist: { ...form.checklist, [c.label]: "ok" } })}
                            className={cn(
                              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                              status === "ok"
                                ? "border-transparent bg-[hsl(var(--status-listo-bg))] text-[hsl(var(--status-listo))]"
                                : "border-input text-muted-foreground hover:text-foreground"
                            )}
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, checklist: { ...form.checklist, [c.label]: "fail" } })}
                            className={cn(
                              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                              status === "fail"
                                ? "border-transparent bg-destructive/10 text-destructive"
                                : "border-input text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Falla
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Financiero */}
            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground">Información financiera</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="e_quote">Presupuesto (Gs.)</Label>
                  <Input id="e_quote" inputMode="numeric" placeholder="0"
                    value={formatThousands(form.quote_amount)}
                    onChange={(e) => setForm({ ...form, quote_amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e_deposit">Seña / Pagado (Gs.)</Label>
                  <Input id="e_deposit" inputMode="numeric" placeholder="0"
                    value={formatThousands(form.deposit_amount)}
                    onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Saldo</Label>
                  <div className={cn(
                    "flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold",
                    balance > 0 ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {formatPYG(balance)}
                  </div>
                </div>
              </div>
              {cargosTotal > 0 && (
                <p className="text-xs text-muted-foreground">
                  Cargos adicionales: <span className="font-semibold text-foreground">{formatPYG(cargosTotal)}</span> · Total: <span className="font-semibold text-foreground">{formatPYG(total)}</span>
                </p>
              )}

              <div className="space-y-2">
                <Label>Fecha estimada de entrega</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline"
                      className={cn("w-full justify-start text-left font-normal sm:w-[280px]",
                        !form.estimated_delivery_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.estimated_delivery_date
                        ? format(form.estimated_delivery_date, "PPP", { locale: es })
                        : <span>Elegí una fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.estimated_delivery_date}
                      onSelect={(d) => setForm({ ...form, estimated_delivery_date: d })}
                      initialFocus locale={es} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Tiempo de garantía</Label>
                <WarrantySelector
                  value={form.warranty_days}
                  onChange={(d) => setForm({ ...form, warranty_days: d })}
                />
              </div>
            </section>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar cambios"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
