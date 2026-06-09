import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Wrench, Plus, Trash2, Search, Loader2, PackagePlus, Package, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatPYG } from "@/lib/orders";
import { cn } from "@/lib/utils";

type Category = "Repuesto" | "Accesorio" | "Herramienta";
type Source = "inventory" | "external";

interface InventoryItem {
  id: string;
  name: string;
  stock: number;
  selling_price: number;
  cost_price: number;
  category: Category;
  branch_id: string | null;
}

interface OrderPart {
  id: string;
  inventory_item_id: string | null;
  quantity: number;
  historical_cost: number | null;
  historical_selling_price: number | null;
  supplier_name: string | null;
  part_details: string | null;
  inventory_items?: { name: string; selling_price: number; stock: number } | null;
}

export default function OrderPartsSection({
  orderId,
  branchId,
}: {
  orderId: string;
  branchId: string | null;
}) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [parts, setParts] = useState<OrderPart[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const PARTS_DRAFT_KEY = `f7_order_parts_draft_${orderId}`;
  const _partsDraft = (() => {
    try {
      const raw = localStorage.getItem(PARTS_DRAFT_KEY);
      return raw ? JSON.parse(raw) as { source?: Source; supplierName?: string; partDetails?: string; extCost?: string } : null;
    } catch { return null; }
  })();
  const [source, setSource] = useState<Source>(_partsDraft?.source ?? "inventory");

  // external supplier form
  const [supplierName, setSupplierName] = useState(_partsDraft?.supplierName ?? "");
  const [partDetails, setPartDetails] = useState(_partsDraft?.partDetails ?? "");
  const [extCost, setExtCost] = useState(_partsDraft?.extCost ?? "");
  const [savingExt, setSavingExt] = useState(false);

  // Auto-save external supplier draft on every change (per-order key)
  useEffect(() => {
    try {
      localStorage.setItem(PARTS_DRAFT_KEY, JSON.stringify({ source, supplierName, partDetails, extCost }));
    } catch { /* ignore */ }
  }, [source, supplierName, partDetails, extCost, PARTS_DRAFT_KEY]);

  // create form
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("Repuesto");
  const [newStock, setNewStock] = useState("1");
  const [newCost, setNewCost] = useState("0");
  const [newPrice, setNewPrice] = useState("0");
  const [creating, setCreating] = useState(false);

  const loadItems = async () => {
    if (!companyId) return;
    let q = (supabase as any)
      .from("inventory_items")
      .select("id,name,stock,selling_price,cost_price,category,branch_id")
      .eq("company_id", companyId)
      .order("name");
    if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`);
    const { data } = await q;
    setItems((data ?? []) as InventoryItem[]);
  };

  const loadParts = async () => {
    const { data } = await (supabase as any)
      .from("order_parts")
      .select("id, inventory_item_id, quantity, historical_cost, historical_selling_price, supplier_name, part_details, inventory_items(name, selling_price, stock)")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    setParts((data ?? []) as OrderPart[]);
  };

  useEffect(() => {
    loadItems();
    loadParts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, companyId, branchId]);

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const addPart = async (item: InventoryItem) => {
    if (!user) return;
    if (item.stock <= 0) {
      toast({ title: "Sin stock", description: "Este artículo no tiene stock disponible.", variant: "destructive" });
      return;
    }
    setAdding(item.id);
    try {
      const { error: insErr } = await (supabase as any).from("order_parts").insert({
        order_id: orderId,
        inventory_item_id: item.id,
        quantity: 1,
        historical_cost: item.cost_price ?? 0,
        historical_selling_price: item.selling_price ?? 0,
        created_by: user.id,
      });
      if (insErr) throw insErr;
      const { error: updErr } = await (supabase as any)
        .from("inventory_items")
        .update({ stock: item.stock - 1 })
        .eq("id", item.id);
      if (updErr) throw updErr;
      toast({ title: "Repuesto agregado", description: `${item.name} (-1 stock)` });
      setQuery("");
      setOpen(false);
      await Promise.all([loadItems(), loadParts()]);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAdding(null);
    }
  };

  const removePart = async (part: OrderPart) => {
    try {
      // External supplier parts have no inventory item; skip stock restitution
      if (!part.inventory_item_id) {
        const { error: delErr } = await (supabase as any)
          .from("order_parts")
          .delete()
          .eq("id", part.id);
        if (delErr) throw delErr;
        toast({ title: "Repuesto removido" });
        await loadParts();
        return;
      }
      const { data: inv } = await (supabase as any)
        .from("inventory_items")
        .select("stock")
        .eq("id", part.inventory_item_id)
        .maybeSingle();
      const currentStock = inv?.stock ?? 0;
      const { error: delErr } = await (supabase as any)
        .from("order_parts")
        .delete()
        .eq("id", part.id);
      if (delErr) throw delErr;
      await (supabase as any)
        .from("inventory_items")
        .update({ stock: currentStock + part.quantity })
        .eq("id", part.inventory_item_id);
      toast({ title: "Repuesto removido", description: "Stock restituido." });
      await Promise.all([loadItems(), loadParts()]);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const addExternalPart = async () => {
    if (!user) return;
    const cost = parseFloat(extCost);
    if (!supplierName.trim() || !partDetails.trim() || !Number.isFinite(cost) || cost < 0) {
      toast({ title: "Completá los campos", description: "Proveedor, detalles y costo son requeridos.", variant: "destructive" });
      return;
    }
    setSavingExt(true);
    try {
      const { error } = await (supabase as any).from("order_parts").insert({
        order_id: orderId,
        inventory_item_id: null,
        quantity: 1,
        historical_cost: cost,
        historical_selling_price: cost,
        supplier_name: supplierName.trim(),
        part_details: partDetails.trim(),
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: "Repuesto externo agregado", description: `${supplierName.trim()} · ${formatPYG(cost)}` });
      setSupplierName(""); setPartDetails(""); setExtCost("");
      try { localStorage.removeItem(PARTS_DRAFT_KEY); } catch {}
      await loadParts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingExt(false);
    }
  };

  const openCreateFromQuery = () => {
    setNewName(query);
    setCreateOpen(true);
    setOpen(false);
  };

  const submitCreate = async () => {
    if (!user || !companyId) return;
    if (!newName.trim()) {
      toast({ title: "Ingresa un nombre", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data: inserted, error } = await (supabase as any)
        .from("inventory_items")
        .insert({
          company_id: companyId,
          branch_id: branchId,
          name: newName.trim(),
          category: newCategory,
          stock: parseInt(newStock) || 0,
          min_stock_alert: 0,
          cost_price: parseFloat(newCost) || 0,
          selling_price: parseFloat(newPrice) || 0,
          created_by: user.id,
        })
        .select("id,name,stock,selling_price,cost_price,category,branch_id")
        .single();
      if (error) throw error;
      toast({ title: "Artículo creado" });
      setCreateOpen(false);
      setNewName(""); setNewCategory("Repuesto"); setNewStock("1"); setNewCost("0"); setNewPrice("0");
      await loadItems();
      // Auto-add to the order if there's stock
      if (inserted && (inserted as InventoryItem).stock > 0) {
        await addPart(inserted as InventoryItem);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Wrench className="h-4 w-4 text-primary" /> Repuestos utilizados
        </div>

        {/* Segmented control: source */}
        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setSource("inventory")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
              source === "inventory"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Package className="h-3.5 w-3.5" /> Desde Inventario
          </button>
          <button
            type="button"
            onClick={() => setSource("external")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
              source === "external"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Truck className="h-3.5 w-3.5" /> Proveedor Externo
          </button>
        </div>

        {source === "inventory" ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Agregar repuesto del inventario
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar repuesto..."
                  className="h-8 border-0 bg-transparent p-0 focus-visible:ring-0"
                />
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <div className="space-y-2 p-2">
                    <p className="text-sm text-muted-foreground">
                      No se encontró ningún artículo{query ? ` para "${query}"` : ""}.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={openCreateFromQuery}
                      className="w-full gap-2"
                    >
                      <PackagePlus className="h-4 w-4" /> Crear nuevo repuesto
                    </Button>
                  </div>
                ) : (
                  <>
                    {filtered.map((it) => {
                      const low = it.stock <= 0;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          disabled={low || adding === it.id}
                          onClick={() => addPart(it)}
                          className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">{it.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatPYG(it.selling_price)}
                            </div>
                          </div>
                          <span
                            className={
                              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
                              (low
                                ? "bg-destructive/10 text-destructive"
                                : "bg-primary/10 text-primary")
                            }
                          >
                            Stock: {it.stock}
                          </span>
                        </button>
                      );
                    })}
                    <div className="border-t border-border p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={openCreateFromQuery}
                        className="w-full justify-start gap-2 text-primary"
                      >
                        <PackagePlus className="h-4 w-4" /> Crear nuevo repuesto
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
            <div className="grid gap-2">
              <Label className="text-xs">Nombre del Proveedor</Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Celdosh, Mundo Celular..."
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Calidad / Detalles</Label>
              <Input
                value={partDetails}
                onChange={(e) => setPartDetails(e.target.value)}
                placeholder="Original OEM, Calidad AAA, Con Marco..."
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Precio de Costo (Gs.)</Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={extCost}
                onChange={(e) => setExtCost(e.target.value)}
                placeholder="0"
              />
            </div>
            <Button
              type="button"
              onClick={addExternalPart}
              disabled={savingExt}
              className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {savingExt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Agregar repuesto externo
            </Button>
          </div>
        )}

        {parts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aún no se utilizaron repuestos para esta orden.
          </p>
        ) : (
          <div className="space-y-2">
            {parts.map((p) => {
              const isExternal = !p.inventory_item_id;
              const lineTotal = isExternal
                ? Number(p.historical_selling_price ?? 0) * p.quantity
                : (p.inventory_items?.selling_price ?? 0) * p.quantity;
              const title = isExternal
                ? (p.supplier_name ?? "Proveedor externo")
                : (p.inventory_items?.name ?? "Artículo eliminado");
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{title}</span>
                      {isExternal && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Externo
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isExternal && p.part_details ? `${p.part_details} · ` : ""}
                      Cant: {p.quantity} · {formatPYG(lineTotal)}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removePart(p)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>


      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo repuesto rápido</DialogTitle>
            <DialogDescription>
              Se guardará en el inventario de la sucursal actual.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Categoría</Label>
                <Select value={newCategory} onValueChange={(v) => setNewCategory(v as Category)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Repuesto">Repuesto</SelectItem>
                    <SelectItem value="Accesorio">Accesorio</SelectItem>
                    <SelectItem value="Herramienta">Herramienta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Stock inicial</Label>
                <Input type="number" min={0} value={newStock} onChange={(e) => setNewStock(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Costo (Gs.)</Label>
                <Input type="number" min={0} step="1" value={newCost} onChange={(e) => setNewCost(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Precio venta (Gs.)</Label>
                <Input type="number" min={0} step="1" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={submitCreate} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear y agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
