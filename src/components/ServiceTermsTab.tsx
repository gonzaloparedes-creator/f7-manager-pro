import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useServiceTerms } from "@/hooks/useServiceTerms";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_SERVICE_TERMS, renderServiceTerms } from "@/lib/orders";
import { FileText, Loader2 } from "lucide-react";

// El placeholder {{garantia_dias}} se resuelve con la garantía real de cada
// orden (ver renderServiceTerms en lib/orders.ts) — funciona igual si el
// admin escribe un texto propio siempre que lo reutilice.
export default function ServiceTermsTab() {
  const { toast } = useToast();
  const { companyId } = useCompany();
  const { template, loading, reload } = useServiceTerms();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading) setText(template); }, [loading, template]);

  const save = async () => {
    if (!companyId) return;
    const trimmed = text.trim();
    if (!trimmed) return toast({ title: "El texto no puede quedar vacío", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({ service_terms_template: trimmed })
      .eq("id", companyId);
    setSaving(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Términos guardados" });
    reload();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Términos y condiciones del servicio</div>
            <div className="text-xs text-muted-foreground">
              El texto que el cliente acepta al recibir un equipo o convertir un presupuesto en orden.
            </div>
          </div>
        </div>

        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
          Usá <code className="rounded bg-muted px-1 py-0.5 font-mono">{"{{garantia_dias}}"}</code> en
          cualquier parte del texto para que se reemplace automáticamente por la garantía elegida
          en cada orden (ej: "30 días").
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="service_terms_text">Texto</Label>
              <Textarea
                id="service_terms_text"
                rows={14}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="resize-none font-mono text-xs leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setText(DEFAULT_SERVICE_TERMS)} disabled={saving}>
                Restaurar predeterminado
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <Label className="text-xs text-muted-foreground">Vista previa (con garantía de ejemplo: 30 días)</Label>
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
                {renderServiceTerms(text, 30)}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
