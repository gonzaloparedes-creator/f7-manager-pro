import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import KpiHint from "@/components/KpiHint";

export function InsightCard({
  title,
  icon: Icon,
  hint,
  testId,
  headerExtra,
  children,
}: {
  title: string;
  icon: LucideIcon;
  hint: string;
  testId: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon className="h-4 w-4 text-primary" /> {title}
            <KpiHint label={title} text={hint} />
          </div>
          {headerExtra}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function InsightLoading() {
  return <p className="text-sm text-muted-foreground">Cargando…</p>;
}

export function InsightEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
