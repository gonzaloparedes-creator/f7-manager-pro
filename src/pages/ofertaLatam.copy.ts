import type { VslLandingCopy } from "@/components/vslLanding.types";
import { OFFER_GUARANTEE_DAYS } from "@/lib/ofertaOffer";
import { PRICING } from "@/lib/plans";
import { PY } from "@/pages/ofertaPy.copy";

// Textos de /latam: la landing del VSL para talleres del resto de Latinoamérica. Español con voseo
// (como la voz del video) y precios en dólares. Es la misma página que /py sin lo que es solo de
// Paraguay: no se agregan cifras, clientes ni testimonios que no estén en /py.
// Marcadores de <Rich>: **destacado**, [[acento de color]].
const days = `${OFFER_GUARANTEE_DAYS} días`;
const usd = (n: number) => `US$ ${n}`;
const PRO_MONTHLY = PRICING.pro.mensual.usd;
const STARTER_MONTHLY = PRICING.starter.mensual.usd;
// Orden de ejemplo del video latino: cobraste US$ 50, el repuesto costó US$ 25, te quedaron US$ 25.
const EXAMPLE_LEFT = 25;

export const LATAM: VslLandingCopy = {
  meta: {
    title: "F7 Manager · Sistema para talleres de celulares en Latinoamérica",
    description: `Mirá el video: cómo ordenar tu taller y saber cuánto te deja cada reparación. Precios en dólares. Garantía de ${days}.`,
  },
  whatsapp: {
    message: `¡Hola! Vi el video de F7 Manager y quiero empezar con la garantía de ${days} en mi taller.`,
    tag: " (Vi el video · Latam)",
  },
  topBar: "Para talleres de celulares de toda Latinoamérica · Precios en dólares (US$)",
  header: PY.header,
  hero: {
    ...PY.hero,
    title: "Si tenés un taller de celulares, [[mirá este video]].",
  },
  story: PY.story,
  circuit: {
    ...PY.circuit,
    footnote: "Capturas reales de F7 Manager, con datos de ejemplo de un taller de Paraguay. En tu taller, los montos se ven en dólares.",
  },
  results: PY.results,
  testimonials: PY.testimonials,
  objections: {
    kicker: PY.objections.kicker,
    items: [
      PY.objections.items[0],
      PY.objections.items[1],
      {
        q: "«¿Sirve en mi país?»",
        a: "Sí. F7 Manager funciona desde el navegador, en cualquier país, y los montos se manejan en dólares. El aviso a tus clientes sale por WhatsApp, como siempre.",
      },
      {
        q: "«Es caro»",
        a: `Hagamos la cuenta: en la orden de ejemplo te quedaron ${usd(EXAMPLE_LEFT)}. El plan Pro, el que trae el reporte de ganancia, sale ${usd(PRO_MONTHLY)} al mes. Se paga con una reparación.`,
      },
    ],
  },
  offer: {
    kicker: "Planes",
    line: `Hay planes desde ${usd(STARTER_MONTHLY)} por mes. El que te recomendamos es el **plan Pro, a ${usd(PRO_MONTHLY)}**. Y si pagás el año, tenés **2 meses gratis**.`,
    help: "El pago lo coordinamos por WhatsApp, desde tu país. Y no arrancás solo: te ayudamos a dejar tu taller andando.",
  },
  faqAnswers: {
    "¿Cuánto cuesta?": `Desde ${usd(STARTER_MONTHLY)} por mes (plan Starter). Pro y Business suman reportes, inventario, caja y venta en mostrador. Pagando por semestre ahorrás 10 % y el plan anual te regala 2 meses.`,
    "¿Cómo se paga?":
      "Nos escribís por WhatsApp y te pasamos cómo pagar desde tu país. Te entregamos tu recibo. Si dentro de la garantía decidís que no es para vos, el reintegro se coordina por el mismo medio.",
  },
  final: {
    title: PY.final.title,
    text: PY.final.text,
    smallPrint: "Para talleres de toda Latinoamérica · Soporte por WhatsApp en español",
  },
  footer: { brand: "F7 Manager", support: PY.footer.support, privacy: PY.footer.privacy },
  stickyCta: PY.stickyCta,
};
