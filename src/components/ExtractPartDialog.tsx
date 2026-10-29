import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { currencySymbol, formatMoney } from "@/lib/currency";
import { parseGs } from "@/lib/devicePurchase";
import { buildPartParams, validatePart, type PartInput, type ScrapDevice } from "@/lib/scrapDevice";

const EMPTY: PartInput = { name: "", cost: "", selling: "" };

function formatThousands(s: string) {
  const n = parseGs(s);
  return n ? n.toLocaleString("es-PY") : "";
}

// Carga una pieza sacada de un equipo de la chatarra: nace como un repuesto en
// Inventario (stock 1) con una parte de lo que se pagó por el equipo como costo.
export default function ExtractPartDialog({
  device,
  onOpenChange,
  onSaved,
}: {
  device: ScrapDevice | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PartInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (device) setForm(EMPTY);
    // Solo al abrir con otro equipo; recargar la lista no debe borrar lo que se está tipeando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.purchase.id]);

  if (!device) return null;

  const remaining = device.unassigned;
  const cost = parseGs(form.cost);
  const set = (patch: Partial<PartInput>) => setForm((f) => ({ ...f, ...patch }));

  const save = async (keepOpen: boolean) => {
    const problem = validatePart(form, remaining);
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("register_device_part", { p: buildPartParams(device.purchase.id, form) });
      if (error) throw error;
      toast.success(`Pieza cargada: ${form.name.trim()}`, { description: "Ya está en Inventario como repuesto." });
      onSaved();
      if (keepOpen) setForm(EMPTY);
      else onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cargar la pieza");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sacar una pieza</DialogTitle>
          <DialogDescription>
            {device.purchase.device_name} ({device.purchase.receipt_number}), comprado por {formatMoney(device.purchase.purchase_price)}.
            La pieza entra a Inventario como repuesto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="part-name">Nombre de la pieza</Label>
            <Input id="part-name" value={form.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} placeholder="Ej: Pantalla OLED iPhone 11" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="part-cost">Costo de la pieza ({currencySymbol()})</Label>
              <Input id="part-cost" inputMode="numeric" placeholder="0" value={formatThousands(form.cost)} onChange={(e) => set({ cost: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="part-selling">Precio de venta ({currencySymbol()}, opcional)</Label>
              <Input id="part-selling" inputMode="numeric" placeholder="0" value={formatThousands(form.selling)} onChange={(e) => set({ selling: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground" data-testid="part-remaining">
            {remaining > 0
              ? `Queda por asignar: ${formatMoney(Math.max(0, remaining - cost))} de ${formatMoney(device.purchase.purchase_price)}. Repartí lo que pagaste entre las piezas que le sacás.`
              : "Ya asignaste todo lo que pagaste por este equipo. Las piezas que sigas cargando entran a costo 0."}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button variant="outline" onClick={() => save(true)} disabled={saving} data-testid="save-part-another">
            Guardar y cargar otra
          </Button>
          <Button onClick={() => save(false)} disabled={saving} data-testid="save-part">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar pieza
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
