import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ShoppingBag, ShoppingCart, AlertTriangle, Trash2, Receipt, Printer } from "lucide-react";
import NewProductDialog from "@/components/NewProductDialog";
import CartSheet, { type Cart, type CompletedCartSale } from "@/components/CartSheet";
import QuantityStepper from "@/components/QuantityStepper";
import { SaleTicket } from "@/components/SaleTicket";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { useCategories } from "@/hooks/useCategories";
import { useBranches } from "@/hooks/useBranches";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPYG } from "@/lib/orders";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Product = {
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

type Sale = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  payment_method: string | null;
  created_at: string;
  branch_id: string | null;
  sale_group_id: string | null;
};

type SaleGroup = {
  key: string;
  items: Sale[];
  total: number;
  created_at: string;
  payment_method: string | null;
  branch_id: string | null;
};

const ALL_CATEGORIES = "__all__";
const ALL_BRANCHES = "__all__";
const CART_STORAGE_KEY = "f7_products_cart";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Products() {
  // Todos los hooks van primero, sin condicionar — el early return de plan
  // va después de que todos los hooks ya se ejecutaron (Rules of Hooks).
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { isBusiness, isRetail, loading: planLoading } = usePlan();
  const { categories, subcategories } = useCategories();
  const { branches, hasMultipleBranches } = useBranches();
  const [items, setItems] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [branchFilter, setBranchFilter] = useState(ALL_BRANCHES);
  const [cart, setCart] = useState<Cart>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Cart) : {};
    } catch {
      return {};
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [printingSale, setPrintingSale] = useState<CompletedCartSale | null>(null);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies").select("name").eq("id", companyId).maybeSingle()
      .then(({ data }) => setBusinessName(data?.name ?? null));
  }, [companyId]);

  useEffect(() => {
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch { /* ignore */ }
  }, [cart]);

  // Descarta del carrito guardado cualquier producto que ya no exista o se
  // haya dado de baja, para no arrastrar referencias fantasma entre sesiones.
  useEffect(() => {
    if (items.length === 0) return;
    setCart((prev) => {
      const validIds = new Set(items.map((i) => i.id));
      let changed = false;
      const next: Cart = {};
      for (const [id, line] of Object.entries(prev)) {
        if (validIds.has(id)) next[id] = line;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [items]);

  useEffect(() => {
    if (!printingSale) return;
    const t = window.setTimeout(() => window.print(), 80);
    return () => window.clearTimeout(t);
  }, [printingSale]);

  const hasExternalInventory = isBusiness || isRetail;

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: productsData, error: pErr }, { data: salesData, error: sErr }] = await Promise.all([
      (supabase as any)
        .from("inventory_items")
        .select("id, name, category_id, subcategory_id, branch_id, stock, min_stock_alert, cost_price, selling_price, image_url")
        .eq("company_id", companyId)
        .eq("is_for_sale", true)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("product_sales")
        .select("id, product_name, quantity, unit_price, payment_method, created_at, branch_id, sale_group_id")
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

  const remove = async (item: Product) => {
    setDeleting(true);
    const { error } = await (supabase as any).from("inventory_items").delete().eq("id", item.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Producto eliminado");
    setPendingDelete(null);
    load();
  };

  const addToCart = (item: Product) => {
    setCart((prev) => ({ ...prev, [item.id]: { quantity: 1, unitPrice: item.selling_price } }));
  };

  const updateCartQty = (item: Product, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) {
        const { [item.id]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [item.id]: { quantity: Math.min(qty, item.stock), unitPrice: prev[item.id]?.unitPrice ?? item.selling_price },
      };
    });
  };

  const cartCount = Object.values(cart).reduce((s, l) => s + l.quantity, 0);
  const cartTotal = Object.values(cart).reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null;
  const subcategoryName = (id: string | null) => subcategories.find((s) => s.id === id)?.name ?? null;

  const filtered = items.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === ALL_CATEGORIES || i.category_id === categoryFilter;
    const matchesBranch = branchFilter === ALL_BRANCHES || i.branch_id === branchFilter;
    return matchesSearch && matchesCategory && matchesBranch;
  });
  const outOfStockCount = items.filter((i) => i.stock <= 0).length;
  const lowStockCount = items.filter((i) => i.stock > 0 && i.stock <= i.min_stock_alert).length;

  const today = new Date();
  const salesToday = sales.filter((s) => isSameDay(new Date(s.created_at), today));
  const totalToday = salesToday.reduce((s, sale) => s + sale.quantity * Number(sale.unit_price || 0), 0);

  // Varias líneas de product_sales comparten sale_group_id cuando se
  // confirmaron juntas desde el carrito — se agrupan acá para que "Ventas
  // recientes" muestre una sola entrada por venta real, no una por producto.
  const saleGroups: SaleGroup[] = useMemo(() => {
    const map = new Map<string, Sale[]>();
    sales.forEach((s) => {
      const key = s.sale_group_id ?? s.id;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    });
    return Array.from(map.entries())
      .map(([key, groupItems]) => ({
        key,
        items: groupItems,
        total: groupItems.reduce((s, i) => s + i.quantity * Number(i.unit_price || 0), 0),
        created_at: groupItems[0].created_at,
        payment_method: groupItems[0].payment_method,
        branch_id: groupItems[0].branch_id,
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [sales]);

  if (!planLoading && !hasExternalInventory) return <Navigate to="/dashboard" replace />;

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
          <div className="mt-1 text-2xl font-bold text-success">{formatPYG(totalToday)}</div>
          <div className="text-[11px] text-muted-foreground">{salesToday.length} venta{salesToday.length !== 1 ? "s" : ""}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Valor catálogo (costo)</div>
          <div className="mt-1 text-2xl font-bold">
            {formatPYG(items.reduce((s, i) => s + i.stock * Number(i.cost_price || 0), 0))}
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar producto..."
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
            const cat = categoryName(i.category_id);
            const sub = subcategoryName(i.subcategory_id);
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
                      <Button size="icon" variant="ghost" onClick={() => setPendingDelete(i)} aria-label={`Eliminar ${i.name}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  {(cat || i.branch_id) && (
                    <div className="flex flex-wrap items-center gap-1">
                      {cat && <Badge variant="outline" className="text-[11px]">{cat}</Badge>}
                      {sub && <Badge variant="secondary" className="text-[10px]">{sub}</Badge>}
                      {hasMultipleBranches && i.branch_id && (
                        <Badge variant="secondary" className="text-[10px]">
                          {branches.find((b) => b.id === i.branch_id)?.name ?? "Sucursal"}
                        </Badge>
                      )}
                    </div>
                  )}

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

                  {cart[i.id] ? (
                    <div className="flex items-center justify-between gap-2">
                      <QuantityStepper
                        value={cart[i.id].quantity}
                        max={i.stock}
                        onChange={(q) => updateCartQty(i, q)}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        {formatPYG(cart[i.id].quantity * cart[i.id].unitPrice)}
                      </span>
                    </div>
                  ) : (
                    <Button
                      className="w-full gap-2"
                      disabled={outOfStock}
                      onClick={() => addToCart(i)}
                    >
                      <ShoppingCart className="h-4 w-4" /> Agregar
                    </Button>
                  )}
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
          {saleGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no registraste ninguna venta.</p>
          ) : (
            <div className="space-y-1.5">
              {saleGroups.map((g) => (
                <div key={g.key} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">
                      {g.items.length === 1 ? g.items[0].product_name : `${g.items.length} productos`}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {new Date(g.created_at).toLocaleString("es-PY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {g.items.length === 1
                        ? `Cant: ${g.items[0].quantity}`
                        : g.items.map((i) => i.product_name).join(", ")}
                      {g.payment_method ? ` · ${g.payment_method}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold text-foreground">{formatPYG(g.total)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10"
                      aria-label="Imprimir ticket"
                      onClick={() => setPrintingSale({
                        id: g.key,
                        created_at: g.created_at,
                        payment_method: g.payment_method,
                        branch_id: g.branch_id,
                        items: g.items.map((i) => ({ product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price })),
                      })}
                    >
                      <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {cartCount > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-20 left-4 right-4 z-40 flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-elevated transition-transform active:scale-[0.98] md:bottom-6 md:left-auto md:right-6 md:w-80"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="h-5 w-5" />
            {cartCount} {cartCount === 1 ? "producto" : "productos"}
          </span>
          <span className="font-bold">{formatPYG(cartTotal)}</span>
        </button>
      )}

      <NewProductDialog open={open} onOpenChange={setOpen} onCreated={load} />
      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        products={items}
        cart={cart}
        setCart={setCart}
        onSold={load}
        onPrintRequest={setPrintingSale}
      />

      {printingSale && (
        <SaleTicket
          sale={printingSale}
          businessName={businessName}
          branchName={branches.find((b) => b.id === printingSale.branch_id)?.name ?? null}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="¿Eliminar producto?"
        description={pendingDelete ? `Se eliminará "${pendingDelete.name}" del catálogo. Esta acción no se puede deshacer.` : ""}
        loading={deleting}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
      />
    </div>
  );
}
