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
import { openUpgradeWhatsApp } from "@/lib/upgrade";
import { PRICING } from "@/lib/plans";
import { trackMeta } from "@/lib/metaPixel";
import { OFFER_GUARANTEE_DAYS, offerStatus, type OfferStatus } from "@/lib/ofertaOffer";
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

const GUARANTEE = `${OFFER_GUARANTEE_DAYS} días`;
const CTA_LABEL = `Empezar con garantía de ${GUARANTEE}`;

const PAGE_TITLE = `F7 Manager Pro · Sistema para talleres de reparación · Garantía de ${GUARANTEE}`;
const PAGE_DESCRIPTION = `Ordená tus órdenes de trabajo, avisale al cliente por WhatsApp y mirá cuánto ganás en cada reparación. Hecho en Paraguay. Si en ${GUARANTEE} no te sirve, te devolvemos todo tu dinero.`;

// Mensaje que llega a Gonzalo: la marca "Vi su anuncio" permite distinguir los
// contactos que vienen de la campaña de los de la landing orgánica.
const OFERTA_MESSAGE = `¡Hola! Vi el anuncio de F7 Manager Pro y quiero empezar con la garantía de ${GUARANTEE} en mi taller.`;
const AD_TAG = " (Vi su anuncio)";

function contactWhatsApp(origin: string, message?: string) {
  trackMeta("Contact", { content_name: "oferta", content_category: origin });
  openUpgradeWhatsApp(message ? message + AD_TAG : OFERTA_MESSAGE);
}

const starterGs = PRICING.starter.mensual.gs.toLocaleString("es-PY");

const marqueeItems = [
  "Fotos de entrada y salida",
  "Aviso por WhatsApp al cliente",
  "Garantía con reloj",
  "Ganancia real por orden",
  "Seguimiento por QR",
  "Caja y gastos",
];

const painCards = [
  {
    icon: ClipboardList,
    title: "La libreta que te traiciona",
    text: "Se moja, se pierde y se lleva el historial. Una orden perdida es plata perdida o un reclamo.",
    mock: (
      <div className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
        <div className="rounded bg-muted/50 p-2">Hoja 47 — "iPhone 8 Juan, no lee"</div>
        <div className="rounded bg-muted/50 p-2 line-through decoration-destructive/70">Moto G, cambio de pin, 180?</div>
        <div className="rounded bg-muted/50 p-2 text-secondary">¿Dónde anoté el del Samsung?</div>
      </div>
    ),
  },
  {
    icon: MessageCircle,
    title: "El WhatsApp que no para",
    text: "Pasás el día contestando «¿ya está mi celular?» en vez de reparar. Cada mensaje te corta el trabajo.",
    mock: (
      <div className="space-y-1.5 text-[11px]">
        <div className="w-fit max-w-[85%] rounded-lg rounded-bl-sm bg-muted/60 px-2.5 py-1.5">¿Ya está mi celular? 🙏</div>
        <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-primary/15 px-2.5 py-1.5 text-primary">Todavía no, te aviso</div>
        <div className="w-fit max-w-[85%] rounded-lg rounded-bl-sm bg-muted/60 px-2.5 py-1.5">¿Y ahora?</div>
      </div>
    ),
  },
  {
    icon: Wallet,
    title: "La plata que no se ve",
    text: "Cobraste bien, pero ¿cuánto te quedó después del repuesto? Sin ese número, podés estar trabajando gratis.",
    mock: (
      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex justify-between text-muted-foreground"><span>Cobrado</span><span>Gs. 350.000</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Repuesto</span><span className="text-destructive">- Gs. 280.000</span></div>
        <div className="flex justify-between border-t border-border pt-1 text-secondary"><span>¿Te quedó?</span><span>???</span></div>
      </div>
    ),
  },
];

const solutionBlocks: {
  pill: string;
  icon: typeof Camera;
  title: string;
  text: string;
  plan: string;
  mock: ReactNode;
}[] = [
  {
    pill: "Evidencia fotográfica",
    icon: Camera,
    title: "El fin de «yo no lo dejé así»",
    text: "Foto de cómo entró y foto de cómo sale, con fecha. Si hay una discusión, tenés la prueba en la mano.",
    plan: "Todos los planes",
    mock: (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          {["Entró", "Entró", "Salió"].map((label, i) => (
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
          <CheckCircle2 className="h-3.5 w-3.5" /> Pantalla rota · Cámara ok · Sin golpes en el marco
        </div>
      </div>
    ),
  },
  {
    pill: "Avisos por WhatsApp",
    icon: MessageCircle,
    title: "El fin del «¿ya está mi equipo?»",
    text: "F7 le avisa al cliente por WhatsApp cuando su equipo cambia de estado, y con el QR puede ver el avance sin escribirte.",
    plan: "Todos los planes",
    mock: (
      <div className="space-y-2 text-[11px]">
        <div className="w-fit max-w-[92%] rounded-lg rounded-bl-sm border border-primary/30 bg-primary/10 px-3 py-2 text-foreground">
          Hola Juan 👋 Tu <b>iPhone 8</b> ya está <b className="text-primary">listo para retirar</b>.
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-muted-foreground">
          <QrCode className="h-3.5 w-3.5" /> Seguimiento por QR
        </div>
      </div>
    ),
  },
  {
    pill: "Ganancia real",
    icon: TrendingUp,
    title: "El fin del «¿habré ganado en esta reparación?»",
    text: "Ves cuánto cobraste, cuánto costó el repuesto y cuánto te quedó. Por orden y por mes, en guaraníes.",
    plan: "Pro y Business",
    mock: (
      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex justify-between text-muted-foreground"><span>Cobrado</span><span>Gs. 350.000</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Repuesto</span><span className="text-destructive">- Gs. 180.000</span></div>
        <div className="flex justify-between border-t border-border pt-1 font-semibold text-primary"><span>Te quedó</span><span>Gs. 170.000</span></div>
      </div>
    ),
  },
  {
    pill: "Garantía segura",
    icon: ShieldCheck,
    title: "El fin de las discusiones por garantía",
    text: "El reloj de la garantía arranca cuando el cliente retira el equipo. Sin «fue ayer» ni «fue hace 40 días».",
    plan: "Todos los planes",
    mock: (
      <div className="flex flex-col gap-2 text-[11px]">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[hsl(var(--status-listo))]/15 px-3 py-1 font-medium text-[hsl(var(--status-listo))]">
          Garantía activa: 23 días restantes
        </span>
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-destructive/15 px-3 py-1 font-medium text-destructive">
          Garantía expirada
        </span>
      </div>
    ),
  },
  {
    pill: "Caja y gastos",
    icon: Wallet,
    title: "El fin del «¿cuánto tendría que haber en la caja?»",
    text: "Abrís la caja, cargás lo que entra y lo que gastás, y al cerrar F7 te dice cuánto efectivo debería haber.",
    plan: "Pro y Business",
    mock: (
      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex justify-between text-muted-foreground"><span>Apertura</span><span>Gs. 200.000</span></div>
        <div className="flex justify-between text-muted-foreground"><span>+ Cobros en efectivo</span><span>Gs. 850.000</span></div>
        <div className="flex justify-between text-muted-foreground"><span>- Gastos</span><span className="text-destructive">Gs. 120.000</span></div>
        <div className="flex justify-between border-t border-border pt-1 font-semibold text-primary"><span>Efectivo esperado</span><span>Gs. 930.000</span></div>
      </div>
    ),
  },
  {
    pill: "Reparación + venta",
    icon: ShoppingBag,
    title: "El fin de manejar dos sistemas",
    text: "Si además vendés accesorios o celulares, cobrás la reparación y la venta en un solo ticket, con inventario y vitrina online.",
    plan: "Business",
    mock: (
      <div className="space-y-1.5 text-[11px]">
        <div className="flex justify-between rounded bg-muted/50 px-2.5 py-1.5"><span>Cambio de pantalla</span><span className="font-mono">Gs. 350.000</span></div>
        <div className="flex justify-between rounded bg-muted/50 px-2.5 py-1.5"><span>Funda + vidrio templado</span><span className="font-mono">Gs. 70.000</span></div>
        <div className="flex justify-between rounded border border-primary/30 bg-primary/10 px-2.5 py-1.5 font-semibold text-primary"><span>Un solo cobro</span><span className="font-mono">Gs. 420.000</span></div>
      </div>
    ),
  },
];

const guaranteeSteps = [
  {
    title: "Nos escribís por WhatsApp",
    text: "Elegís tu plan y coordinamos el pago. Te entregamos tu recibo.",
  },
  {
    title: `Lo usás ${GUARANTEE} en tu taller`,
    text: "Con órdenes reales: fotos, avisos a tus clientes y la ganancia de cada reparación.",
  },
  {
    title: "Si no te sirve, te devolvemos todo",
    text: `Nos avisás por WhatsApp dentro de los ${GUARANTEE} y te reintegramos lo que pagaste.`,
  },
];

function buildFaqs(offer: OfferStatus) {
  return [
    {
      q: `¿Cómo funciona la garantía de ${GUARANTEE}?`,
      a: `Elegís tu plan, coordinamos el pago por WhatsApp y lo usás ${GUARANTEE} en tu taller con órdenes reales. Si no te sirve, nos avisás por WhatsApp dentro de ese plazo y te devolvemos todo lo que pagaste.`,
    },
    ...(offer.active
      ? [
          {
            q: "¿Qué significa «precio congelado»?",
            a: `Quienes se suman hasta el ${offer.deadlineLabel} mantienen el precio de hoy de su plan mientras sigan suscriptos. Pasada esa fecha, los precios pueden cambiar.`,
          },
        ]
      : []),
    ...baseFaqs,
  ];
}

const baseFaqs = [
  {
    q: "¿Tengo que instalar algo?",
    a: "No. F7 funciona desde el navegador del celular, la tablet o la computadora. No hay nada que descargar.",
  },
  {
    q: "¿Otros negocios pueden ver mis datos?",
    a: "No. Cada negocio ve únicamente sus propias órdenes, clientes y números. Nadie de otra empresa puede acceder a lo tuyo.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: `Desde ${starterGs} Gs. por mes (plan Starter). Pro y Business suman reportes, inventario, caja y venta en mostrador. Pagando por semestre ahorrás 10 % y el plan anual te regala 2 meses. Podés elegir guaraníes o dólares.`,
  },
  {
    q: "¿Cómo se paga?",
    a: "Coordinamos el pago con vos por WhatsApp y te entregamos tu recibo. Si dentro de la garantía decidís que no es para vos, el reintegro se coordina por el mismo medio.",
  },
  {
    q: "Tengo más de un local o empleados, ¿me sirve?",
    a: "Sí. El plan Pro incluye sucursales ilimitadas y hasta 5 usuarios con roles; Business, usuarios ilimitados.",
  },
  {
    q: "Solo vendo accesorios, no reparo. ¿Hay plan para mí?",
    a: "Sí, el plan Retail es para locales de venta: punto de venta, inventario, código de barras y control de caja.",
  },
  {
    q: "¿Y si me trabo o no sé usarlo?",
    a: "El sistema trae un tutorial paso a paso y te ayudamos por WhatsApp, en español.",
  },
  {
    q: "¿Puedo cambiar de plan más adelante?",
    a: "Sí. Empezás con el que necesitás hoy y subís cuando tu taller crezca.",
  },
];

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
  const [now] = useState(() => new Date());
  const offer = offerStatus(now);

  useEffect(() => {
    trackMeta("ViewContent", { content_name: "oferta" });
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    const descTag = document.querySelector('meta[name="description"]');
    const prevDesc = descTag?.getAttribute("content") ?? null;
    document.title = PAGE_TITLE;
    descTag?.setAttribute("content", PAGE_DESCRIPTION);
    return () => {
      document.title = prevTitle;
      if (prevDesc !== null) descTag?.setAttribute("content", prevDesc);
    };
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
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const showStickyBar = !heroCtaVisible && !finalCtaVisible;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-24 text-foreground md:pb-0">
      {/* AVISO DE OFERTA (solo mientras la fecha límite real no haya pasado) */}
      {offer.active && (
        <div className="border-b border-secondary/40 bg-secondary/10">
          <div className="container flex items-start justify-center gap-2 py-2 text-center text-xs sm:items-center sm:text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-secondary sm:mt-0" />
            <p>
              Precio congelado para quienes se suman hasta el{" "}
              <span className="whitespace-nowrap font-semibold">{offer.deadlineLabel}</span>
              <span className="mx-1.5 text-muted-foreground">·</span>
              <span className="font-bold text-secondary">{offer.urgencyText}</span>
            </p>
          </div>
        </div>
      )}

      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
              F7
            </div>
            <span className="font-semibold tracking-tight">Manager Pro</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Ingresar</Link>
            </Button>
            <Button
              size="sm"
              onClick={() => contactWhatsApp("header")}
              className="hidden bg-primary text-primary-foreground hover:bg-primary/90 md:inline-flex"
            >
              Empezar ahora
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
              <Sparkles className="h-3 w-3" /> Hecho en Paraguay 🇵🇾 · Para talleres de reparación
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Dejá la libreta. <span className="text-primary">Sabé cuánto ganás</span> en cada reparación.
            </h1>
            <p className="mt-5 text-base text-muted-foreground md:text-lg">
              F7 Manager Pro ordena tus órdenes de trabajo, le avisa a tu cliente por WhatsApp y te muestra
              la ganancia real de cada equipo, en guaraníes.
            </p>

            <div ref={heroCtaRef} className="mt-8 flex flex-col items-center gap-3">
              <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  onClick={() => contactWhatsApp("hero")}
                  className="h-12 bg-primary px-7 text-base text-primary-foreground shadow-elevated hover:bg-primary/90"
                >
                  {CTA_LABEL} <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 border-primary/40 px-7 text-base text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <a href="#solucion">
                    Ver cómo funciona <ChevronDown className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="max-w-md text-sm font-medium">
                <ShieldCheck className="mr-1.5 inline h-4 w-4 align-[-3px] text-primary" />
                Si en {GUARANTEE} no te sirve, te devolvemos todo tu dinero.
              </p>
              <p className="text-xs text-muted-foreground">
                Sin instalar nada · Soporte por WhatsApp en español
              </p>
            </div>

            <div className="mx-auto mt-6 inline-flex max-w-full items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2 text-left text-xs text-muted-foreground">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
                F7
              </div>
              <span>Nació en un mostrador de reparaciones, no en una oficina.</span>
            </div>
          </div>

          {/* Maqueta del tablero */}
          <div className="mx-auto mt-12 max-w-md">
            <Card className="border-primary/30 bg-card p-4 shadow-[0_0_40px_-12px_hsl(var(--primary)/0.5)] sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold">Resumen de hoy</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Datos de ejemplo
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[11px] text-muted-foreground">Cobrado hoy</p>
                  <p className="mt-1 whitespace-nowrap font-mono text-sm font-bold sm:text-base">Gs. 1.850.000</p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                  <p className="text-[11px] text-muted-foreground">Ingreso neto</p>
                  <p className="mt-1 whitespace-nowrap font-mono text-sm font-bold text-primary sm:text-base">Gs. 1.120.000</p>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between rounded bg-muted/40 p-2">
                  <span className="font-mono">#0142 · iPhone 8 Juan</span>
                  <span className="rounded-full bg-[hsl(var(--status-reparacion))]/20 px-2 py-0.5 text-[10px] text-[hsl(var(--status-reparacion))]">
                    En reparación
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-muted/40 p-2">
                  <span className="font-mono">#0143 · Moto G</span>
                  <span className="rounded-full bg-[hsl(var(--status-listo))]/20 px-2 py-0.5 text-[10px] text-[hsl(var(--status-listo))]">
                    Listo
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-muted/40 p-2">
                  <span className="font-mono">#0144 · Samsung A52</span>
                  <span className="rounded-full bg-[hsl(var(--status-entregado))]/20 px-2 py-0.5 text-[10px] text-[hsl(var(--status-entregado))]">
                    Entregado
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CINTA DE BENEFICIOS */}
      <section aria-label="Beneficios" className="overflow-hidden border-y border-border/60 bg-card/60 py-3.5">
        <div className="flex w-max animate-marquee motion-reduce:w-auto motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center">
          {marqueeItems.map((item) => (
            <span
              key={item}
              className="mx-5 whitespace-nowrap text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground motion-reduce:mx-3 motion-reduce:my-1"
            >
              <span className="mr-5 text-primary motion-reduce:hidden">●</span>
              {item}
            </span>
          ))}
          {marqueeItems.map((item) => (
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
            <Kicker>El verdadero problema</Kicker>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              No te falta saber reparar. <span className="text-primary">Te falta tener todo en un solo lugar.</span>
            </h2>
            <p className="mt-5 text-lg font-medium">Reparás bien. Ese nunca fue el problema.</p>
            <p className="mt-3 text-muted-foreground">
              El problema es el equipo que jurabas que entró sin ese golpe. El repuesto que compraste y nunca
              anotaste. El cliente que te escribe a las diez de la noche: «¿ya está?». Y terminar el mes
              cansado, con la mesa llena, sin saber si quedó plata.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
            {painCards.map((card) => (
              <Card key={card.title} className="flex flex-col border-border p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/15 text-secondary">
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{card.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{card.text}</p>
                <div className="mt-4 rounded-lg border border-border bg-background/60 p-3">{card.mock}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* LA SOLUCIÓN */}
      <section id="solucion" className="scroll-mt-16 border-y border-border/60 bg-card/40 py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>La solución</Kicker>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Cada función de F7 resuelve <span className="text-primary">un dolor</span> de tu mostrador.
            </h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-3">
            {solutionBlocks.map((block) => (
              <Card key={block.pill} className="flex flex-col border-border bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    <block.icon className="h-3.5 w-3.5" /> {block.pill}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{block.plan}</span>
                </div>
                <h3 className="mt-4 text-xl font-bold leading-snug">{block.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{block.text}</p>
                <div className="mt-auto pt-5">
                  <div className="rounded-lg border border-border bg-background/60 p-3">{block.mock}</div>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Los números y nombres de las maquetas son de ejemplo.
          </p>
        </div>
      </section>

      {/* TU PARTE / LA PARTE DE F7 */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>Sin complicaciones</Kicker>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Vos reparás. <span className="text-primary">F7 se encarga del resto.</span>
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card className="border-border p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Tu parte</p>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  "Cargás la orden: cliente, equipo y falla",
                  "Sacás las fotos con el mismo celular",
                  "Reparás y cobrás",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="border-primary/50 bg-primary/5 p-6 shadow-[0_0_40px_-14px_hsl(var(--primary)/0.5)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">La parte de F7</p>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  "Guarda las fotos, las fechas y la garantía",
                  "Le avisa al cliente por WhatsApp",
                  "Calcula lo que te quedó de cada reparación",
                  "Ordena tus clientes y tu caja",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <p className="mx-auto mt-5 max-w-xl text-center text-sm text-muted-foreground">
            Tus clientes se crean solos con cada orden: no tenés que cargar ninguna lista antes de empezar.
          </p>

          <div className="mx-auto mt-14 max-w-3xl text-center">
            <p className="text-2xl font-bold tracking-tight md:text-3xl">
              Menos desorden. Menos mensajes. <span className="text-primary">Más ganancia.</span>
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {["Todo en un solo lugar", "Desde tu celular", "En guaraníes"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary"
                >
                  {t}
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
            {[
              {
                icon: Smartphone,
                title: "En tu celular",
                text: "Cargá órdenes y sacá las fotos desde el mismo teléfono con el que atendés.",
              },
              {
                icon: Laptop,
                title: "En la computadora",
                text: "Reportes, caja y clientes en pantalla grande, cuando los necesitás.",
              },
              {
                icon: Cloud,
                title: "Sin instalar nada",
                text: "Todo vive en la nube y cada negocio ve únicamente sus propios datos.",
              },
            ].map((item) => (
              <Card key={item.title} className="border-border p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-bold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
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
              <Kicker>Garantía de {GUARANTEE}</Kicker>
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Si en {GUARANTEE} no te sirve, <span className="text-primary">te devolvemos todo tu dinero</span>.
            </h2>
            <p className="mt-4 text-muted-foreground">
              El riesgo es nuestro, no tuyo. Lo usás con órdenes reales de tu taller y decidís con datos, no con
              promesas.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            {guaranteeSteps.map((step, i) => (
              <Card key={step.title} className="border-border p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-bold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
              </Card>
            ))}
          </div>

          {offer.active && (
            <div className="mx-auto mt-6 flex max-w-2xl items-start gap-3 rounded-xl border border-secondary/40 bg-secondary/10 p-4">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
              <div className="text-sm">
                <p className="font-semibold">Precio congelado hasta el {offer.deadlineLabel}</p>
                <p className="mt-0.5 text-muted-foreground">
                  Si te sumás antes de esa fecha, mantenés el precio de hoy de tu plan mientras sigas suscripto.{" "}
                  <span className="font-semibold text-secondary">{offer.urgencyText}.</span>
                </p>
              </div>
            </div>
          )}

          <Card className="mx-auto mt-6 max-w-2xl border-primary/40 p-6 shadow-[0_0_40px_-14px_hsl(var(--primary)/0.5)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Y además</p>
            <ul className="mt-4 space-y-3.5 text-sm">
              {[
                ["Soporte por WhatsApp, en español", "Una persona real te contesta."],
                ["Tutorial paso a paso", "Dentro del sistema, para cada módulo."],
                ["Precios en guaraníes", "También podés elegir dólares."],
              ].map(([title, sub]) => (
                <li key={title} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    <span className="font-semibold">{title}</span>
                    <span className="block text-muted-foreground">{sub}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              onClick={() => contactWhatsApp("garantia")}
              className="mt-6 h-12 w-full bg-primary text-base text-primary-foreground shadow-elevated hover:bg-primary/90"
            >
              {CTA_LABEL} <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        </div>
      </section>

      {/* PLANES */}
      <PricingSection
        onContact={(message) => contactWhatsApp("planes", message)}
        ctaLabel="Elegir este plan"
        note={
          <>
            <p className="font-medium text-foreground">
              <ShieldCheck className="mr-1.5 inline h-4 w-4 align-[-3px] text-primary" />
              Todos los planes incluyen la garantía de {GUARANTEE}: si no te sirve, te devolvemos todo tu dinero.
            </p>
            {offer.active && (
              <p className="mt-2">
                Precio congelado para quienes se suman hasta el {offer.deadlineLabel}.{" "}
                <span className="font-semibold text-secondary">{offer.urgencyText}.</span>
              </p>
            )}
          </>
        }
      />

      {/* PREGUNTAS FRECUENTES */}
      <section className="border-t border-border/60 py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>Preguntas frecuentes</Kicker>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Antes de empezar</h2>
          </div>
          <Accordion type="single" collapsible className="mx-auto mt-8 max-w-2xl">
            {buildFaqs(offer).map((item, i) => (
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
                Tu próxima reparación, <span className="text-primary">ya ordenada</span>.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Usalo <span className="font-semibold text-foreground">{GUARANTEE}</span> en tu taller. Si no te
                sirve, <span className="font-semibold text-foreground">te devolvemos todo tu dinero</span>.
              </p>
              {offer.active && (
                <p className="mx-auto mt-3 max-w-xl text-sm">
                  <Lock className="mr-1.5 inline h-4 w-4 align-[-3px] text-secondary" />
                  Precio congelado para quienes se suman hasta el {offer.deadlineLabel}.{" "}
                  <span className="font-semibold text-secondary">{offer.urgencyText}.</span>
                </p>
              )}
              <div ref={finalCtaRef} className="mt-8 flex justify-center">
                <Button
                  size="lg"
                  onClick={() => contactWhatsApp("final")}
                  className="h-12 w-full bg-primary px-7 text-base text-primary-foreground shadow-elevated hover:bg-primary/90 sm:w-auto"
                >
                  {CTA_LABEL} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                🇵🇾 Hecho en Paraguay · Soporte por WhatsApp en español
              </p>
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
            <span>F7 Manager Pro · Hecho en Paraguay</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-primary">
              Ingresar
            </Link>
            <button onClick={() => contactWhatsApp("footer")} className="hover:text-primary">
              Soporte por WhatsApp
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
            {CTA_LABEL} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
