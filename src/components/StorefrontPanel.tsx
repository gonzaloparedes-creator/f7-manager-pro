import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Search, ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import type { Product } from "@/pages/Products";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import StorefrontView from "@/components/storefront/StorefrontView";
import StorefrontCustomizer from "@/components/storefront/StorefrontCustomizer";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  ACCENT_PRESETS,
  PRODUCT_SEALS_MAX,
  SEALS_MAX,
  SLUG_MAX,
  SOCIAL_KINDS,
  cleanIncludes,
  cleanSeals,
  defaultCustom,
  hiddenReason,
  isStorefrontVisible,
  normalizeSocialUrl,
  normalizeStorefrontPhone,
  slugify,
  stripAccents,
  storefrontUrl,
  validateSlug,
  type CustomDraft,
  type SocialKind,
  type StorefrontItem,
  type StorefrontSeal,
  type StorefrontSocials,
  type StorefrontStore,
} from "@/lib/storefront";

interface Draft extends CustomDraft {
  slug: string;
  enabled: boolean;
  show_prices: boolean;
  show_stock: boolean;
  tagline: string;
  whatsapp: string;
  address: string;
  accent: string;
  installments: string;
}

interface Props {
  items: Product[];
  reservedIds: Set<string>;
  categoryName: (id: string | null) => string | null;
  onPublishedChange: (ids: string[], value: boolean) => void;
}

type SlugState = "idle" | "checking" | "free" | "taken";
type ListFilter = "todos" | "publicados" | "sin_publicar";
type BulkAction = "publish" | "unpublish";

const PAGE_SIZE = 40;
const CHUNK = 100;

function sanitizeSlugInput(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, SLUG_MAX);
}

function defaultDraft(name: string | null): Draft {
  return {
    slug: slugify(name ?? ""),
    enabled: true,
    show_prices: true,
    show_stock: false,
    tagline: "",
    whatsapp: "",
    address: "",
    accent: ACCENT_PRESETS[0].value,
    installments: "",
    ...defaultCustom(),
  };
}

function sealsFromRow(value: unknown, max: number): StorefrontSeal[] {
  return Array.isArray(value) ? cleanSeals(value as StorefrontSeal[], max) : [];
}

function listFromRow(value: unknown): string[] {
  return Array.isArray(value) ? cleanIncludes(value.filter((v): v is string => typeof v === "string")) : [];
}

export default function StorefrontPanel({ items, reservedIds, categoryName, onPublishedChange }: Props) {
  const { companyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft>(() => defaultDraft(null));
  const [saving, setSaving] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [copied, setCopied] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>("todos");
  const [listSearch, setListSearch] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<BulkAction | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setLoading(true);
    Promise.all([
      supabase.from("companies").select("name, logo_url").eq("id", companyId).maybeSingle<{ name: string | null; logo_url: string | null }>(),
      (supabase as any)
        .from("storefront_settings")
        .select(
          "slug, enabled, show_prices, show_stock, tagline, whatsapp_phone, address, accent_color, installments_text, banner_url, search_placeholder, footer_text, instagram_url, facebook_url, tiktok_url, youtube_url, website_url, seals, product_seals, includes"
        )
        .eq("company_id", companyId)
        .maybeSingle(),
    ]).then(([company, settings]) => {
      if (!active) return;
      const name = company.data?.name ?? null;
      setCompanyName(name);
      setLogoUrl(company.data?.logo_url ?? null);
      if (settings.error) toast.error(settings.error.message);
      const row = settings.data;
      if (row) {
        const loaded: Draft = {
          slug: row.slug,
          enabled: !!row.enabled,
          show_prices: !!row.show_prices,
          show_stock: !!row.show_stock,
          tagline: row.tagline ?? "",
          whatsapp: row.whatsapp_phone ?? "",
          address: row.address ?? "",
          accent: row.accent_color ?? ACCENT_PRESETS[0].value,
          installments: row.installments_text ?? "",
          banner_url: row.banner_url ?? "",
          search_placeholder: row.search_placeholder ?? "",
          footer_text: row.footer_text ?? "",
          socials: {
            instagram: row.instagram_url ?? "",
            facebook: row.facebook_url ?? "",
            tiktok: row.tiktok_url ?? "",
            youtube: row.youtube_url ?? "",
            website: row.website_url ?? "",
          },
          seals: sealsFromRow(row.seals, SEALS_MAX),
          product_seals: sealsFromRow(row.product_seals, PRODUCT_SEALS_MAX),
          includes: listFromRow(row.includes),
        };
        setSaved(loaded);
        setDraft(loaded);
      } else {
        setSaved(null);
        setDraft(defaultDraft(name));
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [companyId]);

  useEffect(() => {
    setSlugState("idle");
    if (loading) return;
    if (validateSlug(draft.slug) || draft.slug === saved?.slug) return;
    let cancelled = false;
    setSlugState("checking");
    const timer = setTimeout(async () => {
      const { data, error } = await (supabase as any).rpc("storefront_slug_available", { _slug: draft.slug });
      if (cancelled) return;
      setSlugState(error ? "idle" : data ? "free" : "taken");
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [draft.slug, saved?.slug, loading]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const dirty = saved === null || JSON.stringify(saved) !== JSON.stringify(draft);
  const slugError = validateSlug(draft.slug);
  const phoneInvalid = draft.whatsapp.trim() !== "" && normalizeStorefrontPhone(draft.whatsapp) === null;

  const socialResults = useMemo(
    () => Object.fromEntries(SOCIAL_KINDS.map((k) => [k, normalizeSocialUrl(k, draft.socials[k])])) as Record<SocialKind, ReturnType<typeof normalizeSocialUrl>>,
    [draft.socials]
  );
  const socialErrors = useMemo(
    () => Object.fromEntries(SOCIAL_KINDS.map((k) => [k, socialResults[k].error])) as Partial<Record<SocialKind, string | null>>,
    [socialResults]
  );
  const socialsInvalid = SOCIAL_KINDS.some((k) => socialResults[k].error !== null);

  const save = async () => {
    if (!companyId) return;
    if (slugError) { toast.error(slugError); return; }
    if (slugState === "taken") { toast.error("Ese enlace ya está en uso. Probá con otro."); return; }
    if (socialsInvalid) { toast.error("Revisá los enlaces de redes sociales."); return; }
    let phone: string | null = null;
    if (draft.whatsapp.trim()) {
      phone = normalizeStorefrontPhone(draft.whatsapp);
      if (!phone) { toast.error("El WhatsApp no es válido. Escribilo con código de país, por ejemplo 595981123456."); return; }
    }
    const seals = cleanSeals(draft.seals, SEALS_MAX);
    const productSeals = cleanSeals(draft.product_seals, PRODUCT_SEALS_MAX);
    const includes = cleanIncludes(draft.includes);
    setSaving(true);
    const { error } = await (supabase as any).from("storefront_settings").upsert(
      {
        company_id: companyId,
        slug: draft.slug,
        enabled: draft.enabled,
        show_prices: draft.show_prices,
        show_stock: draft.show_stock,
        tagline: draft.tagline.trim() || null,
        whatsapp_phone: phone,
        address: draft.address.trim() || null,
        accent_color: draft.accent,
        installments_text: draft.installments.trim() || null,
        banner_url: draft.banner_url || null,
        search_placeholder: draft.search_placeholder.trim() || null,
        footer_text: draft.footer_text.trim() || null,
        instagram_url: socialResults.instagram.value,
        facebook_url: socialResults.facebook.value,
        tiktok_url: socialResults.tiktok.value,
        youtube_url: socialResults.youtube.value,
        website_url: socialResults.website.value,
        seals,
        product_seals: productSeals,
        includes,
      },
      { onConflict: "company_id" }
    );
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? "Ese enlace ya está en uso. Probá con otro." : error.message);
      return;
    }
    const next: Draft = {
      ...draft,
      tagline: draft.tagline.trim(),
      address: draft.address.trim(),
      installments: draft.installments.trim(),
      whatsapp: phone ?? "",
      search_placeholder: draft.search_placeholder.trim(),
      footer_text: draft.footer_text.trim(),
      socials: Object.fromEntries(SOCIAL_KINDS.map((k) => [k, socialResults[k].value ?? ""])) as Record<SocialKind, string>,
      seals,
      product_seals: productSeals,
      includes,
    };
    setSaved(next);
    setDraft(next);
    toast.success("Vitrina guardada");
  };

  const publicUrl = saved ? storefrontUrl(saved.slug, window.location.origin) : null;

  const focusWhatsapp = () => {
    const el = document.getElementById("sf-whatsapp");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar. Copiá el enlace a mano.");
    }
  };

  const visibleOpts = (id: string) => ({ showPrices: draft.show_prices, reserved: reservedIds.has(id) });

  const previewStore: StorefrontStore = useMemo(
    () => ({
      slug: draft.slug || "tu-taller",
      name: companyName ?? "Tu negocio",
      logo_url: logoUrl,
      tagline: draft.tagline.trim() || null,
      whatsapp_phone: normalizeStorefrontPhone(draft.whatsapp),
      address: draft.address.trim() || null,
      accent_color: draft.accent,
      installments_text: draft.installments.trim() || null,
      show_prices: draft.show_prices,
      show_stock: draft.show_stock,
      banner_url: draft.banner_url || null,
      search_placeholder: draft.search_placeholder.trim() || null,
      footer_text: draft.footer_text.trim() || null,
      socials: Object.fromEntries(
        SOCIAL_KINDS.map((k) => [k, socialResults[k].value])
      ) as StorefrontSocials,
      seals: cleanSeals(draft.seals, SEALS_MAX),
      product_seals: cleanSeals(draft.product_seals, PRODUCT_SEALS_MAX),
      includes: cleanIncludes(draft.includes),
    }),
    [draft, companyName, logoUrl, socialResults]
  );

  const previewItems: StorefrontItem[] = useMemo(
    () =>
      items
        .filter((i) => isStorefrontVisible(i, { showPrices: draft.show_prices, reserved: reservedIds.has(i.id) }))
        .map((i) => ({
          id: i.id,
          name: i.name,
          price: draft.show_prices ? Number(i.selling_price) : null,
          image_url: i.image_url,
          category_id: i.category_id,
          category: categoryName(i.category_id),
          is_device: i.is_device,
          battery_health: i.is_device ? i.battery_health ?? null : null,
          stock: draft.show_stock && !i.is_device ? i.stock : null,
          public_description: i.public_description ?? null,
          created_at: i.created_at ?? "",
        })),
    [items, reservedIds, draft.show_prices, draft.show_stock, categoryName]
  );

  const publishedCount = items.filter((i) => i.show_in_storefront).length;
  const publishable = items.filter(
    (i) => !i.show_in_storefront && isStorefrontVisible({ ...i, show_in_storefront: true }, visibleOpts(i.id))
  );

  const listed = useMemo(() => {
    const needle = stripAccents(listSearch.trim()).toLowerCase();
    return items.filter((i) => {
      if (listFilter === "publicados" && !i.show_in_storefront) return false;
      if (listFilter === "sin_publicar" && i.show_in_storefront) return false;
      if (needle && !stripAccents(i.name).toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, listFilter, listSearch]);

  const setPublished = async (ids: string[], value: boolean) => {
    if (!companyId || ids.length === 0) return false;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { error } = await (supabase as any)
        .from("inventory_items")
        .update({ show_in_storefront: value })
        .in("id", slice)
        .eq("company_id", companyId);
      if (error) {
        toast.error(error.message);
        if (i > 0) onPublishedChange(ids.slice(0, i), value);
        return false;
      }
    }
    onPublishedChange(ids, value);
    return true;
  };

  const toggleItem = async (item: Product, value: boolean) => {
    setBusyIds((s) => new Set(s).add(item.id));
    await setPublished([item.id], value);
    setBusyIds((s) => {
      const next = new Set(s);
      next.delete(item.id);
      return next;
    });
  };

  const runBulk = async () => {
    if (!bulk) return;
    setBulkRunning(true);
    const ids = bulk === "publish" ? publishable.map((i) => i.id) : items.filter((i) => i.show_in_storefront).map((i) => i.id);
    const ok = await setPublished(ids, bulk === "publish");
    setBulkRunning(false);
    if (ok) {
      toast.success(bulk === "publish" ? `${ids.length} publicados en la vitrina` : `${ids.length} sacados de la vitrina`);
      setBulk(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="storefront-panel">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Store className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold leading-tight">Vitrina online</h2>
              <p className="text-sm text-muted-foreground">
                Una página pública con los productos y equipos que elijas, para compartir por WhatsApp o redes.
              </p>
            </div>
          </div>
          {publicUrl && saved && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={saved.enabled ? "default" : "secondary"}>{saved.enabled ? "Activa" : "Pausada"}</Badge>
              <Button type="button" variant="outline" size="sm" onClick={copyLink} data-testid="storefront-copy-link">
                {copied ? <Check className="mr-1.5 h-4 w-4 text-primary" /> : <Copy className="mr-1.5 h-4 w-4" />}
                {copied ? "Copiado" : "Copiar enlace"}
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" data-testid="storefront-open-link">
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Ver mi vitrina
                </a>
              </Button>
            </div>
          )}
        </div>
        {publicUrl && saved && (
          <p className="mt-3 break-all rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{publicUrl}</p>
        )}
        {saved && !saved.enabled && (
          <p className="mt-3 text-sm text-secondary">
            La vitrina está pausada: quien abra el enlace no verá tus productos. Activala y guardá para publicarla.
          </p>
        )}
        {saved && !saved.whatsapp && (
          <div
            className="mt-3 flex flex-col gap-2 rounded-lg border border-secondary/40 bg-secondary/10 p-3 sm:flex-row sm:items-center sm:justify-between"
            data-testid="storefront-no-whatsapp"
          >
            <p className="text-sm text-foreground">
              Tu vitrina no tiene un número de WhatsApp cargado: quien vea un producto no puede escribirte desde ahí.
            </p>
            <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={focusWhatsapp}>
              Cargar mi WhatsApp
            </Button>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card className="space-y-5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="sf-enabled" className="text-sm font-semibold">Vitrina activa</Label>
              <p className="text-xs text-muted-foreground">Si la apagás, el enlace deja de mostrar productos.</p>
            </div>
            <Switch id="sf-enabled" checked={draft.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sf-slug">Enlace de tu vitrina</Label>
            <div className="flex items-center rounded-md border border-input bg-background pl-3 text-sm focus-within:ring-2 focus-within:ring-ring">
              <span className="shrink-0 text-muted-foreground">/v/</span>
              <input
                id="sf-slug"
                value={draft.slug}
                onChange={(e) => patch({ slug: sanitizeSlugInput(e.target.value) })}
                onBlur={() => patch({ slug: draft.slug.replace(/^-+|-+$/g, "") })}
                maxLength={SLUG_MAX}
                autoComplete="off"
                spellCheck={false}
                placeholder="mi-taller"
                className="h-10 min-w-0 flex-1 bg-transparent px-1 outline-none"
              />
            </div>
            {slugError ? (
              <p className="text-xs text-destructive">{slugError}</p>
            ) : slugState === "taken" ? (
              <p className="text-xs text-destructive">Ese enlace ya está en uso. Probá con otro.</p>
            ) : slugState === "free" ? (
              <p className="text-xs text-primary">Disponible</p>
            ) : slugState === "checking" ? (
              <p className="text-xs text-muted-foreground">Revisando…</p>
            ) : (
              <p className="text-xs text-muted-foreground">Solo letras, números y guiones. Es lo que van a ver tus clientes.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sf-tagline">Frase de portada</Label>
            <Input
              id="sf-tagline"
              value={draft.tagline}
              maxLength={120}
              onChange={(e) => patch({ tagline: e.target.value })}
              placeholder="Celulares y accesorios con garantía"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sf-installments">Mensaje de cuotas o financiación (opcional)</Label>
            <Input
              id="sf-installments"
              value={draft.installments}
              maxLength={160}
              onChange={(e) => patch({ installments: e.target.value })}
              placeholder="Hasta 12 cuotas con tarjeta"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sf-whatsapp">WhatsApp para consultas</Label>
            <Input
              id="sf-whatsapp"
              inputMode="tel"
              value={draft.whatsapp}
              onChange={(e) => patch({ whatsapp: e.target.value })}
              placeholder="0981 123 456"
              className={!draft.whatsapp.trim() ? "border-secondary/60" : undefined}
            />
            {phoneInvalid ? (
              <p className="text-xs text-destructive">Ese número no parece válido. Probá con el código de país, por ejemplo 595981123456.</p>
            ) : draft.whatsapp.trim() ? (
              <p className="text-xs text-muted-foreground">
                El botón "Contactar por WhatsApp" de cada producto abre una conversación con este número y un mensaje ya escrito con el nombre del producto.
              </p>
            ) : (
              <p className="text-xs text-secondary">
                Sin número no aparece el botón "Contactar por WhatsApp" en los productos. Escribilo como lo usás en WhatsApp.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sf-address">Dirección del local (opcional)</Label>
            <Input
              id="sf-address"
              value={draft.address}
              maxLength={200}
              onChange={(e) => patch({ address: e.target.value })}
              placeholder="Av. Mcal. López 1234, Asunción"
            />
          </div>

          <div className="space-y-2">
            <Label>Color de tu vitrina</Label>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  title={p.label}
                  aria-label={p.label}
                  aria-pressed={draft.accent.toLowerCase() === p.value.toLowerCase()}
                  onClick={() => patch({ accent: p.value })}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition-transform hover:scale-105",
                    draft.accent.toLowerCase() === p.value.toLowerCase() ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: p.value }}
                />
              ))}
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border px-3 text-xs text-muted-foreground hover:bg-accent">
                Otro
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(draft.accent) ? draft.accent : ACCENT_PRESETS[0].value}
                  onChange={(e) => patch({ accent: e.target.value })}
                  className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                  aria-label="Elegir otro color"
                />
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="sf-prices" className="text-sm font-medium">Mostrar precios</Label>
                <p className="text-xs text-muted-foreground">Apagado: cada producto dice "Consultar precio".</p>
              </div>
              <Switch id="sf-prices" checked={draft.show_prices} onCheckedChange={(v) => patch({ show_prices: v })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="sf-stock" className="text-sm font-medium">Mostrar unidades disponibles</Label>
                <p className="text-xs text-muted-foreground">Ej. "Última unidad" o "3 disponibles". Los equipos no lo muestran.</p>
              </div>
              <Switch id="sf-stock" checked={draft.show_stock} onCheckedChange={(v) => patch({ show_stock: v })} />
            </div>
          </div>

          {companyId && (
            <StorefrontCustomizer
              companyId={companyId}
              value={draft}
              onChange={patch}
              socialErrors={socialErrors}
            />
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">
              {saved === null ? "Todavía no la creaste" : dirty ? <span className="text-secondary">Hay cambios sin guardar</span> : "Todo guardado"}
            </span>
            <Button type="button" onClick={save} disabled={saving || !dirty || !!slugError || slugState === "taken" || phoneInvalid || socialsInvalid} data-testid="storefront-save">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saved === null ? "Crear mi vitrina" : "Guardar cambios"}
            </Button>
          </div>
        </Card>

        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Vista previa</h3>
            <span className="text-xs text-muted-foreground">Así la ven tus clientes (se actualiza mientras escribís)</span>
          </div>
          <div
            className="max-h-[44rem] overflow-y-auto overscroll-contain rounded-xl border border-border bg-background"
            data-testid="storefront-preview"
          >
            <StorefrontView store={previewStore} items={previewItems} preview />
          </div>
        </div>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold">Qué publicás</h3>
            <p className="text-sm text-muted-foreground">
              {publishedCount} {publishedCount === 1 ? "marcado" : "marcados"} para la vitrina. Nada se publica solo: elegí uno por uno o en lote.
              No se muestran los que no tienen stock, están reservados{draft.show_prices ? " o no tienen precio" : ""}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={publishable.length === 0}
              onClick={() => setBulk("publish")}
              data-testid="storefront-publish-all"
            >
              Publicar todo lo disponible{publishable.length > 0 ? ` (${publishable.length})` : ""}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={publishedCount === 0} onClick={() => setBulk("unpublish")}>
              Sacar todo
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={listSearch}
              onChange={(e) => { setListSearch(e.target.value); setShown(PAGE_SIZE); }}
              placeholder="Buscar producto…"
              className="pl-9"
              aria-label="Buscar producto"
            />
          </div>
          <div className="flex gap-1.5">
            {(
              [
                ["todos", "Todos"],
                ["publicados", "Publicados"],
                ["sin_publicar", "Sin publicar"],
              ] as [ListFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={listFilter === key}
                onClick={() => { setListFilter(key); setShown(PAGE_SIZE); }}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  listFilter === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Todavía no tenés productos en el catálogo.</p>
        ) : listed.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No hay productos con ese filtro.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {listed.slice(0, shown).map((item) => {
              const reason = hiddenReason(item, visibleOpts(item.id));
              return (
                <li key={item.id} className="flex items-center gap-3 p-3" data-testid={`storefront-row-${item.id}`}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <ShoppingBag className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {Number(item.selling_price) > 0 ? formatMoney(Number(item.selling_price)) : "Sin precio"}
                      {" · "}
                      {item.is_device ? "Equipo" : `Stock ${item.stock}`}
                    </p>
                  </div>
                  {reason && (
                    <Badge variant="outline" className="shrink-0 border-secondary/50 text-secondary" title="Está marcado, pero los clientes no lo ven por ahora">
                      No se ve: {reason}
                    </Badge>
                  )}
                  <Switch
                    checked={!!item.show_in_storefront}
                    disabled={busyIds.has(item.id)}
                    onCheckedChange={(v) => toggleItem(item, v)}
                    aria-label={`Publicar ${item.name} en la vitrina`}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {listed.length > shown && (
          <div className="mt-3 text-center">
            <Button type="button" variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>
              Mostrar más ({listed.length - shown})
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Para escribir una descripción pensada para el cliente, editá el producto y completá "Descripción para el cliente".
        </p>
      </Card>

      <AlertDialog open={bulk !== null} onOpenChange={(o) => { if (!o && !bulkRunning) setBulk(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulk === "publish" ? `Publicar ${publishable.length} productos` : `Sacar ${publishedCount} productos de la vitrina`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulk === "publish"
                ? "Se marcan para la vitrina todos los que tienen stock, no están reservados" + (draft.show_prices ? " y tienen precio." : ".") + " Podés sacar cualquiera cuando quieras."
                : "Los clientes dejan de verlos. Los productos no se borran ni cambian: solo dejan de estar en la vitrina."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkRunning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkRunning}
              onClick={(e) => { e.preventDefault(); void runBulk(); }}
            >
              {bulkRunning ? "Guardando…" : bulk === "publish" ? "Publicar" : "Sacar todo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
