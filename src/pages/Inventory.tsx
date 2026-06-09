import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Package, AlertTriangle, Trash2 } from "lucide-react";
import NewInventoryItemDialog from "@/components/NewInventoryItemDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPYG } from "@/lib/orders";

type Item = {
  id: string;
  name: string;
  category: "Repuesto" | "Accesorio" | "Herramienta";
  stock: number;
  min_stock_alert: number;
  cost_price: number;
  selling_price: number;
  image_url: string | null;
};

export default function Inventory() {
  const { isAdmin } = useUserRole();
  const { companyId } = useCompany();
  const { isStarter, loading: planLoading } = usePlan();
  if (!planLoading && isStarter) return <Navigate to="/dashboard" replace />;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("inventory_items")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Item[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId]);

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este artículo?")) return;
    const { error } = await (supabase as any).from("inventory_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Artículo eliminado");
    load();
  };

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = items.filter((i) => i.stock <= i.min_stock_alert).length;

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
        <Input
          placeholder="Buscar por nombre o categoría..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imagen</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Mín.</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                {isAdmin && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Sin artículos</TableCell></TableRow>
              ) : filtered.map((i) => {
                const low = i.stock <= i.min_stock_alert;
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
                      <Badge variant="outline">{i.category}</Badge>
                    </TableCell>
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
                        <Button size="icon" variant="ghost" onClick={() => remove(i.id)}>
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
      </Card>

      <NewInventoryItemDialog open={open} onOpenChange={setOpen} onCreated={load} />
    </div>
  );
}
