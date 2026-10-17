import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, Plus, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PrintReceipt } from "@/components/PrintReceipt";
import { useServiceTerms } from "@/hooks/useServiceTerms";
import { useWhatsAppOffer } from "@/hooks/useWhatsAppOffer";
import { renderServiceTerms, STATUS_LABELS } from "@/lib/orders";

export interface CreatedOrder {
  id: string;
  order_number: string;
  customer_name: string;
  device_type: string;
  warranty_days: number | null;
  [key: string]: unknown;
}

interface Props {
  order: CreatedOrder;
  companyId: string | null;
  customerCedula: string | null;
  receivedByName: string | null;
  onView: () => void;
  onNew: () => void;
}

export default function OrderCreated({ order, companyId, customerCedula, receivedByName, onView, onNew }: Props) {
  const { template } = useServiceTerms();
  const { offerCreation } = useWhatsAppOffer();
  const [businessName, setBusinessName] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies").select("name").eq("id", companyId).maybeSingle()
      .then(({ data }) => setBusinessName(data?.name ?? null));
  }, [companyId]);

  const tile =
    "flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-5 text-sm font-medium text-foreground transition-colors hover:bg-accent";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-10 text-center sm:py-16">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="h-11 w-11" />
      </span>
      <h1 className="mt-6 text-2xl font-bold text-foreground">¡Orden creada!</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {order.customer_name} · {order.device_type}
      </p>
      <p className="mt-4 rounded-lg bg-muted px-5 py-2 text-xl font-bold tracking-wide text-foreground" data-testid="created-order-number">
        {order.order_number}
      </p>

      <div className="mt-8 grid w-full grid-cols-2 gap-3">
        <button type="button" onClick={() => window.print()} className={tile}>
          <Printer className="h-6 w-6 text-primary" />
          Imprimir comprobante
        </button>
        <button type="button" onClick={() => offerCreation([order.id], "orden_creada")} className={tile}>
          <MessageCircle className="h-6 w-6 text-primary" />
          Avisar por WhatsApp
        </button>
      </div>

      <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
        <Button className="h-11 flex-1" onClick={onView}>Ver orden</Button>
        <Button variant="outline" className="h-11 flex-1" onClick={onNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Nueva orden
        </Button>
      </div>

      <PrintReceipt
        order={{
          ...(order as unknown as Parameters<typeof PrintReceipt>[0]["order"]),
          customer_cedula: customerCedula,
          received_by_name: receivedByName,
        }}
        businessName={businessName}
        serviceTerms={renderServiceTerms(template, order.warranty_days)}
        statusLabel={STATUS_LABELS.recibido}
      />
    </div>
  );
}
