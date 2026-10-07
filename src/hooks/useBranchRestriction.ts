import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Encargado de sucursal: el admin le activa a un usuario "Solo ve su
 * sucursal" (Configuración → Usuarios). Es solo la mitad de pantalla — lo que
 * realmente lo impone son las políticas RLS de la migración
 * 20261006120000_encargado_de_sucursal.sql. Mientras no sepamos el valor,
 * `restricted` es false pero `loading` es true; quien decide qué mostrar tiene
 * que esperar a `loading` (fail closed del lado de los permisos).
 */
export function useBranchRestriction() {
  const { user, loading: authLoading } = useAuth();
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) {
      setRestricted(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("profiles")
      .select("restrict_to_branch")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setRestricted(!!data?.restrict_to_branch);
        setLoading(false);
      });
    return () => { active = false; };
    // Ver comentario equivalente en useCompany.ts (depender del id, no del objeto user).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  return { restricted, loading: loading || authLoading };
}
