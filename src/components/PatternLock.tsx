import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PatternLockProps {
  value: number[];
  onChange: (pattern: number[]) => void;
  size?: number;
}

/**
 * 3x3 Android-style pattern lock.
 * Dots are numbered 1-9 (left-to-right, top-to-bottom).
 * Supports drag (mouse/touch) and click-to-add.
 */
export function PatternLock({ value, onChange, size = 240 }: PatternLockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const cellSize = size / 3;
  const dotRadius = Math.max(8, cellSize * 0.12);

  const dotCenter = (n: number) => {
    const idx = n - 1;
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    return { x: col * cellSize + cellSize / 2, y: row * cellSize + cellSize / 2 };
  };

  const dotAtPoint = (x: number, y: number): number | null => {
    for (let n = 1; n <= 9; n++) {
      const c = dotCenter(n);
      const dx = x - c.x;
      const dy = y - c.y;
      if (dx * dx + dy * dy <= (dotRadius * 2.2) ** 2) return n;
    }
    return null;
  };

  const localPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const addDot = useCallback(
    (n: number) => {
      if (value.includes(n)) return;
      onChange([...value, n]);
    },
    [value, onChange],
  );

  const start = (clientX: number, clientY: number) => {
    const { x, y } = localPoint(clientX, clientY);
    const n = dotAtPoint(x, y);
    setDrawing(true);
    setCursor({ x, y });
    if (n) onChange([n]);
    else onChange([]);
  };

  const move = (clientX: number, clientY: number) => {
    if (!drawing) return;
    const { x, y } = localPoint(clientX, clientY);
    setCursor({ x, y });
    const n = dotAtPoint(x, y);
    if (n) addDot(n);
  };

  const end = () => {
    setDrawing(false);
    setCursor(null);
  };

  useEffect(() => {
    if (!drawing) return;
    const onMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onUp = () => end();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        e.preventDefault();
        move(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => end();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, value]);

  // Build polyline points from selected dots (+ cursor while drawing)
  const linePoints = value.map((n) => dotCenter(n));
  const previewLine =
    drawing && cursor && value.length > 0 ? [...linePoints, cursor] : linePoints;

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={cn(
          "relative touch-none select-none rounded-md border border-input bg-muted/30",
        )}
        style={{ width: size, height: size }}
        onMouseDown={(e) => start(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          if (e.touches[0]) start(e.touches[0].clientX, e.touches[0].clientY);
        }}
      >
        <svg width={size} height={size} className="absolute inset-0">
          {previewLine.length > 1 && (
            <polyline
              points={previewLine.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {Array.from({ length: 9 }, (_, i) => {
            const n = i + 1;
            const c = dotCenter(n);
            const active = value.includes(n);
            const order = value.indexOf(n) + 1;
            return (
              <g key={n}>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={dotRadius * 1.8}
                  fill="transparent"
                  stroke={active ? "hsl(var(--primary))" : "hsl(var(--border))"}
                  strokeWidth={1.5}
                />
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={dotRadius}
                  className={cn(
                    "transition-colors",
                    active ? "fill-primary" : "fill-muted-foreground/40",
                  )}
                />
                {active && (
                  <text
                    x={c.x}
                    y={c.y + 3}
                    textAnchor="middle"
                    fontSize={10}
                    className="fill-primary-foreground font-semibold"
                  >
                    {order}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Secuencia: {value.join(" - ")}
        </p>
      )}
    </div>
  );
}
