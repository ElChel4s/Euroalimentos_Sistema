import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseEnv } from './env';

export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseKey } = getSupabaseEnv();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // El método setAll fue invocado desde un Server Component.
          // Puede ignorarse si el middleware refresca la sesión del usuario.
        }
      },
    },
  });
}
