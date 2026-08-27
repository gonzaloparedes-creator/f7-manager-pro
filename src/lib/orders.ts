export type OrderStatus =
  | "presupuesto"
  | "recibido"
  | "en_diagnostico"
  | "en_reparacion"
  | "listo"
  | "enviado"
  | "entregado"
  | "garantia";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  presupuesto: "Presupuesto",
  recibido: "Recibido",
  en_diagnostico: "En diagnóstico",
  en_reparacion: "En reparación",
  listo: "Listo para retirar",
  enviado: "Enviado",
  entregado: "Entregado",
  garantia: "Garantía",
};

// Resuelve el label a mostrar para un status: el preset configurado por la
// empresa (ver order_status_presets / useOrderStatusPresets) tiene
// prioridad; si no hay match (preset borrado, o call site sin presets a
// mano) cae al label por defecto, y en último caso muestra la key cruda.
export function resolveStatusLabel(status: string, presets?: { key: string; label: string }[]) {
  const fromPreset = presets?.find((p) => p.key === status)?.label;
  if (fromPreset) return fromPreset;
  return STATUS_LABELS[status as OrderStatus] ?? status;
}

export function statusBadgeClasses(status: string) {
  switch (status) {
    case "presupuesto":
      return "bg-[hsl(var(--status-presupuesto-bg))] text-[hsl(var(--status-presupuesto))]";
    case "recibido":
      return "bg-[hsl(var(--status-recibido-bg))] text-[hsl(var(--status-recibido))]";
    case "en_diagnostico":
      return "bg-[hsl(var(--status-diagnostico-bg))] text-[hsl(var(--status-diagnostico))]";
    case "en_reparacion":
      return "bg-[hsl(var(--status-reparacion-bg))] text-[hsl(var(--status-reparacion))]";
    case "listo":
      return "bg-[hsl(var(--status-listo-bg))] text-[hsl(var(--status-listo))]";
    case "enviado":
      return "bg-[hsl(var(--status-enviado-bg))] text-[hsl(var(--status-enviado))]";
    case "entregado":
      return "bg-[hsl(var(--status-entregado-bg))] text-[hsl(var(--status-entregado))]";
    case "garantia":
      return "bg-[hsl(var(--status-garantia-bg))] text-[hsl(var(--status-garantia))]";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// Respuesta del cliente a un Presupuesto, dejada desde el link público de
// tracking (solo vía tracking_token — ver PublicTrackingByCode.tsx y la
// Edge Function respond-to-quote). El cliente no puede editar el monto
// (lo fija el técnico), solo aceptar, rechazar o pedir cambios con una nota.
export type QuoteResponse = "aceptado" | "rechazado" | "cambios_solicitados";

export const QUOTE_RESPONSE_LABELS: Record<QuoteResponse, string> = {
  aceptado: "Aceptado por el cliente",
  rechazado: "Rechazado por el cliente",
  cambios_solicitados: "Cliente pidió cambios",
};

export function quoteResponseBadgeClasses(response: QuoteResponse) {
  switch (response) {
    case "aceptado":
      return "bg-[hsl(var(--status-listo-bg))] text-[hsl(var(--status-listo))]";
    case "rechazado":
      return "bg-destructive/10 text-destructive";
    case "cambios_solicitados":
      return "bg-primary/10 text-primary";
  }
}

export const WARRANTY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Sin garantía (0 días)" },
  { value: 15, label: "15 días" },
  { value: 30, label: "30 días" },
  { value: 60, label: "60 días" },
  { value: 90, label: "90 días" },
];

export type WarrantyState =
  | { kind: "none" }
  | { kind: "active"; daysRemaining: number }
  | { kind: "expired" };

export function computeWarrantyState(
  deliveredAt: string | null | undefined,
  warrantyDays: number | null | undefined
): WarrantyState | null {
  if (!deliveredAt) return null;
  const wd = Number(warrantyDays ?? 0);
  if (wd === 0) return { kind: "none" };
  const delivered = new Date(deliveredAt).getTime();
  const daysPassed = Math.floor((Date.now() - delivered) / (1000 * 60 * 60 * 24));
  const remaining = wd - daysPassed;
  if (remaining >= 0) return { kind: "active", daysRemaining: remaining };
  return { kind: "expired" };
}

export function formatPYG(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return `Gs. ${n.toLocaleString("es-PY")}`;
}

// {{garantia_dias}} se reemplaza por renderServiceTerms() con la garantía
// real elegida en cada orden (WarrantySelector) — así, tanto este texto por
// defecto como cualquier texto personalizado que un admin escriba desde
// Configuración > Términos quedan sincronizados con la garantía real.
export const DEFAULT_SERVICE_TERMS = `TÉRMINOS Y CONDICIONES DEL SERVICIO

1. GARANTÍA: Toda reparación cuenta con {{garantia_dias}} de garantía sobre el trabajo realizado y los repuestos instalados, contados desde la entrega del equipo. La garantía no cubre golpes, humedad, manipulación por terceros, ni daños posteriores al retiro.

2. DIAGNÓSTICO: Al ingresar el equipo se realiza un diagnóstico previo. El presupuesto puede ajustarse si al abrir el equipo se detectan daños adicionales no visibles, en cuyo caso se notificará al cliente antes de continuar.

3. SEÑA Y SALDO: La seña abonada cubre el diagnóstico y la reserva de repuestos; no es reembolsable si el cliente decide no continuar con la reparación. El saldo se abona al momento de retirar el equipo.

4. PLAZOS: Los plazos de entrega son estimativos y pueden variar según la disponibilidad de repuestos. El taller notificará cualquier demora.

5. RETIRO DEL EQUIPO: Pasados 30 días desde el aviso de "Listo para retirar" sin que el cliente retire el equipo, se aplicarán cargos por almacenamiento. Pasados 90 días, el taller podrá disponer del equipo para recuperar los costos.

6. DATOS DEL EQUIPO: Se recomienda al cliente realizar respaldo de su información antes de entregar el equipo. El taller no se responsabiliza por la pérdida de datos.

7. ACEPTACIÓN: La firma del presente documento implica la aceptación total de estas condiciones.`;

export function renderServiceTerms(template: string, warrantyDays: number | null | undefined) {
  const days = Number(warrantyDays ?? 0);
  const phrase = `${days} ${days === 1 ? "día" : "días"}`;
  return template.replaceAll("{{garantia_dias}}", phrase);
}
