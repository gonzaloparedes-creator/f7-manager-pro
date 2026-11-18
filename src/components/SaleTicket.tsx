import { buildTicketRows, rowFits, wrapTextToWidth, type TicketTextSize } from "@/lib/ticketRows";

interface TicketLineItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  imei?: string | null;
  warranty_days?: number | null;
}

export interface TicketSale {
  id: string;
  created_at: string;
  payment_method: string | null;
  items: TicketLineItem[];
  trade_in?: { device_name: string; value: number } | null;
  /** Seña de una reserva que se descuenta de lo que se cobra. */
  deposit?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
}

interface TicketOptions {
  businessName?: string | null;
  branchName?: string | null;
  widthMm?: number;
}

// 8 puntos/mm = 203dpi, la resolución del cabezal de casi toda térmica POS
// (3nstar RPT001, Epson TM-T20, genéricas POS-58/80). Dibujar a esta escala
// hace que la imagen entre 1:1 en el cabezal, sin reescalados.
const PX_PER_MM = 8;
const PADDING_MM = 3;

// El cabezal NO cubre todo el ancho del papel: un rollo de 80mm imprime 72mm
// y uno de 58mm imprime 48mm (el resto son los márgenes mecánicos). Si se
// manda una imagen del ancho del papel, el driver la achica para que entre en
// el área imprimible y, al ser blanco/negro puro, ese achique borra columnas
// enteras de píxeles: las letras salen rotas y despintadas.
function printableWidthMm(paperWidthMm: number): number {
  if (paperWidthMm >= 76) return 72;
  if (paperWidthMm >= 54) return 48;
  return Math.max(20, paperWidthMm - 8);
}

// El partido de líneas vive en ticketRows.ts (wrapTextToWidth) para poder probarlo:
// la versión que había acá se comía la última línea de todo texto que se partía.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  return wrapTextToWidth((t) => ctx.measureText(t).width, text, maxWidth);
}

type Block =
  | { kind: "center"; lines: string[]; font: string; size: number; height: number }
  | { kind: "row"; left: string; right: string; font: string; height: number }
  | { kind: "lines"; lines: string[]; font: string; size: number; height: number }
  | { kind: "dashed"; height: number }
  | { kind: "gap"; height: number };

// Dibuja el ticket en un canvas y lo pasa a blanco/negro puro (sin grises).
// Las impresoras térmicas/POS baratas no saben qué hacer con el texto
// suavizado (antialiased) del navegador: "ditherean" cada pixel gris a su
// manera y con fuentes chicas el texto se vuelve ruido ilegible. Forzando
// cada pixel a blanco o negro, la impresora no tiene que adivinar nada.
export interface TicketImage {
  dataUrl: string;
  /** Ancho del papel = ancho de la página a imprimir. */
  widthMm: number;
  /** Ancho de la imagen: el área que el cabezal realmente imprime. */
  imageWidthMm: number;
  /** Alto real del contenido dibujado. */
  contentHeightMm: number;
  /** Alto de la página a imprimir (nunca menor al ancho: ver buildTicketImage). */
  heightMm: number;
}

export function buildTicketImage(sale: TicketSale, options: TicketOptions = {}): TicketImage | null {
  const { businessName, branchName, widthMm: paperWidthMm = 80 } = options;
  const shopName = businessName?.trim() || "F7 Manager Pro";
  // Se dibuja al ancho imprimible, no al del papel: así la imagen entra tal
  // cual en el cabezal y el driver no tiene que reescalar nada.
  const widthMm = printableWidthMm(paperWidthMm);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const width = Math.round(widthMm * PX_PER_MM);
  const padding = Math.round(PADDING_MM * PX_PER_MM);
  const contentWidth = width - padding * 2;

  const fontHeader = Math.round(4.2 * PX_PER_MM);
  const fontBody = Math.round(3.3 * PX_PER_MM);
  const fontSmall = Math.round(3 * PX_PER_MM);
  const fontTotal = Math.round(3.8 * PX_PER_MM);
  const lineGap = Math.round(1.3 * PX_PER_MM);
  const sectionGap = Math.round(2 * PX_PER_MM);

  canvas.width = width;
  canvas.height = 4000; // alto provisorio solo para medir texto; se recorta después
  ctx.textBaseline = "top";

  const blocks: Block[] = [];
  // Centrado: un nombre de negocio largo se parte en varias líneas en vez de salirse
  // por los dos lados del papel.
  const addCenter = (text: string, size: number) => {
    const font = `bold ${size}px monospace`;
    ctx.font = font;
    const lines = wrapText(ctx, text, contentWidth);
    blocks.push({ kind: "center", lines, font, size, height: lines.length * (size + lineGap) });
  };
  // Dos textos en la misma línea (izquierda y derecha). Si juntos no entran en el ancho
  // del papel, el de la derecha baja a la línea siguiente, alineado a la derecha: antes se
  // dibujaban uno encima del otro y no se entendía ninguno de los dos.
  const addRow = (left: string, right: string, size: number) => {
    const font = `bold ${size}px monospace`;
    ctx.font = font;
    const height = size + lineGap;
    if (rowFits(ctx.measureText(left).width, ctx.measureText(right).width, contentWidth, size)) {
      blocks.push({ kind: "row", left, right, font, height });
      return;
    }
    blocks.push({ kind: "row", left, right: "", font, height });
    blocks.push({ kind: "row", left: "", right, font, height });
  };
  const addWrapped = (text: string, size: number) => {
    const font = `bold ${size}px monospace`;
    ctx.font = font;
    const lines = wrapText(ctx, text, contentWidth);
    blocks.push({ kind: "lines", lines, font, size, height: lines.length * (size + lineGap) });
  };
  const addDashed = () => blocks.push({ kind: "dashed", height: Math.round(1.5 * PX_PER_MM) + sectionGap });
  const addGap = (mm: number) => blocks.push({ kind: "gap", height: Math.round(mm * PX_PER_MM) });

  // El contenido (qué dice cada fila) sale de buildTicketRows; acá solo se le da tamaño.
  const fontSizes: Record<TicketTextSize, number> = {
    header: fontHeader,
    body: fontBody,
    small: fontSmall,
    total: fontTotal,
  };
  for (const row of buildTicketRows(sale, shopName, branchName)) {
    if (row.kind === "center") addCenter(row.text, fontSizes[row.size]);
    else if (row.kind === "text") addWrapped(row.text, fontSizes[row.size]);
    else if (row.kind === "pair") addRow(row.left, row.right, fontSizes[row.size]);
    else if (row.kind === "dashed") addDashed();
    else addGap(row.mm);
  }

  const totalHeight = padding * 2 + blocks.reduce((s, b) => s + b.height, 0);
  canvas.height = totalHeight; // limpia el canvas y resetea el estado del contexto

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, totalHeight);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";

  let y = padding;
  for (const block of blocks) {
    if (block.kind === "gap") { y += block.height; continue; }
    if (block.kind === "dashed") {
      const dashW = Math.round(1.2 * PX_PER_MM);
      const gapW = Math.round(0.8 * PX_PER_MM);
      const dashH = Math.max(1, Math.round(0.35 * PX_PER_MM));
      const lineY = y + Math.round(0.5 * PX_PER_MM);
      for (let x = padding; x < width - padding; x += dashW + gapW) {
        ctx.fillRect(x, lineY, dashW, dashH);
      }
      y += block.height;
      continue;
    }
    ctx.font = block.font;
    if (block.kind === "center") {
      ctx.textAlign = "center";
      block.lines.forEach((line, i) => ctx.fillText(line, width / 2, y + i * (block.size + lineGap)));
    } else if (block.kind === "row") {
      ctx.textAlign = "left";
      ctx.fillText(block.left, padding, y);
      ctx.textAlign = "right";
      ctx.fillText(block.right, width - padding, y);
    } else {
      ctx.textAlign = "left";
      block.lines.forEach((line, i) => ctx.fillText(line, padding, y + i * (block.size + lineGap)));
    }
    y += block.height;
  }

  const imageData = ctx.getImageData(0, 0, width, totalHeight);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const v = luminance < 190 ? 0 : 255;
    data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  // Se redondea hacia arriba: si la página quedara un pelo más baja que la
  // imagen, el sobrante se va a una segunda página (y en un rollo continuo eso
  // sale como una segunda impresión pegada a la primera).
  const contentHeightMm = Math.ceil((totalHeight / PX_PER_MM) * 10) / 10 + 0.5;

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: paperWidthMm,
    imageWidthMm: widthMm,
    contentHeightMm,
    // La página nunca puede ser más ancha que alta: una página apaisada hace
    // que el driver rote el ticket 90° y salga impreso de costado sobre el
    // rollo. Con tickets cortos (pocos ítems) se agrega un poco de papel en
    // blanco al final, que es el precio de que salga derecho.
    heightMm: Math.max(contentHeightMm, paperWidthMm + 5),
  };
}

// Imprime el ticket en un iframe aislado que contiene únicamente la imagen,
// con la página del tamaño exacto del ticket.
//
// Antes se imprimía desde la propia página y salía doble/encimado por dos
// motivos que se acumulaban:
//   1. El documento arrastraba el CSS de la app (`html, body, #root` forzados
//      a 210mm de ancho por el comprobante A4) y el ticket estaba en
//      `position: fixed`, que por especificación se repite en cada página.
//   2. `@page { size: Xmm auto }` Chrome lo ignora y cae a tamaño Carta, así
//      que el trabajo nunca fue del ancho del rollo: el driver lo reescalaba
//      para "ajustar a página". Con ambas medidas explícitas sí lo respeta.
//   3. Con las medidas explícitas, un ticket corto daba una página más ancha
//      que alta (apaisada) y el driver la rotaba 90°: salía de costado. Por
//      eso el alto de página nunca baja del ancho — ver buildTicketImage.
//   4. La imagen iba al ancho del papel (80mm) pero el cabezal solo imprime
//      72mm, así que el driver la achicaba ~10% y ese achique, sobre una
//      imagen de 1 bit, borraba columnas de píxeles: letras rotas. Ahora se
//      dibuja directo al ancho imprimible — ver printableWidthMm.
export function printTicket(sale: TicketSale, options: TicketOptions = {}): void {
  const image = buildTicketImage(sale, options);
  if (!image) return;
  const { dataUrl, widthMm, imageWidthMm, heightMm } = image;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => iframe.remove();

  const doc = iframe.contentDocument;
  if (!doc) return cleanup();
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>` +
      `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }` +
      `html, body { margin: 0; padding: 0; background: #fff; }` +
      // Sin image-rendering: pixelated. Si igual quedara algún reescalado
      // mínimo, la interpolación suave degrada los trazos; el vecino más
      // cercano directamente los borra.
      `img { display: block; width: ${imageWidthMm}mm; height: auto; margin: 0 auto; }` +
      `</style></head><body><img src="${dataUrl}" alt="Ticket de venta"></body></html>`
  );
  doc.close();

  // Esperar a la imagen explícitamente: el load del iframe puede dispararse
  // con el about:blank inicial, antes de que exista el contenido.
  const start = () => {
    const win = iframe.contentWindow;
    if (!win) return cleanup();
    win.addEventListener("afterprint", cleanup, { once: true });
    win.focus();
    win.print();
    // Respaldo por si el navegador no dispara afterprint (algunos móviles).
    window.setTimeout(cleanup, 60000);
  };

  const img = doc.querySelector("img");
  if (!img) return cleanup();
  if (img.complete) start();
  else {
    img.onload = start;
    img.onerror = cleanup;
  }
}
