import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import type { CompanyPeriodRow } from "@/lib/planExpiry";

// Estado de acceso de la propia empresa, calculado en la base (get_my_company_access):
// la fecha de "hoy" y los días de gracia vienen del servidor, no del reloj del usuario.
export interface CompanyAccess {
  // Interruptor manual de suspensión (companies.is_active).
  isActive: boolean;
  // Plazo vencido: pasó el vencimiento + los días de gracia.
  lapsed: boolean;
  // Lo que decide el bloqueo: suspendida a mano O plazo vencido.
  blocked: boolean;
  graceDays: number;
  accessUntil: string | null;
  today: string;
  // "paid" = hay un pago cargado; "trial" = solo prueba gratis; "none" = sin fechas.
  kind: "paid" | "trial" | "none";
  // Pago cargado y prueba gratis de la empresa (el pago manda sobre la prueba).
  period: CompanyPeriodRow;
}

const DEDUPE_MS = 5000;
let recent: { key: string; at: number; promise: Promise<CompanyAccess | null> } | null = null;

async function loadAccess(): Promise<CompanyAccess | null> {
  const { data, error } = await supabase.rpc("get_my_company_access");
  const row = data?.[0];
  if (error || !row) return null;
  return {
    isActive: row.is_active,
    lapsed: row.lapsed,
    blocked: row.blocked,
    graceDays: row.grace_days,
    accessUntil: row.access_until ?? null,
    today: row.today,
    kind: row.kind === "paid" || row.kind === "trial" ? row.kind : "none",
    period: {
      billing_cycle: row.billing_cycle ?? null,
      plan_paid_from: row.plan_paid_from ?? null,
      plan_expires_at: row.plan_expires_at ?? null,
      trial_ends_at: row.trial_ends_at ?? null,
      created_at: row.company_created_at ?? null,
    },
  };
}

// Varios componentes lo piden al mismo tiempo al abrir la app: comparten una sola llamada.
function fetchAccess(companyId: string, force: boolean): Promise<CompanyAccess | null> {
  if (!force && recent && recent.key === companyId && Date.now() - recent.at < DEDUPE_MS) return recent.promise;
  const promise = loadAccess();
  recent = { key: companyId, at: Date.now(), promise };
  return promise;
}

// null = no se pudo leer (sin empresa o error de red): quien lo use no debe bloquear a nadie por eso.
export function useCompanyAccess() {
  const { companyId, loading: companyLoading } = useCompany();
  const [access, setAccess] = useState<CompanyAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    if (companyLoading) return;
    if (!companyId) {
      setAccess(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchAccess(companyId, version > 0).then((result) => {
      if (!active) return;
      setAccess(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId, companyLoading, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { access, loading: loading || companyLoading, reload };
}
