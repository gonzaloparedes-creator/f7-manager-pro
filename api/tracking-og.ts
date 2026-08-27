// Solo lo ven crawlers de redes sociales (WhatsApp, Facebook, Twitter, etc.),
// nunca un usuario real — ver el rewrite condicional por User-Agent en
// vercel.json. Esos bots no ejecutan JavaScript, así que el <meta> estático
// de index.html (con el título/descripción genéricos de F7 Manager Pro) es
// lo único que ven cuando alguien comparte un link de seguimiento. Esta
// función arma en su lugar un preview dinámico ("Seguimiento · {Taller}")
// consultando datos mínimos y no sensibles vía la RPC get_tracking_og_info.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const STATUS_LABELS: Record<string, string> = {
  presupuesto: "Presupuesto",
  recibido: "Recibido",
  en_diagnostico: "En diagnóstico",
  en_reparacion: "En reparación",
  listo: "Listo para retirar",
  entregado: "Entregado",
  garantia: "Garantía",
};

const DEFAULT_TITLE = "Seguimiento de reparación | F7 Manager Pro";
const DEFAULT_DESCRIPTION = "Consultá el estado de tu equipo en tiempo real.";
const OG_IMAGE = "https://f7manager.com/f7-logo.png";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const url = `https://f7manager.com/tracking/${encodeURIComponent(code)}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");

  if (!code || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(200).send(renderHtml(DEFAULT_TITLE, DEFAULT_DESCRIPTION, url));
    return;
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_tracking_og_info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ _code: code }),
    });
    const rows = await r.json();
    const info = Array.isArray(rows) ? rows[0] : null;

    if (!info) {
      res.status(200).send(renderHtml(DEFAULT_TITLE, DEFAULT_DESCRIPTION, url));
      return;
    }

    const title = `Seguimiento ${info.order_number} · ${info.company_name}`;
    const statusLabel = STATUS_LABELS[info.status] ?? info.status;
    const description = `${info.device_type} — Estado: ${statusLabel}. Consultá el estado de tu equipo en tiempo real.`;
    res.status(200).send(renderHtml(title, description, url, info.company_logo_url || OG_IMAGE));
  } catch {
    res.status(200).send(renderHtml(DEFAULT_TITLE, DEFAULT_DESCRIPTION, url));
  }
}
