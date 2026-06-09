-- Restore EXECUTE on SECURITY DEFINER helper functions used inside RLS policies.
-- Without EXECUTE, the authenticated role cannot evaluate policies that reference them,
-- which caused "permission denied for function get_user_company" on the dashboard.

GRANT EXECUTE ON FUNCTION public.get_user_company(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_branch(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_company_active(uuid) TO authenticated, anon;
