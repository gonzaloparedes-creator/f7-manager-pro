import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatPYG } from "@/lib/orders";

interface TicketLineItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface TicketSale {
  id: string;
  created_at: string;
  payment_method: string | null;
  items: TicketLineItem[];
}

interface TicketOptions {
  businessName?: string | null;
  branchName?: string | null;
  widthMm?: number;
}

// ~203dpi: la resolución típica del cabezal de una impresora térmica/POS.
const PX_PER_MM = 8;
const PADDING_MM = 3;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  return lines.length > 0 ? lines : current ? [current] : [""];
}

type Block =
  | { kind: "center"; text: string; font: string; height: number }
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
  widthMm: number;
  /** Alto real del contenido dibujado. */
  contentHeightMm: number;
  /** Alto de la página a imprimir (nunca menor al ancho: ver buildTicketImage). */
  heightMm: number;
}

export function buildTicketImage(sale: TicketSale, options: TicketOptions = {}): TicketImage | null {
  const { businessName, branchName, widthMm = 80 } = options;
  const shopName = businessName?.trim() || "F7 Manager Pro";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const total = sale.items.reduce((s, i) => s + i.quantity * Number(i.unit_price || 0), 0);
  const ticketNumber = sale.id.slice(-6).toUpperCase();
  const dateLabel = format(new Date(sale.created_at), "dd/MM/yy HH:mm", { locale: es });

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
  const addCenter = (text: string, size: number) => {
    blocks.push({ kind: "center", text, font: `bold ${size}px monospace`, height: size + lineGap });
  };
  const addRow = (left: string, right: string, size: number) => {
    blocks.push({ kind: "row", left, right, font: `bold ${size}px monospace`, height: size + lineGap });
  };
  const addWrapped = (text: string, size: number) => {
    const font = `bold ${size}px monospace`;
    ctx.font = font;
    const lines = wrapText(ctx, text, contentWidth);
    blocks.push({ kind: "lines", lines, font, size, height: lines.length * (size + lineGap) });
  };
  const addDashed = () => blocks.push({ kind: "dashed", height: Math.round(1.5 * PX_PER_MM) + sectionGap });
  const addGap = (mm: number) => blocks.push({ kind: "gap", height: Math.round(mm * PX_PER_MM) });

  addCenter(shopName, fontHeader);
  if (branchName) addCenter(branchName, fontSmall);
  addCenter("Comprobante de venta", fontSmall);
  addGap(1);
  addDashed();
  addRow(`Ticket #${ticketNumber}`, dateLabel, fontSmall);
  addDashed();
  for (const item of sale.items) {
    addWrapped(item.product_name, fontBody);
    addRow(`${item.quantity} x ${formatPYG(item.unit_price)}`, formatPYG(item.quantity * Number(item.unit_price || 0)), fontBody);
    addGap(0.8);
  }
  addDashed();
  addRow("TOTAL", formatPYG(total), fontTotal);
  addRow("Pago", sale.payment_method || "—", fontSmall);
  addDashed();
  addCenter("¡Gracias por su compra!", fontSmall);
  addGap(1);

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
      ctx.fillText(block.text, width / 2, y);
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
    widthMm,
    contentHeightMm,
    // La página nunca puede ser más ancha que alta: una página apaisada hace
    // que el driver rote el ticket 90° y salga impreso de costado sobre el
    // rollo. Con tickets cortos (pocos ítems) se agrega un poco de papel en
    // blanco al final, que es el precio de que salga derecho.
    heightMm: Math.max(contentHeightMm, widthMm + 5),
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
export function printTicket(sale: TicketSale, options: TicketOptions = {}): void {
  const image = buildTicketImage(sale, options);
  if (!image) return;
  const { dataUrl, widthMm, heightMm } = image;

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
      `img { display: block; width: ${widthMm}mm; height: auto; image-rendering: pixelated; }` +
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
