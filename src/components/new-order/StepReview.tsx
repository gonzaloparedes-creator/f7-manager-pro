import type { ReactNode } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAssignableTechnicians } from "@/hooks/useAssignableTechnicians";
import { useServiceTerms } from "@/hooks/useServiceTerms";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/SignaturePad";
import { normalizePriority, PRIORITY_LABELS, renderServiceTerms } from "@/lib/orders";
import { formatMoney } from "@/lib/currency";
import { parseAmount, type OrderFormState } from "./state";

interface Props {
  form: OrderFormState;
  patch: (p: Partial<OrderFormState>) => void;
  photoCount: number;
  goTo: (step: number) => void;
}

function Block({ title, step, goTo, children }: { title: string; step: number; goTo: (s: number) => void; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <button type="button" onClick={() => goTo(step)} className="text-sm font-medium text-primary hover:underline">
          Editar
        </button>
      </div>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

export default function StepReview({ form, patch, photoCount, goTo }: Props) {
  const { template } = useServiceTerms();
  const { technicians } = useAssignableTechnicians();

  const quote = parseAmount(form.quote_amount);
  const deposit = parseAmount(form.deposit_amount);
  const technician = technicians.find((t) => t.id === form.assigned_technician_id);
  const checklistCount = Object.keys(form.checklist).length;
  const problems = form.problems.map((p) => (p === "Otro" && form.problem_other.trim() ? `Otro: ${form.problem_other.trim()}` : p));
  const hasSecurity = !!form.device_pin || form.device_pattern.length > 0;

  return (
    <div className="space-y-4">
      <Block title="Cliente" step={0} goTo={goTo}>
        <Row label="Nombre">{form.customer_name}</Row>
        <Row label="Teléfono">+{form.customer_phone}</Row>
        {form.customer_cedula.trim() && <Row label="Cédula / RUC">{form.customer_cedula}</Row>}
        {form.secondary_phone && (
          <Row label="Contacto secundario">
            +{form.secondary_phone}
            {form.secondary_contact_name ? ` (${form.secondary_contact_name})` : ""}
          </Row>
        )}
      </Block>

      <Block title="Equipo" step={1} goTo={goTo}>
        <Row label="Equipo">
          {[form.device_type, form.marca, form.modelo].filter((x) => x.trim()).join(" · ")}
        </Row>
        {form.imei.trim() && <Row label="IMEI / Serie">{form.imei}</Row>}
        <Row label="Detalles">{problems.join(", ")}</Row>
        {form.problem_description.trim() && <Row label="Observaciones">{form.problem_description}</Row>}
      </Block>

      <Block title="Estado de ingreso" step={2} goTo={goTo}>
        <Row label="Fotos">{photoCount > 0 ? photoCount : "Sin fotos"}</Row>
        <Row label="Accesorios">{form.accessories.length > 0 ? form.accessories.join(", ") : "Ninguno"}</Row>
        <Row label="Checklist">{checklistCount > 0 ? `${checklistCount} ítem${checklistCount === 1 ? "" : "s"} revisado${checklistCount === 1 ? "" : "s"}` : "Sin revisar"}</Row>
        <Row label="Acceso al equipo">{hasSecurity ? "PIN / patrón cargado" : "Sin datos"}</Row>
      </Block>

      <Block title="Presupuesto y entrega" step={3} goTo={goTo}>
        <Row label="Presupuesto">{quote > 0 ? formatMoney(quote) : "Sin presupuesto"}</Row>
        <Row label="Seña">{deposit > 0 ? `${formatMoney(deposit)} (${form.deposit_payment_method})` : "Sin seña"}</Row>
        {quote - deposit > 0 && (
          <Row label="Saldo">
            <span className="text-secondary">{formatMoney(quote - deposit)}</span>
          </Row>
        )}
        <Row label="Entrega estimada">
          {form.estimated_delivery_date ? format(form.estimated_delivery_date, "PPP", { locale: es }) : "Sin fecha"}
        </Row>
        <Row label="Garantía">{form.warranty_days > 0 ? `${form.warranty_days} días` : "Sin garantía"}</Row>
        <Row label="Técnico">{technician?.full_name || (form.assigned_technician_id ? "Técnico" : "Yo")}</Row>
        <Row label="Prioridad">{PRIORITY_LABELS[normalizePriority(form.priority)]}</Row>
      </Block>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground">Términos y firma del cliente</h3>
        <div className="space-y-2">
          <Label htmlFor="order_terms">Términos del servicio</Label>
          <Textarea
            id="order_terms"
            readOnly
            rows={8}
            value={renderServiceTerms(template, form.warranty_days)}
            className="resize-none bg-muted/30 font-mono text-xs leading-relaxed"
          />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="terms_accepted"
            checked={form.terms_accepted}
            onCheckedChange={(c) => patch({ terms_accepted: c === true })}
          />
          <Label htmlFor="terms_accepted" className="text-sm font-normal leading-snug">
            El cliente leyó y acepta los términos y condiciones del servicio.
          </Label>
        </div>
        <div className="space-y-2">
          <Label>Firma del cliente (opcional)</Label>
          <SignaturePad value={form.client_signature} onChange={(sig) => patch({ client_signature: sig })} />
        </div>
      </section>
    </div>
  );
}
