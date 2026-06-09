import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { Loader2, ImagePlus } from "lucide-react";

type Category = "Repuesto" | "Accesorio" | "Herramienta";

export default function NewInventoryItemDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Repuesto");
  const [stock, setStock] = useState("0");
  const [minAlert, setMinAlert] = useState("0");
  const [cost, setCost] = useState("0");
  const [price, setPrice] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const reset = () => {
    setName(""); setCategory("Repuesto"); setStock("0"); setMinAlert("0");
    setCost("0"); setPrice("0"); setFile(null); setPreview(null);
  };

  const onFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    if (!user || !companyId) return;
    if (!name.trim()) { toast.error("Ingresa un nombre"); return; }
    setLoading(true);
    try {
      let image_url: string | null = null;
      if (file) {
        setCompressing(true);
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 800,
          useWebWorker: true,
        });
        setCompressing(false);
        const path = `${companyId}/${crypto.randomUUID()}-${compressed.name}`;
        const { error: upErr } = await supabase.storage
          .from("inventory-images")
          .upload(path, compressed, { contentType: compressed.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("inventory-images").getPublicUrl(path);
        image_url = data.publicUrl;
      }

      const { error } = await (supabase as any).from("inventory_items").insert({
        company_id: companyId,
        name: name.trim(),
        category,
        stock: parseInt(stock) || 0,
        min_stock_alert: parseInt(minAlert) || 0,
        cost_price: parseFloat(cost) || 0,
        selling_price: parseFloat(price) || 0,
        image_url,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Artículo creado");
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || "Error al crear el artículo");
    } finally {
      setLoading(false);
      setCompressing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Artículo</DialogTitle>
          <DialogDescription>Agrega un repuesto, accesorio o herramienta al inventario.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Pantalla iPhone 12" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Repuesto">Repuesto</SelectItem>
                  <SelectItem value="Accesorio">Accesorio</SelectItem>
                  <SelectItem value="Herramienta">Herramienta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Stock</Label>
              <Input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Alerta mín.</Label>
              <Input type="number" min={0} value={minAlert} onChange={(e) => setMinAlert(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Costo (Gs.)</Label>
              <Input type="number" min={0} step="1" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Gs. 0" />
            </div>
            <div className="grid gap-2">
              <Label>Precio venta (Gs.)</Label>
              <Input type="number" min={0} step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Gs. 0" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Imagen (opcional)</Label>
            <div className="flex items-center gap-3">
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30 hover:bg-muted/50">
                {preview ? (
                  <img src={preview} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {compressing && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Comprimiendo imagen...
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
