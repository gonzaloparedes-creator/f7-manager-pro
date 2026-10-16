import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Printer, ScanBarcode, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import BarcodeBars from "@/components/BarcodeBars";
import { generateBarcode } from "@/lib/barcodeRemote";
import {
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  MAX_LABEL_COPIES,
  clampCopies,
  isReadableOnLabel,
  labelPriceText,
  printLabels,
} from "@/lib/barcodeLabels";

export interface LabelItem {
  id: string;
  name: string;
  selling_price: number;
  barcode?: string | null;
}

export default function PrintLabelDialog({
  item,
  onOpenChange,
  onBarcodeAssigned,
}: {
  item: LabelItem | null;
  onOpenChange: (open: boolean) => void;
  /** El artículo no tenía código y se le generó uno: la pantalla que abrió el diálogo actualiza su lista. */
  onBarcodeAssigned?: (itemId: string, code: string) => void;
}) {
  const { companyId } = useCompany();
  const [code, setCode] = useState<string | null>(null);
  const [copies, setCopies] = useState("1");
  const [showPrice, setShowPrice] = useState(true);
  const [modules, setModules] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [printing, setPrinting] = useState(false);

  const itemId = item?.id;
  const itemBarcode = item?.barcode ?? null;
  useEffect(() => {
    setCode(itemBarcode);
    setCopies("1");
    setShowPrice(true);
    setModules(0);
  }, [itemId, itemBarcode]);

  if (!item) return null;
  const hasPrice = Number(item.selling_price) > 0;
  const priceText = labelPriceText(item.selling_price, showPrice);
  const count = clampCopies(copies);

  const generate = async () => {
    if (!companyId) return;
    setGenerating(true);
    try {
      const fresh = await generateBarcode(companyId);
      const { error } = await (supabase as any)
        .from("inventory_items")
        .update({ barcode: fresh })
        .eq("id", item.id)
        .eq("company_id", companyId);
      if (error) throw error;
      setCode(fresh);
      onBarcodeAssigned?.(item.id, fresh);
    } catch (e: any) {
      toast.error(e.message || "No se pudo generar el código");
    } finally {
      setGenerating(false);
    }
  };

  const print = async () => {
    if (!code) return;
    setPrinting(true);
    try {
      await printLabels({ name: item.name, barcode: code, price: item.selling_price }, { copies: count, showPrice });
    } catch (e: any) {
      toast.error(e.message || "No se pudo preparar la etiqueta");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Etiqueta con código de barras</DialogTitle>
          <DialogDescription>
            Etiqueta de {LABEL_WIDTH_MM} × {LABEL_HEIGHT_MM} mm para tu impresora de etiquetas.
          </DialogDescription>
        </DialogHeader>

        {!code ? (
          <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4 text-sm">
            <p>
              <span className="font-medium">{item.name}</span> todavía no tiene código de barras.
            </p>
            <p className="text-muted-foreground">
              Generamos uno propio de tu empresa. Si el producto ya trae un código de fábrica, cerrá esto y cargalo en
              «Editar» escaneándolo en el campo «Código de barras».
            </p>
            <Button className="w-full gap-2" onClick={generate} disabled={generating} data-testid="label-generate">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanBarcode className="h-4 w-4" />}
              Generar código
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div
                data-testid="label-preview"
                className="flex flex-col justify-between overflow-hidden border border-border bg-white text-black shadow-sm"
                style={{
                  width: `${LABEL_WIDTH_MM}mm`,
                  height: `${LABEL_HEIGHT_MM}mm`,
                  padding: "2.5mm 3mm 2mm",
                  fontFamily: "Arial, Helvetica, sans-serif",
                }}
              >
                <div>
                  <div
                    className="overflow-hidden break-words font-bold"
                    style={{
                      fontSize: "9.5pt",
                      lineHeight: 1.15,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {item.name}
                  </div>
                  {priceText && (
                    <div className="font-extrabold" style={{ marginTop: "1mm", fontSize: "14pt", lineHeight: 1 }}>
                      {priceText}
                    </div>
                  )}
                </div>
                <div>
                  <BarcodeBars code={code} onDrawn={setModules} className="block h-[12mm] w-full" />
                  <div className="text-center font-mono" style={{ fontSize: "8pt", letterSpacing: "0.12em", marginTop: "0.5mm" }}>
                    {code}
                  </div>
                </div>
              </div>
            </div>

            {modules > 0 && !isReadableOnLabel(modules) && (
              <div className="flex gap-2 rounded-md border border-secondary/40 bg-secondary/10 px-3 py-2 text-sm text-secondary">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Este código es largo para 60 mm y algunos lectores pueden no leerlo. Probá con uno más corto.</span>
              </div>
            )}

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="label-copies">Cantidad de etiquetas</Label>
                <Input
                  id="label-copies"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_LABEL_COPIES}
                  value={copies}
                  onChange={(e) => setCopies(e.target.value)}
                  onBlur={() => setCopies(String(clampCopies(copies)))}
                  className="w-24 text-center"
                />
              </div>
              {hasPrice && (
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="label-show-price">Mostrar el precio</Label>
                  <Switch id="label-show-price" checked={showPrice} onCheckedChange={setShowPrice} />
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          {code && (
            <Button className="gap-2" onClick={print} disabled={printing} data-testid="label-print">
              {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Imprimir {count > 1 ? `${count} etiquetas` : "etiqueta"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
