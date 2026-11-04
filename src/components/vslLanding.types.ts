// Forma de los textos de una landing del VSL (/py, /latam). Marcadores de <Rich>: **destacado**, [[acento de color]].
export interface VslLandingCopy {
  meta: { title: string; description: string };
  whatsapp: {
    message: string;
    /** Marca para distinguir en WhatsApp los contactos que vienen de esta página. */
    tag: string;
  };
  topBar: string;
  header: { brand: string; login: string; cta: string };
  hero: {
    badge: string;
    title: string;
    text: string;
    play: string;
    pending: string;
    videoTitle: string;
    cta: string;
    guarantee: string;
    registered: string;
  };
  story: {
    kicker: string;
    title: string;
    paragraphs: readonly string[];
    javier: string;
    gonzalo: string;
    imageAlt: string;
  };
  circuit: {
    kicker: string;
    title: string;
    footnote: string;
    steps: readonly { key: string; label: string; title: string; text: string; image: string; alt: string; plan?: string }[];
  };
  results: { kicker: string; items: readonly string[]; chip: string };
  testimonials: {
    kicker: string;
    title: string;
    items: readonly { key: string; image: string; width: number; height: number; who: string; alt: string }[];
    footnote: string;
  };
  objections: { kicker: string; items: readonly { q: string; a: string }[] };
  offer: { kicker: string; line: string; help: string };
  /** Respuestas de las preguntas frecuentes de /oferta que esta página cambia, por pregunta exacta. */
  faqAnswers?: Readonly<Record<string, string>>;
  final: { title: string; text: string; smallPrint: string };
  footer: { brand: string; support: string; privacy: string };
  stickyCta: string;
}
