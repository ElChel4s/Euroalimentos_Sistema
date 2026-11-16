/**
 * Obtiene y valida las variables de entorno públicas requeridas por Supabase.
 */
export function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL o clave pública).'
    );
  }

  return { supabaseUrl, supabaseKey };
}

