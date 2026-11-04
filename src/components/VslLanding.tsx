import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PricingSection } from "@/components/PricingSection";
import { VslPlayer } from "@/components/VslPlayer";
import { Rich } from "@/i18n/Rich";
import { useLanguage } from "@/i18n/useLanguage";
import { usePageMeta } from "@/i18n/usePageMeta";
import { openUpgradeWhatsApp } from "@/lib/upgrade";
import { trackMeta, trackMetaCustom } from "@/lib/metaPixel";
import type { VslLandingCopy } from "@/components/vslLanding.types";
import { ArrowRight, CheckCircle2, Lock, MessageCircle, ShieldCheck, Smartphone, Users } from "lucide-react";

// Landing del VSL (tráfico de Meta Ads), compartida por /py (Paraguay, guaraníes) y /latam
// (Latinoamérica, dólares). Siempre en español. Cada página trae sus textos (copy), su video y su
// moneda; la garantía, los planes y las preguntas frecuentes son los mismos de /oferta.

function Kicker({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{children}</span>;
}

function WhatsAppButton({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <Button
      size="lg"
      onClick={onClick}
      className={"h-12 bg-primary px-7 text-base text-primary-foreground shadow-elevated hover:bg-primary/90 " + className}
    >
      <MessageCircle className="h-5 w-5" /> {children} <ArrowRight className="h-4 w-4" />
    </Button>
  );
}

export interface VslLandingProps {
  copy: VslLandingCopy;
  /** Nombre corto de la página para el Pixel ("py", "latam"). */
  page: string;
  videoId: string;
  durationLabel: string;
  poster: string;
  /** Moneda de los planes. Si se fija, no se muestra el selector de moneda. */
  currency?: "gs" | "usd";
}

export function VslLanding({ copy, page, videoId, durationLabel, poster, currency }: VslLandingProps) {
  const heroCtaRef = useRef<HTMLDivElement>(null);
  const finalCtaRef = useRef<HTMLDivElement>(null);
  const [heroCtaVisible, setHeroCtaVisible] = useState(true);
  const [finalCtaVisible, setFinalCtaVisible] = useState(false);
  const { t } = useLanguage();
  const o = t.oferta;

  usePageMeta(copy.meta.title, copy.meta.description);

  // La marca "(Vi el video)" distingue en WhatsApp a quien viene de esta página.
  const contactWhatsApp = (origin: string, message?: string) => {
    trackMeta("Contact", { content_name: page, content_category: origin });
    openUpgradeWhatsApp((message ?? copy.whatsapp.message) + copy.whatsapp.tag);
  };

  useEffect(() => {
    trackMeta("ViewContent", { content_name: page });
  }, [page]);

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

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-24 text-foreground md:pb-0">
      {/* BARRA DE ARRIBA */}
      <div className="border-b border-primary/30 bg-primary/10">
        <p className="container py-2 text-center text-xs font-medium sm:text-sm">{copy.topBar}</p>
      </div>

      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">F7</div>
            <span className="text-sm font-semibold tracking-tight sm:text-base">{copy.header.brand}</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
              <Link to="/login">{copy.header.login}</Link>
            </Button>
            <Button
              size="sm"
              onClick={() => contactWhatsApp("header")}
              className="hidden bg-primary text-primary-foreground hover:bg-primary/90 md:inline-flex"
            >
              {copy.header.cta}
            </Button>
          </div>
        </div>
      </header>

      {/* HERO + VSL */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.25), transparent 70%)" }}
        />
        <div className="container relative py-8 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {copy.hero.badge}
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
              <Rich text={copy.hero.title} />
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">{copy.hero.text}</p>
          </div>

          <div className="mx-auto mt-7 max-w-4xl">
            <VslPlayer
              videoId={videoId}
              poster={poster}
              title={copy.hero.videoTitle}
              playLabel={copy.hero.play}
              durationLabel={durationLabel}
              pendingLabel={copy.hero.pending}
              onPlay={() => trackMetaCustom("VSLPlay", { pagina: page })}
              onMilestone={(m) => trackMetaCustom("VSLProgreso", { pagina: page, porcentaje: m })}
            />
          </div>

          <div ref={heroCtaRef} className="mx-auto mt-7 flex max-w-md flex-col items-center gap-3 text-center">
            <WhatsAppButton onClick={() => contactWhatsApp("hero")} className="w-full sm:w-auto">
              {copy.hero.cta}
            </WhatsAppButton>
            <p className="text-sm font-medium">
              <ShieldCheck className="mr-1.5 inline h-4 w-4 align-[-3px] text-primary" />
              {copy.hero.guarantee}
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> {copy.hero.registered}
            </p>
          </div>
        </div>
      </section>

      {/* QUIÉNES SOMOS */}
      <section className="border-y border-border/60 bg-card/40 py-14 md:py-20">
        <div className="container">
          <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-2">
            <img
              src="/py/javier-y-gonzalo.webp"
              alt={copy.story.imageAlt}
              className="mx-auto w-full max-w-sm"
              loading="lazy"
              decoding="async"
            />
            <div>
              <Kicker>{copy.story.kicker}</Kicker>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                <Rich text={copy.story.title} />
              </h2>
              <div className="mt-5 space-y-3 text-muted-foreground">
                {copy.story.paragraphs.map((p) => (
                  <p key={p}>
                    <Rich text={p} strongClass="font-semibold text-foreground" />
                  </p>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {[copy.story.javier, copy.story.gonzalo].map((chip) => (
                  <span key={chip} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EL CIRCUITO DEL MOSTRADOR */}
      <section id="circuito" className="scroll-mt-16 py-14 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>{copy.circuit.kicker}</Kicker>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              <Rich text={copy.circuit.title} />
            </h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {copy.circuit.steps.map((step, i) => (
              <Card key={step.key} className="flex flex-col overflow-hidden border-border bg-card">
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <span className="text-sm font-bold uppercase tracking-wider text-primary">{step.label}</span>
                    </span>
                    {"plan" in step && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{step.plan}</span>
                    )}
                  </div>
                  <h3 className="mt-3 text-lg font-bold leading-snug">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
                </div>
                <div className="mt-auto border-t border-border bg-background/60 px-5 pt-5">
                  <img
                    src={step.image}
                    alt={step.alt}
                    className="mx-auto max-h-80 w-full max-w-[260px] rounded-t-xl border border-b-0 border-border object-cover object-top"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">{copy.circuit.footnote}</p>
        </div>
      </section>

      {/* RESULTADOS */}
      <section className="border-y border-border/60 bg-card/40 py-14 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl">
            <div className="text-center">
              <Kicker>{copy.results.kicker}</Kicker>
            </div>
            <ul className="mt-6 space-y-3">
              {copy.results.items.map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-base font-semibold md:text-lg">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 flex items-center justify-center gap-2 text-center text-sm font-medium text-primary">
              <Smartphone className="h-4 w-4 shrink-0" /> {copy.results.chip}
            </p>
          </div>
        </div>
      </section>

      {/* TESTIMONIOS (capturas reales de WhatsApp; en el celular se deslizan de costado) */}
      <section className="py-14 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>{copy.testimonials.kicker}</Kicker>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              <Rich text={copy.testimonials.title} />
            </h2>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-6xl snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 md:grid md:grid-cols-3 md:items-start md:overflow-visible md:px-8">
          {copy.testimonials.items.map((item) => (
            <figure key={item.key} className="w-[82%] max-w-[340px] shrink-0 snap-center md:w-auto md:max-w-none">
              <img
                src={item.image}
                alt={item.alt}
                width={item.width}
                height={item.height}
                className="h-auto w-full rounded-2xl border border-border shadow-elevated"
                loading="lazy"
                decoding="async"
              />
              <figcaption className="mt-2 text-center text-sm font-semibold text-muted-foreground">{item.who}</figcaption>
            </figure>
          ))}
        </div>
        <p className="container mt-4 text-center text-xs text-muted-foreground">{copy.testimonials.footnote}</p>
      </section>

      {/* OBJECIONES */}
      <section className="border-t border-border/60 py-14 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>{copy.objections.kicker}</Kicker>
          </div>
          <div
            className={
              "mx-auto mt-8 grid gap-4 " +
              (copy.objections.items.length === 4 ? "max-w-6xl md:grid-cols-2 lg:grid-cols-4" : "max-w-5xl md:grid-cols-3")
            }
          >
            {copy.objections.items.map((item) => (
              <Card key={item.q} className="border-border p-5">
                <h3 className="text-lg font-bold">{item.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* GARANTÍA (la misma de /oferta) */}
      <section id="garantia" className="scroll-mt-16 border-t border-border/60 py-14 md:py-20">
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
            {(["write", "use", "refund"] as const).map((step, i) => (
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
                {o.freeze.body} <span className="font-semibold text-secondary">{o.urgency.short}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PLANES */}
      <div className="mx-auto max-w-2xl px-4 text-center">
        <Kicker>{copy.offer.kicker}</Kicker>
        <p className="mt-3 text-lg">
          <Rich text={copy.offer.line} strongClass="font-bold text-foreground" />
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{copy.offer.help}</p>
      </div>
      <PricingSection
        onContact={(message) => contactWhatsApp("planes", message)}
        currency={currency}
        note={
          <p className="font-medium text-foreground">
            <ShieldCheck className="mr-1.5 inline h-4 w-4 align-[-3px] text-primary" />
            {t.pricing.guaranteeNote}
          </p>
        }
      />

      {/* PREGUNTAS FRECUENTES (las mismas de /oferta) */}
      <section className="border-t border-border/60 py-14 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>{o.faq.kicker}</Kicker>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{o.faq.title}</h2>
          </div>
          <Accordion type="single" collapsible className="mx-auto mt-8 max-w-2xl">
            {o.faq.items.map((item, i) => (
              <AccordionItem key={item.q} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{copy.faqAnswers?.[item.q] ?? item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-border/60 py-14 md:py-20">
        <div className="container">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-8 text-center md:p-10">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{ background: "radial-gradient(50% 50% at 50% 0%, hsl(var(--primary) / 0.4), transparent 70%)" }}
            />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
                <Rich text={copy.final.title} />
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                <Rich text={copy.final.text} />
              </p>
              <div ref={finalCtaRef} className="mt-8 flex justify-center">
                <WhatsAppButton onClick={() => contactWhatsApp("final")} className="w-full sm:w-auto">
                  {copy.hero.cta}
                </WhatsAppButton>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">{copy.final.smallPrint}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60 py-8">
        <div className="container flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">F7</div>
            <span>{copy.footer.brand}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-primary">
              {copy.header.login}
            </Link>
            <button onClick={() => contactWhatsApp("footer")} className="hover:text-primary">
              {copy.footer.support}
            </button>
            <Link to="/privacidad" className="hover:text-primary">
              {copy.footer.privacy}
            </Link>
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
            <MessageCircle className="h-4 w-4" /> {copy.stickyCta} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
