import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
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
  rol: RolUsuarioEnum;
  activo: boolean;
  creado_en: string;
  perfil_vendedor: PerfilVendedor | PerfilVendedor[] | null;
  perfil_despachador: PerfilDespachador | PerfilDespachador[] | null;
  perfil_produccion: PerfilProduccion | PerfilProduccion[] | null;
  perfil_administrador: PerfilAdministrador | PerfilAdministrador[] | null;
}

function normalizeOneToOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Obtiene en servidor el usuario activo autenticado junto con su perfil
 * especializado CTI (1:1) según su rol. Memorizado por request con `React.cache()`.
 * Retorna null si no existe sesión o está inactivo.
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

    const { data, error } = await supabase
      .from('usuarios')
      .select(
        `
      id_usuario,
      auth_id,
      nombre_completo,
      username,
      telefono,
      rol,
      activo,
      creado_en,
      perfil_vendedor (*),
      perfil_despachador (*),
      perfil_produccion (*),
      perfil_administrador (*)
    `
      )
      .eq('auth_id', user.id)
      .eq('activo', true)
      .maybeSingle<UsuarioConPerfilRaw>();

    if (error || !data) {
      return null;
    }

    return {
      id_usuario: data.id_usuario,
      auth_id: data.auth_id,
      nombre_completo: data.nombre_completo,
      username: data.username,
      telefono: data.telefono,
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

