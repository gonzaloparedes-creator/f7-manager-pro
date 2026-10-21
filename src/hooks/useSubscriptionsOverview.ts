import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Una empresa con su plan, su prueba y lo que hace falta para escribirle.
export interface SubscriptionCompany {
  id: string;
  name: string;
  created_at: string;
  plan_type: string;
  is_active: boolean;
  is_paying: boolean;
  founder_cohort: boolean;
  billing_cycle: string | null;
  plan_paid_from: string | null;
  plan_expires_at: string | null;
  trial_ends_at: string | null;
  admin_name: string | null;
  admin_phone: string | null;
  orders_count: number;
  last_order_at: string | null;
  last_contact_at: string | null;
  last_contact_kind: string | null;
}

const COMPANY_COLUMNS =
  "id, name, created_at, plan_type, is_active, is_paying, founder_cohort, billing_cycle, plan_paid_from, plan_expires_at, trial_ends_at";

type CompanyBase = Omit<
  SubscriptionCompany,
  "admin_name" | "admin_phone" | "orders_count" | "last_order_at" | "last_contact_at" | "last_contact_kind"
>;

export function useSubscriptionsOverview(enabled: boolean) {
  const [companies, setCompanies] = useState<SubscriptionCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const [companiesRes, overviewRes] = await Promise.all([
      supabase.from("companies").select(COMPANY_COLUMNS).order("created_at", { ascending: false }),
      supabase.rpc("superadmin_followup_overview"),
    ]);
    setLoading(false);
    if (companiesRes.error || overviewRes.error) {
      setFailed(true);
      return;
    }
    const byCompany = new Map((overviewRes.data ?? []).map((row) => [row.company_id, row]));
    setCompanies(
      ((companiesRes.data ?? []) as CompanyBase[]).map((c) => {
        const extra = byCompany.get(c.id);
        return {
          ...c,
          admin_name: extra?.admin_name ?? null,
          admin_phone: extra?.admin_phone ?? null,
          orders_count: Number(extra?.orders_count ?? 0),
          last_order_at: extra?.last_order_at ?? null,
          last_contact_at: extra?.last_contact_at ?? null,
          last_contact_kind: extra?.last_contact_kind ?? null,
        };
      })
    );
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  const patchCompany = useCallback((id: string, patch: Partial<SubscriptionCompany>) => {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  return { companies, loading, failed, reload, patchCompany };
}
