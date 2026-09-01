import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useCategories } from "@/hooks/useCategories";
import { useBranches } from "@/hooks/useBranches";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { Loader2, FolderPlus, Camera, Upload, X } from "lucide-react";
import { CameraCapture } from "@/components/CameraCapture";
import { sanitizeFilenameForStorage } from "@/lib/utils";

const CREATE_CATEGORY = "__create_category__";
const CREATE_SUBCATEGORY = "__create_subcategory__";
const NO_SUBCATEGORY = "__none__";

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
  const { categories, subcategoriesFor, reload: reloadCategories } = useCategories();
  const { branches, userBranchId, hasMultipleBranches } = useBranches();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [stock, setStock] = useState("0");
  const [minAlert, setMinAlert] = useState("0");
  const [cost, setCost] = useState("0");
  const [price, setPrice] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraTriggerRef = useRef<HTMLButtonElement>(null);
  // Mismo fix que en Nueva orden: el overlay de cámara vive en un portal
  // aparte y, en touch real de Android, Radix puede disparar un segundo
  // onOpenChange(false) tardío (ya con cameraOpen en false) que cierra el
  // Dialog entero. Se devuelve el foco al botón "Cámara" y se sostiene el
  // bloqueo con un ref durante un margen breve para absorberlo.
  const suppressCloseRef = useRef(false);
  const closeCamera = () => {
    suppressCloseRef.current = true;
    cameraTriggerRef.current?.focus();
    setCameraOpen(false);
    window.setTimeout(() => { suppressCloseRef.current = false; }, 600);
  };

  const [newCatName, setNewCatName] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState<string | null>(null);
  const [savingTaxonomy, setSavingTaxonomy] = useState(false);

  const reset = () => {
    setName(""); setCategoryId(null); setSubcategoryId(null); setBranchId(null);
    setStock("0"); setMinAlert("0"); setCost("0"); setPrice("0"); setFile(null); setPreview(null);
  };

  const onFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const createCategory = async () => {
    if (!newCatName?.trim() || !companyId) return;
    setSavingTaxonomy(true);
    const { data, error } = await supabase
      .from("inventory_categories")
      .insert({ company_id: companyId, name: newCatName.trim() })
      .select("id")
      .single();
    setSavingTaxonomy(false);
    if (error) { toast.error(error.message); return; }
    await reloadCategories();
    setCategoryId((data as any).id);
    setSubcategoryId(null);
    setNewCatName(null);
  };

  const createSubcategory = async () => {
    if (!newSubName?.trim() || !companyId || !categoryId) return;
    setSavingTaxonomy(true);
    const { data, error } = await supabase
      .from("inventory_subcategories")
      .insert({ company_id: companyId, category_id: categoryId, name: newSubName.trim() })
      .select("id")
      .single();
    setSavingTaxonomy(false);
    if (error) { toast.error(error.message); return; }
    await reloadCategories();
    setSubcategoryId((data as any).id);
    setNewSubName(null);
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
        const path = `${companyId}/${crypto.randomUUID()}-${sanitizeFilenameForStorage(compressed.name)}`;
        const { error: upErr } = await supabase.storage
          .from("inventory-images")
          .upload(path, compressed, { contentType: compressed.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("inventory-images").getPublicUrl(path);
        image_url = data.publicUrl;
      }

      const { error } = await (supabase as any).from("inventory_items").insert({
        company_id: companyId,
        branch_id: branchId,
        name: name.trim(),
        category_id: categoryId,
        subcategory_id: subcategoryId,
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
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (cameraOpen || suppressCloseRef.current) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
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
              {newCatName !== null ? (
                <div className="flex gap-1">
                  <Input autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nombre" />
                  <Button size="sm" onClick={createCategory} disabled={savingTaxonomy || !newCatName.trim()}>
                    {savingTaxonomy ? <Loader2 className="h-4 w-4 animate-spin" /> : "OK"}
                  </Button>
                </div>
              ) : (
                <Select
                  value={categoryId ?? ""}
                  onValueChange={(v) => {
                    if (v === CREATE_CATEGORY) { setNewCatName(""); return; }
                    setCategoryId(v || null);
                    setSubcategoryId(null);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    <SelectItem value={CREATE_CATEGORY} className="text-primary">
                      <span className="flex items-center gap-1.5"><FolderPlus className="h-3.5 w-3.5" /> Nueva categoría...</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Stock</Label>
              <Input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>

          {categoryId && (
            <div className="grid gap-2">
              <Label>Subcategoría (opcional)</Label>
              {newSubName !== null ? (
                <div className="flex gap-1">
                  <Input autoFocus value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder="Nombre" />
                  <Button size="sm" onClick={createSubcategory} disabled={savingTaxonomy || !newSubName.trim()}>
                    {savingTaxonomy ? <Loader2 className="h-4 w-4 animate-spin" /> : "OK"}
                  </Button>
                </div>
              ) : (
                <Select
                  value={subcategoryId ?? NO_SUBCATEGORY}
                  onValueChange={(v) => {
                    if (v === CREATE_SUBCATEGORY) { setNewSubName(""); return; }
                    setSubcategoryId(v === NO_SUBCATEGORY ? null : v);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Sin subcategoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SUBCATEGORY}>Sin subcategoría</SelectItem>
                    {subcategoriesFor(categoryId).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    <SelectItem value={CREATE_SUBCATEGORY} className="text-primary">
                      <span className="flex items-center gap-1.5"><FolderPlus className="h-3.5 w-3.5" /> Nueva subcategoría...</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {hasMultipleBranches && (
            <div className="grid gap-2">
              <Label>Sucursal</Label>
              <Select value={branchId ?? userBranchId ?? ""} onValueChange={(v) => setBranchId(v || null)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar sucursal" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

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
            {preview && (
              <div className="relative h-20 w-20">
                <img src={preview} alt="preview" className="h-full w-full rounded-md border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => onFile(null)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                  aria-label="Quitar imagen"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted">
                <Upload className="h-4 w-4" />
                Galería
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <button
                ref={cameraTriggerRef}
                type="button"
                onClick={() => setCameraOpen(true)}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted"
              >
                <Camera className="h-4 w-4" />
                Cámara
              </button>
            </div>
            {compressing && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Comprimiendo imagen...
              </span>
            )}
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
      {cameraOpen && (
        <CameraCapture onClose={closeCamera} onCapture={(files) => onFile(files[0] ?? null)} />
      )}
    </Dialog>
  );
}
