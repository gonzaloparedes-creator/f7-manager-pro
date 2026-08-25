import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { PackageCheck, Plus, Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Preset = { id: string; label: string };

export default function AccessoryPresetsTab() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const [items, setItems] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Preset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("accessory_presets")
      .select("id, label")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setItems((data ?? []) as Preset[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const add = async () => {
    if (!companyId) return;
    const trimmed = label.trim();
    if (!trimmed) return toast({ title: "Falta el nombre", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase.from("accessory_presets").insert({ company_id: companyId, label: trimmed });
    setSaving(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setLabel("");
    toast({ title: "Accesorio agregado" });
    load();
  };

  const remove = async (p: Preset) => {
    setDeleting(true);
    const { error } = await supabase.from("accessory_presets").delete().eq("id", p.id);
    setDeleting(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setPendingDelete(null);
    load();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Accesorios</div>
            <div className="text-xs text-muted-foreground">
              Qué puede marcar el técnico como entregado junto con el equipo.
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="ap_label">Nombre / Etiqueta</Label>
            <Input
              id="ap_label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder="Cargador"
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
            Aún no hay accesorios configurados.
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
      </CardContent>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="¿Eliminar accesorio?"
        description={pendingDelete ? `Se eliminará "${pendingDelete.label}". Esta acción no se puede deshacer.` : ""}
        loading={deleting}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
      />
    </Card>
  );
}
