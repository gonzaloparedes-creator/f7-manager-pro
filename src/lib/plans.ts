// Fuente única de verdad para planes: precios, límites y features.
// Antes esto vivía duplicado en Presentacion.tsx y SubscriptionTab.tsx
// (y se desincronizó una vez — Pro llegó a mostrar $15 en un lado y $18 en
// el otro). No lo dupliques de nuevo.

export type PlanType = "starter" | "pro" | "business" | "retail";
export type Cycle = "mensual" | "semestral" | "anual";

export const PLAN_LABELS: Record<PlanType, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  retail: "Retail",
};

export const PLAN_LIMITS: Record<PlanType, { photos: number; branches: number; users: number }> = {
  starter: { photos: 5, branches: 1, users: 1 },
  pro: { photos: 20, branches: Infinity, users: 5 },
  business: { photos: 20, branches: Infinity, users: Infinity },
  // Mismos límites que Starter a propósito: Retail no debe ser una forma
  // barata de esquivar el plan de entrada (ver auditoría de pricing).
  retail: { photos: 5, branches: 1, users: 1 },
};

export const PRICING: Record<PlanType, Record<Cycle, { usd: number; gs: number }>> = {
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
  business: {
    mensual: { usd: 22, gs: 140000 },
    semestral: { usd: 119, gs: 750000 },
    anual: { usd: 220, gs: 1400000 },
  },
  retail: {
    mensual: { usd: 13, gs: 80000 },
    semestral: { usd: 70, gs: 430000 },
    anual: { usd: 130, gs: 800000 },
  },
};

export const PLAN_MESSAGES: Record<PlanType, string> = {
  starter: "¡Hola! Vengo de la plataforma y me interesa el Plan Starter de F7 Manager Pro para mi taller.",
  pro: "¡Hola! Vengo de la plataforma y me interesa activar el Plan Pro de F7 Manager Pro para mi taller.",
  business: "¡Hola! Vengo de la plataforma y me interesa el Plan Business (reparación + venta) de F7 Manager Pro.",
  retail: "¡Hola! Vengo de la plataforma y me interesa el Plan Retail (solo tienda) de F7 Manager Pro.",
};

export const PLAN_FEATURES: Record<PlanType, string[]> = {
  starter: [
    "1 usuario (dueño / admin)",
    "1 sucursal",
    "Órdenes ilimitadas",
    "Base de clientes ilimitada",
    "Tracking QR público",
    "5 fotos por orden",
  ],
  pro: [
    "Todo lo del plan Starter, más:",
    "Hasta 5 usuarios con roles",
    "Sucursales ilimitadas",
    "Control de Inventario",
    "Reportes financieros (Ingreso Neto)",
    "20 fotos por orden",
  ],
  business: [
    "Todo lo del plan Pro, más:",
    "Módulo Punto de Venta (POS / Caja rápida)",
    "Inventario Externo (catálogo para venta al público)",
    "Cobro unificado: reparación + venta en un solo ticket",
    "Recibos automatizados por WhatsApp",
    "Usuarios ilimitados",
  ],
  retail: [
    "Módulo Punto de Venta (POS / Caja rápida)",
    "Inventario Externo (ventas)",
    "Carga de productos con código de barras",
    "Control de Caja y Reportes de Ventas",
    "Recibos automatizados por WhatsApp",
    "1 usuario / 1 sucursal",
  ],
};

// Escalera de upsell del lado "Taller". Retail es una oferta paralela, no
// un escalón de esta escalera.
export const TALLER_LADDER: PlanType[] = ["starter", "pro", "business"];
