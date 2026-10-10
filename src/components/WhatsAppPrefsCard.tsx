import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useToast } from "@/hooks/use-toast";
import { useOrderStatusPresets } from "@/hooks/useOrderStatusPresets";
import { useWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Loader2 } from "lucide-react";

// "Sugerirme avisar": en estos momentos F7 abre el aviso al cliente ya
// escrito. Siempre se puede avisar a mano desde el detalle de la orden.
// Los valores son los mismos que antes ("enviar automáticamente"), por eso no
// hizo falta migrarlos; solo cambió lo que significan.
export default function WhatsAppPrefsCard({ evolutionActive }: { evolutionActive: boolean }) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { toast } = useToast();
  const { presets } = useOrderStatusPresets();
  const { prefs: loaded, loading, reload } = useWhatsAppSettings();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setPrefs(loaded); }, [loaded]);

  const toggle = async (key: string, value: boolean) => {
    if (!user || !companyId) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    // El envío automático viejo (Evolution) todavía lee las preferencias del
    // perfil de quien conectó el QR: se escriben en los dos lados.
    const [profileRes, companyRes] = await Promise.all([
      supabase.from("profiles").update({ notification_preferences: next }).eq("id", user.id),
      supabase.from("companies").update({ whatsapp_notify_prefs: next }).eq("id", companyId),
    ]);
    setSaving(false);
    const error = profileRes.error ?? companyRes.error;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      reload();
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="font-semibold">Cuándo avisar a tus clientes</div>
            <div className="text-xs text-muted-foreground">
              En los momentos que dejes prendidos, F7 te abre el aviso con el mensaje ya escrito. Los demás los podés mandar a mano
              desde el detalle de la orden.
              {evolutionActive && " Mientras tu WhatsApp siga conectado por QR, estos avisos salen solos."}
            </div>
          </div>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Al crear la orden o presupuesto</div>
              <div className="divide-y rounded-md border">
                <div className="flex items-center justify-between px-4 py-3">
                  <Label htmlFor="notif-orden_creada" className="cursor-pointer text-sm font-medium">Avisar al cliente</Label>
                  <Switch id="notif-orden_creada" checked={prefs.orden_creada === true} onCheckedChange={(v) => toggle("orden_creada", v)} />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Al cambiar el estado</div>
              <div className="divide-y rounded-md border">
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <Label htmlFor={`notif-${p.key}`} className="cursor-pointer text-sm font-medium">{p.label}</Label>
                    <Switch id={`notif-${p.key}`} checked={prefs[p.key] === true} onCheckedChange={(v) => toggle(p.key, v)} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
