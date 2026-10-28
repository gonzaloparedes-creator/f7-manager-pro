import { PLAN_FEATURES, PLAN_MESSAGES } from "@/lib/plans";
import { GENERAL_INTEREST_MESSAGE } from "@/lib/upgrade";

// Español = idioma de referencia: en.ts y pt.ts tienen que tener exactamente esta forma
// (si falta una frase, TypeScript no compila). Marcadores: **destacado**, [[acento]], {days}, {starterPrice}.
export const es = {
  common: {
    daysUnit: "días",
    login: "Ingresar",
    viewPlans: "Ver planes",
    startNow: "Empezar ahora",
    howItWorks: "Ver cómo funciona",
    footerBrand: "F7 Manager Pro · Hecho en Paraguay",
    languageLabel: "Idioma",
    ctaGuarantee: "Empezar con garantía de {days}",
    guarantee: "Si en {days} no te sirve, te devolvemos todo tu dinero.",
    statusRepair: "En reparación",
    statusReady: "Listo",
    statusDelivered: "Entregado",
    warrantyActive: "Garantía activa: 23 días restantes",
    warrantyExpired: "Garantía expirada",
  },

  pricing: {
    titleWorkshop: "Precios honestos para [[talleres reales]].",
    titleShop: "Precios honestos para [[tu mostrador]].",
    subtitleWorkshop: "Elegí tu moneda y tu ciclo. Cambialo cuando quieras.",
    subtitleShop: "Sin órdenes de reparación, sin QR, sin firmas — solo mostrador y caja.",
    segmentWorkshop: "Tengo un Taller",
    segmentShop: "Solo tengo Tienda",
    currencyGs: "Guaraníes (Gs.)",
    currencyUsd: "USD ($)",
    usdPrefix: "$",
    cycleMonthly: "Mensual",
    cycleSemiannual: "Semestral · Ahorrá 10%",
    cycleAnnual: "Anual · 2 meses gratis",
    perMonth: "/ mes",
    perSemester: "/ semestre",
    perYear: "/ año",
    equivalent: "Equivale a {amount} / mes",
    choose: "Elegir este plan",
    guaranteeNote: "Todos los planes incluyen la garantía de {days}: si no te sirve, te devolvemos todo tu dinero.",
    badges: { pro: "Más Popular", business: "Todo en Uno", retail: "Solo Ventas" },
    plans: {
      starter: {
        subtitle: "Ideal para dar el primer paso y profesionalizar tu mostrador.",
        features: PLAN_FEATURES.starter,
        message: PLAN_MESSAGES.starter,
      },
      pro: {
        subtitle: "Para talleres que quieren escalar y controlar sus ganancias reales.",
        features: PLAN_FEATURES.pro,
        message: PLAN_MESSAGES.pro,
      },
      business: {
        subtitle: "Para negocios híbridos que reparan y también venden en mostrador.",
        features: PLAN_FEATURES.business,
        message: PLAN_MESSAGES.business,
      },
      retail: {
        subtitle: "Ideal para locales de accesorios, carcasas y venta de celulares.",
        features: PLAN_FEATURES.retail,
        message: PLAN_MESSAGES.retail,
      },
    },
  },

  home: {
    meta: {
      title: "F7 Manager Pro",
      description:
        "Gestioná órdenes de reparación, enviá notificaciones por WhatsApp y tus clientes hacen seguimiento en tiempo real. Profesionalizá tu taller.",
    },
    whatsapp: GENERAL_INTEREST_MESSAGE,
    hero: {
      badge: "Hecho en Paraguay 🇵🇾",
      title: "¿Cansado del caos de [[libretas y WhatsApp]]?",
      text: "Sabemos el dolor de perder una orden, discutir con un cliente por una garantía o no saber cuántas pantallas te quedan en stock. **F7 Manager Pro nació en un mostrador de reparaciones, no en una oficina.**",
    },
    chaos: {
      before: "Antes",
      beforeLines: [
        '📓 Libreta hoja 47 — "iPhone 8 Juan, no lee"',
        '💬 WhatsApp: "che el del moto g cuanto era?"',
        '🧾 Papelito: "garantia 30 dias?? o 60??"',
        '😵 "¿Dónde anoté el del Samsung?"',
      ],
      after: "Con F7",
    },
    pain: {
      pill: "El costo real",
      title: "Si no controlas tu taller, [[estás perdiendo Gs.]] cada día.",
      text: 'Hacé clic en cada tarjeta y descubrí cuánto te está costando seguir "como siempre".',
      more: "+ Ver más",
      less: "− Ocultar",
      cards: {
        leaks: {
          title: "Fugas de Dinero",
          teaser: "¿Seguro que ganaste en esa pantalla genérica?",
          detail:
            "Olvidar los costos ocultos te está matando. Sin un control real de repuestos en Gs., cada reparación puede ser una pérdida silenciosa.",
        },
        chaos: {
          title: "Caos Operativo",
          teaser: "WhatsApp no es una herramienta de gestión.",
          detail:
            "Si un técnico se va, se lleva la información operativa contigo. Órdenes perdidas, clientes molestos y estado real del taller: invisible.",
        },
        warranty: {
          title: "Problemas de Garantía",
          teaser: "El cliente dice que fue ayer, pero fue hace 40 días.",
          detail:
            "¿Cómo lo compruebas sin fotos, firmas ni fechas exactas? Una sola discusión por garantía te cuesta más que un mes de F7 Manager Pro.",
        },
      },
    },
    solution: {
      pill: "La solución",
      title: "F7 Manager Pro: [[el control total]] de tu taller, en Paraguay y en Gs.",
      text: "Órdenes ilimitadas, control financiero preciso y una imagen profesional que tus clientes respetarán.",
      kpiActive: "Órdenes activas",
      kpiReady: "Listas para retirar",
      kpiIncome: "Ingreso del mes",
      kpiWarranties: "Garantías activas",
      recentTitle: "Órdenes recientes",
      today: "Hoy",
      recent: ["iPhone 13 — pantalla", "Redmi Note 10 — flex", "Galaxy S21 — batería"],
    },
    features: {
      title: "Lo que [[realmente impresiona]].",
      text: "4 funciones diseñadas para talleres reales, no para presentaciones bonitas.",
      alerts: {
        title: "Avisos Inteligentes",
        desc: "Si el cliente deja su celular en el taller, F7 sabe a qué número alternativo enviar el WhatsApp. Automatización pura.",
        primary: "+595 981 111 111 (principal — en taller)",
        alternative: "✓ +595 982 222 222 (alternativo — esposa)",
      },
      warranty: {
        title: "Garantía Segura",
        desc: "El reloj de la garantía arranca cuando el cliente retira el equipo. Olvídate de los malentendidos.",
      },
      photos: {
        title: "Evidencia Fotográfica",
        desc: "Foto de cómo entró, foto de cómo sale. Compresión automática para que cargue rápido incluso con datos móviles.",
      },
      profit: {
        title: "Rentabilidad Real en Gs.",
        desc: "Ver tu Ingreso NETO real, restando costos de repuestos de Hohenau u Obligado.",
        gross: "Bruto",
        costs: "Costos",
        net: "NETO",
      },
    },
    growth: {
      pill: "Plan PRO",
      title: "Diseñado para [[crecer]].",
      text: "Empezás solo con una sucursal. Mañana sumás a tu socio, tu técnico y abrís un local más. F7 escala con vos sin cambiar de sistema.",
      bullets: [
        "Sucursales ilimitadas",
        "Hasta 5 usuarios con roles",
        "Reportes financieros consolidados",
        "20 fotos por orden",
      ],
      branches: "Sucursales",
      branchMain: "Casa Central",
      branchEast: "Sucursal Este",
      branchSouth: "Sucursal Sur",
      active: "Activa",
      users: "3 / 5 usuarios — agregá técnicos cuando quieras",
    },
    cta: {
      title: "Deja de ser un esclavo de tu [[mostrador]].",
      text: "Empezá con la **garantía de {days}**: si no te sirve, te devolvemos todo tu dinero. El precio de Starter es menor que el de **dos reparaciones genéricas al mes**. Únete a la liga profesional de talleres.",
      trust: "⚡ Activación inmediata · 🇵🇾 Soporte en español · 💾 Tus datos siempre tuyos",
    },
  },

  oferta: {
    meta: {
      title: "F7 Manager Pro · Sistema para talleres de reparación · Garantía de {days}",
      description:
        "Ordená tus órdenes de trabajo, avisale al cliente por WhatsApp y mirá cuánto ganás en cada reparación. Hecho en Paraguay. Si en {days} no te sirve, te devolvemos todo tu dinero.",
    },
    whatsapp: {
      message: "¡Hola! Vi el anuncio de F7 Manager Pro y quiero empezar con la garantía de {days} en mi taller.",
      adTag: " (Vi su anuncio)",
    },
    urgency: {
      bar: "No sabemos cuándo va a subir el precio",
      barCta: "Entrá lo antes posible y aprovechá el de hoy",
      short: "No sabemos cuándo va a subir: entrá lo antes posible.",
    },
    freeze: {
      title: "Precio congelado para quienes se suman ahora",
      body: "Mantenés el precio de hoy de tu plan mientras sigas suscripto.",
      line: "Precio congelado para quienes se suman ahora.",
    },
    hero: {
      badge: "Hecho en Paraguay 🇵🇾 · Para talleres de reparación",
      title: "Dejá la libreta. [[Sabé cuánto ganás]] en cada reparación.",
      text: "F7 Manager Pro ordena tus órdenes de trabajo, le avisa a tu cliente por WhatsApp y te muestra la ganancia real de cada equipo, en guaraníes.",
      smallPrint: "Sin instalar nada · Soporte por WhatsApp en español",
      born: "Nació en un mostrador de reparaciones, no en una oficina.",
    },
    summary: {
      title: "Resumen de hoy",
      example: "Datos de ejemplo",
      collected: "Cobrado hoy",
      net: "Ingreso neto",
    },
    marquee: {
      label: "Beneficios",
      items: [
        "Fotos de entrada y salida",
        "Aviso por WhatsApp al cliente",
        "Garantía con reloj",
        "Ganancia real por orden",
        "Seguimiento por QR",
        "Caja y gastos",
      ],
    },
    problem: {
      kicker: "El verdadero problema",
      title: "No te falta saber reparar. [[Te falta tener todo en un solo lugar.]]",
      lead: "Reparás bien. Ese nunca fue el problema.",
      text: "El problema es el equipo que jurabas que entró sin ese golpe. El repuesto que compraste y nunca anotaste. El cliente que te escribe a las diez de la noche: «¿ya está?». Y terminar el mes cansado, con la mesa llena, sin saber si quedó plata.",
      cards: {
        notebook: {
          title: "La libreta que te traiciona",
          text: "Se moja, se pierde y se lleva el historial. Una orden perdida es plata perdida o un reclamo.",
          lines: ['Hoja 47 — "iPhone 8 Juan, no lee"', "Moto G, cambio de pin, 180?", "¿Dónde anoté el del Samsung?"],
        },
        whatsapp: {
          title: "El WhatsApp que no para",
          text: "Pasás el día contestando «¿ya está mi celular?» en vez de reparar. Cada mensaje te corta el trabajo.",
          lines: ["¿Ya está mi celular? 🙏", "Todavía no, te aviso", "¿Y ahora?"],
        },
        money: {
          title: "La plata que no se ve",
          text: "Cobraste bien, pero ¿cuánto te quedó después del repuesto? Sin ese número, podés estar trabajando gratis.",
          collected: "Cobrado",
          part: "Repuesto",
          left: "¿Te quedó?",
        },
      },
    },
    solution: {
      kicker: "La solución",
      title: "Cada función de F7 resuelve [[un dolor]] de tu mostrador.",
      footnote: "Los números y nombres de las maquetas son de ejemplo.",
      allPlans: "Todos los planes",
      proBusiness: "Pro y Business",
      businessOnly: "Business",
      blocks: {
        photos: {
          pill: "Evidencia fotográfica",
          title: "El fin de «yo no lo dejé así»",
          text: "Foto de cómo entró y foto de cómo sale, con fecha. Si hay una discusión, tenés la prueba en la mano.",
          came: "Entró",
          left: "Salió",
          note: "Pantalla rota · Cámara ok · Sin golpes en el marco",
        },
        whatsapp: {
          pill: "Avisos por WhatsApp",
          title: "El fin del «¿ya está mi equipo?»",
          text: "F7 le avisa al cliente por WhatsApp cuando su equipo cambia de estado, y con el QR puede ver el avance sin escribirte.",
          message: "Hola Juan 👋 Tu **iPhone 8** ya está [[listo para retirar]].",
          tracking: "Seguimiento por QR",
        },
        profit: {
          pill: "Ganancia real",
          title: "El fin del «¿habré ganado en esta reparación?»",
          text: "Ves cuánto cobraste, cuánto costó el repuesto y cuánto te quedó. Por orden y por mes, en guaraníes.",
          collected: "Cobrado",
          part: "Repuesto",
          left: "Te quedó",
        },
        warranty: {
          pill: "Garantía segura",
          title: "El fin de las discusiones por garantía",
          text: "El reloj de la garantía arranca cuando el cliente retira el equipo. Sin «fue ayer» ni «fue hace 40 días».",
        },
        cash: {
          pill: "Caja y gastos",
          title: "El fin del «¿cuánto tendría que haber en la caja?»",
          text: "Abrís la caja, cargás lo que entra y lo que gastás, y al cerrar F7 te dice cuánto efectivo debería haber.",
          opening: "Apertura",
          cashIn: "+ Cobros en efectivo",
          expenses: "- Gastos",
          expected: "Efectivo esperado",
        },
        bundle: {
          pill: "Reparación + venta",
          title: "El fin de manejar dos sistemas",
          text: "Si además vendés accesorios o celulares, cobrás la reparación y la venta en un solo ticket, con inventario y vitrina online.",
          repair: "Cambio de pantalla",
          sale: "Funda + vidrio templado",
          total: "Un solo cobro",
        },
      },
    },
    split: {
      kicker: "Sin complicaciones",
      title: "Vos reparás. [[F7 se encarga del resto.]]",
      yourPart: "Tu parte",
      yourItems: [
        "Cargás la orden: cliente, equipo y falla",
        "Sacás las fotos con el mismo celular",
        "Reparás y cobrás",
      ],
      f7Part: "La parte de F7",
      f7Items: [
        "Guarda las fotos, las fechas y la garantía",
        "Le avisa al cliente por WhatsApp",
        "Calcula lo que te quedó de cada reparación",
        "Ordena tus clientes y tu caja",
      ],
      note: "Tus clientes se crean solos con cada orden: no tenés que cargar ninguna lista antes de empezar.",
      tagline: "Menos desorden. Menos mensajes. [[Más ganancia.]]",
      chips: ["Todo en un solo lugar", "Desde tu celular", "En guaraníes"],
    },
    devices: {
      phone: {
        title: "En tu celular",
        text: "Cargá órdenes y sacá las fotos desde el mismo teléfono con el que atendés.",
      },
      computer: {
        title: "En la computadora",
        text: "Reportes, caja y clientes en pantalla grande, cuando los necesitás.",
      },
      cloud: {
        title: "Sin instalar nada",
        text: "Todo vive en la nube y cada negocio ve únicamente sus propios datos.",
      },
    },
    guarantee: {
      kicker: "Garantía de {days}",
      title: "Si en {days} no te sirve, [[te devolvemos todo tu dinero]].",
      text: "El riesgo es nuestro, no tuyo. Lo usás con órdenes reales de tu taller y decidís con datos, no con promesas.",
      steps: {
        write: {
          title: "Nos escribís por WhatsApp",
          text: "Elegís tu plan y coordinamos el pago. Te entregamos tu recibo.",
        },
        use: {
          title: "Lo usás {days} en tu taller",
          text: "Con órdenes reales: fotos, avisos a tus clientes y la ganancia de cada reparación.",
        },
        refund: {
          title: "Si no te sirve, te devolvemos todo",
          text: "Nos avisás por WhatsApp dentro de los {days} y te reintegramos lo que pagaste.",
        },
      },
      extrasTitle: "Y además",
      extras: [
        { title: "Soporte por WhatsApp, en español", text: "Una persona real te contesta." },
        { title: "Tutorial paso a paso", text: "Dentro del sistema, para cada módulo." },
        { title: "Precios en guaraníes", text: "También podés elegir dólares." },
      ],
    },
    faq: {
      kicker: "Preguntas frecuentes",
      title: "Antes de empezar",
      items: [
        {
          q: "¿Cómo funciona la garantía de {days}?",
          a: "Elegís tu plan, coordinamos el pago por WhatsApp y lo usás {days} en tu taller con órdenes reales. Si no te sirve, nos avisás por WhatsApp dentro de ese plazo y te devolvemos todo lo que pagaste.",
        },
        {
          q: "¿Qué significa «precio congelado»?",
          a: "Quienes se suman ahora mantienen el precio de hoy de su plan mientras sigan suscriptos. No sabemos cuándo van a cambiar los precios: por eso conviene entrar lo antes posible.",
        },
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
          a: "Desde {starterPrice} Gs. por mes (plan Starter). Pro y Business suman reportes, inventario, caja y venta en mostrador. Pagando por semestre ahorrás 10 % y el plan anual te regala 2 meses. Podés elegir guaraníes o dólares.",
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
      ],
      // Solo en otros idiomas: avisa que el sistema todavía está en español.
      extra: [] as { q: string; a: string }[],
    },
    final: {
      title: "Tu próxima reparación, [[ya ordenada]].",
      text: "Usalo **{days}** en tu taller. Si no te sirve, **te devolvemos todo tu dinero**.",
      smallPrint: "🇵🇾 Hecho en Paraguay · Soporte por WhatsApp en español",
    },
    footer: { support: "Soporte por WhatsApp" },
  },
};

export type LandingDict = typeof es;
