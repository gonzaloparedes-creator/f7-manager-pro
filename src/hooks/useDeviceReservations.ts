import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import type { DeviceReservation } from "@/lib/reservations";

const COLUMNS =
  "id, company_id, branch_id, receipt_number, inventory_item_id, device_name, imei, customer_name, customer_phone, agreed_price, deposit_amount, deposit_payment_method, expires_on, notes, status, refunded_amount, retained_amount, cancel_reason, resolved_at, created_at";

const HISTORY_LIMIT = 50;

/**
 * Reservas de equipos de la empresa: todas las activas (sin tope, porque bloquean
 * el equipo) y las últimas resueltas como historial. Las reservas solo se leen
 * acá; se crean, cancelan y extienden por RPC.
 */
export function useDeviceReservations() {
  const { companyId } = useCompany();
  const [reservations, setReservations] = useState<DeviceReservation[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!companyId) return;
    const [active, history] = await Promise.all([
      (supabase as any)
        .from("device_reservations")
        .select(COLUMNS)
        .eq("company_id", companyId)
        .eq("status", "activa")
        .order("expires_on", { ascending: true }),
      (supabase as any)
        .from("device_reservations")
        .select(COLUMNS)
        .eq("company_id", companyId)
        .neq("status", "activa")
        .order("resolved_at", { ascending: false })
        .limit(HISTORY_LIMIT),
    ]);
    // Si falla una consulta no se pisa lo que ya había: mejor datos viejos que una lista vacía engañosa.
    if (active.error || history.error) return;
    setReservations([...((active.data ?? []) as DeviceReservation[]), ...((history.data ?? []) as DeviceReservation[])]);
    setLoaded(true);
  }, [companyId]);

  useEffect(() => { void reload(); }, [reload]);

  const activeByItem = useMemo(() => {
    const map = new Map<string, DeviceReservation>();
    for (const r of reservations) {
      if (r.status === "activa" && r.inventory_item_id) map.set(r.inventory_item_id, r);
    }
    return map;
  }, [reservations]);

  return { reservations, activeByItem, loaded, reload };
}
