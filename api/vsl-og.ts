// Vista previa del link de las páginas del video (/py y /latam) para WhatsApp,
// Instagram, Facebook, etc. Solo la ven crawlers y clientes que piden la página sin
// ser un navegador (rewrites condicionales en vercel.json, mismo criterio que
// api/tracking-og.ts): esos bots no ejecutan JavaScript y sin esto verían el <meta>
// genérico de index.html (logo y «F7 Manager Pro»). Muestra la portada del video con
// el botón de play. Si el link trae ?g= (de qué grupo viene), se conserva al redirigir.

const BASE_URL = "https://f7manager.com";

const PAGES = {
  py: {
    title: "Mirá cómo funciona F7 Manager por dentro (video de 6 min)",
    description:
      "El sistema para talleres de reparación: órdenes con fotos, garantías, el aviso para tu cliente listo para WhatsApp y cuánto ganaste. 7 días de garantía.",
  },
  latam: {
    title: "Mirá cómo funciona F7 Manager por dentro (video de 6 min)",
    description:
      "El sistema para talleres de reparación, con precios en dólares: órdenes con fotos, garantías, avisos por WhatsApp y cuánto ganaste. 7 días de garantía.",
  },
} as const;

type Page = keyof typeof PAGES;

const GROUP_RE = /^[a-z0-9]{1,12}$/i;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderVslOg(page: Page, group: string) {
  const { title, description } = PAGES[page];
  const canonical = `${BASE_URL}/${page}`;
  const url = GROUP_RE.test(group) ? `${canonical}?g=${group}` : canonical;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = `${BASE_URL}/${page}/vsl-og.jpg`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${t}</title>
<meta name="description" content="${d}" />
<meta property="og:type" content="video.other" />
<meta property="og:site_name" content="F7 Manager" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${img}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${canonical}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />
<meta http-equiv="refresh" content="0; url=${escapeHtml(url)}" />
</head>
<body></body>
</html>`;
}

export default function handler(req: any, res: any) {
  const page: Page = req.query.page === "latam" ? "latam" : "py";
  const group = typeof req.query.g === "string" ? req.query.g : "";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.status(200).send(renderVslOg(page, group));
}
