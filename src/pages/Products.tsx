import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ShoppingBag, ShoppingCart, AlertTriangle, Trash2, Printer, EyeOff, Pencil, Smartphone, MessageCircle, HandCoins, BatteryMedium, CalendarClock } from "lucide-react";
import NewProductDialog from "@/components/NewProductDialog";
import BuyDeviceDialog, { type BuyDestination } from "@/components/BuyDeviceDialog";
import DevicesHub from "@/components/DevicesHub";
import ScrapDevicesPanel from "@/components/ScrapDevicesPanel";
import ExtractPartDialog from "@/components/ExtractPartDialog";
import { useScrapDevices } from "@/hooks/useScrapDevices";
import {
  CATALOG_FILTER_EMPTY,
  CATALOG_FILTER_LABEL,
  hasDeviceActivity,
  matchesDataFilter,
  type CatalogFilter,
  type HubAlertTarget,
} from "@/lib/devicesHub";
import ReserveDeviceDialog from "@/components/ReserveDeviceDialog";
import CancelReservationDialog from "@/components/CancelReservationDialog";
import ExtendReservationDialog from "@/components/ExtendReservationDialog";
import ReservationsPanel from "@/components/ReservationsPanel";
import { useDeviceReservations } from "@/hooks/useDeviceReservations";
import { openWhatsApp, toWhatsAppPhone } from "@/lib/whatsapp";
import { buildReservationMessage, expiryText, isOverdue, type DeviceReservation } from "@/lib/reservations";
import { printPurchaseReceipt } from "@/lib/devicePurchaseReceipt";
import type { DevicePurchaseRecord } from "@/lib/devicePurchase";
import { depositOfSale, tradeInOfSale } from "@/lib/tradeIn";
import { buildPriceList } from "@/lib/priceList";
import { batteryLabel, isLowBattery } from "@/lib/deviceSpecs";
import { STALE_DEVICE_DAYS, daysInStock, daysInStockLabel, hasDevicesInStock, isStaleDevice, staleDeviceSummary } from "@/lib/deviceStock";
import ProductPreviewDialog from "@/components/ProductPreviewDialog";
import DeviceDossierDialog from "@/components/DeviceDossierDialog";
import CartSheet, { type Cart, type CompletedCartSale } from "@/components/CartSheet";
import QuantityStepper from "@/components/QuantityStepper";
import { printTicket } from "@/components/SaleTicket";
import EnviarReciboDialog from "@/components/EnviarReciboDialog";
import WarrantyLookup from "@/components/WarrantyLookup";
import { useUserRole } from "@/hooks/useUserRole";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
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

export type Product = {
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
  is_device: boolean;
  imei: string | null;
  purchase_cost: number;
  repair_cost: number;
  repair_details: string | null;
  notes: string | null;
  battery_health?: number | null;
  origin?: string | null;
  min_price?: number | null;
  created_at?: string;
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
  trade_in_value: number | null;
  reservation_deposit: number | null;
  imei: string | null;
  warranty_days: number | null;
  customer_name: string | null;
  customer_phone: string | null;
};

type SaleGroup = {
  key: string;
  items: Sale[];
  total: number;
  created_at: string;
  payment_method: string | null;
  branch_id: string | null;
  tradeInValue: number;
  depositValue: number;
  customerName: string | null;
  customerPhone: string | null;
};

const ALL_BRANCHES = "__all__";
const NO_CATEGORY_KEY = "__sin_categoria__";
const CART_STORAGE_KEY = "f7_products_cart";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Products() {
  // Todos los hooks van primero, sin condicionar — el early return de plan
  // va después de que todos los hooks ya se ejecutaron (Rules of Hooks).
  const { isAdmin } = useUserRole();
  const { canViewStock, canViewProducts, loading: staffPermsLoading } = useStaffPermissions();
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { isBusiness, isRetail, loading: planLoading } = usePlan();
  const { categories, subcategories, reload: reloadCategories } = useCategories();
  const { branches, hasMultipleBranches } = useBranches();
  const [items, setItems] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [previewItem, setPreviewItem] = useState<Product | null>(null);
  const [dossierItem, setDossierItem] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState(ALL_BRANCHES);
  const [stockFilter, setStockFilter] = useState<CatalogFilter>("all");
  const [activeTab, setActiveTab] = useState("catalogo");
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
  const [ticketWidthMm, setTicketWidthMm] = useState(80);
  const [receiptSale, setReceiptSale] = useState<CompletedCartSale | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyDestination, setBuyDestination] = useState<BuyDestination>("reventa");
  const [registerAsDevice, setRegisterAsDevice] = useState(false);
  const [extractId, setExtractId] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<DevicePurchaseRecord[]>([]);
  const { devices: scrapDevices, totals: scrapSummary, loaded: scrapLoaded, reload: reloadScrap } = useScrapDevices();
  const { reservations, activeByItem, loaded: reservationsLoaded, reload: reloadReservations } = useDeviceReservations();
  const [reserveItem, setReserveItem] = useState<Product | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DeviceReservation | null>(null);
  const [extendTarget, setExtendTarget] = useState<DeviceReservation | null>(null);
  const activeReservations = useMemo(() => reservations.filter((r) => r.status === "activa"), [reservations]);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies").select("name, ticket_width_mm").eq("id", companyId).maybeSingle()
      .then(({ data }) => {
        setBusinessName(data?.name ?? null);
        setTicketWidthMm(data?.ticket_width_mm ?? 80);
      });
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

  // Una línea del carrito que viene de una reserva deja de valer cuando la reserva
  // se cancela o se vende desde otro lado: se saca para no cobrar con una seña fantasma.
  useEffect(() => {
    if (!reservationsLoaded) return;
    setCart((prev) => {
      const activeIds = new Set(activeReservations.map((r) => r.id));
      let changed = false;
      const next: Cart = {};
      for (const [id, line] of Object.entries(prev)) {
        if (line.reservationId && !activeIds.has(line.reservationId)) changed = true;
        else next[id] = line;
      }
      return changed ? next : prev;
    });
  }, [reservationsLoaded, activeReservations]);

  // El ticket se imprime en un documento aislado (ver printTicket): así el
  // trabajo de impresión contiene solo la imagen del ticket, sin el CSS de la
  // app que lo reescalaba y lo repetía en cada página.
  const handlePrintSale = (sale: CompletedCartSale) => {
    printTicket(sale, {
      businessName,
      branchName: branches.find((b) => b.id === sale.branch_id)?.name ?? null,
      widthMm: ticketWidthMm,
    });
  };

  const tradeInDeviceName = (saleGroupId: string) =>
    purchases.find((p) => p.kind === "canje" && p.sale_group_id === saleGroupId)?.device_name ?? "Equipo recibido";

  const toCompletedSale = (g: SaleGroup): CompletedCartSale => ({
    id: g.key,
    created_at: g.created_at,
    payment_method: g.payment_method,
    branch_id: g.branch_id,
    items: g.items.map((i) => ({
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      imei: i.imei,
      warranty_days: i.warranty_days,
    })),
    trade_in: g.tradeInValue > 0 ? { device_name: tradeInDeviceName(g.key), value: g.tradeInValue } : null,
    deposit: g.depositValue > 0 ? g.depositValue : null,
    customer_name: g.customerName,
    customer_phone: g.customerPhone,
  });

  const handleReceiptSale = (sale: CompletedCartSale) => {
    setReceiptSale(sale);
    setReceiptOpen(true);
  };

  const hasExternalInventory = isBusiness || isRetail;

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: productsData, error: pErr }, { data: salesData, error: sErr }] = await Promise.all([
      (supabase as any)
        .from("inventory_items")
        .select("id, name, category_id, subcategory_id, branch_id, stock, min_stock_alert, cost_price, selling_price, image_url, is_device, imei, battery_health, origin, min_price, purchase_cost, repair_cost, repair_details, notes, created_at")
        .eq("company_id", companyId)
        .eq("is_for_sale", true)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("product_sales")
        .select("id, product_name, quantity, unit_price, trade_in_value, reservation_deposit, payment_method, created_at, branch_id, sale_group_id, imei, warranty_days, customer_name, customer_phone")
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

  const loadPurchases = async () => {
    if (!companyId) return;
    const { data, error } = await (supabase as any)
      .from("device_purchases")
      .select("id, receipt_number, created_at, branch_id, device_name, imei, battery_health, seller_name, seller_cedula, seller_phone, purchase_price, payment_method, reason, checklist, accessories, notes, kind, sale_group_id")
      .eq("company_id", companyId)
      // Las compras para piezas viven en la pestaña Chatarra; así no gastan el tope de 50 de esta lista.
      .neq("kind", "piezas")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return toast.error(error.message);
    setPurchases(((data ?? []) as DevicePurchaseRecord[]).map((p) => ({ ...p, purchase_price: Number(p.purchase_price) })));
  };

  useEffect(() => { loadPurchases(); }, [companyId]);

  const handlePurchaseRegistered = () => { load(); loadPurchases(); void reloadReservations(); void reloadScrap(); };

  const openBuy = (destination: BuyDestination) => { setBuyDestination(destination); setBuyOpen(true); };
  const openRegisterDevice = () => { setEditItem(null); setRegisterAsDevice(true); setOpen(true); };

  const handlePrintPurchase = (record: DevicePurchaseRecord) => {
    printPurchaseReceipt(record, {
      businessName,
      branchName: hasMultipleBranches ? branches.find((b) => b.id === record.branch_id)?.name ?? null : null,
    });
  };

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
    const reservation = activeByItem.get(item.id);
    if (reservation) {
      toast.error(`«${item.name}» está reservado para ${reservation.customer_name}. Vendelo desde la reserva.`);
      return;
    }
    setCart((prev) => ({ ...prev, [item.id]: { quantity: 1, unitPrice: item.selling_price } }));
  };

  // Un equipo reservado entra al carrito al precio acordado y con su reserva atada:
  // al confirmar, la seña ya cobrada se descuenta de lo que paga el cliente.
  const sellReservation = (r: DeviceReservation) => {
    const item = items.find((i) => i.id === r.inventory_item_id);
    if (!item) {
      toast.error("El equipo de esta reserva ya no está en el catálogo.");
      return;
    }
    setCart((prev) => ({ ...prev, [item.id]: { quantity: 1, unitPrice: Number(r.agreed_price), reservationId: r.id } }));
    setPreviewItem(null);
    setCartOpen(true);
  };

  const updateCartQty = (item: Product, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) {
        const { [item.id]: _removed, ...rest } = prev;
        return rest;
      }
      const prevLine = prev[item.id];
      return {
        ...prev,
        [item.id]: { ...prevLine, quantity: Math.min(qty, item.stock), unitPrice: prevLine?.unitPrice ?? item.selling_price },
      };
    });
  };

  const branchNameOf = (id: string | null) => (id ? branches.find((b) => b.id === id)?.name ?? null : null);

  const reservationWhatsApp = (r: DeviceReservation) => {
    const phone = toWhatsAppPhone(r.customer_phone);
    if (!phone) { toast.error("El teléfono de esta reserva no es válido para WhatsApp."); return; }
    openWhatsApp(phone, buildReservationMessage(r, { businessName, branchName: hasMultipleBranches ? branchNameOf(r.branch_id) : null }));
  };

  const cartCount = Object.values(cart).reduce((s, l) => s + l.quantity, 0);
  const cartTotal = Object.values(cart).reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null;
  const subcategoryName = (id: string | null) => subcategories.find((s) => s.id === id)?.name ?? null;

  const now = new Date();
  const isSearching = search.trim().length > 0;
  const isLowOrOutOfStock = (i: Product) => i.stock <= 0 || i.stock <= i.min_stock_alert;

  const filtered = items.filter((i) => {
    const q = search.toLowerCase();
    const matchesSearch = i.name.toLowerCase().includes(q) || (!!i.imei && i.imei.includes(search.trim()));
    const matchesBranch = branchFilter === ALL_BRANCHES || i.branch_id === branchFilter;
    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "low"
        ? isLowOrOutOfStock(i)
        : stockFilter === "stale"
          ? isStaleDevice(i, now)
          : matchesDataFilter(i, stockFilter));
    return matchesSearch && matchesBranch && matchesStock;
  });
  const outOfStockCount = items.filter((i) => i.stock <= 0).length;
  const lowStockCount = items.filter((i) => i.stock > 0 && i.stock <= i.min_stock_alert).length;
  const showDeviceAging = canViewStock && hasDevicesInStock(items);
  const staleSummary = staleDeviceSummary(items, now);

  const copyPriceList = async () => {
    const list = buildPriceList({
      items: filtered.map((i) => ({ ...i, reserved: activeByItem.has(i.id) })),
      categoryName,
      businessName,
      branchName: hasMultipleBranches && branchFilter !== ALL_BRANCHES ? branches.find((b) => b.id === branchFilter)?.name : null,
    });
    if (list.included === 0) {
      toast.error("No hay artículos con stock y precio de venta para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(list.text);
      const skipped = [
        list.withoutStock > 0 ? `${list.withoutStock} sin stock` : null,
        list.withoutPrice > 0 ? `${list.withoutPrice} sin precio` : null,
        list.reserved > 0 ? `${list.reserved} reservado${list.reserved !== 1 ? "s" : ""}` : null,
      ].filter(Boolean);
      toast.success(`Lista copiada: ${list.included} artículo${list.included !== 1 ? "s" : ""}`, {
        description: skipped.length > 0 ? `Quedaron afuera: ${skipped.join(", ")}. Pegala en WhatsApp.` : "Pegala en WhatsApp.",
      });
    } catch {
      toast.error("No se pudo copiar: el navegador no permitió acceder al portapapeles.");
    }
  };

  const toggleStockFilter = () => {
    setActiveTab("catalogo");
    setStockFilter((f) => (f === "low" ? "all" : "low"));
  };

  const toggleStaleFilter = () => {
    setActiveTab("catalogo");
    setStockFilter((f) => (f === "stale" ? "all" : "stale"));
  };

  const showDevicesHub = hasDeviceActivity({
    items,
    purchaseCount: purchases.length + scrapSummary.count,
    reservationCount: reservations.length,
  });
  const extractDevice = scrapDevices.find((d) => d.purchase.id === extractId) ?? null;

  const goToAlert = (target: HubAlertTarget) => {
    setActiveTab(target.tab);
    if (target.tab === "catalogo") setStockFilter(target.filter);
  };

  // Mientras no se esté buscando ni filtrando por stock, se agrupa por
  // categoría en secciones desplegables — con catálogos grandes, una sola
  // grilla plana se vuelve interminable para escanear. Al buscar o filtrar
  // se vuelve a la grilla plana: ver el resultado ya filtrado adentro de un
  // acordeón que hay que abrir a mano sería peor, no mejor.
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, { label: string; items: Product[] }>();
    for (const p of filtered) {
      const key = p.category_id ?? NO_CATEGORY_KEY;
      const label = p.category_id ? (categoryName(p.category_id) ?? "Sin categoría") : "Sin categoría";
      const cur = map.get(key) ?? { label, items: [] };
      cur.items.push(p);
      map.set(key, cur);
    }
    return Array.from(map.entries()).sort(([keyA, a], [keyB, b]) => {
      if (keyA === NO_CATEGORY_KEY) return 1;
      if (keyB === NO_CATEGORY_KEY) return -1;
      return a.label.localeCompare(b.label);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, categories]);

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
        tradeInValue: tradeInOfSale(groupItems),
        depositValue: depositOfSale(groupItems),
        customerName: groupItems.find((i) => i.customer_name)?.customer_name ?? null,
        customerPhone: groupItems.find((i) => i.customer_phone)?.customer_phone ?? null,
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [sales]);

  const openCreate = () => { setEditItem(null); setRegisterAsDevice(false); setOpen(true); };
  const openEdit = (item: Product) => { setEditItem(item); setOpen(true); };
  const closeDialog = (o: boolean) => { setOpen(o); if (!o) { setEditItem(null); setRegisterAsDevice(false); } };
  // El diálogo puede crear una categoría nueva al vuelo con su propia
  // instancia de useCategories — esta página tiene la suya aparte, así que
  // sin este reload quedaba desactualizada (el producto recién creado caía
  // en el agrupado "Sin categoría" hasta refrescar la página a mano).
  const handleSaved = () => { load(); reloadCategories(); };

  const renderProductCard = (i: Product) => {
    const outOfStock = i.stock <= 0;
    const lowStock = canViewStock && !outOfStock && i.stock <= i.min_stock_alert;
    const cat = categoryName(i.category_id);
    const sub = subcategoryName(i.subcategory_id);
    const stockDays = i.is_device && !outOfStock && canViewStock ? daysInStock(i.created_at, now) : null;
    const stale = isStaleDevice(i, now);
    const reservation = activeByItem.get(i.id);
    const reservationOverdue = !!reservation && isOverdue(reservation, now);
    return (
      <Card
        key={i.id}
        onClick={() => setPreviewItem(i)}
        className={cn(
          "group h-full cursor-pointer transition-all hover:shadow-elevated",
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
                {i.is_device && i.imei && (
                  <div className="text-[11px] text-muted-foreground">IMEI {i.imei}</div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="ghost" onClick={() => openEdit(i)} aria-label={`Editar ${i.name}`}>
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>
              {isAdmin && (
                <Button size="icon" variant="ghost" onClick={() => setPendingDelete(i)} aria-label={`Eliminar ${i.name}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>

          {(cat || i.branch_id || i.is_device) && (
            <div className="flex flex-wrap items-center gap-1">
              {i.is_device && (
                <Badge variant="outline" className="gap-1 border-primary/40 text-[11px] text-primary">
                  <Smartphone className="h-3 w-3" /> Equipo
                </Badge>
              )}
              {reservation && (
                <Badge
                  variant="outline"
                  data-testid="reserved-badge"
                  className={cn("gap-1 text-[11px]", reservationOverdue ? "border-secondary/60 bg-secondary/10 text-secondary" : "border-primary/40 bg-primary/5 text-primary")}
                >
                  <CalendarClock className="h-3 w-3" />
                  {reservationOverdue ? "Reserva vencida" : "Reservado"} · {expiryText(reservation.expires_on, now)}
                </Badge>
              )}
              {stockDays !== null && (
                <Badge
                  variant="outline"
                  data-testid="days-in-stock"
                  className={cn("text-[11px]", stale ? "border-secondary/50 bg-secondary/10 text-secondary" : "text-muted-foreground")}
                >
                  {daysInStockLabel(stockDays)}
                </Badge>
              )}
              {i.is_device && batteryLabel(i.battery_health) && (
                <Badge
                  variant="outline"
                  data-testid="battery-badge"
                  className={cn("gap-1 text-[11px]", isLowBattery(i.battery_health) ? "border-secondary/50 bg-secondary/10 text-secondary" : "text-muted-foreground")}
                >
                  <BatteryMedium className="h-3 w-3" /> {i.battery_health}%
                </Badge>
              )}
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
            ) : !canViewStock ? (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <EyeOff className="h-3 w-3" /> Stock oculto
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Stock: {i.stock}</span>
            )}
          </div>

          <div onClick={(e) => e.stopPropagation()}>
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
            ) : reservation ? (
              <Button className="w-full gap-2" data-testid="sell-reservation" onClick={() => sellReservation(reservation)}>
                <ShoppingCart className="h-4 w-4" /> Vender reserva
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2"
                  disabled={outOfStock}
                  onClick={() => addToCart(i)}
                >
                  <ShoppingCart className="h-4 w-4" /> Agregar
                </Button>
                {i.is_device && !outOfStock && (
                  <Button variant="outline" className="gap-2" data-testid="reserve-device" onClick={() => setReserveItem(i)}>
                    <CalendarClock className="h-4 w-4" /> Reservar
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!planLoading && !hasExternalInventory) return <Navigate to="/dashboard" replace />;
  if (!staffPermsLoading && !canViewProducts) return <Navigate to="/dashboard" replace />;

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
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => openBuy("reventa")}>
            <HandCoins className="h-4 w-4" />
            Comprar a cliente
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      <div className={cn("grid grid-cols-2 gap-3", showDeviceAging ? "lg:grid-cols-5" : "lg:grid-cols-4", activeTab === "resumen" && "hidden")}>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total productos</div>
          <div className="mt-1 text-2xl font-bold">{items.length}</div>
        </Card>
        <Card
          className={cn(
            "p-4 text-left transition-colors",
            canViewStock && outOfStockCount + lowStockCount > 0 && "cursor-pointer hover:border-secondary/50",
            stockFilter === "low" && "border-secondary bg-secondary/10"
          )}
          role={canViewStock && outOfStockCount + lowStockCount > 0 ? "button" : undefined}
          tabIndex={canViewStock && outOfStockCount + lowStockCount > 0 ? 0 : undefined}
          onClick={canViewStock && outOfStockCount + lowStockCount > 0 ? toggleStockFilter : undefined}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && canViewStock && outOfStockCount + lowStockCount > 0) {
              e.preventDefault();
              toggleStockFilter();
            }
          }}
        >
          <div className="text-xs text-muted-foreground">Sin / bajo stock</div>
          {canViewStock ? (
            <div className="mt-1 flex items-center gap-2 text-2xl font-bold text-secondary">
              {outOfStockCount + lowStockCount}
              {outOfStockCount + lowStockCount > 0 && <AlertTriangle className="h-5 w-5" />}
            </div>
          ) : (
            <div className="mt-1 text-2xl font-bold text-muted-foreground">—</div>
          )}
          {canViewStock && outOfStockCount + lowStockCount > 0 && (
            <div className="mt-1 text-[11px] font-medium text-secondary">
              {stockFilter === "low" ? "Mostrando estos ↓" : "Ver cuáles →"}
            </div>
          )}
        </Card>
        {showDeviceAging && (
          <Card
            data-testid="stale-devices-card"
            className={cn(
              "p-4 text-left transition-colors",
              staleSummary.count > 0 && "cursor-pointer hover:border-secondary/50",
              stockFilter === "stale" && "border-secondary bg-secondary/10"
            )}
            role={staleSummary.count > 0 ? "button" : undefined}
            tabIndex={staleSummary.count > 0 ? 0 : undefined}
            onClick={staleSummary.count > 0 ? toggleStaleFilter : undefined}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && staleSummary.count > 0) {
                e.preventDefault();
                toggleStaleFilter();
              }
            }}
          >
            <div className="text-xs text-muted-foreground">Equipos detenidos {STALE_DEVICE_DAYS}+ días</div>
            <div className={cn("mt-1 text-2xl font-bold", staleSummary.count > 0 && "text-secondary")}>
              {staleSummary.count}
            </div>
            {staleSummary.count > 0 ? (
              <div className="mt-1 text-[11px] font-medium text-secondary">
                {formatPYG(staleSummary.immobilizedCost)} inmovilizado · {stockFilter === "stale" ? "Mostrando estos ↓" : "Ver cuáles →"}
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-muted-foreground">Ninguno sin moverse</div>
            )}
          </Card>
        )}
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid h-auto w-full grid-cols-2 sm:inline-flex sm:h-10 sm:w-auto">
          {showDevicesHub && <TabsTrigger value="resumen" data-testid="tab-resumen">Resumen</TabsTrigger>}
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="ventas">
            Ventas recientes{saleGroups.length > 0 ? ` (${saleGroups.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="reservas" data-testid="tab-reservas">
            Reservas{activeReservations.length > 0 ? ` (${activeReservations.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="compras">Compras de equipos</TabsTrigger>
          {showDevicesHub && (
            <TabsTrigger value="chatarra" data-testid="tab-chatarra">
              Chatarra{scrapSummary.count > 0 ? ` (${scrapSummary.count})` : ""}
            </TabsTrigger>
          )}
          <TabsTrigger value="garantias">Garantías</TabsTrigger>
        </TabsList>

        {showDevicesHub && (
          <TabsContent value="resumen">
            <DevicesHub
              items={items}
              reservations={reservations}
              scrapWithoutParts={scrapSummary.withoutParts}
              canViewStock={canViewStock}
              isAdmin={isAdmin}
              onRegisterDevice={openRegisterDevice}
              onBuyForResale={() => openBuy("reventa")}
              onBuyForParts={() => openBuy("piezas")}
              onGoCatalog={() => { setActiveTab("catalogo"); setStockFilter("all"); }}
              onAlert={goToAlert}
            />
          </TabsContent>
        )}

        <TabsContent value="catalogo" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            {stockFilter !== "all" && (
              <Badge
                variant="outline"
                className="w-fit cursor-pointer gap-1.5 border-secondary/40 text-secondary hover:bg-secondary/10"
                data-testid="catalog-filter-badge"
                onClick={() => setStockFilter("all")}
              >
                <AlertTriangle className="h-3 w-3" />
                Filtrando: {CATALOG_FILTER_LABEL[stockFilter]}
                <span className="ml-0.5 font-bold">✕</span>
              </Badge>
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
            <Button
              variant="outline"
              className="w-full sm:ml-auto sm:w-auto"
              data-testid="copy-price-list"
              disabled={loading || filtered.length === 0}
              onClick={copyPriceList}
            >
              <MessageCircle className="h-4 w-4" />
              Copiar lista para WhatsApp
            </Button>
          </div>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Cargando...</p>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                <ShoppingBag className="h-8 w-8" />
                {stockFilter === "all" ? "Sin productos todavía." : CATALOG_FILTER_EMPTY[stockFilter]}
              </CardContent>
            </Card>
          ) : isSearching || stockFilter !== "all" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(renderProductCard)}
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={groupedByCategory.map(([key]) => key)} className="space-y-2">
              {groupedByCategory.map(([key, group]) => (
                <AccordionItem key={key} value={key} className="rounded-lg border border-border px-3">
                  <AccordionTrigger className="py-3 text-left hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{group.label}</span>
                      <Badge variant="secondary" className="text-[11px]">{group.items.length}</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.items.map(renderProductCard)}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="ventas">
          <Card>
            <CardContent className="space-y-3 p-4">
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
                        {g.tradeInValue > 0 && (
                          <div className="truncate text-xs text-primary">
                            Con canje: {tradeInDeviceName(g.key)} (-{formatPYG(g.tradeInValue)}) · cobrado {formatPYG(g.total - g.tradeInValue - g.depositValue)}
                          </div>
                        )}
                        {g.depositValue > 0 && (
                          <div className="truncate text-xs text-primary" data-testid="sale-deposit">
                            Con seña de reserva: -{formatPYG(g.depositValue)}
                            {g.tradeInValue > 0 ? "" : ` · cobrado ${formatPYG(g.total - g.depositValue)}`}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-semibold text-foreground">{formatPYG(g.total)}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10"
                          aria-label="Enviar comprobante por WhatsApp"
                          onClick={() => handleReceiptSale(toCompletedSale(g))}
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10"
                          aria-label="Imprimir ticket"
                          onClick={() => handlePrintSale(toCompletedSale(g))}
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
        </TabsContent>

        <TabsContent value="reservas">
          <ReservationsPanel
            reservations={reservations}
            branchName={(id) => (hasMultipleBranches ? branchNameOf(id) : null)}
            onSell={sellReservation}
            onExtend={setExtendTarget}
            onCancel={setCancelTarget}
            onWhatsApp={reservationWhatsApp}
          />
        </TabsContent>

        <TabsContent value="compras">
          <Card>
            <CardContent className="space-y-3 p-4">
              {purchases.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no compraste ningún equipo a un cliente. Usá "Comprar a cliente" para registrar la primera.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {purchases.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {p.device_name}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">{p.receipt_number}</span>
                          {p.kind === "canje" && <Badge variant="secondary" className="ml-2 text-[10px]">Canje</Badge>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleString("es-PY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {` · ${p.seller_name}`}
                          {p.imei ? ` · IMEI ${p.imei}` : ""}
                          {p.payment_method ? ` · ${p.payment_method}` : ""}
                          {hasMultipleBranches && p.branch_id ? ` · ${branches.find((b) => b.id === p.branch_id)?.name ?? "Sucursal"}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-semibold text-foreground">{formatPYG(p.purchase_price)}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10"
                          aria-label="Reimprimir comprobante"
                          onClick={() => handlePrintPurchase(p)}
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
        </TabsContent>

        {showDevicesHub && (
          <TabsContent value="chatarra">
            <ScrapDevicesPanel
              devices={scrapDevices}
              totals={scrapSummary}
              loaded={scrapLoaded}
              branchName={(id) => (hasMultipleBranches ? branchNameOf(id) : null)}
              onBuy={() => openBuy("piezas")}
              onExtract={(d) => setExtractId(d.purchase.id)}
              onPrint={handlePrintPurchase}
            />
          </TabsContent>
        )}

        <TabsContent value="garantias">
          <WarrantyLookup />
        </TabsContent>
      </Tabs>

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

      <NewProductDialog open={open} onOpenChange={closeDialog} onCreated={handleSaved} editItem={editItem} defaultIsDevice={registerAsDevice} />
      <BuyDeviceDialog
        open={buyOpen}
        onOpenChange={setBuyOpen}
        initialDestination={buyDestination}
        onRegistered={handlePurchaseRegistered}
        onPrint={handlePrintPurchase}
      />
      <ExtractPartDialog
        device={extractDevice}
        onOpenChange={(o) => { if (!o) setExtractId(null); }}
        onSaved={() => void reloadScrap()}
      />
      <ProductPreviewDialog
        product={previewItem}
        onOpenChange={(o) => !o && setPreviewItem(null)}
        categoryLabel={previewItem ? categoryName(previewItem.category_id) : null}
        subcategoryLabel={previewItem ? subcategoryName(previewItem.subcategory_id) : null}
        branchLabel={hasMultipleBranches && previewItem?.branch_id ? branches.find((b) => b.id === previewItem.branch_id)?.name ?? null : null}
        canViewStock={canViewStock}
        canDelete={isAdmin}
        cartLine={previewItem ? cart[previewItem.id] : undefined}
        reservation={previewItem ? activeByItem.get(previewItem.id) : undefined}
        onAddToCart={() => previewItem && addToCart(previewItem)}
        onReserve={() => { if (previewItem) { setReserveItem(previewItem); setPreviewItem(null); } }}
        onSellReservation={() => { const r = previewItem && activeByItem.get(previewItem.id); if (r) sellReservation(r); }}
        onDossier={() => previewItem && setDossierItem(previewItem)}
        onUpdateQty={(q) => previewItem && updateCartQty(previewItem, q)}
        onEdit={() => { if (previewItem) { openEdit(previewItem); setPreviewItem(null); } }}
        onDelete={() => { if (previewItem) { setPendingDelete(previewItem); setPreviewItem(null); } }}
      />
      <DeviceDossierDialog
        device={dossierItem}
        onOpenChange={(o) => { if (!o) setDossierItem(null); }}
        companyId={companyId}
        businessName={businessName}
        branchName={hasMultipleBranches && dossierItem?.branch_id ? branches.find((b) => b.id === dossierItem.branch_id)?.name ?? null : null}
        categoryLabel={dossierItem ? categoryName(dossierItem.category_id) : null}
      />
      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        products={items}
        reservations={activeReservations}
        cart={cart}
        setCart={setCart}
        onSold={handlePurchaseRegistered}
        onPrintRequest={handlePrintSale}
        onPrintTradeIn={handlePrintPurchase}
        onReceiptRequest={handleReceiptSale}
      />
      <ReserveDeviceDialog
        open={!!reserveItem}
        onOpenChange={(o) => { if (!o) setReserveItem(null); }}
        device={reserveItem}
        onReserved={() => { void reloadReservations(); }}
        businessName={businessName}
        branchName={reserveItem && hasMultipleBranches ? branchNameOf(reserveItem.branch_id) : null}
      />
      <CancelReservationDialog
        reservation={cancelTarget}
        onOpenChange={(o) => { if (!o) setCancelTarget(null); }}
        onCancelled={() => { void reloadReservations(); }}
      />
      <ExtendReservationDialog
        reservation={extendTarget}
        onOpenChange={(o) => { if (!o) setExtendTarget(null); }}
        onExtended={() => { void reloadReservations(); }}
      />
      <EnviarReciboDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        sale={receiptSale}
        businessName={businessName}
        branchName={receiptSale ? branches.find((b) => b.id === receiptSale.branch_id)?.name ?? null : null}
      />

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
