import { createClient } from '@supabase/supabase-js';

/**
 * Cliente administrativo de Supabase (Service Role) para operaciones
 * privilegiadas exclusivamente en el servidor (ej. creación de cuentas desde Administración).
 * NUNCA importar ni exponer en componentes cliente.
 */
export function createAdminClient() {
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

