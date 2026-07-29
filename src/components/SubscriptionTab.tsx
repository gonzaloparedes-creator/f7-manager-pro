import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { usePlan } from "@/hooks/usePlan";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, Crown, Clock } from "lucide-react";
import { openUpgradeWhatsApp } from "@/lib/upgrade";
import { PLAN_LABELS, PLAN_FEATURES, PRICING, PLAN_MESSAGES, TALLER_LADDER, type PlanType } from "@/lib/plans";

const TRIAL_DAYS = 14;

export default function SubscriptionTab() {
  const { companyId } = useCompany();
  const { plan, isStarter, isRetail } = usePlan();
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies").select("created_at, name").eq("id", companyId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setCreatedAt((data as any).created_at);
        setCompanyName((data as any).name ?? "");
      });
  }, [companyId]);

  const daysElapsed = createdAt
    ? Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const daysRemaining = Math.max(0, TRIAL_DAYS - daysElapsed);
  const trialOver = daysRemaining === 0;
  const urgent = daysRemaining > 0 && daysRemaining <= 3;
  const progress = Math.min(100, (daysElapsed / TRIAL_DAYS) * 100);

  const contact = (targetPlan: PlanType) => {
    openUpgradeWhatsApp(
      `${PLAN_MESSAGES[targetPlan]}${companyName ? ` (${companyName})` : ""}`,
    );
  };

  // Próximos escalones disponibles arriba del plan actual (Starter -> Pro -> Business).
  // Retail no forma parte de esta escalera: es una oferta paralela.
  const ladderIndex = TALLER_LADDER.indexOf(plan);
  const upgradeOptions = ladderIndex >= 0 ? TALLER_LADDER.slice(ladderIndex + 1) : [];

  return (
    <div className="space-y-6">
      {/* Current status */}
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Tu plan actual</div>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="text-2xl font-bold">Plan {PLAN_LABELS[plan]}</h2>
                {plan === "starter" ? (
                  <Badge variant="secondary" className="bg-secondary text-secondary-foreground">Starter</Badge>
                ) : (
                  <Badge className="bg-primary text-primary-foreground">
                    <Crown className="mr-1 h-3 w-3" /> {PLAN_LABELS[plan].toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>
            <div className="rounded-full bg-primary/15 p-2 text-primary ring-1 ring-primary/30">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>

          {/* Trial — solo aplica mientras estás en Starter (el plan por defecto) */}
          {isStarter && (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className={urgent ? "h-4 w-4 text-secondary" : "h-4 w-4 text-primary"} />
                  Periodo de prueba (14 días)
                </div>
                {trialOver ? (
                  <span className="text-sm font-semibold text-secondary">Periodo de prueba finalizado</span>
                ) : (
                  <span className={`text-sm font-semibold ${urgent ? "text-secondary" : "text-foreground"}`}>
                    {daysRemaining} {daysRemaining === 1 ? "día restante" : "días restantes"}
                  </span>
                )}
              </div>
              <Progress
                value={progress}
                className={`h-2 ${urgent || trialOver ? "[&>div]:bg-secondary" : ""}`}
              />
              <div className="text-xs text-muted-foreground">
                {trialOver
                  ? "Actualizá tu plan para seguir usando todas las funciones sin interrupciones."
                  : `Llevás ${daysElapsed} de ${TRIAL_DAYS} días. ${urgent ? "¡Tu prueba está por vencer!" : ""}`}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Una tarjeta de upgrade por cada plan disponible arriba del actual */}
      {upgradeOptions.map((targetPlan) => (
        <Card key={targetPlan} className="relative overflow-hidden border-primary/30">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
          <CardContent className="relative space-y-5 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-bold">Plan {PLAN_LABELS[targetPlan]}</h3>
                  <Badge className="bg-secondary text-secondary-foreground">
                    {targetPlan === "business" ? "TODO EN UNO" : "RECOMENDADO"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {targetPlan === "business"
                    ? "Sumá venta de mostrador y cobro unificado a tu taller."
                    : "Llevá tu taller al siguiente nivel con todas las herramientas profesionales."}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">${PRICING[targetPlan].mensual.usd}</div>
                <div className="text-xs text-muted-foreground">/mes</div>
              </div>
            </div>

            <ul className="grid gap-2 sm:grid-cols-2">
              {PLAN_FEATURES[targetPlan].map((f) => (
                <li key={f} className="flex items-center gap-2 rounded-md border border-border bg-background/50 p-3 text-sm">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{f}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => contact(targetPlan)} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                <Sparkles className="mr-2 h-4 w-4" /> Actualizar a Plan {PLAN_LABELS[targetPlan]}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {plan === "business" && (
        <Card className="border-primary/30">
          <CardContent className="flex items-center gap-3 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Ya estás en el plan más alto</div>
              <div className="text-sm text-muted-foreground">
                Tenés acceso a todas las funciones de F7 Manager Pro, incluida la venta de mostrador.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isRetail && (
        <Card className="border-primary/30">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Estás en el Plan Retail</div>
                <div className="text-sm text-muted-foreground">Punto de venta e inventario externo, sin órdenes de reparación.</div>
              </div>
            </div>
            <p className="pl-[52px] text-xs text-muted-foreground">
              ¿También hacés reparaciones?{" "}
              <button onClick={() => contact("business")} className="text-primary underline underline-offset-2">
                Escribinos para pasar a Business
              </button>.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
