import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fetchAllPages } from "@/lib/fetchAllPages";
import type { CommissionSettlement } from "@/lib/commissionSettlements";

// Los tipos generados de Supabase no incluyen todavía commission_settlements.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useCommissionSettlements(companyId: string | null, enabled: boolean) {
  const [settlements, setSettlements] = useState<CommissionSettlement[]>([]);
  const { toast } = useToast();

  const reload = useCallback(async () => {
    if (!companyId || !enabled) {
      setSettlements([]);
      return;
    }
    try {
      const rows = await fetchAllPages<CommissionSettlement>((a, b) =>
        db
          .from("commission_settlements")
          .select("id, user_id, user_name, period_from, period_to, base_amount, rate, amount, notes, created_at, voided_at")
          .eq("company_id", companyId)
          .order("period_to", { ascending: false })
          .order("id", { ascending: true })
          .range(a, b),
      );
      setSettlements(rows.map((r) => ({ ...r, base_amount: Number(r.base_amount), rate: Number(r.rate), amount: Number(r.amount) })));
    } catch (e) {
      toast({ title: "No se pudieron cargar las liquidaciones", description: (e as { message?: string })?.message, variant: "destructive" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, enabled]);

  useEffect(() => { reload(); }, [reload]);

  return { settlements, reload };
}

