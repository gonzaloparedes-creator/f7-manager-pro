import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { type PlanType, type Cycle, PRICING, PLAN_MESSAGES, PLAN_FEATURES } from "@/lib/plans";

type Currency = "gs" | "usd";
type Segment = "taller" | "tienda";
type Plan = PlanType;

const CYCLE_LABEL: Record<Cycle, string> = {
  mensual: "/ mes",
  semestral: "/ semestre",
  anual: "/ año",
};

const CYCLE_MONTHS: Record<Cycle, number> = { mensual: 1, semestral: 6, anual: 12 };

function fmt(amount: number, currency: Currency) {
  if (currency === "usd") return `$${amount.toLocaleString("en-US")}`;
  return `${amount.toLocaleString("es-PY")} Gs.`;
}

export function PricingSection({ onContact }: { onContact: (message?: string) => void }) {
  const [segment, setSegment] = useState<Segment>("taller");
  const [currency, setCurrency] = useState<Currency>("gs");
  const [cycle, setCycle] = useState<Cycle>("mensual");

  const renderCard = (
    plan: Plan,
    opts: { title: string; subtitle: string; features: string[]; cta: string; accent?: boolean; badgeLabel?: string },
  ) => {
    const price = PRICING[plan][cycle];
    const value = currency === "usd" ? price.usd : price.gs;
    const monthlyEq =
      cycle !== "mensual"
        ? Math.round((currency === "usd" ? price.usd : price.gs) / CYCLE_MONTHS[cycle])
        : null;

    return (
      <Card
        key={plan}
        className={
          "relative flex flex-col p-7 " +
          (opts.accent
            ? "border-primary/60 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.5)]"
            : "border-border")
        }
      >
        {opts.badgeLabel && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-primary/40 bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            {opts.badgeLabel}
          </div>
        )}
        <h3 className="text-2xl font-bold">{opts.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{opts.subtitle}</p>

        <div className="mt-6 flex items-end gap-2">
          <span className={"text-4xl font-extrabold tracking-tight " + (opts.accent ? "text-primary" : "")}>
            {fmt(value, currency)}
          </span>
          <span className="pb-1 text-sm text-muted-foreground">{CYCLE_LABEL[cycle]}</span>
        </div>
        {monthlyEq !== null && (
          <p className="mt-1 text-xs text-muted-foreground/80">
            Equivale a {fmt(monthlyEq, currency)} / mes
          </p>
        )}

        <ul className="mt-6 space-y-2.5">
          {opts.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className={"mt-0.5 h-4 w-4 shrink-0 " + (opts.accent ? "text-primary" : "text-primary/80")} />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 pt-2">
          {opts.accent ? (
            <Button onClick={() => onContact(PLAN_MESSAGES[plan])} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {opts.cta}
            </Button>
          ) : (
            <Button onClick={() => onContact(PLAN_MESSAGES[plan])} variant="outline" className="w-full border-primary/40 text-foreground hover:bg-primary/10 hover:text-primary">
              {opts.cta}
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <section id="pricing-section" className="border-t border-border/60 py-24 scroll-mt-20">

      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            {segment === "taller" ? (
              <>Precios honestos para <span className="text-primary">talleres reales</span>.</>
            ) : (
              <>Precios honestos para <span className="text-primary">tu mostrador</span>.</>
            )}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {segment === "taller"
              ? "Elegí tu moneda y tu ciclo. Cambialo cuando quieras."
              : "Sin órdenes de reparación, sin QR, sin firmas — solo mostrador y caja."}
          </p>
        </div>

        {/* Segmento: Taller vs Tienda */}
        <div className="mx-auto mt-8 flex justify-center">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {([
              ["taller", "Tengo un Taller"],
              ["tienda", "Solo tengo Tienda"],
            ] as [Segment, string][]).map(([s, label]) => (
              <button
                key={s}
                onClick={() => setSegment(s)}
                className={
                  "px-4 py-2.5 text-xs font-semibold rounded-full transition-colors " +
                  (segment === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles de moneda y ciclo */}
        <div className="mx-auto mt-4 flex max-w-3xl flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {(["gs", "usd"] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={
                  "px-4 py-2.5 text-xs font-semibold rounded-full transition-colors " +
                  (currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
                }
              >
                {c === "gs" ? "Guaraníes (Gs.)" : "USD ($)"}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {([
              ["mensual", "Mensual"],
              ["semestral", "Semestral · Ahorrá 10%"],
              ["anual", "Anual · 2 meses gratis"],
            ] as [Cycle, string][]).map(([c, label]) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={
                  "px-3.5 py-2.5 text-xs font-semibold rounded-full transition-colors " +
                  (cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        {segment === "taller" ? (
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {renderCard("starter", {
              title: "Starter",
              subtitle: "Ideal para dar el primer paso y profesionalizar tu mostrador.",
              features: PLAN_FEATURES.starter,
              cta: "Comenzar prueba gratis",
            })}
            {renderCard("pro", {
              title: "Pro",
              subtitle: "Para talleres que quieren escalar y controlar sus ganancias reales.",
              features: PLAN_FEATURES.pro,
              cta: "Empezar 14 días GRATIS",
              accent: true,
              badgeLabel: "Más Popular",
            })}
            {renderCard("business", {
              title: "Business",
              subtitle: "Para negocios híbridos que reparan y también venden en mostrador.",
              features: PLAN_FEATURES.business,
              cta: "Empezar 14 días GRATIS",
              accent: true,
              badgeLabel: "Todo en Uno",
            })}
          </div>
        ) : (
          <div className="mx-auto mt-12 max-w-sm">
            {renderCard("retail", {
              title: "Retail",
              subtitle: "Ideal para locales de accesorios, carcasas y venta de celulares.",
              features: PLAN_FEATURES.retail,
              cta: "Empezar 14 días GRATIS",
              accent: true,
              badgeLabel: "Solo Ventas",
            })}
          </div>
        )}
      </div>
    </section>
  );
}
