import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useBranches } from "@/hooks/useBranches";
import { useCategories } from "@/hooks/useCategories";
import { useChecklistPresets } from "@/hooks/useChecklistPresets";
import { useAccessoryPresets } from "@/hooks/useAccessoryPresets";
import { usePaymentMethodPresets } from "@/hooks/usePaymentMethodPresets";
import { useCashRegisterGate } from "@/hooks/useCashRegisterGate";
import CashRegisterRequiredNotice from "@/components/CashRegisterRequiredNotice";
import { toast } from "sonner";
import { Loader2, Printer, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPYG } from "@/lib/orders";
import {
  buildDevicePurchaseParams,
  emptyDevicePurchaseForm,
  imeiWarning,
  parseGs,
  validateDevicePurchase,
  type ChecklistStatus,
  type DevicePurchaseForm,
  type DevicePurchaseKind,
  type DevicePurchaseRecord,
} from "@/lib/devicePurchase";
import { validateTradeInValue, type TradeInDraft } from "@/lib/tradeIn";

function formatThousands(s: string) {
  const n = parseGs(s);
  return n ? n.toLocaleString("es-PY") : "";
}

// Dos usos: "compra" registra el equipo y su comprobante al instante (le pagás
// al cliente). "canje" solo recolecta los datos del equipo que el cliente
// entrega como parte de pago: se guardan junto con la venta, en una sola
// transacción (ver CartSheet / register_sale_with_trade_in).
export default function BuyDeviceDialog({
  open,
  onOpenChange,
  onRegistered,
  onPrint,
  mode = "compra",
  maxValue,
  deposit = 0,
  initialForm,
  onCollect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRegistered?: () => void;
  onPrint?: (record: DevicePurchaseRecord) => void;
  mode?: DevicePurchaseKind;
  /** Canje: tope del valor reconocido (el total de la venta). */
  maxValue?: number;
  /** Canje: seña ya abonada de equipos reservados en la misma venta; se descuenta del tope. */
  deposit?: number;
  initialForm?: DevicePurchaseForm | null;
  onCollect?: (draft: TradeInDraft) => void;
}) {
  const canje = mode === "canje";
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { branches, defaultBranchId, hasMultipleBranches } = useBranches();
  const { categories } = useCategories();
  const { presets: checklistPresets } = useChecklistPresets();
  const { presets: accessoryPresets } = useAccessoryPresets();
  const { presets: paymentMethods } = usePaymentMethodPresets();
  const cashGate = useCashRegisterGate(open && !canje);

  const [form, setForm] = useState<DevicePurchaseForm>(() => emptyDevicePurchaseForm());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<DevicePurchaseRecord | null>(null);

  const effectiveBranchId = form.branch_id ?? defaultBranchId;

  useEffect(() => {
    if (!open) return;
    setForm(initialForm ?? emptyDevicePurchaseForm());
    setDone(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch: Partial<DevicePurchaseForm>) => setForm((f) => ({ ...f, ...patch }));

  const toggleChecklist = (label: string, status: ChecklistStatus) => {
    setForm((f) => {
      const next = { ...f.checklist };
      if (next[label] === status) delete next[label]; else next[label] = status;
      return { ...f, checklist: next };
    });
  };

  const toggleAccessory = (label: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      accessories: checked ? [...f.accessories, label] : f.accessories.filter((x) => x !== label),
    }));
  };

  const purchasePrice = parseGs(form.purchase_price);
  const sellingPrice = parseGs(form.selling_price);
  const imeiMessage = imeiWarning(form.imei);

  const chipClass = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-muted-foreground hover:text-foreground"
    );

  const submit = async () => {
    if (!user || !companyId) return;
    const problem = validateDevicePurchase(form, mode)
      ?? (canje && maxValue !== undefined ? validateTradeInValue(purchasePrice, maxValue, deposit) : null);
    if (problem) { toast.error(problem); return; }
    if (!canje && await cashGate.check()) {
      toast.error("La caja de hoy no está abierta. Abrila desde Caja para registrar la compra.");
      return;
    }

    setSaving(true);
    try {
      const imei = form.imei.trim();
      const { data: sameImei } = await (supabase as any)
        .from("inventory_items")
        .select("name, stock")
        .eq("company_id", companyId)
        .eq("imei", imei)
        .limit(5);
      const inStock = ((sameImei ?? []) as { name: string; stock: number }[]).find((i) => i.stock > 0);
      if (inStock) {
        toast.error(`Ya tenés este IMEI en stock ("${inStock.name}"). Si lo recompraste, primero vendelo o editá el anterior.`);
        return;
      }
      if ((sameImei ?? []).length > 0) {
        toast.warning("Este IMEI ya pasó antes por tu tienda (se vendió). Verificá que sea realmente el mismo equipo.");
      }

      const params = buildDevicePurchaseParams(form, checklistPresets.map((p) => p.label));
      if (canje) {
        onCollect?.({ form, params });
        onOpenChange(false);
        return;
      }
      const { data, error } = await (supabase as any).rpc("register_device_purchase", {
        p: { ...params, branch_id: effectiveBranchId },
      });
      if (error) throw error;

      const result = data as { purchase_id: string; receipt_number: string };
      setDone({
        id: result.purchase_id,
        receipt_number: result.receipt_number,
        created_at: new Date().toISOString(),
        branch_id: effectiveBranchId,
        device_name: params.device_name,
        imei: params.imei,
        battery_health: params.battery_health,
        seller_name: params.seller_name,
        seller_cedula: params.seller_cedula,
        seller_phone: params.seller_phone || null,
        purchase_price: params.purchase_price,
        payment_method: params.payment_method,
        reason: params.reason || null,
        checklist: params.checklist,
        accessories: params.accessories,
        notes: params.notes || null,
      });
      toast.success(`Compra registrada: ${result.receipt_number}`);
      onRegistered?.();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo registrar la compra");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" /> Compra registrada
              </DialogTitle>
              <DialogDescription>
                Comprobante <span className="font-semibold text-foreground">{done.receipt_number}</span> — {done.device_name} por{" "}
                {formatPYG(done.purchase_price)}. El equipo ya está en el catálogo de Productos.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
              <Button onClick={() => onPrint?.(done)} className="gap-2">
                <Printer className="h-4 w-4" /> Imprimir comprobante
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{canje ? "Equipo que recibís como parte de pago" : "Comprar equipo a un cliente"}</DialogTitle>
              <DialogDescription>
                {canje
                  ? "Cargá los datos del equipo que te entrega el cliente. Se registra junto con la venta, con un comprobante, y entra al catálogo al valor que le reconozcas."
                  : "Deja un comprobante con los datos del vendedor y el estado del equipo, y lo suma al catálogo con su costo de compra."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5">
              <section className="grid gap-3">
                <h4 className="text-sm font-semibold text-foreground">Equipo</h4>
                <div className="grid gap-2">
                  <Label htmlFor="buy-device-name">Nombre del equipo</Label>
                  <Input id="buy-device-name" value={form.device_name} onChange={(e) => set({ device_name: e.target.value })} placeholder="Ej: iPhone 13 128GB negro" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="buy-device-imei">IMEI o número de serie</Label>
                  <Input id="buy-device-imei" inputMode="text" maxLength={20} value={form.imei} onChange={(e) => set({ imei: e.target.value })} placeholder="Ej: 356938035643809" />
                  {imeiMessage && (
                    <p className="flex items-start gap-1.5 text-xs text-secondary" data-testid="imei-warning">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {imeiMessage}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="buy-device-battery">Batería % (opcional)</Label>
                  <Input
                    id="buy-device-battery"
                    inputMode="numeric"
                    maxLength={4}
                    value={form.battery_health}
                    onChange={(e) => set({ battery_health: e.target.value })}
                    placeholder="Ej: 89"
                  />
                  <p className="text-xs text-muted-foreground">En iPhone: Ajustes → Batería → Estado de la batería.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Categoría (opcional)</Label>
                    <Select value={form.category_id ?? "__none__"} onValueChange={(v) => set({ category_id: v === "__none__" ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin categoría</SelectItem>
                        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {hasMultipleBranches && !canje && (
                    <div className="grid gap-2">
                      <Label>Sucursal</Label>
                      <Select value={effectiveBranchId ?? ""} onValueChange={(v) => set({ branch_id: v || null })}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar sucursal" /></SelectTrigger>
                        <SelectContent>
                          {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </section>

              <section className="grid gap-3 border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-foreground">{canje ? "Quién entrega el equipo" : "Quién vende"}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="buy-seller-name">Nombre completo</Label>
                    <Input id="buy-seller-name" value={form.seller_name} onChange={(e) => set({ seller_name: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="buy-seller-cedula">Cédula</Label>
                    <Input id="buy-seller-cedula" value={form.seller_cedula} onChange={(e) => set({ seller_cedula: e.target.value })} placeholder="Ej: 4.123.456" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="buy-seller-phone">Teléfono (opcional)</Label>
                  <Input id="buy-seller-phone" inputMode="tel" value={form.seller_phone} onChange={(e) => set({ seller_phone: e.target.value })} />
                </div>
              </section>

              <section className="grid gap-3 border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-foreground">Estado del equipo</h4>
                {checklistPresets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay ítems de checklist configurados. Agregalos en Configuración → Accesorios.</p>
                ) : (
                  <div className="space-y-2">
                    {checklistPresets.map((c) => {
                      const status = form.checklist[c.label];
                      return (
                        <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2">
                          <span className="text-sm">{c.label}</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleChecklist(c.label, "ok")}
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
                              onClick={() => toggleChecklist(c.label, "fail")}
                              className={cn(
                                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                                status === "fail"
                                  ? "border-transparent bg-destructive/10 text-destructive"
                                  : "border-input text-muted-foreground hover:text-foreground"
                              )}
                            >
                              Defecto
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {accessoryPresets.length > 0 && (
                  <div className="grid gap-2">
                    <Label>Accesorios que entrega</Label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {accessoryPresets.map((acc) => (
                        <div key={acc.id} className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2">
                          <Label htmlFor={`buy-acc-${acc.id}`} className="cursor-pointer text-sm font-normal">{acc.label}</Label>
                          <Switch
                            id={`buy-acc-${acc.id}`}
                            checked={form.accessories.includes(acc.label)}
                            onCheckedChange={(c) => toggleAccessory(acc.label, c)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="buy-reason">{canje ? "Motivo (opcional)" : "Motivo de la venta (opcional)"}</Label>
                  <Input id="buy-reason" value={form.reason} onChange={(e) => set({ reason: e.target.value })} placeholder={canje ? "Ej: renueva su equipo" : "Ej: cambia de equipo, necesita el dinero"} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="buy-notes">Observaciones (opcional)</Label>
                  <Textarea id="buy-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Ej: rayón en el marco, batería al 85%" />
                </div>
              </section>

              <section className="grid gap-3 border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-foreground">{canje ? "Valor del canje" : "Pago"}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="buy-price">{canje ? "Valor que le reconocés (Gs.)" : "Precio de compra (Gs.)"}</Label>
                    <Input id="buy-price" inputMode="numeric" placeholder="0" value={formatThousands(form.purchase_price)} onChange={(e) => set({ purchase_price: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="buy-selling">Precio de venta (Gs., opcional)</Label>
                    <Input id="buy-selling" inputMode="numeric" placeholder="0" value={formatThousands(form.selling_price)} onChange={(e) => set({ selling_price: e.target.value })} />
                  </div>
                </div>
                {purchasePrice > 0 && sellingPrice > 0 && (
                  <p className={cn("text-xs", sellingPrice - purchasePrice < 0 ? "text-destructive" : "text-muted-foreground")}>
                    Ganancia estimada antes de repuestos: {formatPYG(sellingPrice - purchasePrice)}
                  </p>
                )}
                {canje ? (
                  <p className="text-xs text-muted-foreground">
                    No sale plata de la caja: este valor se descuenta de lo que paga el cliente por la venta, y es el costo del equipo cuando lo revendas.
                    {maxValue !== undefined && (deposit > 0
                      ? ` Máximo: ${formatPYG(Math.max(0, maxValue - deposit))} (el total de la venta menos la seña ya abonada).`
                      : ` Máximo: ${formatPYG(maxValue)} (el total de la venta).`)}
                  </p>
                ) : (
                  <div className="grid gap-2">
                    <Label>Con qué le pagás</Label>
                    <div className="flex flex-wrap gap-2">
                      {paymentMethods.map((m) => (
                        <button key={m.id} type="button" onClick={() => set({ payment_method: m.label })} className={chipClass(form.payment_method === m.label)}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Sale de la caja de hoy. El costo no es un gasto del mes: se descuenta cuando vendas el equipo.</p>
                  </div>
                )}
              </section>

              {cashGate.blocked && !canje && <CashRegisterRequiredNotice what="registrar la compra" />}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={submit} disabled={saving || (!canje && cashGate.blocked)}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {canje ? "Usar como parte de pago" : "Registrar compra"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
