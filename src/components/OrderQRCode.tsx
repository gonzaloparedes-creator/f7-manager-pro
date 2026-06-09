import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Copy, Download, Printer, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OrderQRCodeProps {
  orderCode: string;
}

export function OrderQRCode({ orderCode }: OrderQRCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const trackingUrl = `${window.location.origin}/tracking/${orderCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(trackingUrl);
    toast({ title: "¡Copiado!", description: "Link público de seguimiento copiado." });
  };

  const downloadQR = () => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${orderCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const printQR = () => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank", "width=420,height=560");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>QR ${orderCode}</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 24px; }
            img { width: 280px; height: 280px; }
            .code { font-family: ui-monospace, monospace; font-size: 20px; font-weight: 600; margin-top: 16px; }
            .url { color: #555; font-size: 12px; margin-top: 6px; word-break: break-all; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="QR ${orderCode}" />
          <div class="code">${orderCode}</div>
          <div class="url">${trackingUrl}</div>
          <script>
            window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2 self-start text-sm font-semibold">
        <QrCode className="h-4 w-4 text-primary" /> Código QR de seguimiento
      </div>
      <p className="self-start text-xs text-muted-foreground">
        El cliente puede escanearlo para ver el estado de su reparación.
      </p>
      <div ref={containerRef} className="rounded-md border border-border bg-white p-3">
        <QRCodeCanvas
          value={trackingUrl}
          size={180}
          level="M"
          includeMargin={false}
        />
      </div>
      <div className="break-all text-center font-mono text-xs text-muted-foreground">
        {trackingUrl}
      </div>
      <div className="flex w-full flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copyLink} className="flex-1 gap-2">
          <Copy className="h-4 w-4" /> Copiar
        </Button>
        <Button variant="outline" size="sm" onClick={downloadQR} className="flex-1 gap-2">
          <Download className="h-4 w-4" /> PNG
        </Button>
        <Button variant="outline" size="sm" onClick={printQR} className="flex-1 gap-2">
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
      </div>
    </div>
  );
}
