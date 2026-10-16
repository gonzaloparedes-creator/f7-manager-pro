import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AvisarClienteDialog from "@/components/AvisarClienteDialog";
import { INTERRUPTION_REASONS, resolveStatusLabel, type InterruptionReason } from "@/lib/orders";
import { INTERRUPTED_STATUS, changeOrderStatus, resolveStatusNotice, type NoticeOrder, type StatusNotice } from "@/lib/orderStatus";

type StatusPreset = { key: string; label: string; message_template?: string | null };

interface MovableOrder {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  status_changed_at: string;
}

// Cambio de estado desde las listas y el tablero: actualiza al instante, graba
// lo mismo que el detalle de la orden y, si hay que avisarle al cliente, lo
// ofrece en un aviso en vez de abrir un modal en medio del arrastre.
export function useMoveOrder<T extends MovableOrder>(params: {
  setOrders: Dispatch<SetStateAction<T[]>>;
  statusPresets: StatusPreset[];
}) {
  const { setOrders, statusPresets } = params;
  const { companyId } = useCompany();
  const { toast } = useToast();
  const [pendingInterruption, setPendingInterruption] = useState<T | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<(StatusNotice & { orderId: string; customerName: string }) | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const offerNotice = useCallback(async (order: T, newStatus: string) => {
    if (!companyId) return;
    const { data: full } = await supabase
      .from("orders")
      .select("customer_name, customer_phone, alternative_phone, secondary_phone, device_type, order_number, tracking_token, quote_amount, deposit_amount, cargos_adicionales, warranty_days, client_id")
      .eq("id", order.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!full) return;
    let clientNotify = true;
    if (full.client_id) {
      const { data: cli } = await supabase
        .from("clients")
        .select("notify_whatsapp")
        .eq("id", full.client_id)
        .eq("company_id", companyId)
        .maybeSingle();
      clientNotify = cli?.notify_whatsapp !== false;
    }
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    const source: NoticeOrder = {
      ...(full as unknown as NoticeOrder),
      cargos_adicionales: Array.isArray(full.cargos_adicionales) ? (full.cargos_adicionales as { monto: number }[]) : [],
      client_notify_whatsapp: clientNotify,
    };
    const result = await resolveStatusNotice({
      companyId, order: source, newStatus, presets: statusPresets, businessName: company?.name ?? null,
    });
    if (!result) return;
    const next = { ...result, orderId: order.id, customerName: order.customer_name };
    toast({
      title: "¿Avisar al cliente?",
      description: `${order.customer_name} · ${resolveStatusLabel(newStatus, statusPresets)}`,
      duration: 15000,
      action: (
        <ToastAction
          altText="Avisar al cliente"
          onClick={() => {
            setNotice(next);
            setNoticeOpen(true);
          }}
        >
          Avisar
        </ToastAction>
      ),
    });
  }, [companyId, statusPresets, toast]);

  const performMove = useCallback(async (order: T, newStatus: string, interruptionReason?: string) => {
    const previous = { status: order.status, status_changed_at: order.status_changed_at };
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: newStatus, status_changed_at: new Date().toISOString() } : o)));
    try {
      await changeOrderStatus({ order, newStatus, presets: statusPresets, interruptionReason });
    } catch (e) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...previous } : o)));
      toast({ title: "No se pudo mover la orden", description: (e as { message?: string })?.message ?? "Probá de nuevo.", variant: "destructive" });
      return;
    }
    toast({ title: order.order_number, description: `Pasó a ${resolveStatusLabel(newStatus, statusPresets)}.` });
    try {
      await offerNotice(order, newStatus);
    } catch (e) {
      console.warn(e);
    }
  }, [offerNotice, setOrders, statusPresets, toast]);

  const requestMove = useCallback((order: T, newStatus: string) => {
    if (newStatus === order.status) return;
    if (newStatus === INTERRUPTED_STATUS) {
      setReason("");
      setPendingInterruption(order);
      return;
    }
    void performMove(order, newStatus);
  }, [performMove]);

  const confirmInterruption = () => {
    if (!pendingInterruption || !reason) return;
    const order = pendingInterruption;
    setPendingInterruption(null);
    void performMove(order, INTERRUPTED_STATUS, reason);
  };

  const dialogs = (
    <>
      <Dialog open={!!pendingInterruption} onOpenChange={(o) => { if (!o) setPendingInterruption(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Retirado sin reparar</DialogTitle>
            <DialogDescription>
              {pendingInterruption ? `${pendingInterruption.order_number} · ${pendingInterruption.customer_name}. ` : ""}
              Elegí por qué se interrumpió la reparación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Elegí un motivo" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(INTERRUPTION_REASONS) as InterruptionReason[]).map((k) => (
                  <SelectItem key={k} value={k}>{INTERRUPTION_REASONS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingInterruption(null)}>Cancelar</Button>
            <Button onClick={confirmInterruption} disabled={!reason}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {notice && (
        <AvisarClienteDialog
          open={noticeOpen}
          onOpenChange={setNoticeOpen}
          orderId={notice.orderId}
          customerName={notice.customerName}
          phone={notice.phone}
          eventKey={notice.eventKey}
          initialMessage={notice.message}
          suggested
        />
      )}
    </>
  );

  return { requestMove, dialogs };
}
