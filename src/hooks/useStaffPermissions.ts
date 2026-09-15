import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useUserRole } from "@/hooks/useUserRole";

interface StaffFlags {
  staff_can_view_stock: boolean;
  staff_can_view_products: boolean;
}

const DEFAULT_FLAGS: StaffFlags = { staff_can_view_stock: false, staff_can_view_products: true };

/**
 * Permisos configurables por el admin para el rol "staff" (Configuración →
 * Usuarios → companies.staff_can_view_*). Admin, recepción y superadmin
 * nunca se ven afectados.
 *
 * Mientras no sepamos con certeza el rol o los flags de la empresa, todo
 * queda en su estado más restrictivo ("fail closed") — con role=null sin
 * resolver todavía, tratarlo como "no es staff" mostraba el stock un
 * instante a cualquiera antes de que la consulta de rol terminara.
 */
export function useStaffPermissions() {
  const { companyId, loading: companyLoading } = useCompany();
  const { role, loading: roleLoading } = useUserRole();
  const [flags, setFlags] = useState<StaffFlags>(DEFAULT_FLAGS);
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
      .select("staff_can_view_stock, staff_can_view_products")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const row = data as StaffFlags | null;
        setFlags({
          staff_can_view_stock: !!row?.staff_can_view_stock,
          staff_can_view_products: row?.staff_can_view_products ?? true,
        });
        setLoading(false);
      });
    return () => { active = false; };
  }, [companyId, companyLoading]);

  const stillLoading = loading || roleLoading || companyLoading;
  const isStaff = role === "staff";
  return {
    canViewStock: !stillLoading && (!isStaff || flags.staff_can_view_stock),
    canViewProducts: !stillLoading && (!isStaff || flags.staff_can_view_products),
    loading: stillLoading,
  };
}
