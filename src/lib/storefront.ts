import type { CSSProperties } from "react";
import { formatPYG } from "@/lib/orders";
import { toWhatsAppPhone } from "@/lib/whatsapp";

export interface StorefrontStore {
  slug: string;
  name: string;
  logo_url: string | null;
  tagline: string | null;
  whatsapp_phone: string | null;
  address: string | null;
  accent_color: string | null;
  installments_text: string | null;
  show_prices: boolean;
  show_stock: boolean;
}

export interface StorefrontItem {
  id: string;
  name: string;
  price: number | null;
  image_url: string | null;
  category_id: string | null;
  category: string | null;
  is_device: boolean;
  battery_health: number | null;
  stock: number | null;
  public_description?: string | null;
  created_at: string;
}

export interface StorefrontData {
  store: StorefrontStore;
  items: StorefrontItem[];
}

export interface StorefrontItemData {
  store: StorefrontStore;
  item: StorefrontItem | null;
  similar: StorefrontItem[];
}

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
}

export function slugify(text: string): string {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/** null si el enlace es válido; si no, el motivo para mostrarle al usuario. */
export function validateSlug(slug: string): string | null {
  if (slug.length < SLUG_MIN) return `Usá al menos ${SLUG_MIN} caracteres.`;
  if (slug.length > SLUG_MAX) return `Usá como máximo ${SLUG_MAX} caracteres.`;
  if (!SLUG_RE.test(slug)) return "Solo letras minúsculas, números y guiones (sin empezar ni terminar con guion).";
  return null;
}

export function storefrontPath(slug: string, itemId?: string): string {
  return itemId ? `/v/${slug}/${itemId}` : `/v/${slug}`;
}

export function storefrontUrl(slug: string, origin: string, itemId?: string): string {
  return `${origin.replace(/\/$/, "")}${storefrontPath(slug, itemId)}`;
}

/** Guarda solo dígitos con código de país (lo que exige la base); null si no sirve. */
export function normalizeStorefrontPhone(raw: string | null | undefined): string | null {
  return toWhatsAppPhone(raw ?? "");
}

export const ACCENT_PRESETS: { label: string; value: string }[] = [
  { label: "Turquesa", value: "#00C2C7" },
  { label: "Azul", value: "#2563EB" },
  { label: "Verde", value: "#16A34A" },
  { label: "Violeta", value: "#7C3AED" },
  { label: "Rosa", value: "#DB2777" },
  { label: "Grafito", value: "#1F2937" },
];

const FOREGROUND_DARK = "212 52% 11%";
const FOREGROUND_LIGHT = "0 0% 100%";

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, Math.round(l * 100)];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rr) h = ((gg - bb) / d) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return [h, Math.round(s * 100), Math.round(l * 100)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/**
 * Pisa los colores de acento de la app solo dentro de la vitrina: el color de
 * marca del taller. El texto sobre el acento pasa a blanco u oscuro según el
 * contraste. Sin color válido devuelve {} y queda el turquesa de siempre.
 */
export function accentStyle(hex: string | null | undefined): CSSProperties {
  const rgb = hex ? hexToRgb(hex) : null;
  if (!rgb) return {};
  const [h, s, l] = rgbToHsl(rgb);
  const base = `${h} ${s}% ${l}%`;
  const glow = `${h} ${s}% ${Math.min(l + 8, 92)}%`;
  const fg = luminance(rgb) > 0.4 ? FOREGROUND_DARK : FOREGROUND_LIGHT;
  return {
    ["--primary" as string]: base,
    ["--ring" as string]: base,
    ["--primary-glow" as string]: glow,
    ["--primary-foreground" as string]: fg,
  };
}

export interface StorefrontSourceItem {
  is_for_sale?: boolean;
  show_in_storefront?: boolean | null;
  stock: number;
  selling_price: number;
}

/** Espejo en el cliente de storefront_rows() (SQL): decide qué se muestra en la vitrina. */
export function isStorefrontVisible(item: StorefrontSourceItem, opts: { showPrices: boolean; reserved: boolean }): boolean {
  if (item.is_for_sale === false) return false;
  if (!item.show_in_storefront) return false;
  if (!(item.stock > 0)) return false;
  if (opts.reserved) return false;
  if (opts.showPrices && !(Number(item.selling_price) > 0)) return false;
  return true;
}

/** Por qué un producto marcado para la vitrina no se ve (para avisárselo al admin). */
export function hiddenReason(item: StorefrontSourceItem, opts: { showPrices: boolean; reserved: boolean }): string | null {
  if (!item.show_in_storefront) return null;
  if (!(item.stock > 0)) return "Sin stock";
  if (opts.reserved) return "Reservado";
  if (opts.showPrices && !(Number(item.selling_price) > 0)) return "Sin precio";
  return null;
}

export type SortKey = "recientes" | "precio_asc" | "precio_desc" | "nombre";

export const SORT_LABELS: Record<SortKey, string> = {
  recientes: "Más recientes",
  precio_asc: "Menor precio",
  precio_desc: "Mayor precio",
  nombre: "Nombre (A-Z)",
};

export const NO_CATEGORY_KEY = "__sin_categoria__";

export interface CatalogQuery {
  text: string;
  category: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  sort: SortKey;
}

export const EMPTY_QUERY: CatalogQuery = { text: "", category: null, minPrice: null, maxPrice: null, sort: "recientes" };

export function categoryKey(item: Pick<StorefrontItem, "category_id">): string {
  return item.category_id ?? NO_CATEGORY_KEY;
}

export interface CategoryOption {
  key: string;
  label: string;
  count: number;
}

export function categoriesOf(items: StorefrontItem[]): CategoryOption[] {
  const map = new Map<string, CategoryOption>();
  for (const it of items) {
    const key = categoryKey(it);
    const cur = map.get(key) ?? { key, label: it.category_id ? it.category ?? "Otros" : "Otros", count: 0 };
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.key === NO_CATEGORY_KEY) return 1;
    if (b.key === NO_CATEGORY_KEY) return -1;
    return a.label.localeCompare(b.label);
  });
}

export function priceBounds(items: StorefrontItem[]): { min: number; max: number } | null {
  const prices = items.map((i) => i.price).filter((p): p is number => p !== null && p > 0);
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function normalize(text: string): string {
  return stripAccents(text).toLowerCase();
}

export function isDefaultQuery(q: CatalogQuery): boolean {
  return !q.text.trim() && q.category === null && q.minPrice === null && q.maxPrice === null && q.sort === "recientes";
}

export function applyCatalogQuery(items: StorefrontItem[], q: CatalogQuery): StorefrontItem[] {
  const needle = normalize(q.text.trim());
  const filtered = items.filter((it) => {
    if (needle && !normalize(it.name).includes(needle) && !normalize(it.category ?? "").includes(needle)) return false;
    if (q.category !== null && categoryKey(it) !== q.category) return false;
    if (q.minPrice !== null && !(it.price !== null && it.price >= q.minPrice)) return false;
    if (q.maxPrice !== null && !(it.price !== null && it.price <= q.maxPrice)) return false;
    return true;
  });
  const sorted = [...filtered];
  if (q.sort === "nombre") sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
  else if (q.sort === "precio_asc" || q.sort === "precio_desc") {
    const dir = q.sort === "precio_asc" ? 1 : -1;
    sorted.sort((a, b) => {
      if (a.price === null && b.price === null) return 0;
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return (a.price - b.price) * dir;
    });
  } else {
    sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return sorted;
}

/** "150000" o "150.000" → 150000; vacío o inválido → null. */
export function parsePriceInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export function priceLabel(item: Pick<StorefrontItem, "price">): string {
  return item.price !== null && item.price > 0 ? formatPYG(item.price) : "Consultar precio";
}

export function whatsappLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

export function buildInterestMessage(item: Pick<StorefrontItem, "name" | "price">, storeName: string, link?: string): string {
  const price = item.price !== null && item.price > 0 ? ` (${formatPYG(item.price)})` : "";
  const lines = [`Hola ${storeName}! Vi "${item.name}"${price} en su vitrina y me interesa.`];
  if (link) lines.push(link);
  return lines.join("\n");
}

export function buildGeneralMessage(storeName: string): string {
  return `Hola ${storeName}! Estuve viendo su vitrina y quería hacerles una consulta.`;
}

export function stockLabel(item: Pick<StorefrontItem, "stock" | "is_device">): string | null {
  if (item.is_device || item.stock === null) return null;
  return item.stock === 1 ? "Última unidad" : `${item.stock} disponibles`;
}
