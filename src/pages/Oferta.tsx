import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PricingSection } from "@/components/PricingSection";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Rich } from "@/i18n/Rich";
import { useLanguage } from "@/i18n/useLanguage";
import { usePageMeta } from "@/i18n/usePageMeta";
import { openUpgradeWhatsApp } from "@/lib/upgrade";
import { trackMeta } from "@/lib/metaPixel";
import {
  ArrowRight,
  Camera,
  ChevronDown,
  ClipboardList,
  Clock,
  Cloud,
  CheckCircle2,
  Laptop,
  Lock,
  MessageCircle,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

// Los textos viven en src/i18n/dictionaries (es, en, pt); acá quedan los íconos y la maqueta.
const PAIN_CARDS = [
  { key: "notebook", icon: ClipboardList },
  { key: "whatsapp", icon: MessageCircle },
  { key: "money", icon: Wallet },
] as const;

const SOLUTION_BLOCKS = [
  { key: "photos", icon: Camera, plan: "allPlans" },
  { key: "whatsapp", icon: MessageCircle, plan: "allPlans" },
  { key: "profit", icon: TrendingUp, plan: "proBusiness" },
  { key: "warranty", icon: ShieldCheck, plan: "allPlans" },
  { key: "cash", icon: Wallet, plan: "proBusiness" },
  { key: "bundle", icon: ShoppingBag, plan: "businessOnly" },
] as const;

const DEVICE_CARDS = [
  { key: "phone", icon: Smartphone },
  { key: "computer", icon: Laptop },
  { key: "cloud", icon: Cloud },
] as const;

const GUARANTEE_STEPS = ["write", "use", "refund"] as const;

function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{children}</span>
  );
}

export default function Oferta() {
  const heroCtaRef = useRef<HTMLDivElement>(null);
  const finalCtaRef = useRef<HTMLDivElement>(null);
  const [heroCtaVisible, setHeroCtaVisible] = useState(true);
  const [finalCtaVisible, setFinalCtaVisible] = useState(false);
  const { t, gs } = useLanguage();
  const o = t.oferta;

  usePageMeta(o.meta.title, o.meta.description);

  // La marca "Vi su anuncio" (traducida) permite distinguir los contactos que vienen de la
  // campaña de los de la landing orgánica.
  const contactWhatsApp = (origin: string, message?: string) => {
    trackMeta("Contact", { content_name: "oferta", content_category: origin });
    openUpgradeWhatsApp(message ? message + o.whatsapp.adTag : o.whatsapp.message);
  };

  useEffect(() => {
    trackMeta("ViewContent", { content_name: "oferta" });
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observers: IntersectionObserver[] = [];
    const watch = (el: Element | null, set: (visible: boolean) => void) => {
      if (!el) return;
      const obs = new IntersectionObserver(([entry]) => set(entry.isIntersecting));
      obs.observe(el);
      observers.push(obs);
    };
    watch(heroCtaRef.current, setHeroCtaVisible);
    watch(finalCtaRef.current, setFinalCtaVisible);
    return () => observers.forEach((obs) => obs.disconnect());
  }, []);

  const showStickyBar = !heroCtaVisible && !finalCtaVisible;

  const painMocks: Record<(typeof PAIN_CARDS)[number]["key"], ReactNode> = {
    notebook: (
      <div className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
        <div className="rounded bg-muted/50 p-2">{o.problem.cards.notebook.lines[0]}</div>
        <div className="rounded bg-muted/50 p-2 line-through decoration-destructive/70">{o.problem.cards.notebook.lines[1]}</div>
        <div className="rounded bg-muted/50 p-2 text-secondary">{o.problem.cards.notebook.lines[2]}</div>
      </div>
    ),
    whatsapp: (
      <div className="space-y-1.5 text-[11px]">
        <div className="w-fit max-w-[85%] rounded-lg rounded-bl-sm bg-muted/60 px-2.5 py-1.5">{o.problem.cards.whatsapp.lines[0]}</div>
        <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-primary/15 px-2.5 py-1.5 text-primary">{o.problem.cards.whatsapp.lines[1]}</div>
        <div className="w-fit max-w-[85%] rounded-lg rounded-bl-sm bg-muted/60 px-2.5 py-1.5">{o.problem.cards.whatsapp.lines[2]}</div>
      </div>
    ),
    money: (
      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex justify-between text-muted-foreground"><span>{o.problem.cards.money.collected}</span><span>{gs(350000)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>{o.problem.cards.money.part}</span><span className="text-destructive">- {gs(280000)}</span></div>
        <div className="flex justify-between border-t border-border pt-1 text-secondary"><span>{o.problem.cards.money.left}</span><span>???</span></div>
      </div>
    ),
  };

  const blocks = o.solution.blocks;
  const solutionMocks: Record<(typeof SOLUTION_BLOCKS)[number]["key"], ReactNode> = {
    photos: (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          {[blocks.photos.came, blocks.photos.came, blocks.photos.left].map((label, i) => (
            <div
              key={i}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-border bg-gradient-to-br from-muted to-muted/40"
            >
              <Camera className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" /> {blocks.photos.note}
        </div>
      </div>
    ),
    whatsapp: (
      <div className="space-y-2 text-[11px]">
        <div className="w-fit max-w-[92%] rounded-lg rounded-bl-sm border border-primary/30 bg-primary/10 px-3 py-2 text-foreground">
          <Rich text={blocks.whatsapp.message} strongClass="font-bold" accentClass="font-bold text-primary" />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-muted-foreground">
          <QrCode className="h-3.5 w-3.5" /> {blocks.whatsapp.tracking}
        </div>
      </div>
    ),
    profit: (
      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex justify-between text-muted-foreground"><span>{blocks.profit.collected}</span><span>{gs(350000)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>{blocks.profit.part}</span><span className="text-destructive">- {gs(180000)}</span></div>
        <div className="flex justify-between border-t border-border pt-1 font-semibold text-primary"><span>{blocks.profit.left}</span><span>{gs(170000)}</span></div>
      </div>
    ),
    warranty: (
      <div className="flex flex-col gap-2 text-[11px]">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[hsl(var(--status-listo))]/15 px-3 py-1 font-medium text-[hsl(var(--status-listo))]">
          {t.common.warrantyActive}
        </span>
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-destructive/15 px-3 py-1 font-medium text-destructive">
          {t.common.warrantyExpired}
        </span>
      </div>
    ),
    cash: (
      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex justify-between text-muted-foreground"><span>{blocks.cash.opening}</span><span>{gs(200000)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>{blocks.cash.cashIn}</span><span>{gs(850000)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>{blocks.cash.expenses}</span><span className="text-destructive">{gs(120000)}</span></div>
        <div className="flex justify-between border-t border-border pt-1 font-semibold text-primary"><span>{blocks.cash.expected}</span><span>{gs(930000)}</span></div>
      </div>
    ),
    bundle: (
      <div className="space-y-1.5 text-[11px]">
        <div className="flex justify-between rounded bg-muted/50 px-2.5 py-1.5"><span>{blocks.bundle.repair}</span><span className="font-mono">{gs(350000)}</span></div>
        <div className="flex justify-between rounded bg-muted/50 px-2.5 py-1.5"><span>{blocks.bundle.sale}</span><span className="font-mono">{gs(70000)}</span></div>
        <div className="flex justify-between rounded border border-primary/30 bg-primary/10 px-2.5 py-1.5 font-semibold text-primary"><span>{blocks.bundle.total}</span><span className="font-mono">{gs(420000)}</span></div>
      </div>
    ),
  };

  const faqs = [...o.faq.items, ...o.faq.extra];

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-24 text-foreground md:pb-0">
      {/* AVISO DE OFERTA: sin fecha, el precio puede subir en cualquier momento */}
      <div className="border-b border-secondary/40 bg-secondary/10">
        <div className="container flex items-start justify-center gap-2 py-2 text-center text-xs sm:items-center sm:text-sm">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-secondary sm:mt-0" />
          <p>
            {o.urgency.bar}
            <span className="mx-1.5 text-muted-foreground">·</span>
            <span className="font-bold text-secondary">{o.urgency.barCta}</span>
          </p>
        </div>
      </div>

      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
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
              onClick={() => contactWhatsApp("header")}
              className="hidden bg-primary text-primary-foreground hover:bg-primary/90 md:inline-flex"
            >
              {t.common.startNow}
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.25), transparent 70%)",
          }}
        />
        <div className="container relative py-12 md:py-20">
          <div className="mx-auto max-w-3xl animate-fade-in text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" /> {o.hero.badge}
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              <Rich text={o.hero.title} />
            </h1>
            <p className="mt-5 text-base text-muted-foreground md:text-lg">{o.hero.text}</p>

            <div ref={heroCtaRef} className="mt-8 flex flex-col items-center gap-3">
              <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  onClick={() => contactWhatsApp("hero")}
                  className="h-12 bg-primary px-7 text-base text-primary-foreground shadow-elevated hover:bg-primary/90"
                >
                  {t.common.ctaGuarantee} <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 border-primary/40 px-7 text-base text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <a href="#solucion">
                    {t.common.howItWorks} <ChevronDown className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="max-w-md text-sm font-medium">
                <ShieldCheck className="mr-1.5 inline h-4 w-4 align-[-3px] text-primary" />
                {t.common.guarantee}
              </p>
              <p className="text-xs text-muted-foreground">{o.hero.smallPrint}</p>
            </div>

            <div className="mx-auto mt-6 inline-flex max-w-full items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2 text-left text-xs text-muted-foreground">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
                F7
              </div>
              <span>{o.hero.born}</span>
            </div>
          </div>

          {/* Maqueta del tablero */}
          <div className="mx-auto mt-12 max-w-md">
            <Card className="border-primary/30 bg-card p-4 shadow-[0_0_40px_-12px_hsl(var(--primary)/0.5)] sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold">{o.summary.title}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {o.summary.example}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[11px] text-muted-foreground">{o.summary.collected}</p>
                  <p className="mt-1 whitespace-nowrap font-mono text-sm font-bold sm:text-base">{gs(1850000)}</p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                  <p className="text-[11px] text-muted-foreground">{o.summary.net}</p>
                  <p className="mt-1 whitespace-nowrap font-mono text-sm font-bold text-primary sm:text-base">{gs(1120000)}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between rounded bg-muted/40 p-2">
                  <span className="font-mono">#0142 · iPhone 8 Juan</span>
                  <span className="rounded-full bg-[hsl(var(--status-reparacion))]/20 px-2 py-0.5 text-[10px] text-[hsl(var(--status-reparacion))]">
                    {t.common.statusRepair}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-muted/40 p-2">
                  <span className="font-mono">#0143 · Moto G</span>
                  <span className="rounded-full bg-[hsl(var(--status-listo))]/20 px-2 py-0.5 text-[10px] text-[hsl(var(--status-listo))]">
                    {t.common.statusReady}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-muted/40 p-2">
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

      {/* CINTA DE BENEFICIOS */}
      <section aria-label={o.marquee.label} className="overflow-hidden border-y border-border/60 bg-card/60 py-3.5">
        <div className="flex w-max animate-marquee motion-reduce:w-auto motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center">
          {o.marquee.items.map((item) => (
            <span
              key={item}
              className="mx-5 whitespace-nowrap text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground motion-reduce:mx-3 motion-reduce:my-1"
            >
              <span className="mr-5 text-primary motion-reduce:hidden">●</span>
              {item}
            </span>
          ))}
          {o.marquee.items.map((item) => (
            <span
              key={item + "-2"}
              aria-hidden="true"
              className="mx-5 whitespace-nowrap text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground motion-reduce:hidden"
            >
              <span className="mr-5 text-primary">●</span>
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* EL VERDADERO PROBLEMA */}
      <section id="problema" className="py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>{o.problem.kicker}</Kicker>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              <Rich text={o.problem.title} />
            </h2>
            <p className="mt-5 text-lg font-medium">{o.problem.lead}</p>
            <p className="mt-3 text-muted-foreground">{o.problem.text}</p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
            {PAIN_CARDS.map((card) => (
              <Card key={card.key} className="flex flex-col border-border p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/15 text-secondary">
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{o.problem.cards[card.key].title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{o.problem.cards[card.key].text}</p>
                <div className="mt-4 rounded-lg border border-border bg-background/60 p-3">{painMocks[card.key]}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* LA SOLUCIÓN */}
      <section id="solucion" className="scroll-mt-16 border-y border-border/60 bg-card/40 py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>{o.solution.kicker}</Kicker>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              <Rich text={o.solution.title} />
            </h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-3">
            {SOLUTION_BLOCKS.map((block) => {
              const copy = blocks[block.key];
              return (
                <Card key={block.key} className="flex flex-col border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                      <block.icon className="h-3.5 w-3.5" /> {copy.pill}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{o.solution[block.plan]}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold leading-snug">{copy.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{copy.text}</p>
                  <div className="mt-auto pt-5">
                    <div className="rounded-lg border border-border bg-background/60 p-3">{solutionMocks[block.key]}</div>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">{o.solution.footnote}</p>
        </div>
      </section>

      {/* TU PARTE / LA PARTE DE F7 */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>{o.split.kicker}</Kicker>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              <Rich text={o.split.title} />
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card className="border-border p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{o.split.yourPart}</p>
              <ul className="mt-4 space-y-3 text-sm">
                {o.split.yourItems.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="border-primary/50 bg-primary/5 p-6 shadow-[0_0_40px_-14px_hsl(var(--primary)/0.5)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{o.split.f7Part}</p>
              <ul className="mt-4 space-y-3 text-sm">
                {o.split.f7Items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <p className="mx-auto mt-5 max-w-xl text-center text-sm text-muted-foreground">{o.split.note}</p>

          <div className="mx-auto mt-14 max-w-3xl text-center">
            <p className="text-2xl font-bold tracking-tight md:text-3xl">
              <Rich text={o.split.tagline} />
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {o.split.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DISPOSITIVOS Y NUBE */}
      <section className="border-y border-border/60 bg-card/40 py-14">
        <div className="container">
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
            {DEVICE_CARDS.map((item) => (
              <Card key={item.key} className="border-border p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-bold">{o.devices[item.key].title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{o.devices[item.key].text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* GARANTÍA */}
      <section id="garantia" className="scroll-mt-16 py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div className="mt-4">
              <Kicker>{o.guarantee.kicker}</Kicker>
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              <Rich text={o.guarantee.title} />
            </h2>
            <p className="mt-4 text-muted-foreground">{o.guarantee.text}</p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            {GUARANTEE_STEPS.map((step, i) => (
              <Card key={step} className="border-border p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-bold">{o.guarantee.steps[step].title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{o.guarantee.steps[step].text}</p>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-6 flex max-w-2xl items-start gap-3 rounded-xl border border-secondary/40 bg-secondary/10 p-4">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
            <div className="text-sm">
              <p className="font-semibold">{o.freeze.title}</p>
              <p className="mt-0.5 text-muted-foreground">
                {o.freeze.body}{" "}
                <span className="font-semibold text-secondary">{o.urgency.short}</span>
              </p>
            </div>
          </div>

          <Card className="mx-auto mt-6 max-w-2xl border-primary/40 p-6 shadow-[0_0_40px_-14px_hsl(var(--primary)/0.5)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{o.guarantee.extrasTitle}</p>
            <ul className="mt-4 space-y-3.5 text-sm">
              {o.guarantee.extras.map((extra) => (
                <li key={extra.title} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    <span className="font-semibold">{extra.title}</span>
                    <span className="block text-muted-foreground">{extra.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              onClick={() => contactWhatsApp("garantia")}
              className="mt-6 h-12 w-full bg-primary text-base text-primary-foreground shadow-elevated hover:bg-primary/90"
            >
              {t.common.ctaGuarantee} <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        </div>
      </section>

      {/* PLANES */}
      <PricingSection
        onContact={(message) => contactWhatsApp("planes", message)}
        note={
          <>
            <p className="font-medium text-foreground">
              <ShieldCheck className="mr-1.5 inline h-4 w-4 align-[-3px] text-primary" />
              {t.pricing.guaranteeNote}
            </p>
            <p className="mt-2">
              {o.freeze.line}{" "}
              <span className="font-semibold text-secondary">{o.urgency.short}</span>
            </p>
          </>
        }
      />

      {/* PREGUNTAS FRECUENTES */}
      <section className="border-t border-border/60 py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>{o.faq.kicker}</Kicker>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{o.faq.title}</h2>
          </div>
          <Accordion type="single" collapsible className="mx-auto mt-8 max-w-2xl">
            {faqs.map((item, i) => (
              <AccordionItem key={item.q} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-border/60 py-16 md:py-24">
        <div className="container">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-8 text-center md:p-10">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background: "radial-gradient(50% 50% at 50% 0%, hsl(var(--primary) / 0.4), transparent 70%)",
              }}
            />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
                <Rich text={o.final.title} />
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                <Rich text={o.final.text} />
              </p>
              <p className="mx-auto mt-3 max-w-xl text-sm">
                <Lock className="mr-1.5 inline h-4 w-4 align-[-3px] text-secondary" />
                {o.freeze.line}{" "}
                <span className="font-semibold text-secondary">{o.urgency.short}</span>
              </p>
              <div ref={finalCtaRef} className="mt-8 flex justify-center">
                <Button
                  size="lg"
                  onClick={() => contactWhatsApp("final")}
                  className="h-12 w-full bg-primary px-7 text-base text-primary-foreground shadow-elevated hover:bg-primary/90 sm:w-auto"
                >
                  {t.common.ctaGuarantee} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">{o.final.smallPrint}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60 py-8">
        <div className="container flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
              F7
            </div>
            <span>{t.common.footerBrand}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-primary">
              {t.common.login}
            </Link>
            <button onClick={() => contactWhatsApp("footer")} className="hover:text-primary">
              {o.footer.support}
            </button>
          </div>
        </div>
      </footer>

      {/* BARRA FIJA (celular) */}
      <div
        className={
          "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur transition-transform duration-200 md:hidden " +
          (showStickyBar ? "translate-y-0" : "translate-y-full")
        }
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        aria-hidden={!showStickyBar}
      >
        <div className="mx-auto max-w-md">
          <Button
            onClick={() => contactWhatsApp("barra-fija")}
            tabIndex={showStickyBar ? 0 : -1}
            className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t.common.ctaGuarantee} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
