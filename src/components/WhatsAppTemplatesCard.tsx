import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, MessageSquareText, Pencil } from "lucide-react";
import MessageTemplateEditor from "@/components/MessageTemplateEditor";
import {
  MESSAGE_EVENTS,
  renderMessage,
  PREVIEW_VARS,
  type MessageEventKey,
} from "@/lib/customerMessages";

const EVENT_ORDER: MessageEventKey[] = [
  "orden_creada",
  "presupuesto_creado",
  "seguimiento",
  "presupuesto_aceptado",
  "presupuesto_rechazado",
  "presupuesto_cambios",
];

const EVENT_HELP: Record<MessageEventKey, string> = {
  orden_creada: "Cuando creás una orden de reparación.",
  presupuesto_creado: "Cuando creás un presupuesto.",
  seguimiento: "Cuando mandás el link de seguimiento a mano, desde el detalle de la orden.",
  presupuesto_aceptado: "Cuando el cliente acepta un presupuesto desde su link.",
  presupuesto_rechazado: "Cuando el cliente rechaza un presupuesto.",
  presupuesto_cambios: "Cuando el cliente pide cambios en un presupuesto.",
};

export default function WhatsAppTemplatesCard({
  onOpenStatuses,
  evolutionActive = false,
}: {
  onOpenStatuses?: () => void;
  evolutionActive?: boolean;
}) {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MessageEventKey | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("event_key, body")
      .eq("company_id", companyId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setCustom(Object.fromEntries((data ?? []).map((r) => [r.event_key, r.body])));
    setLoading(false);
    // toast es estable; recargar solo cuando cambia la empresa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const bodyOf = (key: MessageEventKey) => custom[key]?.trim() || MESSAGE_EVENTS[key].defaultBody;

  const openEditor = (key: MessageEventKey) => {
    setEditing(key);
    setText(bodyOf(key));
  };

  const save = async () => {
    if (!companyId || !editing) return;
    const trimmed = text.trim();
    if (!trimmed) return toast({ title: "El mensaje no puede quedar vacío", variant: "destructive" });
    setSaving(true);
    // Si el texto quedó igual al predeterminado se borra la fila: así el taller
    // sigue recibiendo las mejoras futuras del texto de F7 en vez de quedar
    // clavado en una copia.
    const isDefault = trimmed === MESSAGE_EVENTS[editing].defaultBody;
    const { error } = isDefault
      ? await supabase.from("whatsapp_templates").delete().eq("company_id", companyId).eq("event_key", editing)
      : await supabase.from("whatsapp_templates").upsert(
          { company_id: companyId, event_key: editing, body: trimmed, updated_at: new Date().toISOString() },
          { onConflict: "company_id,event_key" }
        );
    setSaving(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Mensaje guardado" });
    setEditing(null);
    load();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="font-semibold">Mensajes de WhatsApp</div>
            <div className="text-xs text-muted-foreground">
              El texto que F7 te deja escrito para cada aviso. Podés cambiarlo a tu gusto.
              {onOpenStatuses && (
                <>
                  {" "}Los mensajes de cada cambio de estado se editan en{" "}
                  <button type="button" onClick={onOpenStatuses} className="font-medium text-primary underline-offset-2 hover:underline">
                    Estados
                  </button>.
                </>
              )}
              {evolutionActive && " Mientras tu WhatsApp siga conectado por QR, estos textos todavía no se usan: aplican cuando pasás al modo seguro."}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="divide-y rounded-md border">
            {EVENT_ORDER.map((key) => (
              <div key={key} className="flex items-start gap-3 px-4 py-3" data-testid={`template-row-${key}`}>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{MESSAGE_EVENTS[key].label}</span>
                    {custom[key] && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Personalizado</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{EVENT_HELP[key]}</div>
                  <div className="line-clamp-2 text-xs text-muted-foreground/80">
                    {renderMessage(bodyOf(key), PREVIEW_VARS)}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEditor(key)} aria-label={`Editar mensaje: ${MESSAGE_EVENTS[key].label}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mensaje — {editing ? MESSAGE_EVENTS[editing].label : ""}</DialogTitle>
            <DialogDescription>{editing ? EVENT_HELP[editing] : ""}</DialogDescription>
          </DialogHeader>

          <MessageTemplateEditor id="event_template_text" value={text} onChange={setText} />

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => editing && setText(MESSAGE_EVENTS[editing].defaultBody)}
              disabled={saving}
            >
              Restaurar predeterminado
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
