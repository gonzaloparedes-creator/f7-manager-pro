import { OFFER_GUARANTEE_DAYS } from "@/lib/ofertaOffer";
import { PRICING } from "@/lib/plans";
import { formatNumber } from "@/i18n/language";

// Textos de /py: la landing del VSL para Paraguay. Solo español (voseo) y guaraníes.
// Todo lo que dice sale del guion del VSL: no se agregan cifras, clientes ni testimonios.
// Marcadores de <Rich>: **destacado**, [[acento de color]].
const days = `${OFFER_GUARANTEE_DAYS} días`;
const gs = (n: number) => `Gs. ${formatNumber(n, "es")}`;
const PRO_MONTHLY = PRICING.pro.mensual.gs;
const STARTER_MONTHLY = PRICING.starter.mensual.gs;
// Orden de ejemplo del video: cobraste 350.000, el repuesto costó 180.000, te quedaron 170.000.
const EXAMPLE_LEFT = 170000;

export const PY = {
  meta: {
    title: "F7 Manager · Sistema para talleres de celulares en Paraguay",
    description: `Mirá el video: cómo ordenar tu taller y saber cuánto te deja cada reparación. Hecho en Paraguay, en guaraníes. Garantía de ${days}.`,
  },
  whatsapp: {
    message: `¡Hola! Vi el video de F7 Manager y quiero empezar con la garantía de ${days} en mi taller.`,
    // Marca para distinguir en WhatsApp los contactos que vienen de esta página.
    tag: " (Vi el video)",
  },
  topBar: "🇵🇾 Hecho en Paraguay, para talleres de Paraguay · Precios en guaraníes",
  header: { brand: "Manager", login: "Ingresar", cta: "Escribinos" },
  hero: {
    badge: "Video de 6 minutos · Miralo con sonido",
    title: "Si tenés un taller de celulares en Paraguay, [[mirá este video]].",
    text: "Te mostramos cómo ordenar tu taller y saber cuánto te deja cada reparación. Sin libretas, sin vivir pegado al WhatsApp y sin ser experto en computadoras.",
    play: "Tocá para ver el video",
    pending: "El video se está preparando",
    videoTitle: "F7 Manager: cómo ordenar tu taller y saber cuánto ganás",
    cta: "Escribinos por WhatsApp",
    guarantee: `Si en ${days} no te sirve, te devolvemos todo tu dinero.`,
    registered: "Ya se registraron más de 80 talleres",
  },
  story: {
    kicker: "Quiénes somos",
    title: "Lo creamos [[desde un mostrador]], no desde una oficina.",
    paragraphs: [
      "Somos **Javier y Gonzalo**. Javier es técnico especialista en microsoldadura y repara celulares hace más de 7 años en **Seven Store**, su taller. Gonzalo es desarrollador: crea aplicaciones y sistemas para negocios.",
      "En el mostrador de Javier veíamos todos los días lo que vive casi todo técnico: la libreta, el «¿ya está mi celular?» y el fin de mes sin saber cuánto había quedado.",
      "Así que juntamos lo que sabe cada uno: Javier, el mostrador; Gonzalo, la programación. **Así nació F7 Manager.**",
    ],
    javier: "Javier · Técnico, especialista en microsoldadura",
    gonzalo: "Gonzalo · Desarrollador",
    imageAlt: "Ilustración de Javier y Gonzalo en el taller",
  },
  circuit: {
    kicker: "El Circuito del Mostrador",
    title: "Cuatro pasos, [[todo desde el celular]].",
    footnote: "Capturas reales de F7 Manager, con datos de ejemplo.",
    steps: [
      {
        key: "recibir",
        label: "Recibir",
        title: "Todo en una orden, con fecha y hora",
        text: "Cargás al cliente, el equipo y la falla. Marcás el checklist y sacás fotos de cómo llegó. Si mañana te dicen «yo no lo dejé así», abrís la orden y ahí está la foto.",
        image: "/py/paso-recibir.webp",
        alt: "Orden de reparación en F7 Manager con cliente, equipo y estado",
      },
      {
        key: "avisar",
        label: "Avisar",
        title: "El mensaje ya viene escrito",
        text: "Cuando el equipo está listo, el mensaje para tu cliente ya viene escrito, con su nombre y su equipo. Vos solo tocás enviar. Y con el QR del comprobante, tu cliente ve cómo va sin escribirte.",
        image: "/py/paso-avisar.webp",
        alt: "Mensaje de WhatsApp listo para enviar al cliente",
      },
      {
        key: "entregar",
        label: "Entregar",
        title: "La garantía corre desde la entrega",
        text: "Cobrás el saldo y arranca el reloj de la garantía: desde el día que lo retira, no desde el día que lo trajo. Buscás el equipo y te dice cuántos días le quedan.",
        image: "/py/paso-entregar.webp",
        alt: "Garantía vigente con los días que le quedan",
      },
      {
        key: "ganar",
        label: "Ganar",
        title: "Sabés cuánto te quedó",
        text: "En cada orden ves lo que cobraste, lo que te costó el repuesto y lo que te quedó. Y en el reporte, la misma cuenta del mes entero.",
        image: "/py/paso-ganar.webp",
        alt: "Ganancia de la orden: precio al cliente menos costo del repuesto",
        plan: "Planes Pro y Business",
      },
    ],
  },
  results: {
    kicker: "Con F7 Manager",
    items: [
      "Sabés cuánto te deja cada reparación",
      "Chau al «¿ya está?» todo el día",
      "Sin discusiones por garantías",
      "Tu taller se ve profesional",
      "Las órdenes no se van con vos",
    ],
    chip: "Funciona en el celular o en la compu · Sin instalar nada",
  },
  // Capturas reales del grupo de WhatsApp, publicadas con permiso de cada uno (números tapados).
  // No editar lo que dicen: el alt es la transcripción literal.
  testimonials: {
    kicker: "Mensajes reales",
    title: "Lo que nos escriben los talleres que [[ya usan F7]]",
    items: [
      {
        key: "ever",
        image: "/py/testimonio-ever.webp",
        width: 720,
        height: 380,
        who: "Ever Coronel",
        alt: "Mensaje de WhatsApp de Ever Coronel: «A mi me es re útil hasta ahora ni una queja». «Equipo que ingresa, equipo que se registra».",
      },
      {
        key: "milciades-ever",
        image: "/py/testimonio-milciades-ever.webp",
        width: 720,
        height: 725,
        who: "Milciades Electrónica y Ever Coronel",
        alt: "Mensajes de WhatsApp. Milciades Electrónica: «Legalmente es muy bueno el panel conviene mas a los que tienen su control en word y es mucho mas rapido». Ever Coronel responde: «Yo lgmt primera vez usaré un sistema así el sistema que usaba antes era anotar todo en mi cabeza».",
      },
      {
        key: "reporte",
        image: "/py/testimonio-reporte.webp",
        width: 720,
        height: 836,
        who: "Un taller compartiendo su reporte del mes",
        alt: "Un usuario comparte por WhatsApp la captura de su reporte financiero del mes en F7 Manager y escribe: «Full».",
      },
    ],
    footnote: "Capturas reales de WhatsApp, publicadas con permiso. Tapamos los números de teléfono.",
  },
  objections: {
    kicker: "Seguro estás pensando…",
    items: [
      {
        q: "«No tengo tiempo de cargar todo»",
        a: "No cargás todo: cargás cada equipo cuando entra, y no hace falta pasar la libreta vieja.",
      },
      {
        q: "«Mis clientes no usan aplicaciones»",
        a: "No hace falta: el aviso les llega por WhatsApp y el seguimiento se abre con un QR, sin descargar nada.",
      },
      {
        q: "«Es caro»",
        a: `Hagamos la cuenta: en la orden de ejemplo te quedaron ${gs(EXAMPLE_LEFT)}. El plan Pro, el que trae el reporte de ganancia, sale ${gs(PRO_MONTHLY)} al mes. Se paga con una reparación.`,
      },
    ],
  },
  offer: {
    kicker: "Planes",
    line: `Hay planes desde ${gs(STARTER_MONTHLY)} por mes. El que te recomendamos es el **plan Pro, a ${gs(PRO_MONTHLY)}**. Y si pagás el año, tenés **2 meses gratis**.`,
    help: "No arrancás solo: te ayudamos por WhatsApp a dejar tu taller andando.",
  },
  final: {
    title: "Tu taller, [[ordenado desde hoy]].",
    text: `Escribinos por WhatsApp y arrancás hoy, con la **garantía de ${days}**: si no te sirve, te devolvemos todo tu dinero.`,
    smallPrint: "🇵🇾 Hecho en Paraguay · Soporte por WhatsApp en español",
  },
  footer: { brand: "F7 Manager · Hecho en Paraguay", support: "Soporte por WhatsApp" },
  stickyCta: "Escribinos por WhatsApp",
} as const;
