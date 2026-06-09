import { computeWarrantyState } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";

interface Props {
  deliveredAt: string | null | undefined;
  warrantyDays: number | null | undefined;
  className?: string;
}

export function WarrantyBadge({ deliveredAt, warrantyDays, className }: Props) {
  const state = computeWarrantyState(deliveredAt, warrantyDays);
  if (!state) return null;

  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium";

  if (state.kind === "none") {
    return (
      <span className={cn(base, "border-muted bg-muted/40 text-muted-foreground", className)}>
        <ShieldOff className="h-3 w-3" /> Sin garantía
      </span>
    );
  }
  if (state.kind === "active") {
    return (
      <span className={cn(base, "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", className)}>
        <ShieldCheck className="h-3 w-3" /> Garantía activa: {state.daysRemaining} días restantes
      </span>
    );
  }
  return (
    <span className={cn(base, "border-destructive/30 bg-destructive/10 text-destructive", className)}>
      <ShieldAlert className="h-3 w-3" /> Garantía expirada
    </span>
  );
}
