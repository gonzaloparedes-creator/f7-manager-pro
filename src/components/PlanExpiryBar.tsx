import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDateISO } from "@/lib/subscriptionReceipt";
import type { ExpiryTone, PlanExpiryInfo } from "@/lib/planExpiry";

// Turquesa = al día, naranja = por vencer, rojo = vencido (misma regla de color de toda la app).
const TONE_STYLES: Record<ExpiryTone, { fill: string; track: string; text: string; marker: string; glow: string }> = {
  ok: {
    fill: "bg-gradient-to-r from-primary/70 to-primary",
    track: "bg-primary/15",
    text: "text-primary",
    marker: "border-primary bg-background",
    glow: "shadow-[0_0_10px_hsl(var(--primary)/0.55)]",
  },
  soon: {
    fill: "bg-gradient-to-r from-secondary/70 to-secondary",
    track: "bg-secondary/15",
    text: "text-secondary",
    marker: "border-secondary bg-background",
    glow: "shadow-[0_0_10px_hsl(var(--secondary)/0.55)]",
  },
  expired: {
    fill: "bg-destructive",
    track: "bg-destructive/20",
    text: "text-destructive",
    marker: "border-destructive bg-background",
    glow: "shadow-[0_0_10px_hsl(var(--destructive)/0.5)]",
  },
};

interface TrackProps {
  info: PlanExpiryInfo;
  thick: boolean;
}

// La barra se vacía hacia el vencimiento; el marcador indica "dónde estamos hoy".
function ExpiryTrack({ info, thick }: TrackProps) {
  const styles = TONE_STYLES[info.tone];
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(info.remainingPct));
    return () => window.cancelAnimationFrame(frame);
  }, [info.remainingPct]);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={info.remainingPct}
      aria-valuetext={info.headline}
      aria-label="Tiempo que queda del plan"
      className={cn("relative w-full rounded-full", styles.track, thick ? "h-3" : "h-2")}
    >
      <div
        className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out", styles.fill)}
        style={{ width: `${shown}%` }}
      />
      {info.tone !== "expired" && (
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 motion-safe:transition-[left] motion-safe:duration-700 motion-safe:ease-out",
            thick ? "h-5 w-5" : "h-3.5 w-3.5",
            styles.marker,
            styles.glow
          )}
          style={{ left: `clamp(${thick ? "0.625rem" : "0.4375rem"}, ${shown}%, calc(100% - ${thick ? "0.625rem" : "0.4375rem"}))` }}
        />
      )}
    </div>
  );
}

interface PlanExpiryBarProps {
  info: PlanExpiryInfo;
  variant?: "compact" | "large";
  className?: string;
}

export default function PlanExpiryBar({ info, variant = "compact", className }: PlanExpiryBarProps) {
  const styles = TONE_STYLES[info.tone];

  if (variant === "compact") {
    return (
      <div className={cn("space-y-1.5", className)}>
        <div className="flex items-baseline justify-between gap-3">
          <span className={cn("text-sm font-semibold", styles.text)}>{info.headline}</span>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {info.daysLeft < 0 ? "Venció" : "Vence"} {formatDateISO(info.expiresAt)}
          </span>
        </div>
        <ExpiryTrack info={info} thick={false} />
      </div>
    );
  }

  const bigNumber = info.daysLeft >= 0 ? String(info.daysLeft) : String(Math.abs(info.daysLeft));
  const caption =
    info.daysLeft > 1
      ? "días para que venza tu plan"
      : info.daysLeft === 1
        ? "día para que venza tu plan"
        : info.daysLeft === 0
          ? "tu plan vence hoy"
          : info.daysLeft === -1
            ? "día desde que venció tu plan"
            : "días desde que venció tu plan";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-end gap-3">
        <span className={cn("text-5xl font-bold leading-none tabular-nums", styles.text)}>{bigNumber}</span>
        <span className="pb-1 text-sm text-muted-foreground">{caption}</span>
      </div>
      <ExpiryTrack info={info} thick />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Desde {formatDateISO(info.paidFrom)}</span>
        <span className="text-right">
          {info.daysLeft < 0 ? "Venció" : "Vence"} {formatDateISO(info.expiresAt)}
        </span>
      </div>
    </div>
  );
}
