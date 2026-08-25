import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function QuantityStepper({
  value,
  onChange,
  max,
  size = "default",
}: {
  value: number;
  onChange: (next: number) => void;
  max?: number;
  size?: "default" | "sm";
}) {
  const atMax = max !== undefined && value >= max;
  const btnSize = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className={cn(
          btnSize,
          focusRing,
          "flex shrink-0 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-muted active:scale-95",
        )}
        aria-label="Restar unidad"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => !atMax && onChange(value + 1)}
        disabled={atMax}
        className={cn(
          btnSize,
          focusRing,
          "flex shrink-0 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
        )}
        aria-label="Sumar unidad"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
