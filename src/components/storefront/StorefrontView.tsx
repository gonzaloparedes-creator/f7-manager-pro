import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Store, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPYG } from "@/lib/orders";
import {
  EMPTY_QUERY,
  SORT_LABELS,
  applyCatalogQuery,
  categoriesOf,
  isDefaultQuery,
  parsePriceInput,
  priceBounds,
  type CatalogQuery,
  type SortKey,
  type StorefrontItem,
  type StorefrontStore,
} from "@/lib/storefront";
import StorefrontShell, { useStorefrontTitle } from "./StorefrontShell";
import StorefrontCard from "./StorefrontCard";

interface Props {
  store: StorefrontStore;
  items: StorefrontItem[];
  /** Vista previa del panel de administración. */
  preview?: boolean;
}

export default function StorefrontView({ store, items, preview = false }: Props) {
  const [query, setQuery] = useState<CatalogQuery>(EMPTY_QUERY);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useStorefrontTitle(preview ? undefined : store.name);

  const categories = useMemo(() => categoriesOf(items), [items]);
  const bounds = useMemo(() => (store.show_prices ? priceBounds(items) : null), [items, store.show_prices]);
  // Si la tienda oculta precios (también en la vista previa al apagarlo), los filtros y el orden por precio no aplican.
  const effective = useMemo<CatalogQuery>(
    () =>
      store.show_prices
        ? query
        : {
            ...query,
            minPrice: null,
            maxPrice: null,
            sort: query.sort === "precio_asc" || query.sort === "precio_desc" ? "recientes" : query.sort,
          },
    [query, store.show_prices]
  );
  const visible = useMemo(() => applyCatalogQuery(items, effective), [items, effective]);
  const patch = (p: Partial<CatalogQuery>) => setQuery((q) => ({ ...q, ...p }));
  const filtering = !isDefaultQuery(effective);
  const showFilterPanel = !!bounds;

  return (
    <StorefrontShell store={store} preview={preview}>
      <section className="border-b border-border bg-gradient-to-br from-primary/15 via-background to-background">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          <h1 className="max-w-2xl text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {store.tagline?.trim() || `Mirá lo que tenemos en ${store.name}`}
          </h1>
          {store.installments_text?.trim() && (
            <p className="mt-3 inline-flex rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-foreground">
              {store.installments_text.trim()}
            </p>
          )}
          <div className="relative mt-6 max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query.text}
              onChange={(e) => patch({ text: e.target.value })}
              placeholder="Buscar un producto…"
              aria-label="Buscar un producto"
              className="h-12 rounded-xl bg-card pl-11 text-base"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        {categories.length > 1 && (
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={query.category === null} onClick={() => patch({ category: null })}>
              Todos <span className="opacity-70">{items.length}</span>
            </Chip>
            {categories.map((c) => (
              <Chip key={c.key} active={query.category === c.key} onClick={() => patch({ category: c.key })}>
                {c.label} <span className="opacity-70">{c.count}</span>
              </Chip>
            ))}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm text-muted-foreground">
            {visible.length} {visible.length === 1 ? "producto" : "productos"}
          </p>
          {showFilterPanel && (
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                filtersOpen || query.minPrice !== null || query.maxPrice !== null
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" /> Precio
            </button>
          )}
          <select
            value={effective.sort}
            onChange={(e) => patch({ sort: e.target.value as SortKey })}
            aria-label="Ordenar"
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          >
            {(Object.keys(SORT_LABELS) as SortKey[])
              .filter((k) => store.show_prices || (k !== "precio_asc" && k !== "precio_desc"))
              .map((k) => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
          </select>
        </div>

        {showFilterPanel && filtersOpen && bounds && (
          <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Precio desde (Gs.)
              <Input
                inputMode="numeric"
                value={query.minPrice !== null ? String(query.minPrice) : ""}
                placeholder={formatPYG(bounds.min)}
                onChange={(e) => patch({ minPrice: parsePriceInput(e.target.value) })}
                className="h-10 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Precio hasta (Gs.)
              <Input
                inputMode="numeric"
                value={query.maxPrice !== null ? String(query.maxPrice) : ""}
                placeholder={formatPYG(bounds.max)}
                onChange={(e) => patch({ maxPrice: parsePriceInput(e.target.value) })}
                className="h-10 text-sm"
              />
            </label>
          </div>
        )}

        {items.length === 0 ? (
          <Empty
            title="Todavía no hay productos publicados"
            text="Volvé pronto o escribinos por WhatsApp para consultar disponibilidad."
          />
        ) : visible.length === 0 ? (
          <Empty
            title="No encontramos resultados"
            text="Probá con otra búsqueda o limpiá los filtros."
            action={filtering ? (
              <button
                type="button"
                onClick={() => setQuery(EMPTY_QUERY)}
                className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-accent"
              >
                <X className="h-4 w-4" /> Limpiar filtros
              </button>
            ) : undefined}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {visible.map((it) => (
              <StorefrontCard key={it.id} item={it} slug={store.slug} showStock={store.show_stock} preview={preview} />
            ))}
          </div>
        )}
      </section>
    </StorefrontShell>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Store className="h-6 w-6" />
      </span>
      <p className="mt-3 font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}
