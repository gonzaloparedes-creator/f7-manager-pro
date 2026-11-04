-- Permisos de signup_invites (20261104120000). En este proyecto las tablas nuevas no reciben
-- SELECT/INSERT/UPDATE para authenticated por defecto (quedó "Dxtm"), así que el panel del
-- super admin daba "permission denied". Igual que subscription_receipts y las tablas f7_*:
-- se otorga explícito y la política RLS sigue limitando todo al super admin.
-- anon sigue sin acceso a la tabla; la página de registro usa get_signup_invite().
GRANT SELECT, INSERT, UPDATE ON public.signup_invites TO authenticated;
GRANT ALL ON public.signup_invites TO service_role;
