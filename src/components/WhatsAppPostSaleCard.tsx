import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import { notifyMessageQueueChanged } from "@/lib/customerMessages";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { openUpgradeWhatsApp } from "@/lib/upgrade";
import { HeartHandshake, Loader2, Lock } from "lucide-react";

type Flag = "postsale_review_enabled" | "postsale_warranty_enabled" | "postsale_birthday_enabled";

const MAX_URL_LENGTH = 500;
const isValidUrl = (value: string) => /^https?:\/\//i.test(value) && value.length <= MAX_URL_LENGTH;

// Post-venta: F7 arma la lista "Para contactar hoy" (en Avisos) con clientes a
// quienes conviene escribirles. Todo apagado por defecto y cada mensaje se
// manda con un toque: nada sale solo.
export default function WhatsAppPostSaleCard() {
  const { companyId } = useCompany();
  const { toast } = useToast();
  const { postSale, postSaleAvailable, loading, reload } = useWhatsAppSettings();
  const [saving, setSaving] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  // Recargar tras cada cambio no debe volver a mostrar el spinner (borraría lo que se está escribiendo).
  const [ready, setReady] = useState(false);

  useEffect(() => { if (!loading) setReady(true); }, [loading]);

  useEffect(() => { setUrlDraft(postSale.reviewUrl ?? ""); }, [postSale.reviewUrl]);

  const save = async (patch: TablesUpdate<"companies">) => {
    if (!companyId) return false;
    setSaving(true);
    const { error } = await supabase.from("companies").update(patch).eq("id", companyId);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      await reload();
      return false;
    }
    await reload();
    notifyMessageQueueChanged();
    return true;
  };

  const trimmed = urlDraft.trim();
  const urlChanged = trimmed !== (postSale.reviewUrl ?? "");
  const urlInvalid = trimmed !== "" && !isValidUrl(trimmed);

  const saveUrl = async () => {
    if (urlInvalid) return;
    if (await save({ review_url: trimmed || null })) toast({ title: "Link guardado" });
  };

  const rows: { flag: Flag; checked: boolean; label: string; help: string }[] = [
    {
      flag: "postsale_review_enabled",
      checked: postSale.review,
      label: "Pedir reseña",
      help: "A los 3 días de entregar una reparación (y hasta los 7) te sugerimos pedirle al cliente una reseña. Si trajo varios equipos, un solo mensaje.",
    },
    {
      flag: "postsale_warranty_enabled",
      checked: postSale.warranty,
      label: "Avisar que la garantía está por vencer",
      help: "Los últimos 3 días antes de que venza la garantía de una reparación, para que el cliente consulte si notó algo.",
    },
    {
      flag: "postsale_birthday_enabled",
      checked: postSale.birthday,
      label: "Saludar en el cumpleaños",
      help: "El día del cumpleaños del cliente (y hasta 2 días después, por si no abrís F7 ese día). La fecha se carga desde Clientes.",
    },
  ];

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <HeartHandshake className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="font-semibold">Post-venta: para contactar hoy</div>
            <div className="text-xs text-muted-foreground">
              F7 arma cada día una lista de clientes a quienes conviene escribirles. Vos mandás cada mensaje con un toque desde tu
              WhatsApp: nada sale solo. Empieza todo apagado.
            </div>
          </div>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {!ready ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !postSaleAvailable ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-4" data-testid="postsale-locked">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <p>La post-venta (reseñas, garantías por vencer y cumpleaños) está disponible desde el plan Pro.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => openUpgradeWhatsApp()}>
              Contactar para subir de plan
            </Button>
          </div>
        ) : (
          <>
            <div className="divide-y rounded-md border">
              {rows.map((row) => (
                <div key={row.flag} className="space-y-3 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor={`postsale-${row.flag}`} className="cursor-pointer text-sm font-medium">
                        {row.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{row.help}</p>
                    </div>
                    <Switch
                      id={`postsale-${row.flag}`}
                      checked={row.checked}
                      disabled={saving}
                      onCheckedChange={(v) => save({ [row.flag]: v })}
                    />
                  </div>

                  {row.flag === "postsale_review_enabled" && row.checked && (
                    <div className="space-y-1.5">
                      <Label htmlFor="postsale-review-url" className="text-xs">Link de tu ficha para dejar reseñas</Label>
                      <div className="flex gap-2">
                        <Input
                          id="postsale-review-url"
                          value={urlDraft}
                          onChange={(e) => setUrlDraft(e.target.value)}
                          placeholder="https://g.page/r/tu-taller/review"
                          maxLength={MAX_URL_LENGTH}
                          inputMode="url"
                        />
                        <Button type="button" onClick={saveUrl} disabled={saving || !urlChanged || urlInvalid}>
                          Guardar
                        </Button>
                      </div>
                      {urlInvalid ? (
                        <p className="text-xs text-destructive" role="alert">
                          El link tiene que empezar con https://
                        </p>
                      ) : !postSale.reviewUrl ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Hasta que cargues el link no te sugerimos ninguna reseña. En Google Maps, abrí tu negocio y copiá el link de
                          “Pedir reseñas”.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/avisos">Ver la lista de hoy</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
