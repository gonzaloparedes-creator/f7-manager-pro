import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatPYG } from "@/lib/orders";

interface TicketLineItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface TicketSale {
  id: string;
  created_at: string;
  payment_method: string | null;
  items: TicketLineItem[];
}

interface SaleTicketProps {
  sale: TicketSale;
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

// Dibuja el ticket en un <canvas> y lo pasa a blanco/negro puro (sin grises)
// antes de imprimir. Las impresoras térmicas/matriciales de bajo costo no
// saben qué hacer con el texto suavizado (antialiased) que genera el
// navegador: cada pixel gris del borde de una letra lo "ditherean" a su
// manera, y con fuentes chicas eso convierte el texto en ruido ilegible. Al
// forzar cada pixel a blanco o negro nosotros mismos, la impresora no tiene
// que adivinar nada.
function drawTicket(canvas: HTMLCanvasElement, sale: TicketSale, shopName: string, branchName: string | null | undefined, widthMm: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

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
    const font = `bold ${size}px monospace`;
    blocks.push({ kind: "center", text, font, height: size + lineGap });
  };
  const addRow = (left: string, right: string, size: number) => {
    const font = `bold ${size}px monospace`;
    blocks.push({ kind: "row", left, right, font, height: size + lineGap });
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
  canvas.height = totalHeight; // vuelve a limpiar el canvas y resetea el estado del contexto

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
}

export function SaleTicket({ sale, businessName, branchName, widthMm = 80 }: SaleTicketProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shopName = businessName?.trim() || "F7 Manager Pro";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawTicket(canvas, sale, shopName, branchName, widthMm);
  }, [sale, shopName, branchName, widthMm]);

  return (
    <div className="print-ticket" style={{ width: `${widthMm}mm` }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Ticket de venta ${sale.id.slice(-6).toUpperCase()}`}
        style={{ width: "100%", height: "auto", display: "block", imageRendering: "pixelated" }}
      />
    </div>
  );
}
