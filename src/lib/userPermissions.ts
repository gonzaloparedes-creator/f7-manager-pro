export interface UserPermissionFlags {
  can_view_costs: boolean;
  can_give_discounts: boolean;
}

/**
 * Permisos finos por usuario (Configuración → Usuarios). Admin y superadmin
 * siempre pueden todo, sin importar los flags. Mientras no sepamos con certeza
 * el rol o los flags, todo queda cerrado (fail closed): mostrar un costo "un
 * instante" a quien no debería verlo es peor que mostrarlo un instante tarde.
 */
export function resolveUserPermissions(input: {
  loading: boolean;
  isAdmin: boolean;
  flags: UserPermissionFlags | null;
}): { canViewCosts: boolean; canGiveDiscounts: boolean } {
  if (input.loading) return { canViewCosts: false, canGiveDiscounts: false };
  if (input.isAdmin) return { canViewCosts: true, canGiveDiscounts: true };
  if (!input.flags) return { canViewCosts: false, canGiveDiscounts: false };
  return {
    canViewCosts: input.flags.can_view_costs,
    canGiveDiscounts: input.flags.can_give_discounts,
  };
}
