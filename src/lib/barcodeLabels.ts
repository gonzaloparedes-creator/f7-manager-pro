// Etiqueta de 60x40 mm con código de barras Code128 (nombre, precio opcional y
// código). Lógica pura + impresión en un iframe aislado, sin React ni Supabase.
// Nunca lleva costos: una etiqueta se pega en el producto y la ve el cliente.

import { escapeHtml } from "@/lib/devicePurchaseReceipt";
import { formatPYG } from "@/lib/orders";

export const LABEL_WIDTH_MM = 60;
export const LABEL_HEIGHT_MM = 40;
export const LABEL_SIDE_PADDING_MM = 3;
export const MAX_LABEL_COPIES = 200;
// Por debajo de este ancho de barra fina un lector térmico de 203 dpi empieza a fallar.
export const MIN_READABLE_MODULE_MM = 0.25;
const QUIET_ZONE_MODULES = 10;
const SVG_NS = "http://www.w3.org/2000/svg";

export interface LabelContent {
  name: string;
  barcode: string;
  price?: number | null;
}

export function clampCopies(raw: string | number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_LABEL_COPIES);
}

/** El precio sale solo si se pidió y es mayor a cero (un repuesto sin precio de venta no lleva "Gs. 0"). */
export function labelPriceText(price: number | null | undefined, show: boolean): string | null {
  const n = Number(price ?? 0);
  return show && Number.isFinite(n) && n > 0 ? formatPYG(n) : null;
}

export function moduleWidthMm(modules: number): number {
  if (!(modules > 0)) return 0;
  return (LABEL_WIDTH_MM - 2 * LABEL_SIDE_PADDING_MM) / modules;
}

export function isReadableOnLabel(modules: number): boolean {
  return moduleWidthMm(modules) >= MIN_READABLE_MODULE_MM;
}

async function loadJsBarcode() {
  const mod = (await import("jsbarcode")) as unknown as { default?: typeof import("jsbarcode") };
  return (mod.default ?? mod) as typeof import("jsbarcode");
}

/**
 * Dibuja solo las barras (sin el texto) con 1 unidad por módulo, así el ancho del
 * viewBox es la cantidad de módulos y la etiqueta las estira al ancho disponible.
 * Devuelve esa cantidad de módulos (incluye las zonas de silencio).
 */
export async function drawBarcode(svg: SVGSVGElement, code: string): Promise<number> {
  const JsBarcode = await loadJsBarcode();
  JsBarcode(svg, code, {
    format: "CODE128",
    width: 1,
    height: 60,
    margin: 0,
    marginLeft: QUIET_ZONE_MODULES,
    marginRight: QUIET_ZONE_MODULES,
    displayValue: false,
    background: "#ffffff",
    lineColor: "#000000",
  });
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("shape-rendering", "crispEdges");
  const box = (svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
  return box.length === 4 && box[2] > 0 ? box[2] : 0;
}

export async function barcodeSvgMarkup(code: string): Promise<{ markup: string; modules: number }> {
  const svg = document.createElementNS(SVG_NS, "svg");
  const modules = await drawBarcode(svg, code);
  return { markup: svg.outerHTML, modules };
}

export function buildLabelsHtml(
  label: LabelContent,
  barsMarkup: string,
  options: { copies: number; showPrice: boolean },
): string {
  const price = labelPriceText(label.price, options.showPrice);
  const one = `<section class="label">
  <div class="top">
    <div class="name">${escapeHtml(label.name)}</div>
    ${price ? `<div class="price">${escapeHtml(price)}</div>` : ""}
  </div>
  <div class="bottom">
    <div class="bars">${barsMarkup}</div>
    <div class="code">${escapeHtml(label.barcode)}</div>
  </div>
</section>`;
  const copies = clampCopies(options.copies);

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Etiquetas</title>
<style>
  @page { size: ${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
  .label { width: ${LABEL_WIDTH_MM}mm; height: ${LABEL_HEIGHT_MM}mm; padding: 2.5mm ${LABEL_SIDE_PADDING_MM}mm 2mm; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; break-after: page; page-break-after: always; }
  .label:last-child { break-after: auto; page-break-after: auto; }
  .name { font-size: 9.5pt; font-weight: 700; line-height: 1.15; max-height: 2.3em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
  .price { margin-top: 1mm; font-size: 14pt; font-weight: 800; line-height: 1; }
  .bars svg { display: block; width: 100%; height: 12mm; }
  .code { margin-top: 0.5mm; text-align: center; font-family: "Courier New", monospace; font-size: 8pt; letter-spacing: 0.12em; }
</style></head>
<body>
${Array.from({ length: copies }, () => one).join("\n")}
</body></html>`;
}

/** Arma las etiquetas y abre el diálogo de impresión en un iframe aislado (mismo criterio que el ticket). */
export async function printLabels(label: LabelContent, options: { copies: number; showPrice: boolean }): Promise<void> {
  const { markup } = await barcodeSvgMarkup(label.barcode);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => iframe.remove();
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) return cleanup();

  doc.open();
  doc.write(buildLabelsHtml(label, markup, options));
  doc.close();

  win.addEventListener("afterprint", cleanup, { once: true });
  // Un instante para que el iframe termine de maquetar antes de imprimir.
  window.setTimeout(() => {
    win.focus();
    win.print();
  }, 80);
  window.setTimeout(cleanup, 60000);
}
