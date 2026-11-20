import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type {
  PerfilAdministrador,
  PerfilDespachador,
  PerfilProduccion,
  PerfilVendedor,
  RolUsuarioEnum,
  UsuarioConPerfil,
} from '@/types/database.types';

interface UsuarioConPerfilRaw {
  id_usuario: number;
  auth_id: string | null;
  nombre_completo: string;
  username: string;
  telefono: string | null;
  codigo_empleado_sac: string | null;
  rol: RolUsuarioEnum;
  activo: boolean;
  creado_en: string;
  perfil_vendedor: PerfilVendedor | PerfilVendedor[] | null;
  perfil_despachador: PerfilDespachador | PerfilDespachador[] | null;
  perfil_produccion: PerfilProduccion | PerfilProduccion[] | null;
  perfil_administrador: PerfilAdministrador | PerfilAdministrador[] | null;
}

const USUARIO_CON_PERFIL_SELECT = `
  id_usuario,
  auth_id,
  nombre_completo,
  username,
  telefono,
  codigo_empleado_sac,
  rol,
  activo,
  creado_en,
  perfil_vendedor (*),
  perfil_despachador (*),
  perfil_produccion (*),
  perfil_administrador (*)
`;

function normalizeOneToOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Obtiene en servidor el usuario activo autenticado junto con su perfil
 * especializado CTI (1:1) según su rol. Memorizado por request con `React.cache()`.
 * Usa cliente administrativo en servidor para evitar bloqueos RLS tras resiembra de usuarios.
 */
export const getUsuarioConPerfilActivo = cache(
  async (): Promise<UsuarioConPerfil | null> => {
    await connection();

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const dbClient = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseAdminClient()
      : supabase;

    let { data, error } = await dbClient
      .from('usuarios')
      .select(USUARIO_CON_PERFIL_SELECT)
      .eq('auth_id', user.id)
      .eq('activo', true)
      .maybeSingle<UsuarioConPerfilRaw>();

    // Fallback por username (desde el correo Auth) si el auth_id aún no está vinculado
    if ((!data || error) && user.email) {
      const usernameFromEmail = user.email.split('@')[0]?.trim().toLowerCase();
      if (usernameFromEmail) {
        const fallback = await dbClient
          .from('usuarios')
          .select(USUARIO_CON_PERFIL_SELECT)
          .ilike('username', usernameFromEmail)
          .eq('activo', true)
          .maybeSingle<UsuarioConPerfilRaw>();

        if (!fallback.error && fallback.data) {
          await dbClient
            .from('usuarios')
            .update({ auth_id: user.id })
            .eq('id_usuario', fallback.data.id_usuario);
          data = { ...fallback.data, auth_id: user.id };
          error = null;
        }
      }
    }

    if (error || !data) {
      return null;
    }

    return {
      id_usuario: data.id_usuario,
      auth_id: data.auth_id,
      nombre_completo: data.nombre_completo,
      username: data.username,
      telefono: data.telefono,
      codigo_empleado_sac: data.codigo_empleado_sac ?? null,
      rol: data.rol,
      activo: data.activo,
      creado_en: data.creado_en,
      perfil_vendedor: normalizeOneToOne(data.perfil_vendedor),
      perfil_despachador: normalizeOneToOne(data.perfil_despachador),
      perfil_produccion: normalizeOneToOne(data.perfil_produccion),
      perfil_administrador: normalizeOneToOne(data.perfil_administrador),
    };
  }
);

/**
 * Exige que exista un usuario activo cuyo rol coincida con `rolRequerido`;
 * de lo contrario redirige a `/login`.
 */
export async function requireRolUsuario(
  rolRequerido: RolUsuarioEnum
): Promise<UsuarioConPerfil> {
  const usuario = await getUsuarioConPerfilActivo();
  if (!usuario || usuario.rol !== rolRequerido) {
    redirect('/login');
  }
  return usuario;
}
