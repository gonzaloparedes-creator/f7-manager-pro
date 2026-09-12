import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * El stock disponible está oculto para el rol "staff" por defecto — el admin
 * lo habilita desde Configuración → Usuarios (companies.staff_can_view_stock).
 * Admin, recepción y superadmin siempre lo ven.
 */
export function useCanViewStock() {
  const { companyId, loading: companyLoading } = useCompany();
  const { role, loading: roleLoading } = useUserRole();
  const [staffCanViewStock, setStaffCanViewStock] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (companyLoading) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("companies")
      .select("staff_can_view_stock")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setStaffCanViewStock(!!(data as { staff_can_view_stock: boolean } | null)?.staff_can_view_stock);
        setLoading(false);
      });
    return () => { active = false; };
  }, [companyId, companyLoading]);

  const canViewStock = role !== "staff" || staffCanViewStock;
  return { canViewStock, loading: loading || roleLoading || companyLoading };
}
