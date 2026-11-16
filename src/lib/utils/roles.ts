import type { RolUsuarioEnum } from '@/types/database.types';

export const ROLE_HOME_ROUTES: Record<RolUsuarioEnum, string> = {
  VENDEDOR: '/vendedor/nueva-venta',
  DESPACHADOR: '/despacho',
  PRODUCCION: '/produccion/lotes',
  ADMINISTRADOR: '/admin/historial',
};

export const ROLE_ALLOWED_PREFIX: Record<RolUsuarioEnum, string> = {
  VENDEDOR: '/vendedor',
  DESPACHADOR: '/despacho',
  PRODUCCION: '/produccion',
  ADMINISTRADOR: '/admin',
};

/**
 * Devuelve la ruta inicial correspondiente al rol operativo del usuario.
 */
export function getRoleHomeRoute(rol: RolUsuarioEnum): string {
  return ROLE_HOME_ROUTES[rol] ?? '/login';
}

/**
 * Verifica si un rol tiene permiso para acceder a un pathname dado.
 */
export function isRouteAllowedForRole(
  rol: RolUsuarioEnum,
  pathname: string
): boolean {
  const prefix = ROLE_ALLOWED_PREFIX[rol];
  if (!prefix) return false;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
