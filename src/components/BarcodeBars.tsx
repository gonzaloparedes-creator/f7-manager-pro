import { useEffect, useRef } from "react";
import { drawBarcode } from "@/lib/barcodeLabels";

/** Barras Code128 de un código; avisa por onDrawn cuántos módulos ocupa (0 si no se pudo dibujar). */
export default function BarcodeBars({
  code,
  onDrawn,
  className,
}: {
  code: string;
  onDrawn?: (modules: number) => void;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    let cancelled = false;
    drawBarcode(svg, code)
      .then((modules) => { if (!cancelled) onDrawn?.(modules); })
      .catch(() => { if (!cancelled) onDrawn?.(0); });
    return () => { cancelled = true; };
  }, [code, onDrawn]);

  return <svg ref={ref} className={className} role="img" aria-label={`Código de barras ${code}`} />;
}
