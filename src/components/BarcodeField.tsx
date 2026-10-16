import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { BARCODE_MAX_LENGTH } from "@/lib/barcode";
import { generateBarcode } from "@/lib/barcodeRemote";

/** Campo «Código de barras» de un artículo: se escanea con un lector USB/Bluetooth, se tipea, o se genera uno propio. */
export default function BarcodeField({
  id,
  value,
  onChange,
  companyId,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  companyId: string | null | undefined;
}) {
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!companyId) return;
    setGenerating(true);
    try {
      onChange(await generateBarcode(companyId));
    } catch (e: any) {
      toast.error(e.message || "No se pudo generar el código");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Código de barras (opcional)</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={BARCODE_MAX_LENGTH}
          autoComplete="off"
          placeholder="Escanealo o tipealo"
          className="font-mono"
        />
        {!value.trim() && (
          <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={generate} disabled={generating || !companyId}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanBarcode className="h-4 w-4" />}
            Generar
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Hacé clic acá y escaneá el código que trae el producto. Si no trae, tocá «Generar» y después imprimís la etiqueta.
      </p>
    </div>
  );
}
