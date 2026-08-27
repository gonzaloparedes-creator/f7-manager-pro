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
import { Smartphone, Plus, Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Preset = { id: string; label: string };

export default function DeviceTypePresetsTab() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const [items, setItems] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Preset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [savingMode, setSavingMode] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data, error }, { data: company }] = await Promise.all([
      supabase
        .from("device_type_presets")
        .select("id, label")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true }),
      supabase.from("companies").select("use_device_type_presets").eq("id", companyId).maybeSingle(),
    ]);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setItems((data ?? []) as Preset[]);
    setSelectionMode(!!company?.use_device_type_presets);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const toggleSelectionMode = async (value: boolean) => {
    if (!companyId) return;
    setSavingMode(true);
    setSelectionMode(value);
    const { error } = await supabase.from("companies").update({ use_device_type_presets: value }).eq("id", companyId);
    setSavingMode(false);
    if (error) {
      setSelectionMode(!value);
      return toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    toast({ title: value ? "Modo selección activado" : "Modo texto libre activado" });
  };

  const add = async () => {
    if (!companyId) return;
    const trimmed = label.trim();
    if (!trimmed) return toast({ title: "Falta el nombre", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase.from("device_type_presets").insert({ company_id: companyId, label: trimmed });
    setSaving(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setLabel("");
    toast({ title: "Equipo agregado" });
    load();
  };

  const remove = async (p: Preset) => {
    setDeleting(true);
    const { error } = await supabase.from("device_type_presets").delete().eq("id", p.id);
    setDeleting(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setPendingDelete(null);
    load();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Tipos de equipo</div>
            <div className="text-xs text-muted-foreground">
              Si tu taller recepciona siempre los mismos tipos de equipo, activá el modo selección
              para cargarlos con un clic en vez de escribirlos a mano.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border px-4 py-3">
          <div>
            <Label htmlFor="device_type_mode" className="cursor-pointer text-sm font-medium">Modo selección</Label>
            <div className="text-xs text-muted-foreground">
              {selectionMode
                ? "El campo Equipo muestra los chips de abajo en vez de un campo de texto libre."
                : "Predeterminado: el campo Equipo es un texto libre, como siempre."}
            </div>
          </div>
          {savingMode ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch id="device_type_mode" checked={selectionMode} onCheckedChange={toggleSelectionMode} />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="dtp_label">Nombre / Etiqueta</Label>
            <Input
              id="dtp_label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder="Celular"
            />
          </div>
          <Button onClick={add} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Aún no hay tipos de equipo configurados.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etiqueta</TableHead>
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

        {selectionMode && items.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Con el modo selección activo pero sin equipos cargados, el formulario de carga vuelve a mostrar texto libre.
          </p>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="¿Eliminar tipo de equipo?"
        description={pendingDelete ? `Se eliminará "${pendingDelete.label}". Esta acción no se puede deshacer.` : ""}
        loading={deleting}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
      />
    </Card>
  );
}
