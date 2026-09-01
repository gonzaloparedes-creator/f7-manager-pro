import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Tags, Plus, Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Preset = { id: string; label: string };
type PresetKind = "marca_presets" | "modelo_presets";

// El switch prende/apaga el paquete completo (Marca + Modelo) en los
// formularios de carga y las tablas de ganancia por categoría en Reportes
// — no solo las listas. A diferencia de Equipo, ni Marca ni Modelo tienen
// un sub-modo "texto libre vs selección": ambos siempre se muestran como
// chips, con un chip "Otro" (si la empresa lo agrega a su lista) que
// revela texto libre.
export default function MarcaPresetsTab() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const [items, setItems] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Preset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [modeloItems, setModeloItems] = useState<Preset[]>([]);
  const [modeloLoading, setModeloLoading] = useState(true);
  const [modeloLabel, setModeloLabel] = useState("");
  const [modeloSaving, setModeloSaving] = useState(false);
  const [modeloPendingDelete, setModeloPendingDelete] = useState<Preset | null>(null);
  const [modeloDeleting, setModeloDeleting] = useState(false);
  const [useDeviceClassification, setUseDeviceClassification] = useState(false);
  const [savingMode, setSavingMode] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    setModeloLoading(true);
    const [{ data, error }, { data: modeloData, error: modeloError }, { data: company }] = await Promise.all([
      supabase
        .from("marca_presets")
        .select("id, label")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("modelo_presets")
        .select("id, label")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true }),
      supabase.from("companies").select("use_device_classification").eq("id", companyId).maybeSingle(),
    ]);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    if (modeloError) toast({ title: "Error", description: modeloError.message, variant: "destructive" });
    setItems((data ?? []) as Preset[]);
    setModeloItems((modeloData ?? []) as Preset[]);
    setUseDeviceClassification(!!company?.use_device_classification);
    setLoading(false);
    setModeloLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const toggleUseDeviceClassification = async (value: boolean) => {
    if (!companyId) return;
    setSavingMode(true);
    setUseDeviceClassification(value);
    const { error } = await supabase.from("companies").update({ use_device_classification: value }).eq("id", companyId);
    setSavingMode(false);
    if (error) {
      setUseDeviceClassification(!value);
      return toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    toast({ title: value ? "Clasificación por marca/modelo activada" : "Clasificación por marca/modelo desactivada" });
  };

  const add = async (kind: PresetKind, value: string) => {
    if (!companyId) return;
    const trimmed = value.trim();
    if (!trimmed) return toast({ title: "Falta el nombre", variant: "destructive" });
    const setSavingState = kind === "marca_presets" ? setSaving : setModeloSaving;
    setSavingState(true);
    const { error } = await supabase.from(kind).insert({ company_id: companyId, label: trimmed });
    setSavingState(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    if (kind === "marca_presets") setLabel(""); else setModeloLabel("");
    toast({ title: kind === "marca_presets" ? "Marca agregada" : "Modelo agregado" });
    load();
  };

  const remove = async (kind: PresetKind, p: Preset) => {
    const setDeletingState = kind === "marca_presets" ? setDeleting : setModeloDeleting;
    setDeletingState(true);
    const { error } = await supabase.from(kind).delete().eq("id", p.id);
    setDeletingState(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    if (kind === "marca_presets") setPendingDelete(null); else setModeloPendingDelete(null);
    load();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Tags className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Marca y modelo del equipo</div>
            <div className="text-xs text-muted-foreground">
              Clasificá cada orden por marca (Apple, Samsung, etc.) y modelo, además del tipo de
              equipo. Se refleja en Reportes para ver en qué categoría ganás más.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border px-4 py-3">
          <div>
            <Label htmlFor="device_classification_mode" className="cursor-pointer text-sm font-medium">
              Clasificación por marca/modelo
            </Label>
            <div className="text-xs text-muted-foreground">
              {useDeviceClassification
                ? "Los formularios de carga muestran Marca y Modelo, y Reportes muestra la ganancia separada por categoría."
                : "Desactivado: los formularios y Reportes quedan como hoy, sin estos campos."}
            </div>
          </div>
          {savingMode ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch id="device_classification_mode" checked={useDeviceClassification} onCheckedChange={toggleUseDeviceClassification} />
          )}
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Marcas</div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="marca_label">Nombre de la marca</Label>
              <Input
                id="marca_label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add("marca_presets", label); } }}
                placeholder="Apple"
              />
            </div>
            <Button onClick={() => add("marca_presets", label)} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Agregar
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Aún no hay marcas configuradas.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marca</TableHead>
                    <TableHead className="w-20 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setPendingDelete(p)} aria-label={`Eliminar ${p.label}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {useDeviceClassification && items.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Con la clasificación activa pero sin marcas cargadas, el campo Marca muestra
              directamente el texto libre ("Otro").
            </p>
          )}
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="text-sm font-medium">Modelos</div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="modelo_label">Nombre del modelo</Label>
              <Input
                id="modelo_label"
                value={modeloLabel}
                onChange={(e) => setModeloLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add("modelo_presets", modeloLabel); } }}
                placeholder="iPhone 13"
              />
            </div>
            <Button onClick={() => add("modelo_presets", modeloLabel)} disabled={modeloSaving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Agregar
            </Button>
          </div>

          {modeloLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : modeloItems.length === 0 ? (
            <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Aún no hay modelos configurados.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="w-20 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modeloItems.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setModeloPendingDelete(p)} aria-label={`Eliminar ${p.label}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {useDeviceClassification && modeloItems.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Con la clasificación activa pero sin modelos cargados, el campo Modelo muestra
              directamente el texto libre ("Otro").
            </p>
          )}
        </div>
      </CardContent>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="¿Eliminar marca?"
        description={pendingDelete ? `Se eliminará "${pendingDelete.label}". Esta acción no se puede deshacer.` : ""}
        loading={deleting}
        onConfirm={() => pendingDelete && remove("marca_presets", pendingDelete)}
      />
      <ConfirmDialog
        open={!!modeloPendingDelete}
        onOpenChange={(o) => !o && setModeloPendingDelete(null)}
        title="¿Eliminar modelo?"
        description={modeloPendingDelete ? `Se eliminará "${modeloPendingDelete.label}". Esta acción no se puede deshacer.` : ""}
        loading={modeloDeleting}
        onConfirm={() => modeloPendingDelete && remove("modelo_presets", modeloPendingDelete)}
      />
    </Card>
  );
}
