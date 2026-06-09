import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Plus, Trash2, Loader2 } from "lucide-react";

type Preset = { id: string; label: string; days: number };

export default function WarrantyPresetsTab() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const [items, setItems] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("warranty_presets")
      .select("id, label, days")
      .eq("company_id", companyId)
      .order("days", { ascending: true });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setItems((data ?? []) as Preset[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const add = async () => {
    if (!companyId) return;
    const trimmed = label.trim();
    const d = parseInt(days, 10);
    if (!trimmed) return toast({ title: "Falta el nombre", variant: "destructive" });
    if (Number.isNaN(d) || d < 0) return toast({ title: "Días inválidos", description: "Debe ser un número entero ≥ 0.", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase.from("warranty_presets").insert({ company_id: companyId, label: trimmed, days: d });
    setSaving(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setLabel(""); setDays("");
    toast({ title: "Preset creado" });
    load();
  };

  const remove = async (p: Preset) => {
    if (!confirm(`¿Eliminar "${p.label}"?`)) return;
    const { error } = await supabase.from("warranty_presets").delete().eq("id", p.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    load();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Opciones de Garantía</div>
            <div className="text-xs text-muted-foreground">
              Configurá los plazos de garantía que aparecerán al crear o editar órdenes.
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="wp_label">Nombre / Etiqueta</Label>
            <Input id="wp_label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Pantalla Original" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wp_days">Días</Label>
            <Input id="wp_days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} placeholder="30" />
          </div>
          <Button onClick={add} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Aún no hay presets configurados.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead className="w-24">Días</TableHead>
                  <TableHead className="w-20 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.label}</TableCell>
                    <TableCell className="text-muted-foreground">{p.days}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
