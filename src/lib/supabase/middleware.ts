import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getRoleHomeRoute,
  isRouteAllowedForRole,
} from '@/lib/utils/roles';
import type { RolUsuarioEnum } from '@/types/database.types';
import { getSupabaseEnv } from './env';

const PROTECTED_ROUTES = [
  '/vendedor',
  '/despacho',
  '/produccion',
  '/admin',
] as const;

const VALID_ROLES = new Set<RolUsuarioEnum>([
  'VENDEDOR',
  'DESPACHADOR',
  'PRODUCCION',
  'ADMINISTRADOR',
]);

function extractRolFromMetadata(
  appMetadata: Record<string, unknown> | undefined,
  userMetadata: Record<string, unknown> | undefined
): RolUsuarioEnum | null {
  const rawRol = appMetadata?.rol ?? userMetadata?.rol;
  if (typeof rawRol === 'string' && VALID_ROLES.has(rawRol as RolUsuarioEnum)) {
    return rawRol as RolUsuarioEnum;
  }
  return null;
}

function redirectWithSessionCookies(
  request: NextRequest,
  pathname: string,
  supabaseResponse: NextResponse,
  redirectTo?: string
): NextResponse {
  const targetUrl = request.nextUrl.clone();
  targetUrl.pathname = pathname;
  targetUrl.search = '';
  if (redirectTo) {
    targetUrl.searchParams.set('redirectTo', redirectTo);
  }

  const redirectResponse = NextResponse.redirect(targetUrl);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  const { supabaseUrl, supabaseKey } = getSupabaseEnv();

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
        if (headers) {
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          );
        }
      },
    },
  });

  // Lectura ligera de sesión desde cookies JWT (refresca solo si el token expiró)
  // sin ejecutar consultas adicionales a PostgreSQL en cada navegación de pestaña.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const { pathname } = request.nextUrl;
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!user) {
    if (isProtectedRoute) {
      return redirectWithSessionCookies(
        request,
        '/login',
        supabaseResponse,
        pathname
      );
    }
    if (pathname === '/') {
      return redirectWithSessionCookies(request, '/login', supabaseResponse);
    }
    return supabaseResponse;
  }

  const rol = extractRolFromMetadata(user.app_metadata, user.user_metadata);

  if (rol) {
    const homeRoute = getRoleHomeRoute(rol);

    if (pathname === '/') {
      return redirectWithSessionCookies(request, homeRoute, supabaseResponse);
    }

    if (isProtectedRoute && !isRouteAllowedForRole(rol, pathname)) {
      return redirectWithSessionCookies(request, homeRoute, supabaseResponse);
    }
  } else if (pathname === '/') {
    return redirectWithSessionCookies(request, '/login', supabaseResponse);
  }

  return supabaseResponse;
}
