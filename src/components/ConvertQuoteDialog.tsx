import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatPYG, DEFAULT_SERVICE_TERMS } from "@/lib/orders";
import { Type, Grid3x3, Banknote, ArrowLeftRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { PatternLock } from "@/components/PatternLock";
import { SignaturePad } from "@/components/SignaturePad";
import WarrantySelector from "@/components/WarrantySelector";
import { useAccessoryPresets } from "@/hooks/useAccessoryPresets";
import { useChecklistPresets } from "@/hooks/useChecklistPresets";

type QuoteOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  secondary_phone?: string | null;
  device_type: string;
  quote_amount: number;
};

// El resto de los datos que Nueva Orden pide (fotos, PIN/patrón, accesorios,
// garantía, seña y firma) recién se completan acá, cuando el equipo entra
// de verdad al taller — un Presupuesto no tiene nada de esto todavía. Las
// fotos quedan afuera a propósito: ya se pueden cargar después desde
// "Evidencia fotográfica" al actualizar el estado, no hace falta duplicarlo.
export default function ConvertQuoteDialog({
  order, open, onOpenChange, onConverted,
}: { order: QuoteOrder; open: boolean; onOpenChange: (o: boolean) => void; onConverted: () => void }) {
  const { toast } = useToast();
  const { presets: accessoryPresets } = useAccessoryPresets();
  const { presets: checklistPresets } = useChecklistPresets();
  const [loading, setLoading] = useState(false);

  const [lockInputMode, setLockInputMode] = useState<"text" | "pattern">("text");
  const [devicePin, setDevicePin] = useState("");
  const [devicePattern, setDevicePattern] = useState<number[]>([]);
  const [accessories, setAccessories] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<Record<string, "ok" | "fail">>({});
  const [warrantyDays, setWarrantyDays] = useState(30);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("Efectivo");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signature, setSignature] = useState("");

  const parseAmount = (s: string) => {
    const digits = s.replace(/\D/g, "");
    return digits ? parseInt(digits, 10) : 0;
  };
  const formatThousands = (s: string) => {
    const n = parseAmount(s);
    return n ? n.toLocaleString("es-PY") : "";
  };
  const deposit = parseAmount(depositAmount);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deposit > order.quote_amount) {
      toast({ title: "Importes inválidos", description: "La seña no puede superar al presupuesto.", variant: "destructive" });
      return;
    }
    if (!termsAccepted) {
      toast({ title: "Faltan datos", description: "El cliente debe aceptar los términos del servicio.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "recibido",
          device_pin: devicePin || null,
          device_pattern: devicePattern,
          accessories,
          checklist: Object.entries(checklist).map(([label, status]) => ({ label, status })),
          warranty_days: warrantyDays,
          deposit_amount: deposit,
          deposit_payment_method: deposit > 0 ? depositMethod : null,
          terms_accepted: termsAccepted,
          client_signature: signature || null,
        })
        .eq("id", order.id);
      if (error) throw error;

      await supabase.from("order_status_history").insert({
        order_id: order.id, status: "recibido", note: "Presupuesto convertido a orden — equipo recibido",
      });

      try {
        const notificationPhone = order.secondary_phone ? order.secondary_phone : order.customer_phone;
        await supabase.functions.invoke("send-order-notification", {
          body: {
            customer_name: order.customer_name,
            customer_phone: notificationPhone,
            device_type: order.device_type,
            order_number: order.order_number,
            order_code: order.order_number,
            app_origin: window.location.origin,
          },
        });
      } catch (e) { console.warn("notification failed", e); }

      toast({ title: "¡Orden creada!", description: `${order.order_number} pasó de presupuesto a orden recibida.` });
      onOpenChange(false);
      onConverted();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convertir a orden</DialogTitle>
          <DialogDescription>
            {order.order_number} · {order.customer_name} · {order.device_type} — el equipo ya está en el taller.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {accessoryPresets.length > 0 && (
            <div className="space-y-2">
              <Label>Accesorios y Componentes</Label>
              <p className="text-xs text-muted-foreground">Marcá lo que el cliente entrega junto al equipo.</p>
              <div className="grid grid-cols-2 gap-3">
                {accessoryPresets.map((acc) => {
                  const checked = accessories.includes(acc.label);
                  return (
                    <div key={acc.id} className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2">
                      <Label className="text-sm font-normal cursor-pointer">{acc.label}</Label>
                      <Switch
                        checked={checked}
                        onCheckedChange={(c) => setAccessories(c
                          ? [...accessories, acc.label]
                          : accessories.filter((x) => x !== acc.label))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {checklistPresets.length > 0 && (
            <div className="space-y-2">
              <Label>Checklist de Recepción</Label>
              <p className="text-xs text-muted-foreground">Dejá constancia del estado del equipo al recibirlo.</p>
              <div className="space-y-2">
                {checklistPresets.map((c) => {
                  const status = checklist[c.label];
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2">
                      <span className="text-sm">{c.label}</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setChecklist({ ...checklist, [c.label]: "ok" })}
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
                          onClick={() => setChecklist({ ...checklist, [c.label]: "fail" })}
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
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{lockInputMode === "text" ? "PIN / Contraseña" : "Patrón de desbloqueo (Android)"}</Label>
              <div className="flex rounded-md border border-input p-0.5">
                <button
                  type="button"
                  onClick={() => setLockInputMode("text")}
                  aria-label="Usar PIN o contraseña"
                  className={cn("flex h-7 w-7 items-center justify-center rounded-sm", lockInputMode === "text" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  <Type className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLockInputMode("pattern")}
                  aria-label="Usar patrón de desbloqueo"
                  className={cn("flex h-7 w-7 items-center justify-center rounded-sm", lockInputMode === "pattern" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  <Grid3x3 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {lockInputMode === "text" ? (
              <Input type="text" autoComplete="off" placeholder="Ej: 1234 o contraseña" value={devicePin} onChange={(e) => setDevicePin(e.target.value)} />
            ) : (
              <div className="flex flex-col items-start gap-2">
                <PatternLock value={devicePattern} onChange={setDevicePattern} size={200} />
                <Button type="button" variant="outline" size="sm" onClick={() => setDevicePattern([])} disabled={devicePattern.length === 0}>
                  Borrar patrón
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tiempo de garantía</Label>
            <WarrantySelector value={warrantyDays} onChange={setWarrantyDays} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Presupuesto (Gs.)</Label>
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold">
                {formatPYG(order.quote_amount)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert_deposit">Seña (Gs.)</Label>
              <Input
                id="convert_deposit"
                inputMode="numeric"
                placeholder="0"
                value={formatThousands(depositAmount)}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
            </div>
          </div>

          {deposit > 0 && (
            <div className="space-y-2">
              <Label>Método de pago de la seña</Label>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "Efectivo", label: "Efectivo", icon: Banknote },
                  { value: "Transferencia", label: "Transferencia", icon: ArrowLeftRight },
                  { value: "Otro", label: "Otro", icon: MoreHorizontal },
                ] as const).map((m) => {
                  const active = depositMethod === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setDepositMethod(m.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <m.icon className="h-3.5 w-3.5" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Términos del servicio</Label>
            <Textarea readOnly rows={6} value={DEFAULT_SERVICE_TERMS} className="resize-none bg-muted/30 font-mono text-xs leading-relaxed" />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="convert_terms" checked={termsAccepted} onCheckedChange={(c) => setTermsAccepted(c === true)} />
            <Label htmlFor="convert_terms" className="text-sm font-normal leading-snug">
              El cliente leyó y acepta los términos y condiciones del servicio.
            </Label>
          </div>
          <div className="space-y-2">
            <Label>Firma del cliente (opcional)</Label>
            <SignaturePad value={signature} onChange={setSignature} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Convirtiendo..." : "Confirmar recepción del equipo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
