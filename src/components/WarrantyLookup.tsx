import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, Smartphone, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { cn } from "@/lib/utils";
import { formatDMY } from "@/lib/postSale";
import {
  deviceWarranty,
  entryFromDeviceSale,
  entryFromRepairOrder,
  matchesWarrantyFilter,
  matchesWarrantySearch,
  warrantyStatusLabel,
  warrantySummary,
  type DeviceSaleRow,
  type RepairOrderRow,
  type WarrantyEntry,
  type WarrantyFilter,
  type WarrantyKind,
} from "@/lib/deviceWarranty";

const FETCH_LIMIT = 1000;

const FILTERS: { value: WarrantyFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Vigentes" },
  { value: "due", label: "Por vencer" },
  { value: "expired", label: "Vencidas" },
];

const KIND_STYLE: Record<WarrantyKind, string> = {
  active: "border-success/40 bg-success/10 text-success",
  due: "border-secondary/40 bg-secondary/10 text-secondary",
  expired: "border-destructive/40 bg-destructive/10 text-destructive",
  none: "border-border bg-muted text-muted-foreground",
  unrecorded: "border-border bg-muted text-muted-foreground",
};

export default function WarrantyLookup() {
  const { companyId } = useCompany();
  const [entries, setEntries] = useState<WarrantyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<WarrantyFilter>("all");

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [salesRes, ordersRes] = await Promise.all([
        (supabase as any)
          .from("product_sales")
          .select("id, product_name, imei, customer_name, customer_phone, created_at, warranty_days, sale_group_id")
          .eq("company_id", companyId)
          .not("imei", "is", null)
          .order("created_at", { ascending: false })
          .limit(FETCH_LIMIT),
        supabase
          .from("orders")
          .select("id, order_number, marca, modelo, device_type, imei, customer_name, customer_phone, delivered_at, warranty_days")
          .eq("company_id", companyId)
          .eq("status", "entregado")
          .not("delivered_at", "is", null)
          .gt("warranty_days", 0)
          .order("delivered_at", { ascending: false })
          .limit(FETCH_LIMIT),
      ]);
      if (cancelled) return;
      if (salesRes.error) toast.error(salesRes.error.message);
      if (ordersRes.error) toast.error(ordersRes.error.message);
      const saleRows = (salesRes.data ?? []) as DeviceSaleRow[];
      const orderRows = (ordersRes.data ?? []) as RepairOrderRow[];
      const merged = [
        ...saleRows.map(entryFromDeviceSale),
        ...orderRows.map(entryFromRepairOrder),
      ].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      setEntries(merged);
      setTruncated(saleRows.length >= FETCH_LIMIT || orderRows.length >= FETCH_LIMIT);
      setLoadedAt(new Date());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const summary = useMemo(() => warrantySummary(entries, loadedAt), [entries, loadedAt]);

  const visible = useMemo(
    () =>
      entries.filter(
        (e) =>
          matchesWarrantyFilter(deviceWarranty(e.startedAt, e.warrantyDays, loadedAt), filter) &&
          matchesWarrantySearch(e, search)
      ),
    [entries, filter, search, loadedAt]
  );

  const counts: Record<WarrantyFilter, number> = {
    all: entries.length,
    active: summary.active + summary.due,
    due: summary.due,
    expired: summary.expired,
  };

  return (
    <div className="space-y-4" data-testid="warranty-lookup">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por IMEI, cliente, teléfono o equipo..."
          className="pl-9"
          inputMode="search"
          autoComplete="off"
          aria-label="Buscar garantía"
        />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar garantías">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={cn(
              "min-h-10 rounded-full border px-3 text-sm transition-colors",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted"
            )}
          >
            {f.label}
            {!loading && <span className="ml-1.5 text-xs opacity-80">{counts[f.value]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Cargando garantías...</p>
      ) : entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <ShieldCheck className="h-8 w-8" />
            <p>Todavía no hay equipos vendidos ni reparaciones con garantía.</p>
            <p className="text-xs">
              Al vender un equipo desde el carrito se elige la garantía; queda guardada acá junto al IMEI.
            </p>
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Ninguna garantía coincide con la búsqueda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {visible.map((e) => {
            const w = deviceWarranty(e.startedAt, e.warrantyDays, loadedAt);
            return (
              <div
                key={e.key}
                data-testid="warranty-row"
                className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {e.source === "venta" ? (
                      <Smartphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Venta de equipo" />
                    ) : (
                      <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Reparación" />
                    )}
                    <span className="truncate font-medium text-foreground">{e.title}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {e.source === "venta" ? "Venta" : "Reparación"}
                    </Badge>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {e.imei ? `IMEI ${e.imei} · ` : ""}
                    {e.buyerName ? `${e.buyerName}${e.buyerPhone ? ` (${e.buyerPhone})` : ""} · ` : e.buyerPhone ? `${e.buyerPhone} · ` : ""}
                    {e.reference} · {formatDMY(new Date(e.startedAt))}
                    {w.endsAt ? ` → vence ${formatDMY(w.endsAt)}` : ""}
                  </div>
                </div>
                <Badge variant="outline" className={cn("w-fit shrink-0 whitespace-nowrap", KIND_STYLE[w.kind])}>
                  {warrantyStatusLabel(w)}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {truncated && (
        <p className="text-xs text-muted-foreground">
          Se muestran las últimas {FETCH_LIMIT} garantías de cada tipo; las más antiguas no aparecen en esta lista.
        </p>
      )}
    </div>
  );
}
