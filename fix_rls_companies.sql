-- Habilitar RLS en companies si no estuviera habilitado
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Crear la política que permite a los superadmins actualizar cualquier empresa
CREATE POLICY "Superadmins can update companies" 
ON public.companies 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'superadmin'
  )
);

-- Si los superadmins también necesitan ver las empresas que no son la suya, 
-- agregamos una política de SELECT por las dudas.
CREATE POLICY "Superadmins can view all companies" 
ON public.companies 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'superadmin'
  )
);
