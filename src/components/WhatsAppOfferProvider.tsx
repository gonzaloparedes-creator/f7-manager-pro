import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { fetchWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import { WhatsAppOfferContext, type CreationOfferEvent } from "@/hooks/useWhatsAppOffer";
import AvisarClienteDialog, { type MessageOption } from "@/components/AvisarClienteDialog";
import {
  buildBatchCreatedMessage,
  buildOrderMessageVars,
  notifyMessageQueueChanged,
  recipientPhone,
  renderMessage,
  resolveEventBody,
  type OrderMessageSource,
  type TemplateOverrides,
} from "@/lib/customerMessages";
import { resolveStatusLabel } from "@/lib/orders";

interface Request {
  id: number;
  orderIds: string[];
  event: CreationOfferEvent;
}

interface PreparedOffer {
  orderId: string;
  customerName: string;
  phone: string;
  eventKey: string;
  message: string;
  options?: MessageOption[];
}

type OfferOrder = OrderMessageSource & { id: string; status: string; client_id: string | null };

// Devuelve null cuando no corresponde ofrecer nada: la empresa sigue en modo
// Evolution (el servidor ya avisa solo), el aviso de "orden creada" está
// apagado, el cliente pidió no recibir avisos, o el teléfono es un relleno.
async function prepareCreationOffer(companyId: string, request: Request): Promise<PreparedOffer | null> {
  const settings = await fetchWhatsAppSettings(companyId);
  if (settings.evolutionActive || settings.prefs.orden_creada !== true) return null;

  const [ordersRes, templatesRes, companyRes, presetsRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, status, client_id, order_number, tracking_token, customer_name, customer_phone, alternative_phone, secondary_phone, device_type, quote_amount, deposit_amount, cargos_adicionales, warranty_days"
      )
      .eq("company_id", companyId)
      .in("id", request.orderIds),
    supabase.from("whatsapp_templates").select("event_key, body").eq("company_id", companyId),
    supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
    supabase.from("order_status_presets").select("key, label").eq("company_id", companyId),
  ]);
  if (ordersRes.error) throw ordersRes.error;

  const byId = new Map((ordersRes.data ?? []).map((o) => [o.id, o as unknown as OfferOrder]));
  const orders = request.orderIds.map((id) => byId.get(id)).filter((o): o is OfferOrder => !!o);
  if (orders.length === 0) return null;

  const clientIds = [...new Set(orders.map((o) => o.client_id).filter((c): c is string => !!c))];
  if (clientIds.length > 0) {
    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, notify_whatsapp")
      .in("id", clientIds);
    if (error) throw error;
    if ((clients ?? []).some((c) => c.notify_whatsapp === false)) return null;
  }

  const first = orders[0];
  const phone = recipientPhone(first);
  if (!phone) return null;

  const overrides: TemplateOverrides = {};
  for (const row of templatesRes.data ?? []) overrides[row.event_key] = row.body;
  const taller = companyRes.data?.name ?? "";
  const presets = presetsRes.data ?? [];

  const messageFor = (order: OfferOrder) =>
    renderMessage(
      resolveEventBody(request.event, overrides),
      buildOrderMessageVars(order, { taller, estado: resolveStatusLabel(order.status, presets) })
    );

  if (orders.length === 1) {
    return {
      orderId: first.id,
      customerName: first.customer_name,
      phone,
      eventKey: request.event,
      message: messageFor(first),
    };
  }

  const combined = buildBatchCreatedMessage(orders, { cliente: first.customer_name, taller });
  const options: MessageOption[] = [
    {
      key: "lote",
      label: `Un solo mensaje con los ${orders.length} equipos`,
      message: combined,
      eventKey: request.event,
      orderId: first.id,
      orderIds: orders.map((o) => o.id),
    },
    ...orders.map((o) => ({
      key: o.id,
      label: `Solo ${o.device_type} (${o.order_number})`,
      message: messageFor(o),
      eventKey: request.event,
      orderId: o.id,
    })),
  ];
  return {
    orderId: first.id,
    customerName: first.customer_name,
    phone,
    eventKey: request.event,
    message: combined,
    options,
  };
}

function CreationOfferHost({ request, onDone }: { request: Request; onDone: () => void }) {
  const { companyId, loading } = useCompany();
  const [offer, setOffer] = useState<PreparedOffer | null>(null);
  const [open, setOpen] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!companyId) {
      onDone();
      return;
    }
    if (started.current) return;
    started.current = true;
    prepareCreationOffer(companyId, request)
      .then((prepared) => {
        if (!prepared) {
          onDone();
          return;
        }
        setOffer(prepared);
        setOpen(true);
      })
      .catch((e) => {
        console.warn("No se pudo preparar el aviso por WhatsApp:", e);
        onDone();
      });
    // request.id cambia con cada oferta nueva (el host se remonta por key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, loading]);

  if (!offer) return null;
  return (
    <AvisarClienteDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Se desmonta recién cuando termina la animación de cierre.
        if (!o) setTimeout(onDone, 300);
      }}
      orderId={offer.orderId}
      customerName={offer.customerName}
      phone={offer.phone}
      eventKey={offer.eventKey}
      initialMessage={offer.message}
      options={offer.options}
      suggested
      companyId={companyId}
    />
  );
}

export default function WhatsAppOfferProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const seq = useRef(0);

  const api = useMemo(
    () => ({
      offerCreation: (orderIds: string[], event: CreationOfferEvent) => {
        if (orderIds.length === 0) return;
        seq.current += 1;
        setRequest({ id: seq.current, orderIds, event });
      },
    }),
    []
  );

  return (
    <WhatsAppOfferContext.Provider value={api}>
      {children}
      {request && (
        <CreationOfferHost
          key={request.id}
          request={request}
          onDone={() => {
            setRequest((prev) => (prev?.id === request.id ? null : prev));
            notifyMessageQueueChanged();
          }}
        />
      )}
    </WhatsAppOfferContext.Provider>
  );
}
