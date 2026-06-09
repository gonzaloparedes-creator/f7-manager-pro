import { useUserRole } from "@/hooks/useUserRole";

export function useSuperAdmin() {
  const { isSuperAdmin, loading } = useUserRole();
  return { isSuperAdmin, loading };
}
