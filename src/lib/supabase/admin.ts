import { createClient } from '@supabase/supabase-js';

/**
 * Cliente administrativo de Supabase (Service Role) para operaciones
 * privilegiadas exclusivamente en el servidor (ej. resolución de perfil tras login,
 * vinculación de `auth_id` y administración de cuentas).
 * NUNCA importar ni exponer en componentes cliente.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Faltan variables de entorno del servidor (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY).'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** Alias retrocompatible para módulos servidores existentes. */
export const createAdminClient = createSupabaseAdminClient;
