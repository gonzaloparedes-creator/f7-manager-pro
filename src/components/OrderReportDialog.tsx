import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Lock, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useOrderStatusPresets } from "@/hooks/useOrderStatusPresets";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { toast } from "sonner";
import { PRIORITY_LABELS, QUOTE_RESPONSE_LABELS, normalizePriority, resolveStatusLabel, type QuoteResponse } from "@/lib/orders";
import {
  printOrderReport,
  type OrderReportData,
  type OrderReportOrder,
  type OrderReportPart,
  type OrderReportPayment,
  type OrderReportVariant,
} from "@/lib/orderReport";

// Solo los campos que usa el reporte: el resto de la orden (PIN, patrón, firma) no entra al armado.
interface ReportSourceOrder {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_cedula?: string | null;
  device_type: string;
  marca?: string | null;
  modelo?: string | null;
  imei: string | null;
  problems: string[];
  problem_other: string | null;
  problem_description: string;
  accessories?: string[] | null;
  checklist?: { label: string; status: "ok" | "fail" }[] | null;
  received_by_name?: string | null;
  warranty_days?: number | null;
  delivered_at?: string | null;
  estimated_delivery_date: string | null;
  quote_amount: number;
  original_quote_amount?: number | null;
  deposit_amount: number;
  cargos_adicionales: { motivo: string; monto: number }[];
  financial_documents: { name: string; url: string; uploaded_at: string }[];
  photos: string[];
  status: string;
  quote_response?: QuoteResponse | null;
  quote_response_note?: string | null;
  quote_responded_at?: string | null;
  priority?: string | null;
  interruption_reason?: string | null;
}

interface ReportHistory {
  status: string;
  status_label?: string | null;
  note: string | null;
  created_at: string;
  is_internal?: boolean;
  image_urls?: string[] | null;
}

interface ReportNote {
  note: string;
  created_at: string;
  technician_id: string;
}

interface Extras {
  parts: OrderReportPart[];
  payments: OrderReportPayment[];
  names: Record<string, string>;
}

interface OrderReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ReportSourceOrder;
  history: ReportHistory[];
  techNotes: ReportNote[];
  businessName: string | null;
  branchName: string | null;
  technicianName: string | null;
}

// El detalle de la orden monta este diálogo siempre: mientras esté cerrado no tiene que
// consultar nada (permisos, estados, repuestos, pagos), por eso el cuerpo se monta recién al abrir.
export default function OrderReportDialog(props: OrderReportDialogProps) {
  return props.open ? <OrderReportDialogBody {...props} /> : null;
}

function OrderReportDialogBody({
  open,
  onOpenChange,
  order,
  history,
  techNotes,
  businessName,
  branchName,
  technicianName,
}: OrderReportDialogProps) {
  const { companyId } = useCompany();
  const { presets } = useOrderStatusPresets();
  const { canViewCosts } = useUserPermissions();
  const [extras, setExtras] = useState<Extras | null>(null);
  const [loadError, setLoadError] = useState(false);

  const orderId = order.id;
  useEffect(() => {
    setExtras(null);
    setLoadError(false);
    if (!open || !companyId) return;
    let cancelled = false;

    // Siempre por orden y por empresa (las políticas RLS ya lo exigen).
    const load = async () => {
      const [parts, payments] = await Promise.all([
        supabase
          .from("order_parts")
          .select("quantity, historical_cost, historical_selling_price, supplier_name, part_details, inventory_items(name)")
          .eq("order_id", orderId).order("created_at", { ascending: true }),
        supabase
          .from("order_payments")
          .select("amount, payment_method, created_at, created_by")
          .eq("order_id", orderId).eq("company_id", companyId).order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      if (parts.error || payments.error) {
        setLoadError(true);
        return;
      }

      const ids = Array.from(
        new Set<string>([
          ...techNotes.map((n) => n.technician_id),
          ...(payments.data ?? []).map((p) => p.created_by ?? ""),
        ].filter(Boolean)),
      );
      const names: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").eq("company_id", companyId).in("id", ids);
        for (const p of profs ?? []) {
          if (p.full_name) names[p.id] = p.full_name;
        }
      }
      if (cancelled) return;

      setExtras({
        parts: (parts.data ?? []).map((p) => ({
          name: p.inventory_items?.name ?? p.part_details ?? "Repuesto",
          quantity: Number(p.quantity ?? 0),
          unit_price: Number(p.historical_selling_price ?? 0),
          unit_cost: Number(p.historical_cost ?? 0),
          details: p.inventory_items?.name && p.part_details ? p.part_details : null,
          supplier: p.supplier_name ?? null,
        })),
        payments: (payments.data ?? []).map((p) => ({
          amount: Number(p.amount ?? 0),
          method: p.payment_method ?? null,
          created_at: p.created_at,
          author: p.created_by ? names[p.created_by] ?? null : null,
        })),
        names,
      });
    };
    load().catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
    // techNotes cambia de identidad en cada carga de la orden; alcanza con reabrir el diálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId, companyId]);

  const reportOrder = useMemo<OrderReportOrder>(() => ({
    order_number: order.order_number,
    created_at: order.created_at,
    status_label: resolveStatusLabel(order.status, presets),
    customer_name: order.customer_name,
    customer_phone: order.customer_phone || null,
    customer_cedula: order.customer_cedula ?? null,
    device_type: order.device_type,
    marca: order.marca ?? null,
    modelo: order.modelo ?? null,
    imei: order.imei,
    problems: order.problems ?? [],
    problem_other: order.problem_other,
    problem_description: order.problem_description || null,
    accessories: order.accessories ?? [],
    checklist: order.checklist ?? [],
    received_by_name: order.received_by_name ?? null,
    assigned_technician_name: technicianName,
    branch_name: branchName,
    priority_label: PRIORITY_LABELS[normalizePriority(order.priority)],
    estimated_delivery_date: order.estimated_delivery_date,
    delivered_at: order.delivered_at ?? null,
    warranty_days: order.warranty_days ?? null,
    quote_amount: Number(order.quote_amount ?? 0),
    original_quote_amount: order.original_quote_amount ?? null,
    deposit_amount: Number(order.deposit_amount ?? 0),
    cargos_adicionales: order.cargos_adicionales ?? [],
    quote_response_label: order.quote_response ? QUOTE_RESPONSE_LABELS[order.quote_response] : null,
    quote_response_note: order.quote_response_note ?? null,
    quote_responded_at: order.quote_responded_at ?? null,
    interruption_reason: order.interruption_reason ?? null,
    photos: order.photos ?? [],
    financial_documents: (order.financial_documents ?? []).map((d) => ({ name: d.name, uploaded_at: d.uploaded_at })),
  }), [order, presets, technicianName, branchName]);

  const print = (variant: OrderReportVariant) => {
    if (!extras) return;
    const data: OrderReportData = {
      order: reportOrder,
      history: history.map((h) => ({
        status_label: h.status_label ?? resolveStatusLabel(h.status, presets),
        note: h.note,
        created_at: h.created_at,
        is_internal: !!h.is_internal,
        image_urls: h.image_urls ?? [],
      })),
      notes: techNotes.map((n) => ({ note: n.note, created_at: n.created_at, author: extras.names[n.technician_id] ?? null })),
      parts: extras.parts,
      payments: extras.payments,
    };
    try {
      printOrderReport(data, { variant, businessName, canViewCosts });
    } catch {
      toast.error("No se pudo abrir la impresión. Probá de nuevo.");
    }
  };

  const ready = !!extras;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Reporte de la orden</DialogTitle>
          <DialogDescription>{order.order_number} · todo lo que se hizo, listo para imprimir</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full items-start justify-start gap-3 whitespace-normal px-4 py-3 text-left"
            disabled={!ready}
            onClick={() => print("interno")}
            data-testid="order-report-interno"
          >
            {ready || loadError ? (
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
            ) : (
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
            )}
            <span className="space-y-0.5">
              <span className="block font-semibold">Reporte completo (uso interno)</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Historial con los movimientos internos, notas técnicas, repuestos, pagos y quién hizo cada cosa
                {canViewCosts ? ", más costos y ganancia" : ""}. Para archivar en el taller.
              </span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto w-full items-start justify-start gap-3 whitespace-normal px-4 py-3 text-left"
            disabled={!ready}
            onClick={() => print("cliente")}
            data-testid="order-report-cliente"
          >
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span className="space-y-0.5">
              <span className="block font-semibold">Reporte para el cliente</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Lo mismo que el cliente ve en su link de seguimiento, más sus cuentas. Sin notas internas, costos ni nombres del equipo.
              </span>
            </span>
          </Button>

          {loadError && (
            <p className="text-sm text-destructive" data-testid="order-report-error">
              No se pudieron cargar los repuestos y pagos de la orden, así que el reporte no está disponible. Cerrá y volvé a abrir para reintentar.
            </p>
          )}
        </div>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Printer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Se abre el cuadro de impresión del navegador: para tener un archivo, elegí «Guardar como PDF».
        </p>
      </DialogContent>
    </Dialog>
  );
}
