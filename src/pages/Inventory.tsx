import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Package, AlertTriangle, Trash2 } from "lucide-react";
import NewInventoryItemDialog from "@/components/NewInventoryItemDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { useCategories } from "@/hooks/useCategories";
import { useBranches } from "@/hooks/useBranches";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPYG } from "@/lib/orders";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Item = {
  id: string;
  name: string;
  category_id: string | null;
  subcategory_id: string | null;
  branch_id: string | null;
  stock: number;
  min_stock_alert: number;
  cost_price: number;
  selling_price: number;
  image_url: string | null;
};

const ALL_CATEGORIES = "__all__";
const ALL_BRANCHES = "__all__";

export default function Inventory() {
  // Todos los hooks van primero, sin condicionar — el early return de plan
  // va después de que todos los hooks ya se ejecutaron (Rules of Hooks).
  const { isAdmin } = useUserRole();
  const { companyId } = useCompany();
  const { isStarter, loading: planLoading } = usePlan();
  const { categories, subcategories } = useCategories();
  const { branches, hasMultipleBranches } = useBranches();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [branchFilter, setBranchFilter] = useState(ALL_BRANCHES);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("inventory_items")
      .select("id,name,category_id,subcategory_id,branch_id,stock,min_stock_alert,cost_price,selling_price,image_url")
      .eq("company_id", companyId)
      .eq("is_for_repair", true)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Item[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId]);

  const remove = async (item: Item) => {
    setDeleting(true);
    const { error } = await (supabase as any).from("inventory_items").delete().eq("id", item.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Artículo eliminado");
    setPendingDelete(null);
    load();
  };

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null;
  const subcategoryName = (id: string | null) => subcategories.find((s) => s.id === id)?.name ?? null;
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? null;

  const filtered = items.filter((i) => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      i.name.toLowerCase().includes(q) ||
      (categoryName(i.category_id) ?? "").toLowerCase().includes(q) ||
      (subcategoryName(i.subcategory_id) ?? "").toLowerCase().includes(q);
    const matchesCategory = categoryFilter === ALL_CATEGORIES || i.category_id === categoryFilter;
    const matchesBranch = branchFilter === ALL_BRANCHES || i.branch_id === branchFilter;
    return matchesSearch && matchesCategory && matchesBranch;
  });

  const lowStockCount = items.filter((i) => i.stock <= i.min_stock_alert).length;

  if (!planLoading && isStarter) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Package className="h-6 w-6 text-primary" />
            Inventario
          </h1>
          <p className="text-sm text-muted-foreground">Gestiona repuestos, accesorios y herramientas.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo Artículo
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total artículos</div>
          <div className="mt-1 text-2xl font-bold">{items.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Bajo stock</div>
          <div className="mt-1 flex items-center gap-2 text-2xl font-bold text-secondary">
            {lowStockCount}
            {lowStockCount > 0 && <AlertTriangle className="h-5 w-5" />}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Valor inventario (costo)</div>
          <div className="mt-1 text-2xl font-bold">
            {formatPYG(items.reduce((s, i) => s + i.stock * Number(i.cost_price || 0), 0))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Buscar por nombre o categoría..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>Todas las categorías</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {hasMultipleBranches && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_BRANCHES}>Todas las sucursales</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Sin artículos</div>
        ) : (
          <>
            {/* Mobile: tarjetas — la tabla de hasta 9 columnas no entra en un viewport chico */}
            <div className="space-y-2 sm:hidden">
              {filtered.map((i) => {
                const low = i.stock <= i.min_stock_alert;
                const cat = categoryName(i.category_id);
                const sub = subcategoryName(i.subcategory_id);
                return (
                  <div key={i.id} className={cn("rounded-lg border border-border bg-card p-3", low && "bg-secondary/5")}>
                    <div className="flex items-start gap-3">
                      {i.image_url ? (
                        <img src={i.image_url} alt={i.name} className="h-12 w-12 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="truncate font-medium text-foreground">{i.name}</div>
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="-mr-2 -mt-1 h-9 w-9 shrink-0"
                              onClick={() => setPendingDelete(i)}
                              aria-label={`Eliminar ${i.name}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {cat ? (
                            <>
                              <Badge variant="outline">{cat}</Badge>
                              {sub && <Badge variant="secondary" className="text-[10px]">{sub}</Badge>}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin categoría</span>
                          )}
                          {hasMultipleBranches && branchName(i.branch_id) && (
                            <span className="text-xs text-muted-foreground">· {branchName(i.branch_id)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-sm">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold",
                        low ? "bg-secondary/15 text-secondary border border-secondary/30" : "text-foreground"
                      )}>
                        {low && <AlertTriangle className="h-3 w-3" />}
                        Stock: {i.stock} <span className="font-normal text-muted-foreground">(mín. {i.min_stock_alert})</span>
                      </span>
                      <span className="text-muted-foreground">
                        {formatPYG(i.cost_price)} → <span className="font-medium text-foreground">{formatPYG(i.selling_price)}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop/tablet: tabla completa */}
            <div className="hidden overflow-x-auto sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imagen</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    {hasMultipleBranches && <TableHead>Sucursal</TableHead>}
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Mín.</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    {isAdmin && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => {
                    const low = i.stock <= i.min_stock_alert;
                    const cat = categoryName(i.category_id);
                    const sub = subcategoryName(i.subcategory_id);
                    return (
                      <TableRow key={i.id} className={cn(low && "bg-secondary/5")}>
                        <TableCell>
                          {i.image_url ? (
                            <img src={i.image_url} alt={i.name} className="h-10 w-10 rounded-md object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{i.name}</TableCell>
                        <TableCell>
                          {cat ? (
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant="outline">{cat}</Badge>
                              {sub && <Badge variant="secondary" className="text-[10px]">{sub}</Badge>}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin categoría</span>
                          )}
                        </TableCell>
                        {hasMultipleBranches && (
                          <TableCell className="text-muted-foreground">{branchName(i.branch_id) ?? "—"}</TableCell>
                        )}
                        <TableCell className="text-right">
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold",
                            low ? "bg-secondary/15 text-secondary border border-secondary/30" : "text-foreground"
                          )}>
                            {low && <AlertTriangle className="h-3 w-3" />}
                            {i.stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{i.min_stock_alert}</TableCell>
                        <TableCell className="text-right">{formatPYG(i.cost_price)}</TableCell>
                        <TableCell className="text-right">{formatPYG(i.selling_price)}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => setPendingDelete(i)} aria-label={`Eliminar ${i.name}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      <NewInventoryItemDialog open={open} onOpenChange={setOpen} onCreated={load} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="¿Eliminar artículo?"
        description={pendingDelete ? `Se eliminará "${pendingDelete.name}" del inventario. Esta acción no se puede deshacer.` : ""}
        loading={deleting}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
      />
    </div>
  );
}
