import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ShoppingBag, ShoppingCart, AlertTriangle, Trash2, Receipt } from "lucide-react";
import NewProductDialog from "@/components/NewProductDialog";
import SellProductDialog from "@/components/SellProductDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPYG } from "@/lib/orders";

type Product = {
  id: string;
  name: string;
  stock: number;
  min_stock_alert: number;
  cost_price: number;
  selling_price: number;
  image_url: string | null;
};

type Sale = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  payment_method: string | null;
  created_at: string;
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Products() {
  const { isAdmin } = useUserRole();
  const { companyId } = useCompany();
  const { isBusiness, isRetail, loading: planLoading } = usePlan();
  const hasExternalInventory = isBusiness || isRetail;
  if (!planLoading && !hasExternalInventory) return <Navigate to="/dashboard" replace />;

  const [items, setItems] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selling, setSelling] = useState<Product | null>(null);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: productsData, error: pErr }, { data: salesData, error: sErr }] = await Promise.all([
      (supabase as any)
        .from("inventory_items")
        .select("id, name, stock, min_stock_alert, cost_price, selling_price, image_url")
        .eq("company_id", companyId)
        .eq("is_for_sale", true)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("product_sales")
        .select("id, product_name, quantity, unit_price, payment_method, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (pErr) toast.error(pErr.message);
    else setItems((productsData ?? []) as Product[]);
    if (sErr) toast.error(sErr.message);
    else setSales((salesData ?? []) as Sale[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId]);

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    const { error } = await (supabase as any).from("inventory_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Producto eliminado");
    load();
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const outOfStockCount = items.filter((i) => i.stock <= 0).length;
  const lowStockCount = items.filter((i) => i.stock > 0 && i.stock <= i.min_stock_alert).length;

  const today = new Date();
  const salesToday = sales.filter((s) => isSameDay(new Date(s.created_at), today));
  const totalToday = salesToday.reduce((s, sale) => s + sale.quantity * Number(sale.unit_price || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <ShoppingBag className="h-6 w-6 text-primary" />
            Productos
          </h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de venta al público — separado de los repuestos de reparación.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo Producto
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total productos</div>
          <div className="mt-1 text-2xl font-bold">{items.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Sin / bajo stock</div>
          <div className="mt-1 flex items-center gap-2 text-2xl font-bold text-secondary">
            {outOfStockCount + lowStockCount}
            {outOfStockCount + lowStockCount > 0 && <AlertTriangle className="h-5 w-5" />}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Ventas de hoy</div>
          <div className="mt-1 text-2xl font-bold text-emerald-500">{formatPYG(totalToday)}</div>
          <div className="text-[11px] text-muted-foreground">{salesToday.length} venta{salesToday.length !== 1 ? "s" : ""}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Valor catálogo (costo)</div>
          <div className="mt-1 text-2xl font-bold">
            {formatPYG(items.reduce((s, i) => s + i.stock * Number(i.cost_price || 0), 0))}
          </div>
        </Card>
      </div>

      <Input
        placeholder="Buscar producto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Cargando...</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <ShoppingBag className="h-8 w-8" />
            Sin productos todavía.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => {
            const outOfStock = i.stock <= 0;
            const lowStock = !outOfStock && i.stock <= i.min_stock_alert;
            return (
              <Card
                key={i.id}
                className={cn(
                  "group h-full transition-all hover:shadow-elevated",
                  outOfStock ? "border-l-4 border-l-destructive" : lowStock ? "border-l-4 border-l-secondary" : "hover:border-primary/50"
                )}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {i.image_url ? (
                        <img src={i.image_url} alt={i.name} className="h-12 w-12 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                          <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-foreground">{i.name}</div>
                        <div className="text-sm font-medium text-primary">{formatPYG(i.selling_price)}</div>
                      </div>
                    </div>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" onClick={() => remove(i.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    {outOfStock ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Sin stock
                      </Badge>
                    ) : lowStock ? (
                      <Badge variant="outline" className="gap-1 border-secondary/40 text-secondary">
                        <AlertTriangle className="h-3 w-3" /> Bajo stock: {i.stock}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Stock: {i.stock}</span>
                    )}
                  </div>

                  <Button
                    className="w-full gap-2"
                    disabled={outOfStock}
                    onClick={() => setSelling(i)}
                  >
                    <ShoppingCart className="h-4 w-4" /> Vender
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Receipt className="h-4 w-4 text-primary" /> Ventas recientes
          </div>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no registraste ninguna venta.</p>
          ) : (
            <div className="space-y-1.5">
              {sales.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{s.product_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString("es-PY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {" · "}Cant: {s.quantity}
                      {s.payment_method ? ` · ${s.payment_method}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold text-foreground">
                    {formatPYG(s.quantity * Number(s.unit_price || 0))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewProductDialog open={open} onOpenChange={setOpen} onCreated={load} />
      <SellProductDialog
        open={!!selling}
        onOpenChange={(o) => !o && setSelling(null)}
        product={selling}
        onSold={load}
      />
    </div>
  );
}
