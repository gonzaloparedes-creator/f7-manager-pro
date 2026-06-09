import { STATUS_LABELS, statusBadgeClasses, type OrderStatus } from "@/lib/orders";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = STATUS_LABELS[status as OrderStatus] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusBadgeClasses(status),
        className
      )}
    >
      {label}
    </span>
  );
}
