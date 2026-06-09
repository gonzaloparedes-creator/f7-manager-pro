import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import UpgradeProDialog from "@/components/UpgradeProDialog";
import { openUpgradeWhatsApp } from "@/lib/upgrade";
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

const painCards = [
  {
    icon: Wallet,
    title: "Fugas de Dinero",
    teaser: "¿Seguro que ganaste en esa pantalla genérica?",
    detail:
      "Olvidar los costos ocultos te está matando. Sin un control real de repuestos en Gs., cada reparación puede ser una pérdida silenciosa.",
    accent: "text-secondary",
  },
  {
    icon: ClipboardList,
    title: "Caos Operativo",
    teaser: "WhatsApp no es una herramienta de gestión.",
    detail:
      "Si un técnico se va, se lleva la información operativa contigo. Órdenes perdidas, clientes molestos y estado real del taller: invisible.",
    accent: "text-primary",
  },
  {
    icon: ShieldCheck,
    title: "Problemas de Garantía",
    teaser: "El cliente dice que fue ayer, pero fue hace 40 días.",
    detail:
      "¿Cómo lo compruebas sin fotos, firmas ni fechas exactas? Una sola discusión por garantía te cuesta más que un mes de F7 Manager Pro.",
    accent: "text-destructive",
  },
];

const features = [
  {
    icon: MessageSquare,
    title: "Avisos Inteligentes",
    desc: "Si el cliente deja su celular en el taller, F7 sabe a qué número alternativo enviar el WhatsApp. Automatización pura.",
    demo: (
      <div className="space-y-2 text-xs">
        <div className="rounded-md bg-muted/50 px-3 py-2 text-muted-foreground line-through">
          +595 981 111 111 (principal — en taller)
        </div>
        <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-primary">
          ✓ +595 982 222 222 (alternativo — esposa)
        </div>
      </div>
    ),
  },
  {
    icon: ShieldCheck,
    title: "Garantía Segura",
    desc: "El reloj de la garantía arranca cuando el cliente retira el equipo. Olvídate de los malentendidos.",
    demo: (
      <div className="flex flex-col gap-2 text-xs">
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
    icon: Camera,
    title: "Evidencia Fotográfica",
    desc: "Foto de cómo entró, foto de cómo sale. Compresión automática para que cargue rápido incluso con datos móviles.",
    demo: (
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
  },
  {
    icon: TrendingUp,
    title: "Rentabilidad Real en Gs.",
    desc: "Ver tu Ingreso NETO real, restando costos de repuestos de Hohenau u Obligado.",
    demo: (
      <div className="space-y-1 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>Bruto</span>
          <span className="font-mono">Gs. 4.850.000</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Costos</span>
          <span className="font-mono text-destructive">- Gs. 2.120.000</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1 text-primary font-semibold">
          <span>NETO</span>
          <span className="font-mono">Gs. 2.730.000</span>
        </div>
      </div>
    ),
  },
];

export default function Presentacion() {
  const [openCard, setOpenCard] = useState<number | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
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
              onClick={() => setShowPlans(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Ver planes
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
              <Sparkles className="h-3 w-3" /> Hecho en Paraguay 🇵🇾
            </span>
            <h1 className="mt-4 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              ¿Cansado del caos de{" "}
              <span className="text-primary">libretas y WhatsApp</span>?
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground">
              Sabemos el dolor de perder una orden, discutir con un cliente por
              una garantía o no saber cuántas pantallas te quedan en stock.{" "}
              <span className="text-foreground font-medium">
                F7 Manager Pro nació en un mostrador de reparaciones, no en una
                oficina.
              </span>
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => setShowPlans(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-elevated"
              >
                Empezar 14 días GRATIS <ArrowRight className="h-4 w-4" />
              </Button>
              <a
                href="#solucion"
                className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              >
                Ver cómo funciona <ChevronDown className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Visual: chaos vs order */}
          <div className="mx-auto mt-14 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card className="border-destructive/30 bg-destructive/5 p-5">
              <div className="mb-3 flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Antes
                </span>
              </div>
              <div className="space-y-2 font-mono text-[11px] text-muted-foreground">
                <div className="rounded bg-muted/50 p-2">📓 Libreta hoja 47 — "iPhone 8 Juan, no lee"</div>
                <div className="rounded bg-muted/50 p-2">💬 WhatsApp: "che el del moto g cuanto era?"</div>
                <div className="rounded bg-muted/50 p-2">🧾 Papelito: "garantia 30 dias?? o 60??"</div>
                <div className="rounded bg-muted/50 p-2">😵 "¿Dónde anoté el del Samsung?"</div>
              </div>
            </Card>
            <Card className="border-primary/30 bg-primary/5 p-5">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Con F7
                </span>
              </div>
              <div className="space-y-2 text-[11px]">
                <div className="flex items-center justify-between rounded bg-card/80 p-2">
                  <span className="font-mono">#0142 · iPhone 8 Juan</span>
                  <span className="rounded-full bg-[hsl(var(--status-reparacion))]/20 px-2 py-0.5 text-[10px] text-[hsl(var(--status-reparacion))]">
                    En reparación
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-card/80 p-2">
                  <span className="font-mono">#0143 · Moto G — Gs. 180.000</span>
                  <span className="rounded-full bg-[hsl(var(--status-listo))]/20 px-2 py-0.5 text-[10px] text-[hsl(var(--status-listo))]">
                    Listo
                  </span>
                </div>
                <div className="flex items-center justify-between rounded bg-card/80 p-2">
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

      {/* SECTION 2 — AGITATION */}
      <section className="border-t border-border/60 py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
              <AlertTriangle className="h-3 w-3" /> El costo real
            </span>
            <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight">
              Si no controlas tu taller,{" "}
              <span className="text-secondary">estás perdiendo Gs.</span> cada día.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Hacé clic en cada tarjeta y descubrí cuánto te está costando seguir
              "como siempre".
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
            {painCards.map((c, i) => {
              const Icon = c.icon;
              const isOpen = openCard === i;
              return (
                <button
                  key={c.title}
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
                  <h3 className="text-lg font-semibold">{c.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{c.teaser}</p>
                  <div
                    className={`grid transition-all duration-300 ${
                      isOpen ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="border-t border-border/60 pt-3 text-sm text-foreground/90">
                        {c.detail}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-primary opacity-70 group-hover:opacity-100">
                    {isOpen ? "− Ocultar" : "+ Ver más"}
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
              La solución
            </span>
            <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight">
              F7 Manager Pro: <span className="text-primary">el control total</span> de tu taller, en Paraguay y en Gs.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Órdenes ilimitadas, control financiero preciso y una imagen profesional que tus clientes respetarán.
            </p>
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
                { label: "Órdenes activas", value: "37", tone: "text-primary" },
                { label: "Listas para retirar", value: "12", tone: "text-[hsl(var(--status-listo))]" },
                { label: "Ingreso del mes", value: "Gs. 12.4M", tone: "text-secondary" },
                { label: "Garantías activas", value: "84", tone: "text-[hsl(var(--status-garantia))]" },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-border bg-background/40 p-4">
                  <div className="text-xs text-muted-foreground">{k.label}</div>
                  <div className={`mt-1 text-2xl font-bold ${k.tone}`}>{k.value}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Órdenes recientes</span>
                <span className="text-xs text-muted-foreground">Hoy</span>
              </div>
              <div className="space-y-2">
                {[
                  ["#0192", "iPhone 13 — pantalla", "En reparación", "reparacion"],
                  ["#0191", "Redmi Note 10 — flex", "Listo", "listo"],
                  ["#0190", "Galaxy S21 — batería", "Entregado", "entregado"],
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
              Lo que <span className="text-primary">realmente impresiona</span>.
            </h2>
            <p className="mt-3 text-muted-foreground">
              4 funciones diseñadas para talleres reales, no para presentaciones bonitas.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card
                  key={f.title}
                  className="group p-6 transition-all hover:border-primary/40 hover:shadow-elevated"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold">{f.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border border-border bg-background/40 p-3">
                    {f.demo}
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
                Plan PRO
              </span>
              <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
                Diseñado para <span className="text-primary">crecer</span>.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Empezás solo con una sucursal. Mañana sumás a tu socio, tu técnico
                y abrís un local más. F7 escala con vos sin cambiar de sistema.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Sucursales ilimitadas</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Hasta 5 usuarios con roles</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Reportes financieros consolidados</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> 20 fotos por orden</li>
              </ul>
            </div>
            <Card className="p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sucursales
              </div>
              <div className="space-y-2">
                {[
                  ["Casa Central", "Asunción", true],
                  ["Sucursal Este", "Ciudad del Este", false],
                  ["Sucursal Sur", "Encarnación", false],
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
                        Activa
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> 3 / 5 usuarios — agregá técnicos cuando quieras
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* SECTION 5.5 — PRICING */}
      <PricingSection onContact={() => openUpgradeWhatsApp()} />

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
                Deja de ser un esclavo de tu <span className="text-primary">mostrador</span>.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Pruébalo gratis por <span className="text-foreground font-semibold">14 días</span>.
                Sin tarjetas, sin compromiso. El precio de Starter es menor que el de
                <span className="text-foreground font-semibold"> dos reparaciones genéricas al mes</span>.
                Únete a la liga profesional de talleres.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  asChild
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-elevated text-base h-12 px-7"
                >
                  <Link to="/register">
                    Empezar 14 días GRATIS <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="h-12 px-7 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  Ver planes
                </Button>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                ⚡ Activación inmediata · 🇵🇾 Soporte en español · 💾 Tus datos siempre tuyos
              </p>
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
            <span>F7 Manager Pro · Hecho en Paraguay</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-primary">Ingresar</Link>
            <Link to="/register" className="hover:text-primary">Crear cuenta</Link>
          </div>
        </div>
      </footer>

      <UpgradeProDialog open={showPlans} onOpenChange={setShowPlans} />
    </div>
  );
}

// =================== PRICING SECTION ===================
type Currency = "gs" | "usd";
type Cycle = "mensual" | "semestral" | "anual";

const PRICING: Record<"starter" | "pro", Record<Cycle, { usd: number; gs: number }>> = {
  starter: {
    mensual: { usd: 9, gs: 55000 },
    semestral: { usd: 49, gs: 295000 },
    anual: { usd: 90, gs: 550000 },
  },
  pro: {
    mensual: { usd: 15, gs: 95000 },
    semestral: { usd: 80, gs: 510000 },
    anual: { usd: 150, gs: 950000 },
  },
};

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

function PricingSection({ onContact }: { onContact: () => void }) {
  const [currency, setCurrency] = useState<Currency>("gs");
  const [cycle, setCycle] = useState<Cycle>("mensual");

  const renderCard = (
    plan: "starter" | "pro",
    opts: { title: string; subtitle: string; features: string[]; cta: string; highlight?: boolean },
  ) => {
    const price = PRICING[plan][cycle];
    const value = currency === "usd" ? price.usd : price.gs;
    const monthlyEq =
      cycle !== "mensual"
        ? Math.round((currency === "usd" ? price.usd : price.gs) / CYCLE_MONTHS[cycle])
        : null;

    return (
      <Card
        className={
          "relative flex flex-col p-7 " +
          (opts.highlight
            ? "border-primary/60 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.5)]"
            : "border-border")
        }
      >
        {opts.highlight && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-primary/40 bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            Más Popular
          </div>
        )}
        <h3 className="text-2xl font-bold">{opts.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{opts.subtitle}</p>

        <div className="mt-6 flex items-end gap-2">
          <span className={"text-4xl font-extrabold tracking-tight " + (opts.highlight ? "text-primary" : "")}>
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
              <CheckCircle2 className={"mt-0.5 h-4 w-4 shrink-0 " + (opts.highlight ? "text-primary" : "text-primary/80")} />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 pt-2">
          {opts.highlight ? (
            <Button onClick={onContact} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {opts.cta}
            </Button>
          ) : (
            <Button onClick={onContact} variant="outline" className="w-full border-primary/40 text-foreground hover:bg-primary/10 hover:text-primary">
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
            Precios honestos para <span className="text-primary">talleres reales</span>.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Elegí tu moneda y tu ciclo. Cambialo cuando quieras.
          </p>
        </div>

        {/* Toggles */}
        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {(["gs", "usd"] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={
                  "px-4 py-1.5 text-xs font-semibold rounded-full transition-colors " +
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
                  "px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors " +
                  (cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
          {renderCard("starter", {
            title: "Starter",
            subtitle: "Ideal para dar el primer paso y profesionalizar tu mostrador.",
            features: [
              "1 usuario (dueño / admin)",
              "1 sucursal",
              "Órdenes ilimitadas",
              "Base de clientes ilimitada",
              "Tracking QR público",
              "5 fotos por orden",
            ],
            cta: "Comenzar prueba gratis",
          })}
          {renderCard("pro", {
            title: "Pro",
            subtitle: "Para talleres que quieren escalar y controlar sus ganancias reales.",
            features: [
              "Todo lo del plan Starter, más:",
              "Hasta 5 usuarios con roles",
              "Sucursales ilimitadas",
              "Control de Inventario",
              "Reportes financieros (Ingreso Neto)",
              "20 fotos por orden",
            ],
            cta: "Empezar 14 días GRATIS",
            highlight: true,
          })}
        </div>
      </div>
    </section>
  );
}
