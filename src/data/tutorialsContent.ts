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
  Wallet,
  Receipt,
  Cpu,
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
          "Las tres tarjetas resumen de arriba (\"Total\", \"En proceso\", \"Listas para retirar\") también funcionan como filtro: tocá una para ver solo esas órdenes, y tocala de nuevo para volver a \"Activas\".",
          "Debajo del buscador hay chips de estado (por ejemplo \"Recibido\", \"En reparación\", \"Listo\") que se arman automáticamente según los estados que tenga configurados tu taller en Configuración → Estados. También hay dos chips fijos: \"Activas\" (todo lo que no está entregado, enviado, retirado sin reparar, ni es un presupuesto) y \"Presupuestos\".",
          "Si tu taller tiene más de una sucursal, los administradores ven además un filtro para mirar una sucursal a la vez o todas juntas.",
          "Las órdenes abiertas se ordenan por prioridad: primero las de prioridad Alta, después las Normales y al final las de prioridad Baja (dentro de cada grupo, las más nuevas arriba). El chip \"Prioridad alta\" deja a la vista solo las urgentes.",
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
          "Cuando una orden tiene saldo pendiente de cobro, aparece un botón \"Cobrar Saldo\" directo en la tarjeta para no tener que entrar al detalle. Abre la misma ventana de registrar pago que hay en el detalle de la orden: monto, método de pago y, si hace falta, un descuento — sin salir del Dashboard.",
          "Las órdenes con prioridad Alta muestran una etiqueta roja \"Prioridad alta\" y las de prioridad Baja una gris; las Normales no llevan etiqueta para no llenar la pantalla. Las órdenes ya cerradas (entregadas, enviadas o retiradas sin reparar) no muestran prioridad.",
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
          "**Nueva Orden**: usala cuando el cliente te deja el equipo hoy mismo. Es el flujo completo, paso a paso y en pantalla completa: cliente, equipo, accesorios y checklist de recepción, seguridad (PIN o patrón), garantía y firma del cliente.",
          "**Nuevo Presupuesto**: usalo cuando todavía no tenés el equipo en mano — por ejemplo, alguien pregunta por teléfono o WhatsApp cuánto sale una reparación. Es liviano: solo cliente, equipo, problema y un monto estimado, sin fotos ni firma.",
          "**Modo Lote**: usalo cuando un mismo cliente te deja varios equipos a la vez (ej. toda la familia trae su celular el mismo día). Cargás el cliente una sola vez y cada equipo se convierte en una orden independiente, con su propio número y link de seguimiento. Para ganar velocidad, no pide accesorios, checklist, garantía, seña ni firma por equipo — eso se completa después desde el detalle de cada orden si hace falta.",
          "**Convertir Presupuesto en Orden**: se usa cuando un presupuesto que ya cargaste se confirma y el cliente efectivamente te trae el equipo. Se abre desde el detalle del presupuesto y ahí sí se completan accesorios, checklist, seguridad, garantía, seña y firma — los datos que el Presupuesto original no pedía.",
        ],
      },
      {
        id: "nueva-orden",
        title: "Nueva Orden",
        body: [
          "Nueva Orden se abre en pantalla completa y va por 5 pasos: Cliente, Equipo, Ingreso, Presupuesto y Revisión. Arriba ves en qué paso estás (los completos llevan un tilde) y abajo una barra fija con \"Volver\" y \"Continuar\", así en el celular el botón siempre queda a mano. \"Continuar\" se habilita cuando el paso tiene lo mínimo; si falta algo, un aviso encima del botón te dice qué.",
          "**Paso 1 · Cliente**: buscá un cliente que ya tengas (por nombre, teléfono o cédula/RUC) o cargá uno nuevo con nombre y teléfono. Si el cliente es nuevo aparece el switch \"Notificar por WhatsApp\" — permite dejarlo desactivado desde que se crea, sin ir después a Clientes a apagarlo. Si ya existe, no se muestra: se respeta la preferencia que ese cliente ya tiene guardada.",
          "**Paso 2 · Equipo**: el tipo de equipo (y marca/modelo si tu taller activó esa clasificación en Configuración), el IMEI o número de serie y los problemas que ves. Hace falta el equipo y al menos un problema.",
          "**Paso 3 · Ingreso** (opcional): fotos del estado del equipo, accesorios que el cliente deja (cargador, funda, etc.), checklist de recepción y el PIN o patrón de desbloqueo para que el técnico lo tenga a mano. Si no vas a cargar nada, el botón dice \"Omitir\" y seguís de largo.",
          "**Paso 4 · Presupuesto**: presupuesto y seña (con el método de pago de la seña), el saldo a cobrar al retirar se calcula solo, la fecha estimada de entrega (atajos de 3, 7 o 15 días), la garantía y el técnico asignado (por defecto queda quien crea la orden). La seña no puede superar al presupuesto. Acá también se define la \"Prioridad\" (Baja, Normal o Alta): marcá Alta cuando el cliente tiene apuro y esa orden sube al principio de la lista del Dashboard; se puede cambiar después desde el detalle.",
          "**Paso 5 · Revisión**: un resumen de todo lo cargado (cada bloque tiene un botón para volver a corregirlo), los términos del servicio, que el cliente tiene que aceptar, y su firma (opcional). \"Crear orden\" guarda todo.",
          "Al terminar aparece una pantalla de éxito con el número de orden y los accesos para imprimir el comprobante, avisar al cliente por WhatsApp, abrir la orden o empezar otra. Si salís a la mitad con la X, el avance queda guardado como borrador y lo retomás la próxima vez (los términos aceptados y la firma nunca se guardan: se piden de nuevo).",
        ],
        images: [
          { file: "crear-ordenes-nueva-orden-01.png", alt: "Nueva Orden - paso 1, datos del cliente" },
          { file: "crear-ordenes-nueva-orden-02.png", alt: "Nueva Orden - paso 4, presupuesto, seña y entrega" },
          { file: "crear-ordenes-nueva-orden-03.png", alt: "Nueva Orden - paso 5, términos y firma del cliente" },
        ],
      },
      {
        id: "presupuesto",
        title: "Nuevo Presupuesto",
        body: [
          "Formulario liviano para cuando todavía no tenés el equipo físicamente: cliente, tipo de equipo, el problema que describe el cliente, y un monto estimado.",
          "A propósito no pide fotos, seguridad ni firma — esos datos se completan recién si el presupuesto se confirma y se convierte en una orden real.",
          "El cliente puede ver y responder este presupuesto desde su link de seguimiento (aceptar, pedir cambios o rechazar), y esa respuesta se refleja como una etiqueta en la tarjeta de la orden en el Dashboard.",
          "Igual que en Nueva Orden, si el cliente es nuevo aparece el switch \"Notificar por WhatsApp\" para definir de una si va a recibir avisos automáticos o no.",
        ],
        images: [{ file: "crear-ordenes-presupuesto-01.png", alt: "Formulario de Nuevo Presupuesto" }],
      },
      {
        id: "modo-lote",
        title: "Modo Lote",
        body: [
          "Pensado para cuando un mismo cliente deja varios equipos juntos. Se cargan los datos del cliente una sola vez, y después se agrega un equipo por fila — cada fila es un acordeón que se puede expandir o colapsar sin perder lo ya cargado.",
          "Si el cliente es nuevo, junto a sus datos aparece el switch \"Notificar por WhatsApp\" — se define una sola vez para todo el lote, ya que es un solo cliente el que se está creando.",
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
          "Si el cliente NO acepta el presupuesto y se lleva el equipo sin repararlo, no hace falta convertirlo: desde el detalle del presupuesto se cambia el estado directamente a \"Retirado sin reparar\" (uno de los estados predeterminados, en Configuración → Estados) para dejarlo cerrado sin que quede colgado como saldo pendiente.",
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
          "En el encabezado también se cambia la prioridad de la orden (Baja, Normal o Alta) con un selector; el cambio se guarda al instante. Si la reparación se interrumpió, junto al estado aparece una etiqueta con el motivo.",
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
          "Si sos administrador, al final de esta sección ves un panel con la ganancia de esa orden: el precio que paga el cliente (presupuesto más cargos adicionales), el costo de los repuestos y lo que te queda, en Gs. y en porcentaje. El costo es el que tenía cada repuesto cuando lo agregaste a la orden, así que si después cambia el precio de compra, la ganancia de esta orden no se mueve. Tu equipo no ve este panel.",
        ],
        images: [{ file: "detalle-orden-repuestos-01.png", alt: "Sección de repuestos usados en la orden" }],
      },
      {
        id: "financiero",
        title: "Información financiera y documentos",
        badge: { label: "Edición: solo Admin" },
        body: [
          "Acá se ve y edita el presupuesto, la seña, el saldo pendiente y los cargos adicionales que se le sumen al trabajo sobre la marcha (por ejemplo, si aparece un problema extra durante la reparación). También se define la fecha estimada de entrega.",
          "Con saldo pendiente aparece el botón \"Registrar pago\": abre un monto ya cargado con el total que falta (por si el cliente paga todo de una vez) y un método de pago para elegir de la lista configurable. Si el cliente va completando de a poco, se cambia el monto por lo que efectivamente paga esa vez — el sistema descuenta eso del saldo y deja el resto pendiente para la próxima visita. Cada pago registrado queda anotado en el Historial de la orden, con fecha y método.",
          "Si el cliente paga con más de un método a la vez (por ejemplo, la mitad en efectivo y la otra mitad por transferencia), tocá \"Agregar otro método\" para sumar una línea de monto + método por cada uno — el sistema valida que la suma de todas las líneas no supere el saldo, y registra cada una por separado para que Reportes y Cierre de Caja reflejen bien de dónde vino cada parte del pago.",
          "Cuando una línea es en Efectivo, al lado aparece un campo para cargar con cuánto te paga el cliente y calcular el vuelto automáticamente — igual que en el carrito de Productos.",
          "Si el taller necesita hacer un descuento al cobrar (por ejemplo, por pago al contado o como cortesía), en la misma ventana hay un campo de descuento que se puede cargar en porcentaje o en Gs. fijos. El descuento se aplica sobre el saldo pendiente y reduce el presupuesto de la orden de forma permanente, para que el total final quede reflejado correctamente en Reportes.",
          "El \"Presupuesto inicial\" siempre conserva el monto con el que se presupuestó originalmente. Si después se cambia el precio (con el lápiz de esta tarjeta, desde Editar orden o con un descuento al cobrar), aparece una línea \"Ajuste de precio\" con la diferencia y el \"Total ajustado\" muestra el nuevo monto — así queda registro de cuánto se presupuestó y cuánto se terminó cobrando. Las órdenes que ya habían sido ajustadas antes de esta mejora no tienen el monto original guardado, así que se siguen viendo como antes.",
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
          "Si el cliente se lleva el equipo sin que se repare, elegí el estado \"Retirado sin reparar\": el sistema te pide el motivo de la interrupción (placa dañada, sin repuesto disponible, el cliente desistió, sin viabilidad técnica u otro motivo). Ese motivo es interno — queda en el Historial de la orden y en Reportes, pero el cliente no lo ve en su seguimiento. Si después se cambia a otro estado, el motivo se borra.",
          "Al guardar el cambio, si ese estado está marcado para avisar (Configuración → WhatsApp), F7 te muestra el aviso listo para mandarle al cliente: tocás \"Abrir WhatsApp\" y sale desde tu propio WhatsApp. Si en ese momento no querés avisar, tocás \"No avisar\".",
        ],
        images: [{ file: "detalle-orden-estado-01.png", alt: "Formulario para actualizar el estado de la orden" }],
      },
      {
        id: "avisar-cliente",
        title: "Avisar al cliente por WhatsApp",
        body: [
          "F7 no manda los mensajes por su cuenta: te los deja escritos y los mandás vos con un toque, desde tu propio WhatsApp (o WhatsApp Web en la compu). Así no hay riesgo de que WhatsApp bloquee tu número.",
          "El aviso aparece solo al crear una orden o presupuesto y al cambiar de estado, según lo que hayas dejado prendido en Configuración → WhatsApp. El diálogo muestra el teléfono del cliente y el mensaje, que podés retocar antes de abrir WhatsApp; \"Copiar\" lo copia por si preferís pegarlo en otro lado.",
          "En cualquier momento podés avisar a mano con el botón \"WhatsApp\" del detalle de la orden: elegís qué mensaje mandar (estado actual, seguimiento, presupuesto...). También se puede mandar el comprobante de una venta de mostrador desde Productos, y avisarle a un técnico que tiene una orden nueva con el botón \"Avisar\" junto a su nombre.",
          "Los avisos que dejaste para después quedan en el menú Avisos (con un número en rojo cuando hay pendientes), junto con las respuestas que dejan los clientes a un presupuesto. Si un cliente tiene apagado \"Notificar por WhatsApp\", o su teléfono es un relleno como \"000\", F7 no te sugiere avisarle.",
          "Además, si tenés el plan Pro o superior y lo activás en Configuración → WhatsApp → Post-venta, el menú Avisos suma la lista \"Para contactar hoy\": pedir una reseña a los 3 días de entregar una reparación, avisar que la garantía está por vencer y saludar en el cumpleaños del cliente. Se arma sola, pero cada mensaje lo mandás vos con un toque. Una vez que le escribiste (o lo descartaste) a un cliente, deja de aparecer.",
        ],
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
        body: [
          "Desde el mismo detalle se pueden corregir nombre, teléfono o cédula/RUC, y hay un botón directo para abrirle un chat de WhatsApp.",
          "También hay un switch \"Notificar por WhatsApp\": si lo apagás, F7 deja de sugerirte avisarle a ese cliente (orden creada, cambios de estado, respuesta a un presupuesto) — útil para clientes mayoristas u otros contactos que no quieran ese tipo de mensajes. Igual podés escribirle a mano cuando quieras. Por defecto está prendido para todos.",
          "Y el campo \"Cumpleaños\" (opcional): si cargás la fecha y tenés prendido el saludo de cumpleaños en Configuración → WhatsApp → Post-venta, F7 te lo recuerda ese día en Avisos para que le mandes el saludo con un toque.",
        ],
        images: [{ file: "clientes-editar-01.png", alt: "Edición de datos de un cliente" }],
      },
      {
        id: "alta",
        title: "¿Cómo se agregan clientes nuevos?",
        body: [
          "No hay un botón de \"Nuevo cliente\" en esta pantalla — los clientes se crean automáticamente la primera vez que se los carga desde Nueva Orden, Nuevo Presupuesto o Modo Lote. Si ya existe un cliente con esa cédula o teléfono, el sistema lo reconoce y no duplica el registro.",
          "Esos mismos formularios incluyen el switch \"Notificar por WhatsApp\" cuando el cliente es nuevo, así que no hace falta venir después a Clientes solo para desactivar los avisos automáticos de alguien que ya sabés que no los quiere.",
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
        body: [
          "Se carga nombre, categoría/subcategoría, sucursal, costo, precio y cantidad en stock. Solo los administradores pueden eliminar ítems.",
          "Para restockear un repuesto que se agotó (o corregir cualquier dato), usá el lápiz de \"Editar\" en su fila — no hace falta eliminarlo y cargarlo de nuevo.",
        ],
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
        body: [
          "Muestra el total de productos, cuáles están sin stock o con bajo stock, las ventas del día y el valor total del catálogo.",
          "El catálogo (pestaña \"Catálogo\") se agrupa solo por categoría en secciones desplegables — cada una se puede colapsar para no tener que scrollear entre categorías que no estás usando en el momento. Al buscar un producto por nombre, se muestra directo el resultado sin agrupar.",
          "Tocando la tarjeta de un producto (en cualquier parte que no sea un botón puntual) se abre una previsualización grande: foto ampliada, nombre, precio, stock y categoría, con accesos directos para agregar al carrito, editar o eliminar sin volver al catálogo.",
          "Para restockear un producto que se agotó (o corregir nombre, precio, imagen, etc.), usá el lápiz de \"Editar\" en su tarjeta o desde la previsualización — no hace falta eliminarlo y cargarlo de nuevo.",
        ],
        images: [{ file: "productos-catalogo-01.png", alt: "Catálogo de productos y estadísticas" }],
      },
      {
        id: "equipos",
        title: "Vender celulares (equipos con IMEI)",
        body: [
          "Al crear un producto, activá el switch \"Es un equipo (celular)\" para cargar un celular usado o reacondicionado como unidad única: el stock arranca en 1 y aparecen los campos IMEI, \"Costo de compra\", \"Repuestos\" (cuánto gastaste en repararlo), \"Qué repuestos le pusiste\", el precio de venta y una caja de notas para cualquier anotación (accesorios incluidos, estado, garantía, etc.).",
          "Mientras cargás los montos, el sistema suma compra + repuestos como costo total y te muestra la \"Ganancia estimada\" (precio de venta menos costo total), en verde si ganás y en rojo si el precio no cubre el costo.",
          "El IMEI se puede buscar desde el buscador del catálogo, y el equipo se distingue por la etiqueta \"Equipo\" en su tarjeta. El detalle (IMEI, repuestos y notas) se ve tocando la tarjeta. Si cargás un IMEI que ya existe en otro producto, el sistema te avisa pero te deja guardar (por si recompraste un equipo que habías vendido).",
          "Se vende igual que cualquier producto, desde el carrito. El costo total queda registrado en la venta, así Reportes calcula la ganancia real del equipo (incluyendo lo que gastaste en repuestos) sin pasos extra.",
        ],
      },
      {
        id: "comprar-equipos",
        title: "Comprar un equipo a un cliente",
        body: [
          "Con el botón \"Comprar a cliente\" (arriba, al lado de \"Nuevo Producto\") registrás la compra de un celular usado: cargás el equipo con su IMEI, los datos de quien te lo vende (nombre y cédula), el estado del equipo, los accesorios que entrega, el motivo de la venta, cuánto le pagás y con qué medio.",
          "El estado se marca con el mismo checklist que usás al recibir una reparación, pero acá cada ítem se marca como \"OK\" o \"Defecto\". Lo que no marques queda como no revisado, no como funcionando. Los ítems y accesorios disponibles se configuran en Configuración.",
          "Al registrar, el equipo aparece solo en el catálogo con el precio que pagaste como costo de compra (y el precio de venta si lo cargaste), y se genera un comprobante numerado (CMP-0001, CMP-0002...) para imprimir en dos copias: una para el vendedor y otra para la tienda, con espacio para las firmas. Si el IMEI tiene solo números y no cierra (no son 15 dígitos o falla la verificación), el sistema avisa que puede haber un error de tipeo, pero te deja seguir.",
          "Si el IMEI ya está en stock, el sistema no deja registrar la compra. Si ese IMEI ya pasó antes por tu tienda y se vendió, te avisa pero te deja continuar.",
          "La plata que le pagás sale de la caja de hoy: en Caja → Cierre aparece como \"Compras de equipos a clientes\" y baja el efectivo esperado (o el saldo virtual, si pagaste por transferencia). No es un gasto del mes: el costo del equipo se descuenta recién cuando lo vendés, así la ganancia de cada celular sale bien en Reportes. Si la caja de hoy no está abierta y tu empresa exige abrirla, primero abrila desde Caja.",
          "La pestaña \"Compras de equipos\" lista las compras registradas con un botón para reimprimir el comprobante. Una compra registrada no se puede editar ni borrar, porque es el respaldo del pago y del comprobante firmado. Revisá bien los datos antes de confirmar.",
        ],
      },
      {
        id: "bateria-origen",
        title: "Batería % y origen de cada equipo",
        body: [
          "Cada celular puede llevar la salud de su batería en porcentaje (en iPhone: Ajustes → Batería → Estado de la batería) y su origen: Proveedor, Comprado a cliente, Canje, Stock propio o Consignado. Los dos datos son opcionales. Se cargan en \"Nuevo Producto\" cuando activás \"Es un equipo\", y se pueden corregir después desde \"Editar\" (por ejemplo, si le cambiás la batería).",
          "En \"Comprar a cliente\" y en el canje hay un campo \"Batería %\": el valor queda en el equipo, en el comprobante impreso (como lo declaró quien lo entregó) y el origen se completa solo (\"Comprado a cliente\" o \"Canje\"). Los equipos que ya habías comprado o recibido en canje antes de esta función también quedaron con su origen.",
          "La batería se ve en la tarjeta del equipo (naranja si está por debajo de 80%, que es cuando conviene cambiarla) y, junto con el origen, al tocar la tarjeta. Si la batería está en 0% se muestra igual: 0% es un dato, vacío significa que no se midió. Además aparece en la lista de precios para WhatsApp, por ejemplo \"iPhone 13 128GB · Batería 89%\". El origen nunca va en esa lista.",
        ],
      },
      {
        id: "precio-minimo",
        title: "Mínimo de negociación de cada equipo",
        body: [
          "En \"Nuevo Producto\" (o en \"Editar\"), cuando el producto es un equipo, el campo \"Mínimo de negociación\" guarda hasta cuánto estás dispuesto a bajar el precio de ese celular. Es opcional: vacío (o 0) significa que no definiste un mínimo. No puede ser mayor que el precio de venta, y debajo del formulario ves cuánta ganancia te queda si lo vendés justo en el mínimo (en rojo si quedás por debajo del costo).",
          "El mínimo es un dato interno. No aparece en la tarjeta del equipo, ni en la lista de precios para WhatsApp, ni en el ticket, ni en los comprobantes. Al tocar la tarjeta se ve tapado (\"Gs. ••••••\") y solo se muestra cuando tocás el ojito, y se vuelve a tapar al cerrar el detalle o cambiar de equipo, así podés mostrarle el equipo al cliente sin que lo vea.",
          "Al confirmar una venta, si algún equipo se vende por debajo de su mínimo (contando el descuento del carrito), el sistema te pregunta antes de registrar: \"¿Querés vender igual?\". El aviso nombra el equipo pero no dice el monto del mínimo. Es un aviso, no un bloqueo: la decisión final es de quien vende. Ojo: quienes pueden editar productos también pueden ver y cambiar el mínimo, igual que el costo.",
        ],
      },
      {
        id: "equipos-detenidos",
        title: "Equipos detenidos y días en stock",
        body: [
          "Cada celular que tenés en stock muestra en su tarjeta hace cuántos días entró al catálogo (\"Ingresó hoy\", \"12 días en stock\"). Pasados los 30 días la etiqueta se pinta de naranja: es un equipo que se está quedando sin moverse.",
          "Cuando tenés al menos un equipo en stock, arriba aparece la tarjeta \"Equipos detenidos 30+ días\" con la cantidad y el costo inmovilizado: cuánta plata tenés parada en esos celulares, calculada con lo que te costaron. Tocá la tarjeta para ver solo esos equipos y volvé a tocarla (o a la etiqueta \"Filtrando\") para ver todo de nuevo.",
          "Los días se cuentan desde que el equipo entró al catálogo, sea por \"Comprar a cliente\", por canje o cargado a mano. Los productos que no son equipos (fundas, vidrios, cargadores) y los equipos ya vendidos no cuentan. Si tu usuario no tiene permiso para ver el stock, estos datos tampoco se muestran.",
        ],
      },
      {
        id: "vender",
        title: "Vender con el carrito (POS)",
        body: [
          "Se van agregando productos al carrito con su cantidad, y al confirmar la venta se descuenta el stock automáticamente.",
          "Si querés aplicarle un descuento a la venta (por porcentaje o por un monto fijo en Gs.), se carga en el campo \"Descuento\" del carrito antes de confirmar — se reparte proporcionalmente entre los productos, así queda reflejado en el precio de venta real y en Reportes.",
          "Cuando el medio de pago es Efectivo, aparece un campo \"¿Con cuánto te paga?\": cargás el billete que te dio el cliente y el sistema calcula el vuelto automáticamente, tipo caja registradora de supermercado. Si el monto no alcanza, avisa \"Falta\" en vez de \"Vuelto\". Es solo una ayuda para el cálculo — no cambia el monto de la venta que queda registrado.",
        ],
        images: [{ file: "productos-vender-01.png", alt: "Carrito de venta (POS) en Productos" }],
      },
      {
        id: "canje",
        title: "Recibir un equipo como parte de pago (canje)",
        body: [
          "Si el cliente te entrega su celular usado como parte de pago de lo que compra, en el carrito tocá \"Recibir un equipo como parte de pago\". Cargás el equipo igual que en \"Comprar a cliente\" (IMEI, nombre y cédula de quien lo entrega, estado, accesorios) y el valor que le reconocés. Ese valor no puede superar el total de la venta.",
          "El carrito te muestra el total, el equipo recibido restando y el monto \"A cobrar\". El \"¿Con cuánto te paga?\" y el vuelto se calculan sobre ese monto. El equipo no se guarda hasta que confirmás la venta: se registra todo junto, o no se registra nada.",
          "Al confirmar, la venta queda por su precio completo (así Reportes calcula bien la ganancia del producto que vendiste) y el equipo recibido entra solo al catálogo, con el valor del canje como costo de compra, listo para revenderlo. Se genera un comprobante numerado (CMP-...) que podés imprimir desde la misma pantalla de la venta o desde la pestaña \"Compras de equipos\", donde figura con la etiqueta \"Canje\".",
          "En Caja solo cuenta la plata que cobraste de verdad (el total menos el valor del canje): el equipo recibido no mueve el efectivo esperado. En Reportes, \"Ingresos por medio de pago\" muestra el valor del canje en una línea aparte, \"Canje (equipo recibido)\".",
          "El ticket y el comprobante por WhatsApp de esa venta muestran el equipo recibido y lo que se pagó. Por ahora se puede recibir un solo equipo por venta, y un canje registrado no se puede editar ni borrar, porque es el respaldo del comprobante firmado.",
        ],
      },
      {
        id: "garantias-equipos",
        title: "Garantía de los equipos vendidos y consulta por IMEI",
        body: [
          "Cuando en el carrito hay un celular (un producto marcado como equipo), aparece el bloque \"Garantía del equipo\": elegís los días de garantía (arranca en 30; podés poner 0 para vender sin garantía u otra cantidad) y, si querés, el nombre y el WhatsApp del comprador. Los dos datos del comprador son opcionales. La garantía vale para todos los equipos de esa venta; los productos que no son equipos (fundas, vidrios) no llevan garantía.",
          "El ticket impreso y el comprobante por WhatsApp muestran el IMEI, los días de garantía y hasta qué fecha vale. Si cargaste el WhatsApp del comprador, al enviar el comprobante el número ya viene completo.",
          "La pestaña \"Garantías\" (en Productos) junta en una sola lista los equipos que vendiste y las reparaciones entregadas con garantía. Escribí el IMEI (completo o los últimos dígitos), el nombre o el teléfono del cliente, o el modelo, y ves enseguida si ese equipo está vigente, por vencer (últimos 3 días), vencido o vendido sin garantía. Los botones de arriba filtran por estado.",
          "Las ventas de equipos anteriores a esta función aparecen con su IMEI pero como \"Sin garantía registrada\": el sistema no sabe qué garantía se les dio, así que no la inventa. La lista muestra las últimas 1000 garantías de cada tipo. La garantía queda guardada con la venta y no se puede modificar después.",
        ],
      },
      {
        id: "lista-whatsapp",
        title: "Copiar la lista de precios para WhatsApp",
        body: [
          "En la pestaña \"Catálogo\", el botón \"Copiar lista para WhatsApp\" arma un texto con tus productos y sus precios de venta, listo para pegar en un chat, un grupo o un estado. Los productos van agrupados por categoría y ordenados por nombre, con el nombre del negocio y la fecha arriba.",
          "La lista respeta lo que estás viendo: si buscaste algo, filtraste por sucursal o tocaste la tarjeta \"Equipos detenidos 30+ días\" para armar una lista de ofertas, se copia solo eso. Para copiar todo el catálogo, dejá el buscador vacío y las sucursales en \"Todas\".",
          "Quedan afuera los productos agotados y los que tienen precio de venta Gs. 0; al copiar, el aviso te cuenta cuántos fueron para que puedas corregirlos. A los equipos que tienen batería cargada se les suma el dato (ej: \"iPhone 13 128GB · Batería 89%\"). La lista nunca incluye costos, IMEI, origen del equipo, el mínimo de negociación ni cuántas unidades tenés en stock. Una vez pegada en WhatsApp podés editar el texto como cualquier mensaje.",
        ],
      },
      {
        id: "vitrina-online",
        title: "Vitrina online: tu catálogo en un enlace",
        badge: { label: "Solo plan Business · la configura un administrador" },
        body: [
          "La pestaña \"Vitrina\" (en Productos, visible solo para administradores del plan Business) arma una página pública con tus productos y equipos, que cualquier persona puede abrir desde el celular sin instalar nada ni crear una cuenta. El enlace tiene la forma /v/tu-taller: lo elegís vos, y el botón \"Copiar enlace\" lo deja listo para pegar en WhatsApp, Instagram o Google.",
          "Para crearla, completá el enlace, una frase de portada, tu WhatsApp, la dirección y el color de tu marca, y activá \"Vitrina activa\". A la derecha ves una vista previa en vivo de cómo queda. Si pausás la vitrina, el enlace deja de mostrar productos pero no se pierde: al reactivarla vuelve igual.",
          "Nada se publica solo: cada producto o equipo tiene su switch \"Publicar en la vitrina online\" (en la lista de la propia pestaña o al crear/editar el producto), apagado por defecto. También podés usar \"Publicar todo lo disponible\" para subir de una vez todo lo que se puede ver, y \"Sacar todo\" para apagar todo de golpe. Al crear o editar un producto, la \"Descripción para el cliente\" es un texto opcional que se muestra en la página del artículo.",
          "Aunque esté publicado, un artículo no se muestra si no tiene stock, si está reservado para un cliente o si no tiene precio (cuando la vitrina muestra precios). En la lista aparece con la etiqueta naranja \"No se ve\" y el motivo, y vuelve a mostrarse solo cuando se resuelve. \"Mostrar precios\" y \"Mostrar unidades disponibles\" son opcionales; sin precios, el cliente ve \"Consultar precio\".",
          "Debajo de los ajustes básicos hay un bloque desplegable con cuatro secciones para personalizarla: \"Portada y textos\" (imagen de portada horizontal, el texto del buscador y un texto al pie con tus horarios o formas de pago), \"Sellos bajo la portada\" (frases cortas con ícono que aparecen en una franja, hasta 6), \"Página del producto\" (sellos que se muestran en la ficha de cada artículo, hasta 4, y la lista \"Qué incluye\", hasta 8 puntos) y \"Redes sociales\" (Instagram, Facebook, TikTok, YouTube y tu sitio web). Todo es opcional y empieza vacío: los sellos y \"Qué incluye\" los escribís vos con lo que realmente ofrecés, el sistema no inventa garantías ni envíos. Lo que cargás en \"Qué incluye\" se muestra igual en todos los artículos. En las redes podés pegar el enlace o solo el @usuario. La vista previa se actualiza mientras escribís, y los cambios se aplican al tocar \"Guardar cambios\".",
          "Cada artículo puede tener hasta 5 fotos adicionales: al crear o editar el producto, en \"Fotos adicionales para la vitrina\" (junto a \"Publicar en la vitrina online\") tocá \"Agregar fotos\". La foto principal sigue siendo la imagen del producto; las demás aparecen en la ficha como una galería con flechas y miniaturas. Si sacás una foto de la galería, deja de mostrarse en la vitrina.",
          "El cliente puede buscar, filtrar por categoría y por rango de precio, ordenar, y abrir cada artículo. En cada artículo, el botón \"Contactar por WhatsApp\" abre una conversación con el número que cargaste en \"WhatsApp para consultas\" y un mensaje ya escrito (\"Hola tu-negocio! Me interesa este producto: ...\" con el nombre, el precio y el enlace del artículo), así el cliente solo tiene que enviarlo. Si no cargaste ese número, el botón no aparece y la pestaña te lo avisa en naranja con un acceso directo a \"Cargar mi WhatsApp\". Al lado del botón, el ícono de compartir copia el enlace del artículo o abre el menú de compartir del celular. Cuando pegás el enlace de tu vitrina o de un artículo en WhatsApp, Instagram o Facebook, se arma una tarjeta con tu portada (o la foto del artículo), el nombre, el precio y la descripción.",
          "La vitrina nunca muestra costos, mínimo de negociación, IMEI, origen ni datos de tus clientes. Si el plan baja de Business, el enlace deja de mostrar productos.",
        ],
      },
      {
        id: "ventas",
        title: "Ventas recientes y ticket imprimible",
        body: [
          "La pestaña \"Ventas recientes\" (al lado de \"Catálogo\") muestra cada venta con la opción de imprimir el ticket correspondiente — queda a un clic, sin importar cuántos productos tenga cargado el catálogo.",
          "El ancho del ticket (58mm u 80mm, según la impresora) se configura una sola vez en Configuración → Perfil → Impresión de tickets. Si no coincide con el rollo real de la impresora, el ticket sale achicado e ilegible.",
        ],
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
        id: "como-se-calcula",
        title: "Cómo se calcula cada número",
        body: [
          "Arriba de las tarjetas hay una línea que resume la base de los números: lo cobrado cuenta por fecha de cobro, la tienda por fecha de venta, los costos son los que tenía cada repuesto o producto al usarse o venderse, y no se incluyen los gastos del negocio.",
          "Al lado del nombre de cada tarjeta hay un ícono de ayuda (?). Tocalo y se abre una explicación corta de qué suma y qué no suma ese número. La Ganancia Neta Total, por ejemplo, no descuenta lo cargado en Gastos (alquiler, sueldos, etc.): es la ganancia sobre repuestos y productos.",
        ],
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
          "La columna \"Reparados\" cuenta cuántos equipos de cada tipo/marca/modelo se entregaron efectivamente dentro del rango de fechas elegido — es la cantidad de reparaciones completadas, no cuántas órdenes tocan esa categoría en total (una orden todavía en el taller no suma acá hasta que se entrega).",
          "\"Ventas por categoría\" además se puede desplegar: hacé clic en una categoría (por ejemplo \"Cargadores\") para ver qué producto puntual del catálogo se vendió adentro, no solo el total de la categoría.",
        ],
        images: [{ file: "reportes-categorias-01.png", alt: "Ganancia por categoría, tipo de equipo, marca y modelo" }],
      },
      {
        id: "interrumpidas",
        title: "Reparaciones interrumpidas",
        body: [
          "Si en el rango elegido hubo equipos que se retiraron sin reparar, aparece la tarjeta \"Reparaciones interrumpidas\": cuántos fueron, qué porcentaje de los equipos cerrados en el período representan (entregados + retirados sin reparar) y el desglose por motivo — placa dañada, sin repuesto, el cliente desistió, sin viabilidad técnica u otro.",
          "Sirve para ver de dónde se te escapa el trabajo: por ejemplo, si \"Sin repuesto disponible\" se repite mucho, quizás conviene tener más stock de ese repuesto. Las órdenes que se retiraron sin reparar antes de que existiera el motivo se cuentan aparte como \"Sin motivo registrado\".",
        ],
      },
      {
        id: "para-decidir-mejor",
        title: "Para decidir mejor: taller e inventario",
        body: [
          "Al final de Reportes hay una sección \"Para decidir mejor\" con análisis que salen de lo que ya cargás en el sistema, sin trabajo extra. Cada tarjeta tiene su ícono de ayuda (?) con la explicación de cómo se calcula.",
          "Taller (usa el período elegido arriba): \"Entregas a tiempo\" compara el día en que se entregó cada equipo contra la fecha de entrega que le prometiste al cliente — las órdenes sin fecha prometida no entran en el porcentaje. \"Servicios más pedidos\" lista los problemas que más se cargaron y el ticket promedio de esas órdenes. \"Tiempo en cada etapa\" muestra cuánto se queda una orden, en promedio, en cada estado, para ver dónde se demora el taller.",
          "\"Clientes que no volvieron\" lista a quienes ya tuvieron una orden, no tienen ninguna abierta y su última visita fue hace más de 90 días, de los que se fueron hace menos tiempo a los que se fueron hace más. Con el botón WhatsApp se abre un mensaje corto que podés editar antes de enviar. No depende del período elegido.",
          "Inventario: \"Dinero parado\" suma lo que tenés inmovilizado en artículos con stock que no se usaron ni se vendieron en 30, 60, 90 o 180 días (stock por costo). \"Lista de reposición\" junta los artículos que llegaron a su stock mínimo, los agotados primero, y el botón \"Copiar lista\" la deja lista para pegar en un mensaje al proveedor. \"Hoja de conteo\" abre una hoja imprimible con el stock que dice el sistema y columnas en blanco para anotar lo que contás en el estante; si tenés varias sucursales podés elegir de cuál imprimirla.",
        ],
      },
      {
        id: "numeros-del-negocio",
        title: "Números del negocio: punto de equilibrio, productos y clientes",
        body: [
          "Después de \"Para decidir mejor\" hay otra sección, \"Números del negocio\", con cuatro tarjetas que también salen de lo que ya cargaste. Cada una tiene su ícono de ayuda (?).",
          "Punto de equilibrio: te dice cuánto tenés que cobrar en el mes para que la ganancia cubra tus costos fijos. Los costos fijos son tus gastos recurrentes activos (alquiler, sueldos, internet…; los semanales se pasan a un mes típico), que cargás en Gastos → Recurrentes. Muestra cuánto llevás ganado este mes, qué porcentaje de los costos fijos ya cubriste, cuánto te falta y, al ritmo de hoy, cómo cerrarías el mes. El estado es Saludable (ya cubriste los costos o, al ritmo de hoy, los vas a cubrir), Atención (al ritmo de hoy cubrirías al menos el 70 %) o Crítico (menos del 70 %); antes del día 7 del mes dice \"Muy pronto para decir\" porque todavía hay pocos días para proyectar. Si no tenés gastos recurrentes cargados, la tarjeta te lleva directo a cargarlos. No depende del período elegido arriba, y los gastos sueltos que no son recurrentes no entran.",
          "Curva ABC de productos (solo si tenés Tienda): ordena lo vendido en el período elegido de más a menos facturado. A son los pocos productos que juntan el 80 % de lo vendido — nunca deberían faltar —; B son los que siguen hasta el 95 %; C es la cola larga que aporta poco. Cada fila muestra unidades, porcentaje del total y la ganancia de ese producto.",
          "Clientes por grupo (solo si tenés Taller): agrupa a tus clientes según cuántas veces vinieron y hace cuánto no vuelven. Campeones (3 o más visitas y volvieron en los últimos 90 días), Leales (2 visitas, la última en los últimos 90 días), Nuevos (una visita reciente o una orden abierta), En riesgo (entre 91 y 180 días sin volver) y Dormidos (más de 180 días). Tocá un grupo para ver sus cinco mejores clientes. Los presupuestos no cuentan como visita, y mira toda la historia, no el período elegido.",
          "Valor de cada cliente (LTV): lo que dejó en promedio cada cliente que ya pagó al menos una orden, el porcentaje que volvió y quiénes concentran más. Es lo facturado, sin descontar costos de repuestos, así que sirve para saber cuánto vale conseguir y cuidar a un cliente, no como ganancia.",
        ],
      },
      {
        id: "medio-de-pago",
        title: "Ingresos por medio de pago",
        body: [
          "Suma cuánto entró por Efectivo, Transferencia y cualquier otro medio que hayas configurado, combinando Taller y Tienda — usando la fecha real en que se cobró cada pago, no la fecha de la orden.",
        ],
        images: [{ file: "reportes-medio-pago-01.png", alt: "Ingresos por medio de pago" }],
      },
      {
        id: "sucursal-tecnico",
        title: "Por sucursal y por técnico",
        body: [
          "Si tu taller tiene varias sucursales, hay un desglose de ingresos por sucursal. También hay un desglose por técnico, que incluye el cálculo de comisión si la tenés activada para ese usuario en Configuración → Usuarios.",
        ],
        images: [{ file: "reportes-sucursal-tecnico-01.png", alt: "Desglose por sucursal y por técnico" }],
      },
      {
        id: "liquidar-comisiones",
        title: "Liquidar comisiones",
        badge: { label: "Solo Admin" },
        body: [
          "Cuando le pagás la comisión a un técnico o vendedor, podés dejarlo registrado para saber qué período ya cobró. En \"Por vendedor / técnico\", elegí arriba un período que termine ayer o antes (por ejemplo \"Semana pasada\" o \"Mes pasado\") y tocá \"Liquidar\" en la fila de la persona. \"Todo el tiempo\" y \"Hoy\" no se pueden liquidar.",
          "Se abre una ventana con lo atribuido a esa persona en esas fechas, su porcentaje y el monto a pagar. Podés agregar una nota (por ejemplo \"pagado en efectivo el viernes\") y confirmar con \"Registrar liquidación\". Ese cálculo se hace de nuevo al abrir la ventana, así que siempre coincide con lo que realmente se cobró.",
          "Solo se liquidan días ya cerrados: si el período incluye hoy, se liquida hasta ayer y lo de hoy queda para la próxima. Si parte del período ya estaba liquidado, esos días se saltean y no se pagan dos veces. Cuando todo el período ya está liquidado, la fila muestra \"Liquidada\".",
          "Esto deja constancia del pago de la comisión: no mueve la caja ni crea un gasto, así que si querés que figure como salida de dinero, cargalo aparte en Gastos.",
          "Una liquidación no se edita ni se borra. Si te equivocaste, abrí \"Liquidaciones\" (debajo de la tabla), tocá \"Anular\" y confirmá: queda en el historial como anulada y esos días vuelven a estar disponibles para liquidar de nuevo.",
        ],
      },
    ],
  },
  {
    id: "cierre-caja",
    label: "Caja",
    icon: Wallet,
    description: "Apertura del día y, para administradores, el cierre y la reconciliación de efectivo.",
    note: "Apertura: cualquier miembro del equipo · Cierre: Admin, o Staff/Recepción si el admin lo habilita en Configuración → Usuarios · Disponible en los planes Pro y Business.",
    topics: [
      {
        id: "apertura",
        title: "Apertura de caja",
        body: [
          "Al iniciar el día, cualquier miembro del equipo (staff o admin) puede abrir la caja: cuenta el efectivo con el que arranca (el fondo para dar vuelto) y lo carga acá, con una nota opcional.",
          "Una vez abierta, queda marcada para ese día — \"Volver a abrir este día\" permite repetirlo si hubo un error al contar. Más abajo hay un historial de aperturas anteriores.",
          "Si tenés varias sucursales, arriba a la derecha elegís de cuál es la caja: \"Toda la empresa\" (la caja general de siempre) o una sucursal puntual — cada una tiene su propia apertura y su propio cierre, con los ingresos y gastos de esa sucursal. Un encargado con \"Solo ve su sucursal\" trabaja siempre con la caja de la suya.",
          "Si el administrador activó \"Exigir caja abierta para cobrar\" (Configuración → Usuarios), mientras la caja del día no esté abierta no se puede cobrar el saldo de una orden ni confirmar una venta de Productos: el sistema avisa y te lleva a Caja para abrirla. La seña al crear una orden, y un descuento sin cobro, no se bloquean. Si tu usuario está limitado a una sucursal, hace falta la apertura de esa sucursal.",
        ],
        images: [{ file: "cierre-caja-comparar-01.png", alt: "Apertura de caja" }],
      },
      {
        id: "como-funciona",
        title: "Cierre: elegir el día y comparar",
        badge: { label: "Solo Admin" },
        body: [
          "En la pestaña \"Cierre\" (solo visible para administradores), elegís una fecha y el sistema muestra cuánto entró ese día, separado en \"Reparaciones (órdenes)\", \"Ventas de productos\" y \"Gastos\" — y dentro de cada uno, desglosado por medio de pago (Efectivo, Transferencia, Tarjeta, etc.), para saber exactamente de dónde vino y adónde fue cada movimiento.",
          "El efectivo esperado se calcula como: apertura del día + ingresos en efectivo - gastos pagados en efectivo. Solo el efectivo necesita contarse a mano: transferencia y tarjeta ya quedan verificadas por el banco o el procesador de pago. Ingresá cuánto contaste físicamente en la caja y el sistema calcula si sobró, faltó o cuadró exacto.",
        ],
        images: [{ file: "cierre-caja-comparar-01.png", alt: "Comparación de efectivo esperado vs contado" }],
      },
      {
        id: "caja-virtual",
        title: "Caja física y caja virtual (banco)",
        body: [
          "Si además de la caja con efectivo también manejás plata en el banco, activá \"Usar caja virtual (banco) además de la caja física\" en Configuración → Usuarios. Es opcional: apagado, Caja funciona exactamente igual que antes.",
          "Con el switch activo, F7 separa el dinero en dos cajas sin que tengas que configurar nada: lo cobrado o pagado en Efectivo va a la caja física, y cualquier otro medio (transferencia, tarjeta, QR, etc.) va a la caja virtual. En el desglose cada medio de pago muestra a qué caja pertenece.",
          "En la Apertura cargás los dos saldos: el efectivo con el que arrancás y el saldo que tenés en el banco (poné 0 si hoy no abrís con saldo en el banco). En el Cierre, cada caja se reconcilia por separado: apertura + ingresos - gastos de esa caja = lo esperado. El efectivo se cuenta a mano; el saldo real del banco es opcional — si lo cargás, F7 lo compara con lo esperado y te dice si sobró, faltó o cuadró; si lo dejás vacío, no se compara. Ojo: el saldo del banco puede incluir movimientos que no pasaron por F7, así que una diferencia ahí no siempre es un error.",
          "Al final del Cierre ves el total esperado del día sumando ambas cajas, y el historial muestra las columnas de cada una para saber, día por día, cómo se cerró cada caja.",
        ],
      },
      {
        id: "historial",
        title: "Volver a cerrar e historial",
        badge: { label: "Solo Admin" },
        body: [
          "Una vez cerrado, ese día queda marcado — si te equivocaste al contar, \"Volver a cerrar este día\" te deja repetirlo.",
          "Más abajo queda un historial navegable de todos los cierres anteriores; hacé clic en una fecha para volver a ver el detalle de ese día.",
        ],
        images: [{ file: "cierre-caja-historial-01.png", alt: "Historial de cierres de caja" }],
      },
    ],
  },
  {
    id: "gastos",
    label: "Gastos",
    icon: Receipt,
    description: "Repuestos, mercadería, alquiler y cualquier otro gasto del taller o la tienda.",
    note: "Admin, o Staff/Recepción si el admin lo habilita en Configuración → Usuarios · Disponible en los planes Pro y Business.",
    topics: [
      {
        id: "cargar",
        title: "Cargar un gasto",
        body: [
          "Elegís una categoría (Repuestos, Mercadería, Alquiler, Sueldos, Servicios y Otros vienen precargadas, y podés agregar las propias con \"Nueva categoría...\" al momento de cargar el gasto, o desde Configuración → Accesorios → Categorías de gastos), una descripción opcional, el monto y la fecha.",
          "Si lo pagaste todo de una vez, elegís \"Contado\" y el método de pago (Efectivo, Transferencia, etc.) — queda registrado como pagado en el momento. Si lo compraste a crédito, elegís \"Crédito\" y opcionalmente la cantidad de cuotas: el gasto queda pendiente de pago hasta que vayas registrando cada cuota.",
        ],
        images: [{ file: "gastos-nuevo-01.png", alt: "Cargar un nuevo gasto" }],
      },
      {
        id: "cuotas",
        title: "Abonar cuotas de un gasto a crédito",
        body: [
          "Un gasto a crédito con saldo pendiente muestra un botón \"Abonar\": ahí elegís cuánto pagás esta vez y con qué método, y el sistema descuenta eso del pendiente y suma una cuota pagada. Se puede seguir abonando hasta cubrir el total.",
          "Las tarjetas de arriba muestran el total gastado en el mes, lo gastado hoy, y cuánto queda pendiente de pagar entre todos los gastos a crédito abiertos.",
          "Los gastos pagados en efectivo (tanto de contado como cuotas abonadas en efectivo) se descuentan automáticamente del efectivo esperado en Caja → Cierre — no hace falta anotarlos dos veces.",
        ],
        images: [{ file: "gastos-abonar-01.png", alt: "Abonar una cuota de un gasto a crédito" }],
      },
      {
        id: "recurrentes",
        title: "Gastos recurrentes (alquiler, internet, sueldos…)",
        body: [
          "En la pestaña \"Recurrentes\" creás una regla para los gastos que se repiten: elegís la categoría, el monto, y si se repite cada mes (con el día del mes) o cada semana (con el día de la semana). El gasto se carga solo en esa fecha, sin que tengas que acordarte.",
          "En \"Cuando se genere el gasto\" elegís si queda \"pendiente de pago\" (aparece como \"A pagar\" en la lista y lo abonás cuando pagues de verdad, con el botón \"Abonar\") o si ya se registra pagado con un método. Si elegís Efectivo, se descuenta del efectivo esperado en Caja → Cierre el día que se carga.",
          "Los gastos que genera una regla llevan la marca \"Recurrente\". Si elegís el día 29, 30 o 31, en los meses más cortos se carga el último día del mes. Podés pausar una regla con el interruptor (al reanudarla no se cargan de golpe los meses que estuvo pausada), editarla — los cambios valen para los próximos gastos — o eliminarla; los gastos ya cargados se conservan.",
          "Los gastos recurrentes se cargan cuando alguien con acceso a Gastos abre el sistema: si nadie lo abre un día, al entrar la próxima vez se cargan las fechas que faltaron (hasta 3 meses atrás), con la fecha que les correspondía.",
        ],
      },
    ],
  },
  {
    id: "panic-full",
    label: "Panic Full",
    icon: Cpu,
    description: "Analizá el registro de un iPhone que se reinicia solo y mirá la falla probable y qué revisar primero.",
    note: "Todo el equipo · Disponible en los planes Pro y Business.",
    topics: [
      {
        id: "analizar",
        title: "Analizar un archivo panic-full",
        body: [
          "Exportá del iPhone el archivo que empieza con \"panic-full\" (extensión .ips) con 3uTools u otra herramienta, o desde el propio iPhone en Ajustes → Privacidad y seguridad → Analítica y mejoras → Datos de analítica. Después arrastralo a la pantalla Panic Full (o hacé clic para elegirlo). También podés pegar el texto del log.",
          "El resultado muestra el modelo del equipo, la falla más probable, si parece de hardware o de software, el nivel de confianza, la línea del log que lo respalda, los componentes a revisar y qué verificar. Si hay otras posibilidades menos probables, aparecen plegadas debajo.",
          "El archivo se analiza en tu navegador: no se sube ni se guarda en ningún servidor.",
        ],
      },
      {
        id: "interpretar",
        title: "Cómo interpretar el resultado",
        body: [
          "Es un diagnóstico orientativo basado en patrones conocidos: te dice por dónde empezar, pero no reemplaza la revisión del equipo. La confianza \"alta\" significa que el log nombra el componente (por ejemplo un sensor faltante); \"baja\" es un punto de partida.",
          "Si subís varios logs del mismo equipo a la vez, se marca el patrón que se repite: una misma falla en varios reinicios es una señal mucho más fuerte que un solo log.",
          "\"Copiar informe\" arma un resumen en texto para pegar en WhatsApp o en las notas de una orden.",
        ],
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
          "Tus datos personales (nombre, teléfono), la identidad del taller que ven tus clientes (nombre del negocio y logo — el que aparece en el link de seguimiento y en los mensajes de WhatsApp), y la ubicación (país/departamento/ciudad). Los avisos de WhatsApp se configuran en su propia pestaña.",
        ],
        images: [{ file: "configuracion-perfil-01.png", alt: "Tab de Perfil en Configuración" }],
      },
      {
        id: "moneda",
        title: "Moneda",
        body: [
          "En Configuración → Perfil → \"Ubicación y moneda\" elegís la moneda en la que trabaja tu negocio: hoy guaraníes (Gs.) o dólares (US$). Todos los montos (órdenes, cobros, caja, gastos, reportes, comprobantes y mensajes de WhatsApp) se ven en esa moneda, y también lo que ve tu cliente en el link de seguimiento y en la vitrina.",
          "Al elegir el país se preselecciona su moneda, y la podés cambiar a mano. Si la moneda de tu país todavía no está disponible, usá dólares y tocá \"Pedir mi moneda\": la vamos sumando a medida que se necesita.",
          "Ojo: cambiar la moneda NO convierte los montos que ya cargaste. Por ejemplo, un presupuesto de 350.000 pasaría de verse \"Gs. 350.000\" a \"US$ 350.000\". Por eso, si tu negocio ya tiene órdenes, cobros o productos cargados, F7 te avisa antes de confirmar. Si te equivocás, volvé a la moneda anterior y todo se ve como antes.",
          "Por ahora los dólares se cargan sin centavos (montos enteros).",
        ],
      },
      {
        id: "whatsapp",
        title: "WhatsApp",
        body: [
          "Acá definís cómo avisás a tus clientes. F7 te deja cada mensaje escrito y lo mandás con un toque desde tu propio WhatsApp: no hace falta conectar nada ni escanear ningún código.",
          "\"Cuándo avisar a tus clientes\": un interruptor para cuando se crea la orden o presupuesto y uno por cada estado (incluidos los que creaste vos). Los que dejes prendidos te muestran el aviso listo para mandar; los demás los podés mandar a mano desde el detalle de la orden.",
          "\"Mensajes de WhatsApp\": el texto de cada aviso (orden creada, presupuesto, seguimiento y las respuestas a un presupuesto). Se editan tocando las variables (cliente, equipo, número de orden, estado, link, taller, monto, saldo, garantía) para insertarlas donde está el cursor, con una vista previa de cómo lo ve el cliente. \"Restaurar predeterminado\" vuelve al texto original. Los mensajes de cada estado se editan en la pestaña Estados.",
          "\"Post-venta: para contactar hoy\" (desde el plan Pro): tres interruptores, todos apagados al principio. \"Pedir reseña\" (3 a 7 días después de entregar; necesita que cargues el link de tu ficha de Google para dejar reseñas), \"Garantía por vencer\" (los últimos 3 días de la garantía de la reparación) y \"Cumpleaños\" (el día del cumpleaños cargado en Clientes, y hasta 2 días después). Lo que prendas aparece en Avisos, en la sección \"Para contactar hoy\". Los textos de estos tres mensajes se editan en \"Mensajes de WhatsApp\" → Post-venta, con las variables {{resena}} y {{vencimiento}} además de las de siempre.",
          "Si tu taller todavía tiene un WhatsApp conectado por código QR (la forma anterior), arriba aparece un aviso con el botón \"Desconectar y pasar al modo seguro\". Esa conexión no es oficial y WhatsApp puede bloquear el número conectado, por eso se va a dejar de usar.",
        ],
      },
      {
        id: "whatsapp-preguntas",
        title: "WhatsApp: preguntas frecuentes",
        body: [
          "¿Por qué ya no es automático? Porque los envíos automáticos por código QR no son una vía oficial: WhatsApp puede bloquear el número del taller sin avisar, y con él se pierden los chats con tus clientes. Mandar el mensaje desde tu propio WhatsApp es lo que más cuida tu número.",
          "¿Puedo seguir con el QR? Por un tiempo sí: mientras esté conectado, los avisos siguen saliendo solos como antes. Pero esa conexión se va a apagar, y conviene pasarse antes desde Configuración → WhatsApp.",
          "¿Qué pasa si me olvido de avisar? El aviso queda esperando en el menú Avisos, y desde ahí lo mandás cuando puedas.",
          "¿Le llega a todos los clientes la reseña o el saludo? No: F7 respeta al cliente que tiene apagado \"Notificar por WhatsApp\" y al que tiene un teléfono de relleno. Además, la reseña no se le vuelve a pedir al mismo número antes de 30 días, y si trajo varios equipos juntos recibe un solo mensaje.",
          "¿Y si quiero que sea 100 % automático? Hoy no está disponible. La opción para eso es la API oficial de WhatsApp, que tiene costo y requiere verificar el negocio con Meta; la estamos evaluando.",
        ],
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
          "Para un encargado de sucursal (alguien que no es el dueño y no tiene que ver el resto del negocio), activale \"Solo ve su sucursal\" en su fila — necesita tener una sucursal asignada. Con eso solo ve y carga productos, stock, ventas y órdenes de su sucursal (lo que cargue queda siempre en ella), y no tiene acceso a Configuración. Caja y Gastos los conserva, pero recortados a su sucursal: abre y cierra la caja de su sucursal y ve solo los gastos de ella (Staff y Recepción, siempre que les hayas habilitado Gastos y Cierre de caja en esta misma pantalla). Mantiene el rol que tenga (Admin, Staff o Recepción). Los clientes siguen siendo compartidos entre sucursales, y si deriva una orden a otra sucursal deja de verla. No podés activárselo a tu propio usuario.",
          "Un admin puede eliminar un usuario cuando alguien deja el taller (el ícono de tacho en su fila). No podés eliminarte a vos mismo ni al único admin de la empresa, y si el usuario tiene órdenes registradas a su nombre (como técnico o quien recepcionó), hay que reasignarlas primero — así no se pierde de quién es cada orden ya entregada o con garantía activa.",
          "Más abajo hay switches para ajustar qué puede ver el personal sin rol Admin: mostrar el stock disponible, permitir el acceso a Productos, a Gastos, y a hacer el Cierre de Caja (la Apertura de Caja siempre está disponible para cualquiera). Los de Gastos y Cierre de Caja afectan tanto a Staff como a Recepción; todos vienen apagados por defecto salvo Productos.",
          "Ahí mismo está el switch \"Usar caja virtual (banco) además de la caja física\": si lo activás, la Apertura y el Cierre de Caja separan el dinero en efectivo del dinero en el banco (transferencias, tarjeta, etc.). Viene apagado por defecto.",
          "También ahí está \"Exigir caja abierta para cobrar\": si lo activás, nadie puede cobrar saldos ni hacer ventas de Productos hasta que se abra la caja del día. Viene apagado por defecto y solo tiene efecto en los planes que incluyen Caja.",
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
          "Esta pestaña agrupa varias listas configurables que se usan al cargar una orden o un gasto: tipo de equipo, marca, modelo, problemas frecuentes, checklist de recepción, métodos de pago y categorías de gastos.",
          "Para cada una se puede armar la lista de opciones que van a aparecer como chips de selección rápida en los formularios, en vez de escribir todo a mano cada vez. La clasificación por marca/modelo tiene además un interruptor propio (\"Clasificación por marca/modelo\") que activa esos dos campos en los formularios y las tablas de ganancia por categoría en Reportes.",
          "Métodos de pago controla las opciones disponibles al cobrar una seña o saldo (Nueva Orden, Modo Lote, Presupuestos y Venta Mostrador) — por defecto trae Efectivo, Transferencia, Tarjeta de débito y Tarjeta de crédito, pero podés agregar o borrar las que uses en tu taller (Giro, QR, etc.).",
          "Categorías de gastos controla las opciones disponibles al cargar un gasto en el módulo de Gastos (Pro y Business) — trae Repuestos, Mercadería, Alquiler, Sueldos, Servicios y Otros por defecto.",
        ],
        images: [{ file: "configuracion-accesorios-01.png", alt: "Listas configurables de tipo de equipo, marca, modelo, problemas y checklist" }],
      },
      {
        id: "estados",
        title: "Estados",
        body: [
          "Permite personalizar los nombres de los estados por los que pasa una orden (por ejemplo, cambiar \"En reparación\" por el texto que uses en tu taller), reordenarlos y definir cuáles quedan fijos.",
          "Cada estado tiene además su propio mensaje de WhatsApp editable: con el ícono de mensaje se abre un editor con variables (cliente, equipo, número de orden, estado, link de seguimiento, taller, monto, saldo y garantía) que se insertan tocándolas y se reemplazan al armar el aviso, más una vista previa de cómo lo ve el cliente. Si no se edita, se usa el mensaje predeterminado.",
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
        body: [
          "Acá ves tu plan actual y cuánto le queda: una barra con los días que faltan para que venza y la fecha de vencimiento. Va de turquesa (al día) a naranja (falta una semana o menos) y a rojo (ya venció).",
          "Cuando falta una semana o menos, los administradores ven una tarjeta naranja arriba del Inicio con la barra de días y el botón \"Renovar mi plan\". Podés ocultarla con la X; vuelve a aparecer en tu próxima sesión mientras siga pendiente. En el resto de las pantallas ves una franja fina con el mismo aviso.",
          "Si el plan se vence (mensual, semestral o anual), tenés 3 días de gracia para renovarlo: la cuenta sigue funcionando y el aviso pasa a rojo diciendo hasta qué día tenés acceso. Pasado ese plazo la cuenta se suspende sola: ves una pantalla \"Tu plan venció\", no se pueden cargar datos nuevos y la vitrina online deja de mostrarse. Tus datos quedan guardados.",
          "Apenas se registra tu pago, la cuenta vuelve a funcionar sola (tocá \"Ya renové, volver a entrar\" si seguías en la pantalla de suspensión). El botón \"Renovar mi plan\" abre WhatsApp con el mensaje armado para coordinar el pago. Si todavía no ves ninguna fecha, es que aún no se registró tu primer pago y la cuenta no se bloquea por vencimiento.",
          "Si recién creaste tu cuenta, empezás con una prueba gratis de 14 días: ves los días que te quedan con la misma barra y, al terminar, pasan los mismos 3 días de gracia antes de que la cuenta se suspenda. Si querés seguir, escribinos con \"Renovar mi plan\" y al registrarse tu primer pago el acceso sigue sin cortes.",
        ],
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
  { id: "whatsapp", title: "Configurar WhatsApp y notificaciones", description: "Dejar listos los mensajes y avisar a tus clientes con un toque." },
  { id: "inventario", title: "Inventario: descuento automático de repuestos", description: "Cómo se conecta el stock con las órdenes de reparación." },
  { id: "reportes", title: "Tu primer reporte de ganancias", description: "Leer los números de tu taller mes a mes." },
];
