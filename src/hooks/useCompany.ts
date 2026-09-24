import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useCompany() {
  const { user, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) {
      setCompanyId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setCompanyId((data as any)?.company_id ?? null);
        setLoading(false);
      });
    return () => { active = false; };
    // Supabase emite un evento de auth (con un objeto `user` nuevo, aunque
    // sea el mismo usuario) cada vez que la pestaña vuelve a estar visible
    // (auto-refresh de token). Depender del objeto entero re-disparaba este
    // fetch en cada cambio de pestaña; con el id alcanza y sobra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  return { companyId, loading: loading || authLoading };
}
