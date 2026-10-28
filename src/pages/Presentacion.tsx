import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { openUpgradeWhatsApp } from "@/lib/upgrade";
import { PricingSection } from "@/components/PricingSection";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Rich } from "@/i18n/Rich";
import { useLanguage } from "@/i18n/useLanguage";
import { stripRich } from "@/i18n/parseRich";
import { usePageMeta } from "@/i18n/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
  Camera,
  TrendingUp,
  Building2,
  Users,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Smartphone,
  ClipboardList,
  Wallet,
  ArrowRight,
} from "lucide-react";

// Los textos viven en src/i18n/dictionaries (es, en, pt); acá quedan los íconos y los colores.
const PAIN_CARDS = [
  { key: "leaks", icon: Wallet, accent: "text-secondary" },
  { key: "chaos", icon: ClipboardList, accent: "text-primary" },
  { key: "warranty", icon: ShieldCheck, accent: "text-destructive" },
] as const;

const FEATURE_CARDS = [
  { key: "alerts", icon: MessageSquare },
  { key: "warranty", icon: ShieldCheck },
  { key: "photos", icon: Camera },
  { key: "profit", icon: TrendingUp },
] as const;

export default function Presentacion() {
  const [openCard, setOpenCard] = useState<number | null>(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t, gs } = useLanguage();
  const h = t.home;

  usePageMeta(stripRich(h.meta.title), h.meta.description);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const contact = (message: string = h.whatsapp) => openUpgradeWhatsApp(message);
  const goToPricing = () =>
    document.getElementById("pricing-section")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const featureDemos: Record<(typeof FEATURE_CARDS)[number]["key"], ReactNode> = {
    alerts: (
      <div className="space-y-2 text-xs">
        <div className="rounded-md bg-muted/50 px-3 py-2 text-muted-foreground line-through">
          {h.features.alerts.primary}
        </div>
        <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-primary">
          {h.features.alerts.alternative}
        </div>
      </div>
    ),
    warranty: (
      <div className="flex flex-col gap-2 text-xs">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[hsl(var(--status-listo))]/15 px-3 py-1 font-medium text-[hsl(var(--status-listo))]">
          {t.common.warrantyActive}
        </span>
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-destructive/15 px-3 py-1 font-medium text-destructive">
          {t.common.warrantyExpired}
        </span>
      </div>
    ),
    photos: (
      <div className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-md border border-border bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center"
          >
            <Camera className="h-4 w-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    ),
    profit: (
      <div className="space-y-1 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>{h.features.profit.gross}</span>
          <span className="font-mono">{gs(4850000)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{h.features.profit.costs}</span>
          <span className="font-mono text-destructive">- {gs(2120000)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1 text-primary font-semibold">
          <span>{h.features.profit.net}</span>
          <span className="font-mono">{gs(2730000)}</span>
        </div>
      </div>
    ),
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
              F7
            </div>
            <span className="text-sm font-semibold tracking-tight max-[359px]:hidden sm:text-base">Manager Pro</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
              <Link to="/login">{t.common.login}</Link>
            </Button>
            <Button
              size="sm"
              onClick={goToPricing}
              className="bg-primary px-2.5 text-primary-foreground hover:bg-primary/90 sm:px-3"
            >
              {t.common.viewPlans}
            </Button>
          </div>
        </div>
      </header>

      {/* SECTION 1 — HOOK */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.25), transparent 70%)",
          }}
        />
        <div className="container relative py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" /> {h.hero.badge}
            </span>
            <h1 className="mt-4 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              <Rich text={h.hero.title} />
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground">
              <Rich text={h.hero.text} strongClass="text-foreground font-medium" />
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => contact()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-elevated"
              >
                {t.common.ctaGuarantee} <ArrowRight className="h-4 w-4" />
              </Button>
              <a
                href="#solucion"
                className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              >
                {t.common.howItWorks} <ChevronDown className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Visual: chaos vs order */}
          <div className="mx-auto mt-14 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card className="border-destructive/30 bg-destructive/5 p-5">
              <div className="mb-3 flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {h.chaos.before}
                </span>
              </div>
              <div className="space-y-2 font-mono text-[11px] text-muted-foreground">
                {h.chaos.beforeLines.map((line) => (
                  <div key={line} className="rounded bg-muted/50 p-2">{line}</div>
                ))}
              </div>
            </Card>
            <Card className="border-primary/30 bg-primary/5 p-5">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {h.chaos.after}
                </span>
              </div>
              <div className="space-y-2 text-[11px]">
                <div className="flex items-center justify-between rounded bg-card/80 p-2">
                  <span className="font-mono">#0142 · iPhone 8 Juan</span>
                  <span className="rounded-full bg-[hsl(var(--status-reparacion))]/20 px-2 py-0.5 text-[10px] text-[hsl(var(--status-reparacion))]">
                    {t.common.statusRepair}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-card/80 p-2">
                  <span className="font-mono">#0143 · Moto G — {gs(180000)}</span>
                  <span className="rounded-full bg-[hsl(var(--status-listo))]/20 px-2 py-0.5 text-[10px] text-[hsl(var(--status-listo))]">
                    {t.common.statusReady}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-card/80 p-2">
                  <span className="font-mono">#0144 · Samsung A52</span>
                  <span className="rounded-full bg-[hsl(var(--status-entregado))]/20 px-2 py-0.5 text-[10px] text-[hsl(var(--status-entregado))]">
                    {t.common.statusDelivered}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* SECTION 2 — AGITATION */}
      <section className="border-t border-border/60 py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
              <AlertTriangle className="h-3 w-3" /> {h.pain.pill}
            </span>
            <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight">
              <Rich text={h.pain.title} accentClass="text-secondary" />
            </h2>
            <p className="mt-3 text-muted-foreground">{h.pain.text}</p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
            {PAIN_CARDS.map((c, i) => {
              const Icon = c.icon;
              const copy = h.pain.cards[c.key];
              const isOpen = openCard === i;
              return (
                <button
                  key={c.key}
                  onClick={() => setOpenCard(isOpen ? null : i)}
                  className={`group text-left rounded-lg border bg-card p-6 transition-all hover-scale ${
                    isOpen
                      ? "border-primary/50 shadow-elevated"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-muted ${c.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{copy.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{copy.teaser}</p>
                  <div
                    className={`grid transition-all duration-300 ${
                      isOpen ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="border-t border-border/60 pt-3 text-sm text-foreground/90">
                        {copy.detail}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-primary opacity-70 group-hover:opacity-100">
                    {isOpen ? h.pain.less : h.pain.more}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 3 — SOLUTION */}
      <section id="solucion" className="border-t border-border/60 py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {h.solution.pill}
            </span>
            <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight">
              <Rich text={h.solution.title} />
            </h2>
            <p className="mt-3 text-muted-foreground">{h.solution.text}</p>
          </div>

          {/* Mock dashboard */}
          <div className="mx-auto mt-12 max-w-5xl rounded-xl border border-border bg-card shadow-elevated overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-border bg-background/50 px-4 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-secondary/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
              <span className="ml-3 text-xs text-muted-foreground font-mono">f7.seven.com.py/dashboard</span>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-4">
              {[
                { label: h.solution.kpiActive, value: "37", tone: "text-primary" },
                { label: h.solution.kpiReady, value: "12", tone: "text-[hsl(var(--status-listo))]" },
                { label: h.solution.kpiIncome, value: "Gs. 12.4M", tone: "text-secondary" },
                { label: h.solution.kpiWarranties, value: "84", tone: "text-[hsl(var(--status-garantia))]" },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-border bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{k.label}</div>
                  <div className={`mt-1 text-2xl font-bold ${k.tone}`}>{k.value}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">{h.solution.recentTitle}</span>
                <span className="text-xs text-muted-foreground">{h.solution.today}</span>
              </div>
              <div className="space-y-2">
                {[
                  ["#0192", h.solution.recent[0], t.common.statusRepair, "reparacion"],
                  ["#0191", h.solution.recent[1], t.common.statusReady, "listo"],
                  ["#0190", h.solution.recent[2], t.common.statusDelivered, "entregado"],
                ].map(([id, desc, st, key]) => (
                  <div key={id} className="flex items-center justify-between rounded-md border border-border/60 bg-background/30 px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">{id}</span>
                      <span>{desc}</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium`}
                      style={{
                        backgroundColor: `hsl(var(--status-${key}) / 0.18)`,
                        color: `hsl(var(--status-${key}))`,
                      }}
                    >
                      {st}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — FEATURES */}
      <section className="border-t border-border/60 py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              <Rich text={h.features.title} />
            </h2>
            <p className="mt-3 text-muted-foreground">{h.features.text}</p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2">
            {FEATURE_CARDS.map((f) => {
              const Icon = f.icon;
              const copy = h.features[f.key];
              return (
                <Card
                  key={f.key}
                  className="group p-6 transition-all hover:border-primary/40 hover:shadow-elevated"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold">{copy.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{copy.desc}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border border-border bg-background/40 p-3">
                    {featureDemos[f.key]}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 5 — MASTER CONTROL */}
      <section className="border-t border-border/60 py-20">
        <div className="container">
          <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
                {h.growth.pill}
              </span>
              <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
                <Rich text={h.growth.title} />
              </h2>
              <p className="mt-3 text-muted-foreground">{h.growth.text}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {h.growth.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> {bullet}</li>
                ))}
              </ul>
            </div>
            <Card className="p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {h.growth.branches}
              </div>
              <div className="space-y-2">
                {[
                  [h.growth.branchMain, "Asunción", true],
                  [h.growth.branchEast, "Ciudad del Este", false],
                  [h.growth.branchSouth, "Encarnación", false],
                ].map(([name, city, active]) => (
                  <div
                    key={name as string}
                    className={`flex items-center justify-between rounded-md border px-3 py-2.5 ${
                      active ? "border-primary/40 bg-primary/5" : "border-border bg-background/30"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <div className="text-sm font-medium">{name}</div>
                        <div className="text-[11px] text-muted-foreground">{city}</div>
                      </div>
                    </div>
                    {active && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {h.growth.active}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> {h.growth.users}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* SECTION 5.5 — PRICING */}
      <PricingSection
        onContact={(message) => contact(message)}
        note={
          <p className="font-medium text-foreground">
            <ShieldCheck className="mr-1.5 inline h-4 w-4 align-[-3px] text-primary" />
            {t.pricing.guaranteeNote}
          </p>
        }
      />

      {/* SECTION 6 — CTA */}
      <section className="border-t border-border/60 py-24">
        <div className="container">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-10 text-center">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(50% 50% at 50% 0%, hsl(var(--primary) / 0.4), transparent 70%)",
              }}
            />
            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
                <Rich text={h.cta.title} />
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                <Rich text={h.cta.text} strongClass="text-foreground font-semibold" />
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  onClick={() => contact()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-elevated text-base h-12 px-7"
                >
                  {t.common.ctaGuarantee} <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={goToPricing}
                  className="h-12 px-7 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  {t.common.viewPlans}
                </Button>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">{h.cta.trust}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60 py-8">
        <div className="container flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-[10px] font-bold">
              F7
            </div>
            <span>{t.common.footerBrand}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-primary">{t.common.login}</Link>
            <button
              onClick={() => contact()}
              className="hover:text-primary"
            >
              {t.common.startNow}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
