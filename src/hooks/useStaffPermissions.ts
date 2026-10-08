import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useUserRole } from "@/hooks/useUserRole";
import { useBranchRestriction } from "@/hooks/useBranchRestriction";

interface StaffFlags {
  staff_can_view_stock: boolean;
  staff_can_view_products: boolean;
  staff_can_view_gastos: boolean;
  staff_can_close_caja: boolean;
}

const DEFAULT_FLAGS: StaffFlags = {
  staff_can_view_stock: false,
  staff_can_view_products: true,
  staff_can_view_gastos: false,
  staff_can_close_caja: false,
};

/**
 * Permisos configurables por el admin para roles no-admin (Configuración →
 * Usuarios → companies.staff_can_*). Admin y superadmin nunca se ven
 * afectados.
 *
 * Stock/Productos solo restringen al rol "staff" (Recepción siempre tiene
 * acceso) — así se definió originalmente. Gastos/Cierre de caja, en
 * cambio, restringen tanto a "staff" como a "recepcion" (pedido explícito:
 * ambos roles quedan ocultos hasta que el admin los habilita).
 *
 * Un usuario con "Solo ve su sucursal" (encargado de sucursal) pierde la
 * administración de la empresa (Configuración), sea cual sea su rol. Caja y
 * Gastos los conserva, pero recortados a su sucursal (esas tablas tienen
 * branch_id; lo impone la RLS y lo respetan las pantallas).
 *
 * Mientras no sepamos con certeza el rol o los flags de la empresa, todo
 * queda en su estado más restrictivo ("fail closed") — con role=null sin
 * resolver todavía, tratarlo como "no es staff" mostraba datos un instante
 * a cualquiera antes de que la consulta de rol terminara.
 */
export function useStaffPermissions() {
  const { companyId, loading: companyLoading } = useCompany();
  const { role, loading: roleLoading } = useUserRole();
  const { restricted: branchRestricted, loading: restrictionLoading } = useBranchRestriction();
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
      .select("staff_can_view_stock, staff_can_view_products, staff_can_view_gastos, staff_can_close_caja")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const row = data as StaffFlags | null;
        setFlags({
          staff_can_view_stock: !!row?.staff_can_view_stock,
          staff_can_view_products: row?.staff_can_view_products ?? true,
          staff_can_view_gastos: !!row?.staff_can_view_gastos,
          staff_can_close_caja: !!row?.staff_can_close_caja,
        });
        setLoading(false);
      });
    return () => { active = false; };
  }, [companyId, companyLoading]);

  const stillLoading = loading || roleLoading || companyLoading || restrictionLoading;
  const isStaff = role === "staff";
  const isStaffOrRecepcion = role === "staff" || role === "recepcion";
  // La administración de la empresa (usuarios, sucursales, planes) no se puede
  // recortar por sucursal: un usuario restringido no la ve (la RLS también la bloquea).
  const notBranchRestricted = !stillLoading && !branchRestricted;
  return {
    canViewStock: !stillLoading && (!isStaff || flags.staff_can_view_stock),
    canViewProducts: !stillLoading && (!isStaff || flags.staff_can_view_products),
    canViewGastos: !stillLoading && (!isStaffOrRecepcion || flags.staff_can_view_gastos),
    canCloseCaja: !stillLoading && (!isStaffOrRecepcion || flags.staff_can_close_caja),
    canViewCaja: !stillLoading,
    canManageCompany: notBranchRestricted,
    branchRestricted,
    loading: stillLoading,
  };
}
