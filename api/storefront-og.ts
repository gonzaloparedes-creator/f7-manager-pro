// Vista previa del link de la Vitrina online (/v/:slug y /v/:slug/:itemId) para
// WhatsApp, Instagram, Facebook, etc. Solo la ven crawlers y clientes que piden
// la página sin ser un navegador (ver los rewrites condicionales en vercel.json,
// mismo criterio que api/tracking-og.ts): esos bots no ejecutan JavaScript, así
// que sin esto verían el <meta> genérico de index.html.
//
// Los datos salen de la RPC pública get_storefront_og, que ya aplica el candado
// de la vitrina (plan Business, empresa activa, vitrina encendida) y devuelve
// solo nombre, logo, portada, frase y, si es un artículo, su nombre, precio,
// foto y descripción pública. Nunca costos ni IMEI.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const BASE_URL = "https://f7manager.com";
const DEFAULT_TITLE = "Vitrina online | F7 Manager Pro";
const DEFAULT_DESCRIPTION = "Mirá los productos disponibles y consultá por WhatsApp.";
const OG_IMAGE = "https://f7manager.com/f7-logo.png";

const SLUG_RE = /^[a-z0-9-]{1,60}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OgInfo {
  name: string;
  logo_url: string | null;
  banner_url: string | null;
  tagline: string | null;
  show_prices: boolean;
  item: {
    name: string;
    price: number | null;
    image_url: string | null;
    public_description: string | null;
  } | null;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function formatPrice(value: number) {
  return `Gs. ${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function renderHtml(title: string, description: string, url: string, image: string = OG_IMAGE) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(image);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${t}</title>
<meta name="description" content="${d}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${img}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />
<meta http-equiv="refresh" content="0; url=${escapeHtml(url)}" />
</head>
<body></body>
</html>`;
}

export default async function handler(req: any, res: any) {
  const slug = typeof req.query.slug === "string" ? req.query.slug.toLowerCase() : "";
  const rawItem = typeof req.query.item === "string" ? req.query.item : "";
  const itemId = UUID_RE.test(rawItem) ? rawItem.toLowerCase() : "";
  const validSlug = SLUG_RE.test(slug);

  const url = validSlug ? `${BASE_URL}/v/${slug}${itemId ? `/${itemId}` : ""}` : BASE_URL;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");

  if (!validSlug || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(200).send(renderHtml(DEFAULT_TITLE, DEFAULT_DESCRIPTION, url));
    return;
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_storefront_og`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(itemId ? { _slug: slug, _item_id: itemId } : { _slug: slug }),
    });
    const info = (await r.json()) as OgInfo | null;

    if (!r.ok || !info || typeof info.name !== "string") {
      res.status(200).send(renderHtml(DEFAULT_TITLE, DEFAULT_DESCRIPTION, url));
      return;
    }

    const storeImage = info.banner_url || info.logo_url || OG_IMAGE;
    const storeDescription = clip(info.tagline?.trim() || `Mirá lo que tenemos en ${info.name} y consultanos por WhatsApp.`, 200);

    if (info.item) {
      const { item } = info;
      const priced = info.show_prices && item.price !== null && item.price > 0;
      const description = clip(
        item.public_description?.trim() ||
          `${priced ? `${formatPrice(item.price as number)}. ` : ""}Consultá disponibilidad por WhatsApp en ${info.name}.`,
        200
      );
      const title = `${priced ? `${item.name} · ${formatPrice(item.price as number)}` : item.name} · ${info.name}`;
      res.status(200).send(renderHtml(title, description, url, item.image_url || storeImage));
      return;
    }

    res.status(200).send(renderHtml(`${info.name} · Vitrina`, storeDescription, url, storeImage));
  } catch {
    res.status(200).send(renderHtml(DEFAULT_TITLE, DEFAULT_DESCRIPTION, url));
  }
}
