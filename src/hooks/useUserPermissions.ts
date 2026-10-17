import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { resolveUserPermissions, type UserPermissionFlags } from "@/lib/userPermissions";

/**
 * Switches por usuario que el admin apaga en Configuración → Usuarios
 * ("Ve costos y márgenes", "Puede dar descuentos y vender bajo el mínimo").
 * Solo ocultan/bloquean en pantalla: lo único que la base impone es quién
 * puede cambiar los switches (trigger de la migración 20261016170000).
 */
export function useUserPermissions() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [flags, setFlags] = useState<UserPermissionFlags | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) {
      setFlags(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (supabase as any)
      .from("profiles")
      .select("can_view_costs, can_give_discounts")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: { data: Partial<UserPermissionFlags> | null }) => {
        if (!active) return;
        setFlags(
          data
            ? { can_view_costs: data.can_view_costs ?? true, can_give_discounts: data.can_give_discounts ?? true }
            : null,
        );
        setLoading(false);
      });
    return () => { active = false; };
    // Ver comentario equivalente en useCompany.ts (depender del id, no del objeto user).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const stillLoading = loading || authLoading || roleLoading;
  return {
    ...resolveUserPermissions({ loading: stillLoading, isAdmin, flags }),
    loading: stillLoading,
  };
}
