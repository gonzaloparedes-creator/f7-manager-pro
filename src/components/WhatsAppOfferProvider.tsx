import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { fetchWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import { WhatsAppOfferContext, type CreationOfferEvent } from "@/hooks/useWhatsAppOffer";
import AvisarClienteDialog, { type MessageOption } from "@/components/AvisarClienteDialog";
import AvisarTecnicoDialog from "@/components/AvisarTecnicoDialog";
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
import { loadTechnicianRecipients, type TechnicianRecipient } from "@/lib/technicianNotice";

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

type OfferOrder = OrderMessageSource & {
  id: string;
  status: string;
  client_id: string | null;
  assigned_technician_id: string | null;
};

interface PreparedOffers {
  client: PreparedOffer | null;
  technicians: TechnicianRecipient[];
}

// En modo Evolution el servidor ya avisa solo (cliente y técnico): no se
// ofrece nada. Si no, el aviso al cliente depende de su preferencia y el del
// técnico de que haya una persona asignada con teléfono.
async function prepareOffers(companyId: string, userId: string | null, request: Request): Promise<PreparedOffers> {
  const none: PreparedOffers = { client: null, technicians: [] };
  const settings = await fetchWhatsAppSettings(companyId);
  if (settings.evolutionActive) return none;

  const ordersRes = await supabase
    .from("orders")
    .select(
      "id, status, client_id, order_number, tracking_token, customer_name, customer_phone, alternative_phone, secondary_phone, device_type, quote_amount, deposit_amount, cargos_adicionales, warranty_days, assigned_technician_id"
    )
    .eq("company_id", companyId)
    .in("id", request.orderIds);
  if (ordersRes.error) throw ordersRes.error;
  const byId = new Map((ordersRes.data ?? []).map((o) => [o.id, o as unknown as OfferOrder]));
  const orders = request.orderIds.map((id) => byId.get(id)).filter((o): o is OfferOrder => !!o);
  if (orders.length === 0) return none;

  // Un presupuesto todavía no tiene trabajo para el técnico.
  const technicians =
    request.event === "orden_creada"
      ? (await loadTechnicianRecipients(companyId, orders, userId)).recipients
      : [];

  const client = settings.prefs.orden_creada === true ? await prepareClientOffer(companyId, request, orders) : null;
  return { client, technicians };
}

// Devuelve null cuando no corresponde avisar al cliente: pidió no recibir
// avisos o el teléfono es un relleno.
async function prepareClientOffer(
  companyId: string,
  request: Request,
  orders: OfferOrder[]
): Promise<PreparedOffer | null> {
  const [templatesRes, companyRes, presetsRes] = await Promise.all([
    supabase.from("whatsapp_templates").select("event_key, body").eq("company_id", companyId),
    supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
    supabase.from("order_status_presets").select("key, label").eq("company_id", companyId),
  ]);

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
  const { user } = useAuth();
  const [offers, setOffers] = useState<PreparedOffers | null>(null);
  const [stage, setStage] = useState<"client" | "technician">("client");
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
    prepareOffers(companyId, user?.id ?? null, request)
      .then((prepared) => {
        if (!prepared.client && prepared.technicians.length === 0) {
          onDone();
          return;
        }
        setOffers(prepared);
        setStage(prepared.client ? "client" : "technician");
        setOpen(true);
      })
      .catch((e) => {
        console.warn("No se pudo preparar el aviso por WhatsApp:", e);
        onDone();
      });
    // request.id cambia con cada oferta nueva (el host se remonta por key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, loading]);

  if (!offers) return null;

  // Los dos avisos no se muestran a la vez: primero el del cliente y, cuando
  // se cierra (después de la animación), el del técnico.
  if (stage === "client" && offers.client) {
    const offer = offers.client;
    return (
      <AvisarClienteDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) return;
          if (offers.technicians.length > 0) {
            setTimeout(() => {
              setStage("technician");
              setOpen(true);
            }, 300);
          } else {
            setTimeout(onDone, 300);
          }
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

  return (
    <AvisarTecnicoDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Se desmonta recién cuando termina la animación de cierre.
        if (!o) setTimeout(onDone, 300);
      }}
      recipients={offers.technicians}
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
