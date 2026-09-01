import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ListChecks, Plus, Trash2, Loader2, Lock, ChevronUp, ChevronDown, Pencil, Check, X, MessageCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getDefaultStatusMessage, renderStatusMessage } from "@/lib/orders";

type Preset = { id: string; key: string; label: string; sort_order: number; is_locked: boolean; message_template: string | null };

function slugify(label: string, taken: Set<string>) {
  const base = label
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "estado";
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

// A diferencia de Accesorios/Problemas, acá "key" (orders.status real) es
// estable y nunca se edita — solo el label. 'recibido' y 'entregado' vienen
// bloqueados (is_locked): tienen lógica real enganchada (arranque del flujo
// y conteo de garantía respectivamente) y no se pueden borrar — RLS lo
// exige igual del lado del servidor, esto es además una guía para el admin.
export default function OrderStatusPresetsTab() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const [items, setItems] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Preset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [messageEditing, setMessageEditing] = useState<Preset | null>(null);
  const [messageText, setMessageText] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("order_status_presets")
      .select("id, key, label, sort_order, is_locked, message_template")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setItems((data ?? []) as Preset[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const add = async () => {
    if (!companyId) return;
    const trimmed = newLabel.trim();
    if (!trimmed) return toast({ title: "Falta el nombre", variant: "destructive" });
    setSaving(true);
    const key = slugify(trimmed, new Set(items.map((i) => i.key)));
    const nextSort = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 1;
    const { error } = await supabase.from("order_status_presets").insert({
      company_id: companyId, key, label: trimmed, sort_order: nextSort,
    });
    setSaving(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setNewLabel("");
    toast({ title: "Estado agregado" });
    load();
  };

  const startEdit = (p: Preset) => { setEditingId(p.id); setEditingLabel(p.label); };
  const cancelEdit = () => { setEditingId(null); setEditingLabel(""); };

  const saveEdit = async (p: Preset) => {
    const trimmed = editingLabel.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("order_status_presets").update({ label: trimmed }).eq("id", p.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    cancelEdit();
    load();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const other = items[index + direction];
    const current = items[index];
    if (!other) return;
    setMovingId(current.id);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("order_status_presets").update({ sort_order: other.sort_order }).eq("id", current.id),
      supabase.from("order_status_presets").update({ sort_order: current.sort_order }).eq("id", other.id),
    ]);
    setMovingId(null);
    if (e1 || e2) return toast({ title: "Error", description: (e1 ?? e2)?.message, variant: "destructive" });
    load();
  };

  const remove = async (p: Preset) => {
    setDeleting(true);
    const { error } = await supabase.from("order_status_presets").delete().eq("id", p.id);
    setDeleting(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setPendingDelete(null);
    load();
  };

  const openMessageEditor = (p: Preset) => {
    setMessageEditing(p);
    setMessageText(p.message_template ?? getDefaultStatusMessage(p.key));
  };

  const saveMessage = async () => {
    if (!messageEditing) return;
    const trimmed = messageText.trim();
    if (!trimmed) return toast({ title: "El mensaje no puede quedar vacío", variant: "destructive" });
    setSavingMessage(true);
    const { error } = await supabase
      .from("order_status_presets")
      .update({ message_template: trimmed })
      .eq("id", messageEditing.id);
    setSavingMessage(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Mensaje guardado" });
    setMessageEditing(null);
    load();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Estados de la orden</div>
            <div className="text-xs text-muted-foreground">
              Los pasos del selector "Actualizar estado". "Recibido" y "Entregado" (con candado) no se pueden borrar.
              Con el ícono de WhatsApp de cada fila podés personalizar el mensaje que recibe el cliente en ese estado.
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="status_label">Nombre del paso nuevo</Label>
            <Input
              id="status_label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder="Esperando repuesto"
            />
          </div>
          <Button onClick={add} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="divide-y rounded-md border">
            {items.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="flex shrink-0 flex-col">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || !!movingId}
                    aria-label="Subir" className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1 || !!movingId}
                    aria-label="Bajar" className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {p.is_locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}

                {editingId === p.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      autoFocus
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(p); if (e.key === "Escape") cancelEdit(); }}
                      className="h-8"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(p)} aria-label="Guardar">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit} aria-label="Cancelar">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 truncate font-medium">{p.label}</span>
                    <Button variant="ghost" size="icon" onClick={() => openMessageEditor(p)} aria-label={`Mensaje de WhatsApp de ${p.label}`}>
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(p)} aria-label={`Renombrar ${p.label}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!p.is_locked && (
                      <Button variant="ghost" size="icon" onClick={() => setPendingDelete(p)} aria-label={`Eliminar ${p.label}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="¿Eliminar este estado?"
        description={pendingDelete ? `Se eliminará "${pendingDelete.label}" del selector. Las órdenes que ya estén en ese estado no se modifican.` : ""}
        loading={deleting}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
      />

      <Dialog open={!!messageEditing} onOpenChange={(o) => !o && setMessageEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mensaje de WhatsApp — {messageEditing?.label}</DialogTitle>
            <DialogDescription>
              El texto que recibe el cliente cuando una orden pasa a este estado.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
            Usá estos placeholders, se reemplazan automáticamente:{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">{"{{cliente}}"}</code>{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">{"{{equipo}}"}</code>{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">{"{{orden}}"}</code>{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">{"{{estado}}"}</code>{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">{"{{link}}"}</code>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status_message_text">Mensaje</Label>
            <Textarea
              id="status_message_text"
              rows={6}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="resize-none text-sm"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => messageEditing && setMessageText(getDefaultStatusMessage(messageEditing.key))}
              disabled={savingMessage}
            >
              Restaurar predeterminado
            </Button>
            <Button type="button" onClick={saveMessage} disabled={savingMessage}>
              {savingMessage ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label className="text-xs text-muted-foreground">Vista previa (con datos de ejemplo)</Label>
            <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
              {renderStatusMessage(messageText, {
                cliente: "Juan Pérez",
                equipo: "Celular",
                orden: "ORD-0001",
                estado: messageEditing?.label ?? "",
                link: "https://f7manager.com/tracking/ORD-0001",
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
