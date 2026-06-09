ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';

UPDATE public.user_roles
SET role = 'superadmin'
WHERE user_id = 'e2042823-2018-4021-b363-dac241f164a6';
