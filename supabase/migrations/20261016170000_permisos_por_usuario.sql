-- Permisos finos por usuario (B4): dos switches que el admin apaga por
-- empleado en Configuración → Usuarios.
--   can_view_costs      → "Ve costos y márgenes"
--   can_give_discounts  → "Puede dar descuentos y vender bajo el mínimo"
--
-- Ambos arrancan en true para todos (nadie pierde nada al migrar). Admin y
-- superadmin siempre ven y pueden todo, sin importar el valor del flag: lo
-- resuelve la pantalla, no la columna.
--
-- Solo la mitad "quién puede cambiar el flag" se impone en la base: un perfil
-- puede editar su propia fila (nombre, teléfono), así que sin este trigger un
-- empleado podría prenderse los permisos que el admin le apagó. Esconder los
-- costos / los descuentos en pantalla es solo de interfaz.

ALTER TABLE public.profiles
  ADD COLUMN can_view_costs boolean NOT NULL DEFAULT true,
  ADD COLUMN can_give_discounts boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.protect_user_permission_flags()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Service role / migraciones / SQL directo (sin usuario): se deja pasar.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.can_view_costs IS DISTINCT FROM OLD.can_view_costs
      OR NEW.can_give_discounts IS DISTINCT FROM OLD.can_give_discounts)
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar estos permisos';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_permission_flags
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_user_permission_flags();
