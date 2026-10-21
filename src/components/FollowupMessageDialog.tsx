import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { openWhatsApp, toWhatsAppPhone } from "@/lib/whatsapp";
import {
  GROUP_LABELS,
  SITUATION_GROUP,
  SITUATION_LABELS,
  buildFollowupMessage,
  firstName,
  type FollowupCompany,
  type FollowupGroup,
  type FollowupSituation,
} from "@/lib/followup";
import type { PlanExpiryInfo } from "@/lib/planExpiry";

export interface FollowupTarget {
  company: FollowupCompany;
  info: PlanExpiryInfo;
  situation: FollowupSituation;
}

interface FollowupMessageDialogProps {
  target: FollowupTarget | null;
  onClose: () => void;
  onSent: (companyId: string, kind: FollowupGroup, sentAt: string) => void;
}

export default function FollowupMessageDialog({ target, onClose, onSent }: FollowupMessageDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        {target && <FollowupForm key={`${target.company.id}-${target.situation}`} target={target} onClose={onClose} onSent={onSent} />}
      </DialogContent>
    </Dialog>
  );
}

function FollowupForm({
  target,
  onClose,
  onSent,
}: {
  target: FollowupTarget;
  onClose: () => void;
  onSent: FollowupMessageDialogProps["onSent"];
}) {
  const { company, info, situation } = target;
  const group = SITUATION_GROUP[situation];
  const suggested = useMemo(() => buildFollowupMessage(company, info, situation), [company, info, situation]);
  const [text, setText] = useState(suggested);
  const [sending, setSending] = useState(false);

  const phone = toWhatsAppPhone(company.admin_phone);
  const contactName = firstName(company.admin_name) || company.admin_name || "sin nombre cargado";
  const message = text.trim();

  const send = async () => {
    if (!phone || !message || sending) return;
    // Primero se abre WhatsApp (dentro del clic, para que el navegador no lo bloquee) y después se anota.
    openWhatsApp(phone, message);
    setSending(true);
    const { error } = await supabase.from("company_contact_log").insert({ company_id: company.id, kind: group, message });
    setSending(false);
    if (error) {
      toast.warning("Se abrió WhatsApp, pero no se pudo anotar el contacto", { description: error.message });
      onClose();
      return;
    }
    onSent(company.id, group, new Date().toISOString());
    onClose();
    toast.success(`Contacto anotado: ${company.name}`, { description: "Queda al final de la cola unos días." });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Escribir por WhatsApp
        </DialogTitle>
        <DialogDescription>
          {company.name} · {contactName}
          {phone ? ` · +${phone}` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{GROUP_LABELS[group]}</Badge>
          <span className="text-sm text-muted-foreground">{SITUATION_LABELS[situation]}</span>
        </div>

        {!phone && (
          <p role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
            Este negocio no tiene un teléfono válido cargado en el perfil de su administrador, así que no se puede abrir el chat.
          </p>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="followup-text">Mensaje (podés editarlo antes de enviar)</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={text === suggested}
              onClick={() => setText(suggested)}
            >
              <RotateCcw className="h-3 w-3" />
              Restaurar
            </Button>
          </div>
          <Textarea id="followup-text" rows={8} value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} />
          <p className="text-right text-xs text-muted-foreground">{text.length}/1500</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Se abre WhatsApp con el mensaje escrito; vos lo mandás. Queda anotado que le escribiste para no repetirlo enseguida.
        </p>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={sending}>Cancelar</Button>
        <Button type="button" onClick={send} disabled={!phone || !message || sending}>
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
          Abrir WhatsApp
        </Button>
      </DialogFooter>
    </>
  );
}
