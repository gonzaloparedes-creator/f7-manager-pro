import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FilePlus2,
  FileSearch,
  Users,
  Package,
  ShoppingBag,
  BarChart3,
  Settings as SettingsIcon,
  QrCode,
} from "lucide-react";

export interface TutorialImageRef {
  file: string;
  alt: string;
}

export interface TutorialBadge {
  label: string;
}

export interface TutorialTopic {
  id: string;
  title: string;
  badge?: TutorialBadge;
  body: string[];
  images?: TutorialImageRef[];
}

export interface TutorialCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  note?: string;
  topics: TutorialTopic[];
}

export interface VideoPlaceholder {
  id: string;
  title: string;
  description: string;
}

export const tutorialCategories: TutorialCategory[] = [
  {
    id: "ordenes",
    label: "Órdenes",
    icon: LayoutDashboard,
    description:
      "El Dashboard es la pantalla principal: acá aparecen todas las órdenes de tu taller, con búsqueda, filtros y acceso rápido para crear nuevas.",
    topics: [
      {
        id: "buscar",
        title: "Buscar y filtrar órdenes",
        body: [
          "El buscador de arriba filtra por nombre del cliente, número de orden, tipo de equipo, IMEI, marca/modelo o teléfono — no hace falta escribir el dato completo, con una parte alcanza.",
          "Debajo del buscador hay chips de estado (por ejemplo \"Recibido\", \"En reparación\", \"Listo\") que se arman automáticamente según los estados que tenga configurados tu taller en Configuración → Estados. También hay dos chips fijos: \"Activas\" (todo lo que no está entregado ni es un presupuesto) y \"Presupuestos\".",
          "Si tu taller tiene más de una sucursal, los administradores ven además un filtro para mirar una sucursal a la vez o todas juntas.",
        ],
        images: [{ file: "ordenes-buscar-01.png", alt: "Buscador y filtros de estado en el Dashboard" }],
      },
      {
        id: "tarjeta",
        title: "Leer una tarjeta de orden",
        body: [
          "Cada tarjeta muestra el número de orden, el cliente, el equipo (con marca/modelo si tu taller activó esa clasificación) y el IMEI o número de serie si se cargó.",
          "La etiqueta de color indica el estado actual de la orden. Al lado puede aparecer una etiqueta de garantía (si el trabajo tiene garantía vigente), el técnico asignado, y los problemas reportados por el cliente.",
          "Si la orden es un presupuesto, vas a ver una etiqueta con la respuesta del cliente (aceptado, rechazado o pendiente) apenas responda desde el link de seguimiento.",
          "Cuando una orden tiene saldo pendiente de cobro, aparece un botón \"Cobrar Saldo\" directo en la tarjeta para no tener que entrar al detalle.",
        ],
        images: [{ file: "ordenes-tarjeta-01.png", alt: "Detalle de una tarjeta de orden en el Dashboard" }],
      },
      {
        id: "calendario",
        title: "Calendario de entregas",
        body: [
          "El botón \"Calendario\" abre una vista con todas las órdenes que tienen una fecha de entrega estimada cargada (se excluyen las ya entregadas y los presupuestos).",
          "Los días con entregas programadas quedan marcados en el calendario, y la lista de abajo se ordena por fecha, de la más próxima a la más lejana.",
          "Si una entrega ya pasó su fecha estimada y la orden sigue sin marcarse como entregada, aparece resaltada con una etiqueta roja \"Atrasada\" para que no se te pase.",
        ],
        images: [{ file: "ordenes-calendario-01.png", alt: "Calendario de entregas con órdenes agendadas" }],
      },
    ],
  },
  {
    id: "crear-ordenes",
    label: "Crear órdenes",
    icon: FilePlus2,
    description:
      "Hay cuatro formas distintas de cargar trabajo nuevo, según el momento en el que estás: cuando el cliente ya te dejó el equipo, cuando todavía no, cuando trae varios equipos juntos, o cuando un presupuesto anterior se confirma.",
    topics: [
      {
        id: "cual-uso",
        title: "¿Cuál uso? Guía rápida",
        body: [
          "**Nueva Orden**: usala cuando el cliente te deja el equipo hoy mismo. Es el flujo completo: carga accesorios, checklist de recepción, seguridad (PIN o patrón), garantía y firma del cliente.",
          "**Nuevo Presupuesto**: usalo cuando todavía no tenés el equipo en mano — por ejemplo, alguien pregunta por teléfono o WhatsApp cuánto sale una reparación. Es liviano: solo cliente, equipo, problema y un monto estimado, sin fotos ni firma.",
          "**Modo Lote**: usalo cuando un mismo cliente te deja varios equipos a la vez (ej. toda la familia trae su celular el mismo día). Cargás el cliente una sola vez y cada equipo se convierte en una orden independiente, con su propio número y link de seguimiento. Para ganar velocidad, no pide accesorios, checklist, garantía, seña ni firma por equipo — eso se completa después desde el detalle de cada orden si hace falta.",
          "**Convertir Presupuesto en Orden**: se usa cuando un presupuesto que ya cargaste se confirma y el cliente efectivamente te trae el equipo. Se abre desde el detalle del presupuesto y ahí sí se completan accesorios, checklist, seguridad, garantía, seña y firma — los datos que el Presupuesto original no pedía.",
        ],
      },
      {
        id: "nueva-orden",
        title: "Nueva Orden",
        body: [
          "Es el formulario más completo. Se busca o carga el cliente (por nombre, teléfono o cédula/RUC), se elige el tipo de equipo (y marca/modelo si tu taller activó esa clasificación en Configuración), se anota el IMEI o número de serie, y se describe el problema.",
          "Se pueden marcar los accesorios que el cliente deja junto con el equipo (cargador, funda, etc.) y completar un checklist de recepción (estado de la pantalla, batería, etc.) para dejar registro del estado con el que entró.",
          "Si el equipo tiene PIN o patrón de desbloqueo, se puede cargar ahí mismo para que el técnico lo tenga a mano sin tener que preguntarlo de nuevo.",
          "Se completan los datos financieros (presupuesto y seña si el cliente adelanta algo), se elige la garantía y el técnico asignado (por defecto queda quien está creando la orden, pero se puede cambiar), y se puede tomar una firma del cliente y fotos del estado del equipo al recibirlo.",
        ],
        images: [
          { file: "crear-ordenes-nueva-orden-01.png", alt: "Formulario de Nueva Orden - datos del cliente y equipo" },
          { file: "crear-ordenes-nueva-orden-02.png", alt: "Formulario de Nueva Orden - datos financieros y firma" },
        ],
      },
      {
        id: "presupuesto",
        title: "Nuevo Presupuesto",
        body: [
          "Formulario liviano para cuando todavía no tenés el equipo físicamente: cliente, tipo de equipo, el problema que describe el cliente, y un monto estimado.",
          "A propósito no pide fotos, seguridad ni firma — esos datos se completan recién si el presupuesto se confirma y se convierte en una orden real.",
          "El cliente puede ver y responder este presupuesto desde su link de seguimiento (aceptar, pedir cambios o rechazar), y esa respuesta se refleja como una etiqueta en la tarjeta de la orden en el Dashboard.",
        ],
        images: [{ file: "crear-ordenes-presupuesto-01.png", alt: "Formulario de Nuevo Presupuesto" }],
      },
      {
        id: "modo-lote",
        title: "Modo Lote",
        body: [
          "Pensado para cuando un mismo cliente deja varios equipos juntos. Se cargan los datos del cliente una sola vez, y después se agrega un equipo por fila — cada fila es un acordeón que se puede expandir o colapsar sin perder lo ya cargado.",
          "Cada equipo tiene exactamente los mismos datos que se cargan en Nueva Orden: tipo/IMEI/marca/modelo, técnico asignado, problemas y observaciones, fotos, accesorios, checklist de recepción, presupuesto/seña/garantía, y PIN o patrón de desbloqueo. Las filas nuevas arrancan expandidas para cargar rápido; se pueden colapsar a mano una vez completadas para ver de un vistazo el progreso del lote.",
          "La firma del cliente y la aceptación de los términos se completan una sola vez para todo el lote, no por equipo — un cliente que deja varios equipos firma una sola vez por todos.",
          "Al confirmar, cada fila se convierte en una orden real e independiente, cada una con su propio número de orden, su propio link de seguimiento para el cliente y la misma firma/términos.",
        ],
        images: [{ file: "crear-ordenes-modo-lote-01.png", alt: "Modo Lote con varios equipos del mismo cliente" }],
      },
      {
        id: "convertir-presupuesto",
        title: "Convertir un Presupuesto en Orden",
        body: [
          "Cuando un cliente confirma un presupuesto y trae el equipo, se entra al detalle de ese presupuesto y se usa el botón para convertirlo en una orden real.",
          "Ahí se completan los datos que el Presupuesto no pedía: accesorios, checklist de recepción, seguridad (PIN/patrón), garantía, seña y firma del cliente — el presupuesto original queda como base y no hay que volver a cargar cliente, equipo ni problema.",
        ],
        images: [{ file: "crear-ordenes-convertir-01.png", alt: "Diálogo para convertir un presupuesto en orden" }],
      },
    ],
  },
  {
    id: "detalle-orden",
    label: "Detalle de una orden",
    icon: FileSearch,
    description:
      "Entrando a una orden desde el Dashboard vas a encontrar toda la información y las acciones posibles, organizadas en secciones.",
    topics: [
      {
        id: "encabezado",
        title: "Encabezado y datos del cliente",
        body: [
          "Arriba de todo está el número de orden, el nombre del cliente, sus teléfonos de contacto y, si se cargó, la cédula/RUC. También se ve quién recepcionó la orden y el estado actual.",
          "Desde acá se accede al link de seguimiento para copiarlo o compartirlo, al botón de Imprimir el recibo, y al menú de acciones de la orden.",
        ],
        images: [{ file: "detalle-orden-encabezado-01.png", alt: "Encabezado del detalle de una orden" }],
      },
      {
        id: "tecnico",
        title: "Técnico asignado y derivación",
        body: [
          "Se puede asignar o reasignar el técnico responsable de la orden en cualquier momento, eligiendo entre el personal de tu taller (admin y staff).",
          "Si tu taller tiene varias sucursales, también existe la opción \"Derivar a otra sucursal\" para pasar la orden a otro local sin perder su historial.",
        ],
        images: [{ file: "detalle-orden-tecnico-01.png", alt: "Sección de técnico asignado y derivación" }],
      },
      {
        id: "detalles-equipo",
        title: "Detalles del equipo",
        body: [
          "Muestra el tipo de equipo, IMEI/número de serie, y — si tu taller activó la clasificación en Configuración → Accesorios — la marca y el modelo.",
          "Si se cargó un PIN o patrón de desbloqueo al recibir el equipo, aparece acá. También se ve la firma del cliente si se tomó al momento de crear la orden.",
        ],
        images: [{ file: "detalle-orden-equipo-01.png", alt: "Detalles del equipo dentro de una orden" }],
      },
      {
        id: "repuestos",
        title: "Repuestos usados",
        badge: { label: "Requiere plan Pro o Business+" },
        body: [
          "Permite cargar los repuestos que se usaron en la reparación, tomándolos directamente del stock de Inventario. Al agregar un repuesto acá, el stock se descuenta automáticamente — no hace falta ajustarlo a mano en Inventario.",
        ],
        images: [{ file: "detalle-orden-repuestos-01.png", alt: "Sección de repuestos usados en la orden" }],
      },
      {
        id: "financiero",
        title: "Información financiera y documentos",
        badge: { label: "Edición: solo Admin" },
        body: [
          "Acá se ve y edita el presupuesto, la seña, el saldo pendiente y los cargos adicionales que se le sumen al trabajo sobre la marcha (por ejemplo, si aparece un problema extra durante la reparación). También se define la fecha estimada de entrega.",
          "En \"Documentos (PDF)\" se pueden adjuntar hasta 3 archivos de hasta 10 MB cada uno — útil para guardar una factura, una garantía del fabricante, o cualquier comprobante relacionado con el trabajo.",
        ],
        images: [{ file: "detalle-orden-financiero-01.png", alt: "Información financiera y documentos adjuntos" }],
      },
      {
        id: "fotos",
        title: "Fotos",
        badge: { label: "Límite: 5 en Starter/Retail, 20 en Pro/Business" },
        body: [
          "Galería con las fotos que se tomaron al recibir el equipo, más las que se van sumando como evidencia durante la reparación. Se pueden ver en grande tocando cualquier miniatura.",
        ],
        images: [{ file: "detalle-orden-fotos-01.png", alt: "Galería de fotos de la orden" }],
      },
      {
        id: "actualizar-estado",
        title: "Actualizar estado",
        body: [
          "Para cambiar el estado de una orden (por ejemplo, de \"En reparación\" a \"Listo para retirar\"), se elige el nuevo estado y se puede agregar una nota.",
          "Esa nota puede ser interna (solo la ve tu equipo) o visible para el cliente en su seguimiento — hay un interruptor para elegir cuál de las dos. Lo mismo aplica para las fotos que se adjunten en ese momento: quedan internas o se muestran en el link de seguimiento, según esa misma elección.",
          "Cada cambio de estado dispara automáticamente un mensaje de WhatsApp al cliente (si tu taller tiene WhatsApp conectado en Configuración), avisándole que su equipo avanzó de estado.",
        ],
        images: [{ file: "detalle-orden-estado-01.png", alt: "Formulario para actualizar el estado de la orden" }],
      },
      {
        id: "bitacora",
        title: "Bitácora técnica",
        badge: { label: "Visible en el link de seguimiento completo" },
        body: [
          "Espacio de notas para el técnico — pensado para dejar registro de diagnósticos, pasos seguidos o cualquier detalle técnico del proceso. Cada usuario puede borrar solo sus propias notas.",
          "A diferencia de la nota interna de \"Actualizar estado\", la bitácora técnica sí se muestra al cliente cuando accede por el link o QR de seguimiento completo (el que se genera hoy en adelante) — no aparece si el cliente entra con el código corto ORD-XXXX de una orden más antigua.",
        ],
        images: [{ file: "detalle-orden-bitacora-01.png", alt: "Bitácora técnica de la orden" }],
      },
      {
        id: "qr-seguimiento",
        title: "QR y seguimiento",
        body: [
          "Cada orden genera un código QR y un link único que podés compartir con el cliente (por WhatsApp, por ejemplo) para que siga el estado de su reparación sin necesidad de crear una cuenta.",
        ],
        images: [{ file: "detalle-orden-qr-01.png", alt: "Código QR de seguimiento de la orden" }],
      },
      {
        id: "historial",
        title: "Historial de estados",
        body: [
          "Línea de tiempo con todos los cambios de estado que tuvo la orden, con fecha, quién lo hizo, la nota que se dejó y las fotos asociadas a cada paso.",
        ],
        images: [{ file: "detalle-orden-historial-01.png", alt: "Historial de estados de la orden" }],
      },
      {
        id: "imprimir",
        title: "Imprimir recibo",
        body: [
          "Genera un recibo listo para imprimir o guardar como PDF, con los datos de la orden, el resumen financiero y los términos de servicio configurados en Configuración → Términos.",
        ],
      },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: Users,
    description: "Directorio con todos los clientes que pasaron por tu taller.",
    topics: [
      {
        id: "buscar",
        title: "Buscar un cliente",
        body: ["Se puede buscar por nombre, teléfono o cédula/RUC. La lista muestra cuántas órdenes tiene cada cliente."],
        images: [{ file: "clientes-buscar-01.png", alt: "Buscador de clientes" }],
      },
      {
        id: "historial",
        title: "Historial de órdenes de un cliente",
        body: ["Tocando un cliente se abre el detalle con todas sus órdenes anteriores, para tener contexto rápido si vuelve a traer un equipo."],
        images: [{ file: "clientes-historial-01.png", alt: "Historial de órdenes de un cliente" }],
      },
      {
        id: "editar",
        title: "Editar datos y contactar por WhatsApp",
        body: ["Desde el mismo detalle se pueden corregir nombre, teléfono o cédula/RUC, y hay un botón directo para abrirle un chat de WhatsApp."],
        images: [{ file: "clientes-editar-01.png", alt: "Edición de datos de un cliente" }],
      },
      {
        id: "alta",
        title: "¿Cómo se agregan clientes nuevos?",
        body: [
          "No hay un botón de \"Nuevo cliente\" en esta pantalla — los clientes se crean automáticamente la primera vez que se los carga desde Nueva Orden, Nuevo Presupuesto o Modo Lote. Si ya existe un cliente con esa cédula o teléfono, el sistema lo reconoce y no duplica el registro.",
        ],
      },
    ],
  },
  {
    id: "inventario",
    label: "Inventario",
    icon: Package,
    description: "Control de stock de los repuestos internos que usa tu taller para reparar.",
    note: "Disponible en los planes Pro y Business+.",
    topics: [
      {
        id: "stock",
        title: "Stock y estadísticas",
        body: [
          "La parte de arriba muestra el total de ítems cargados, cuántos están con bajo stock, y el valor total del inventario a costo.",
        ],
        images: [{ file: "inventario-stock-01.png", alt: "Estadísticas de stock en Inventario" }],
      },
      {
        id: "filtros",
        title: "Filtrar por categoría, subcategoría y sucursal",
        body: ["Los filtros ayudan a encontrar rápido un repuesto puntual cuando la lista crece, especialmente si manejás varias sucursales."],
        images: [{ file: "inventario-filtros-01.png", alt: "Filtros de categoría y sucursal en Inventario" }],
      },
      {
        id: "cargar",
        title: "Cargar un repuesto nuevo",
        body: ["Se carga nombre, categoría/subcategoría, sucursal, costo, precio y cantidad en stock. Solo los administradores pueden eliminar ítems."],
        images: [{ file: "inventario-cargar-01.png", alt: "Formulario para cargar un repuesto nuevo" }],
      },
      {
        id: "descuento-automatico",
        title: "Cómo se descuenta el stock automáticamente",
        body: [
          "El stock no se ajusta a mano acá: se descuenta solo cuando un técnico agrega ese repuesto a una orden, desde la sección \"Repuestos\" del detalle de la orden. Esto evita que el stock quede desactualizado.",
        ],
      },
    ],
  },
  {
    id: "productos",
    label: "Productos",
    icon: ShoppingBag,
    description: "Catálogo de venta al público, para talleres que también venden productos además de reparar.",
    note: "Disponible en los planes Business y Retail.",
    topics: [
      {
        id: "catalogo",
        title: "Catálogo de venta y estadísticas",
        body: ["Muestra el total de productos, cuáles están sin stock o con bajo stock, las ventas del día y el valor total del catálogo."],
        images: [{ file: "productos-catalogo-01.png", alt: "Catálogo de productos y estadísticas" }],
      },
      {
        id: "vender",
        title: "Vender con el carrito (POS)",
        body: ["Se van agregando productos al carrito con su cantidad, y al confirmar la venta se descuenta el stock automáticamente."],
        images: [{ file: "productos-vender-01.png", alt: "Carrito de venta (POS) en Productos" }],
      },
      {
        id: "ventas",
        title: "Ventas recientes y ticket imprimible",
        body: ["Cada venta queda registrada en un listado, con la opción de imprimir el ticket correspondiente."],
        images: [{ file: "productos-ventas-01.png", alt: "Listado de ventas recientes con ticket" }],
      },
    ],
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: BarChart3,
    description: "Panel financiero para saber cuánto está ganando el taller, en qué período y en qué categoría.",
    note: "Solo para Admin · Disponible en los planes Pro y Business.",
    topics: [
      {
        id: "rango",
        title: "Elegir el rango de fechas",
        body: ["Se puede elegir un rango predefinido (este mes, el mes pasado, etc.) o uno personalizado con fecha desde/hasta."],
        images: [{ file: "reportes-rango-01.png", alt: "Selector de rango de fechas en Reportes" }],
      },
      {
        id: "ganancia-neta",
        title: "Ingresos, costo y Ganancia Neta",
        body: [
          "Se separan las cifras de Taller (reparaciones) y Tienda (venta de productos, si tu taller la tiene activa), mostrando ingresos, costo de repuestos/mercadería y la ganancia neta resultante.",
          "El ingreso se reconoce cuando se cobra: la seña cuenta en la fecha que se cobró, y el saldo (junto con el costo de los repuestos de esa orden) cuenta en la fecha en que se termina de cobrar — así el reporte refleja la plata que efectivamente entró en ese período, no lo presupuestado.",
        ],
        images: [{ file: "reportes-ganancia-neta-01.png", alt: "Tarjetas de ingresos y ganancia neta" }],
      },
      {
        id: "grafico",
        title: "Gráfico por período",
        body: ["Un gráfico de barras muestra la evolución de ingresos agrupada por día, semana o mes, según el rango elegido."],
        images: [{ file: "reportes-grafico-01.png", alt: "Gráfico de ingresos por período" }],
      },
      {
        id: "categorias",
        title: "Ganancia por categoría, tipo de equipo, marca y modelo",
        badge: { label: "La parte de marca/modelo requiere activar \"Clasificación por marca/modelo\"" },
        body: [
          "Además del total general, hay tablas que separan la ganancia por categoría de producto (en Tienda) y, si tu taller activó la \"Clasificación por marca/modelo\" en Configuración → Accesorios, por tipo de equipo, por marca y por modelo (esta última limitada a los 8 modelos con más ingresos, para que sea un reporte legible y no una lista interminable).",
          "Esto sirve para saber, por ejemplo, si tu taller gana más reparando celulares Apple o notebooks, sin tener que revisar orden por orden.",
        ],
        images: [{ file: "reportes-categorias-01.png", alt: "Ganancia por categoría, tipo de equipo, marca y modelo" }],
      },
      {
        id: "sucursal-tecnico",
        title: "Por sucursal y por técnico",
        body: [
          "Si tu taller tiene varias sucursales, hay un desglose de ingresos por sucursal. También hay un desglose por técnico, que incluye el cálculo de comisión si la tenés activada para ese usuario en Configuración → Usuarios.",
        ],
        images: [{ file: "reportes-sucursal-tecnico-01.png", alt: "Desglose por sucursal y por técnico" }],
      },
    ],
  },
  {
    id: "configuracion",
    label: "Configuración",
    icon: SettingsIcon,
    description: "Todo lo que define cómo trabaja tu taller: datos del negocio, usuarios, listas configurables y más.",
    note: "Solo para Admin.",
    topics: [
      {
        id: "perfil",
        title: "Perfil",
        body: [
          "Tus datos personales (nombre, teléfono), la identidad del taller que ven tus clientes (nombre del negocio y logo — el que aparece en el link de seguimiento y en los mensajes de WhatsApp), la ubicación (país/departamento/ciudad), y qué notificaciones automáticas de WhatsApp mandar según cada cambio de estado.",
        ],
        images: [{ file: "configuracion-perfil-01.png", alt: "Tab de Perfil en Configuración" }],
      },
      {
        id: "whatsapp",
        title: "WhatsApp",
        body: [
          "Acá se conecta el número de WhatsApp del taller escaneando un código QR (usando WhatsApp Business en el celular). Una vez conectado, el sistema puede mandar avisos automáticos a tus clientes cuando cambia el estado de su orden.",
        ],
        images: [{ file: "configuracion-whatsapp-01.png", alt: "Conexión de WhatsApp por código QR" }],
      },
      {
        id: "sucursales",
        title: "Sucursales",
        badge: { label: "Starter: hasta 1 sucursal" },
        body: ["Alta y baja de las sucursales de tu taller, cada una con su nombre y dirección."],
        images: [{ file: "configuracion-sucursales-01.png", alt: "Listado de sucursales" }],
      },
      {
        id: "categorias",
        title: "Categorías",
        badge: { label: "No disponible en Starter" },
        body: ["Categorías y subcategorías compartidas entre Inventario y Productos, para organizar repuestos y mercadería."],
        images: [{ file: "configuracion-categorias-01.png", alt: "Categorías y subcategorías" }],
      },
      {
        id: "usuarios",
        title: "Usuarios",
        badge: { label: "Cantidad de usuarios limitada en Starter/Retail" },
        body: [
          "Alta de cuentas para tu equipo, con tres roles posibles: Admin (acceso completo), Staff (técnicos, sin acceso a Configuración ni Reportes) y Recepción (pensado para quien recibe equipos y atiende clientes).",
          "A cada usuario se le asigna una sucursal, y opcionalmente un porcentaje de comisión sobre lo que factura (no disponible en los planes Starter y Retail).",
        ],
        images: [{ file: "configuracion-usuarios-01.png", alt: "Alta de usuarios y roles" }],
      },
      {
        id: "garantias",
        title: "Garantías",
        body: ["Lista configurable de plazos de garantía (por ejemplo 30, 60, 90 días) para elegir rápido al crear o convertir una orden."],
        images: [{ file: "configuracion-garantias-01.png", alt: "Presets de garantía" }],
      },
      {
        id: "accesorios",
        title: "Accesorios",
        body: [
          "Esta pestaña agrupa cinco listas configurables que se usan al cargar una orden: tipo de equipo, marca, modelo, problemas frecuentes y checklist de recepción.",
          "Para cada una se puede armar la lista de opciones que van a aparecer como chips de selección rápida en los formularios, en vez de escribir todo a mano cada vez. La clasificación por marca/modelo tiene además un interruptor propio (\"Clasificación por marca/modelo\") que activa esos dos campos en los formularios y las tablas de ganancia por categoría en Reportes.",
        ],
        images: [{ file: "configuracion-accesorios-01.png", alt: "Listas configurables de tipo de equipo, marca, modelo, problemas y checklist" }],
      },
      {
        id: "estados",
        title: "Estados",
        body: [
          "Permite personalizar los nombres de los estados por los que pasa una orden (por ejemplo, cambiar \"En reparación\" por el texto que uses en tu taller), reordenarlos y definir cuáles quedan fijos.",
          "Cada estado tiene además su propio mensaje de WhatsApp editable: con el ícono de mensaje se abre un editor con placeholders (cliente, equipo, número de orden, estado y link de seguimiento) que se reemplazan automáticamente al enviar, más una vista previa en vivo. Si no se edita, se sigue usando el mensaje predeterminado de siempre.",
        ],
        images: [{ file: "configuracion-estados-01.png", alt: "Configuración de estados de orden" }],
      },
      {
        id: "terminos",
        title: "Términos",
        body: ["Texto legal/condiciones de servicio que se imprime en los recibos, con la garantía elegida ya reemplazada en el texto."],
        images: [{ file: "configuracion-terminos-01.png", alt: "Términos de servicio" }],
      },
      {
        id: "seguridad",
        title: "Seguridad",
        body: ["Cambiar tu propia contraseña de acceso."],
      },
      {
        id: "suscripcion",
        title: "Suscripción",
        body: ["Información sobre tu plan actual y su facturación."],
      },
    ],
  },
  {
    id: "seguimiento",
    label: "Seguimiento del cliente",
    icon: QrCode,
    description: "Lo que ve tu cliente final cuando le compartís el link o QR de una orden — no hace falta que tenga usuario ni contraseña.",
    topics: [
      {
        id: "vista-cliente",
        title: "Qué ve el cliente",
        body: [
          "El cliente ve el logo y nombre de tu taller, el estado actual de su equipo, la fecha estimada de entrega, el problema reportado, los accesorios que dejó y el checklist de recepción.",
          "También ve un resumen financiero (presupuesto, seña, saldo) sin poder editarlo, y el historial completo de cambios de estado con las fotos que se hayan marcado como visibles para el cliente.",
          "Si accedió por el link o QR de seguimiento completo (no el código corto ORD-XXXX), también ve la Bitácora técnica — tené esto en cuenta antes de escribir ahí algo que preferís que el cliente no lea.",
        ],
        images: [{ file: "seguimiento-vista-cliente-01.png", alt: "Vista del cliente en el link de seguimiento" }],
      },
      {
        id: "compartir",
        title: "Compartir el link o el QR",
        body: ["Desde el detalle de la orden se puede copiar el link directamente o mostrar el código QR para que el cliente lo escanee con su celular."],
        images: [{ file: "seguimiento-compartir-01.png", alt: "Compartir link y QR de seguimiento" }],
      },
      {
        id: "responder-presupuesto",
        title: "Aceptar, pedir cambios o rechazar un presupuesto",
        badge: { label: "Solo con el link seguro, no con el código corto" },
        body: [
          "Si la orden todavía es un presupuesto y el cliente accedió por el link seguro (el que se comparte por WhatsApp, no el código corto), puede responder directamente: aceptar, pedir cambios o rechazar. Esa respuesta se refleja al instante como una etiqueta en la tarjeta de la orden en tu Dashboard.",
        ],
        images: [{ file: "seguimiento-responder-presupuesto-01.png", alt: "Respuesta del cliente a un presupuesto" }],
      },
    ],
  },
];

export const videoPlaceholders: VideoPlaceholder[] = [
  { id: "primeros-pasos", title: "Primeros pasos: tu primera orden", description: "Un recorrido completo desde crear la orden hasta entregarla." },
  { id: "modo-lote", title: "Modo Lote: varios equipos a la vez", description: "Cómo cargar rápido cuando un cliente trae más de un equipo." },
  { id: "cobrar-cerrar", title: "Cobrar y cerrar una orden", description: "Seña, saldo y cómo queda reflejado en Reportes." },
  { id: "whatsapp", title: "Configurar WhatsApp y notificaciones", description: "Conectar tu número y automatizar los avisos a tus clientes." },
  { id: "inventario", title: "Inventario: descuento automático de repuestos", description: "Cómo se conecta el stock con las órdenes de reparación." },
  { id: "reportes", title: "Tu primer reporte de ganancias", description: "Leer los números de tu taller mes a mes." },
];
