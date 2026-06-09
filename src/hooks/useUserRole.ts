import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "staff" | "superadmin";

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!active) return;
        const roles = (data ?? []).map((r) => r.role as AppRole);
        if (roles.includes("superadmin")) setRole("superadmin");
        else if (roles.includes("admin")) setRole("admin");
        else if (roles.length > 0) setRole(roles[0]);
        else setRole(null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  return { 
    role, 
    loading: loading || authLoading, 
    isAdmin: role === "admin" || role === "superadmin",
    isSuperAdmin: role === "superadmin"
  };
}
