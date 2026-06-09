import { useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  height?: number;
}

export function SignaturePad({ value, onChange, height = 180 }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Configure canvas size + DPR scaling. Re-applies scale after clear/resize.
  const setupCanvas = (preserve = true) => {
    const canvas = sigRef.current?.getCanvas();
    const wrap = wrapperRef.current;
    if (!canvas || !wrap) return;
    const ratio = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    if (!w) return;

    // Preserve current drawing data if requested
    const data = preserve && sigRef.current && !sigRef.current.isEmpty()
      ? sigRef.current.toData()
      : null;

    canvas.width = w * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx?.setTransform(1, 0, 0, 1, 0, 0);
    ctx?.scale(ratio, ratio);

    if (data && data.length > 0) {
      sigRef.current?.fromData(data);
    } else if (preserve && value) {
      sigRef.current?.fromDataURL(value);
    }
  };

  useEffect(() => {
    setupCanvas(true);
    const onResize = () => setupCanvas(true);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  const handleEnd = () => {
    if (!sigRef.current) return;
    if (sigRef.current.isEmpty()) {
      onChange("");
    } else {
      onChange(sigRef.current.getCanvas().toDataURL("image/png"));
    }
  };

  const clear = () => {
    sigRef.current?.clear();
    // clear() resets the canvas context transform (including DPR scale),
    // which breaks subsequent drawing. Re-apply the scale here.
    setupCanvas(false);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <div
        ref={wrapperRef}
        className="rounded-md border border-input bg-background"
        style={{ height }}
      >
        <SignatureCanvas
          ref={sigRef}
          penColor="hsl(var(--foreground))"
          onEnd={handleEnd}
          canvasProps={{ className: "w-full h-full rounded-md" }}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Firmá dentro del recuadro con el dedo o el mouse.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          <Eraser className="mr-1 h-3 w-3" /> Borrar firma
        </Button>
      </div>
    </div>
  );
}
