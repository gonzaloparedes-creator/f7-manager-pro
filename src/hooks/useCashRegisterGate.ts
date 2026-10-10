import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";

/**
 * Ajuste "Exigir caja abierta para cobrar" (companies.require_open_cash).
 * Solo corre mientras `active` es true (p. ej. con el dialog de cobro abierto)
 * para no sumar consultas a pantallas que no cobran.
 *
 * Regla: con el ajuste prendido (y plan que tenga Caja), hace falta una
 * apertura de HOY. Un usuario restringido a su sucursal necesita la de su
 * sucursal; el resto cuenta cualquier apertura del día.
 *
 * Si la consulta falla NO se bloquea: un corte de red no tiene que frenar una
 * venta. `check()` vuelve a consultar en el momento y devuelve si hay que
 * bloquear — es lo que conviene usar al confirmar el cobro.
 */
export function useCashRegisterGate(active: boolean) {
  const { user } = useAuth();
  const userId = user?.id;
  const { companyId } = useCompany();
  const [required, setRequired] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async (): Promise<boolean> => {
    if (!userId || !companyId) return false;
    const [companyRes, profileRes] = await Promise.all([
      supabase.from("companies").select("require_open_cash, plan_type").eq("id", companyId).maybeSingle(),
      supabase.from("profiles").select("branch_id, restrict_to_branch").eq("id", userId).maybeSingle(),
    ]);
    if (companyRes.error || !companyRes.data) return false;
    const needsOpening = companyRes.data.require_open_cash === true && companyRes.data.plan_type !== "starter";
    setRequired(needsOpening);
    if (!needsOpening) {
      setIsOpen(true);
      return false;
    }

    let query = supabase
      .from("cash_openings")
      .select("id")
      .eq("company_id", companyId)
      .eq("opening_date", format(new Date(), "yyyy-MM-dd"))
      .limit(1);
    if (profileRes.data?.restrict_to_branch) {
      query = profileRes.data.branch_id ? query.eq("branch_id", profileRes.data.branch_id) : query.is("branch_id", null);
    }
    const { data, error } = await query;
    if (error) return false;
    const open = (data ?? []).length > 0;
    setIsOpen(open);
    return !open;
  }, [userId, companyId]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    check().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active, check]);

  return { required, isOpen, blocked: required && !isOpen, loading, check };
}
