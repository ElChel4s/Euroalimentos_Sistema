'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getRoleHomeRoute } from '@/lib/utils/roles';
import type { RolUsuarioEnum } from '@/types/database.types';

export type AuthActionState = {
  error?: string;
} | null;

interface UsuarioAuthRow {
  id_usuario: number;
  auth_id: string | null;
  rol: RolUsuarioEnum;
  activo: boolean;
}

/**
 * Autentica al operador con usuario corto o correo electrónico y lo redirige
 * al módulo correspondiente a su rol en `usuarios`.
 */
export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const identifier = String(formData.get('identifier') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!identifier || !password) {
    return { error: 'Ingrese su usuario/correo y contraseña.' };
  }

  const email = identifier.includes('@')
    ? identifier.trim().toLowerCase()
    : `${identifier.trim().toLowerCase()}@euroalimentos.com`;

  const supabase = await createClient();

  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !data.user) {
    console.error(
      '[AUTH ERROR]:',
      signInError?.message ?? 'signInWithPassword no devolvió usuario',
      { email }
    );
    return {
      error: 'Credenciales inválidas. Verifique su usuario y contraseña.',
    };
  }

  const authUserId = data.user.id;
  const username = email.split('@')[0];

  const { data: usuarioByAuth, error: authLookupError } = await supabase
    .from('usuarios')
    .select('id_usuario, auth_id, rol, activo')
    .eq('auth_id', authUserId)
    .maybeSingle<UsuarioAuthRow>();

  if (authLookupError) {
    console.error('[AUTH DB ERROR - auth_id]:', authLookupError.message, {
      code: authLookupError.code,
      authUserId,
    });
    await supabase.auth.signOut();
    return {
      error: 'No se pudo verificar el perfil del usuario. Intente nuevamente.',
    };
  }

  let usuario = usuarioByAuth;

  // Autovinculación inicial por username (insensible a mayúsculas) si no se encontró por auth_id
  if (!usuario) {
    const { data: usuarioEncontrado, error: usernameError } = await supabase
      .from('usuarios')
      .select('id_usuario, auth_id, rol, activo')
      .ilike('username', username)
      .maybeSingle<UsuarioAuthRow>();

    if (usernameError) {
      console.error('[AUTH DB ERROR - username]:', usernameError.message, {
        code: usernameError.code,
        username,
      });
    }

    if (!usernameError && usuarioEncontrado) {
      const { error: linkError } = await supabase
        .from('usuarios')
        .update({ auth_id: authUserId })
        .eq('id_usuario', usuarioEncontrado.id_usuario);

      if (linkError) {
        console.error('[AUTH LINK ERROR]:', linkError.message, {
          code: linkError.code,
          id_usuario: usuarioEncontrado.id_usuario,
        });
      }

      // Continúa el flujo normal sin rechazar al usuario encontrado por username
      usuario = { ...usuarioEncontrado, auth_id: authUserId };
    }
  }

  if (!usuario) {
    console.error('[AUTH PROFILE MISSING]:', {
      email,
      authUserId,
      username,
    });
    await supabase.auth.signOut();
    return {
      error: `El usuario '${username}' existe en Auth pero no está registrado en la tabla public.usuarios.`,
    };
  }

  if (usuario.activo === false) {
    await supabase.auth.signOut();
    return { error: 'Su cuenta está desactivada. Contacte a Gerencia.' };
  }

  // Sincroniza rol e id_usuario en user_metadata para validación instantánea en proxy.ts
  const metaRol = data.user.user_metadata?.rol;
  const metaId = data.user.user_metadata?.id_usuario;
  if (metaRol !== usuario.rol || metaId !== usuario.id_usuario) {
    await supabase.auth.updateUser({
      data: {
        rol: usuario.rol,
        id_usuario: usuario.id_usuario,
      },
    });
  }

  revalidatePath('/', 'layout');
  redirect(getRoleHomeRoute(usuario.rol));
}

/**
 * Cierra la sesión activa en Supabase y redirige al login corporativo.
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export interface CrearUsuarioEmpleadoInput {
  nombre_completo: string;
  username: string;
  password: string;
  telefono?: string;
  rol: RolUsuarioEnum;
  meta_cti?: Record<string, unknown>;
}

export interface CrearUsuarioEmpleadoResult {
  ok: boolean;
  userId?: string;
  email?: string;
  error?: string;
}

/**
 * Crea un empleado en Supabase Auth usando Service Role para disparar el
 * trigger `on_auth_user_created` (inserción en `usuarios` + perfil CTI 1:1).
 * Requiere sesión activa con rol `ADMINISTRADOR`.
 */
export async function crearUsuarioEmpleadoAction(
  input: CrearUsuarioEmpleadoInput
): Promise<CrearUsuarioEmpleadoResult> {
  const actor = await getUsuarioConPerfilActivo();
  if (!actor || actor.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Acceso denegado: solo ADMINISTRADOR puede registrar usuarios.',
    };
  }

  const nombreCompleto = input.nombre_completo.trim();
  const normalizedUsername = input.username.trim().toLowerCase();

  if (!nombreCompleto || !normalizedUsername || input.password.length < 6) {
    return {
      ok: false,
      error:
        'Complete nombre, usuario y una contraseña de al menos 6 caracteres.',
    };
  }

  const email = `${normalizedUsername}@euroalimentos.com`;

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        ...(input.meta_cti ?? {}),
        nombre_completo: nombreCompleto,
        username: normalizedUsername,
        telefono: input.telefono?.trim() || null,
        rol: input.rol,
      },
    });

    if (error || !data.user) {
      console.error('[ADMIN CREATE USER ERROR]:', error?.message, { email });
      return {
        ok: false,
        error: error?.message ?? 'No se pudo crear el usuario en Supabase Auth.',
      };
    }

    revalidatePath('/admin/catalogo');
    return {
      ok: true,
      userId: data.user.id,
      email,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'Error inesperado al crear el usuario.';
    console.error('[ADMIN CREATE USER EXCEPTION]:', message);
    return { ok: false, error: message };
  }
}

export interface VerificarUsuarioLoginData {
  username: string;
  nombre_completo: string;
  rol: RolUsuarioEnum;
  requiere_cambio_clave: boolean;
}

export type VerificarUsuarioLoginResult =
  | { ok: true; data: VerificarUsuarioLoginData }
  | { ok: false; error: string };

interface RpcVerificarUsuarioRaw {
  encontrado?: boolean;
  id_usuario?: number;
  username?: string;
  nombre_completo?: string;
  rol?: RolUsuarioEnum;
  activo?: boolean;
  requiere_cambio_clave?: boolean;
  error?: string;
}

/**
 * Paso 1 del Login: valida la existencia y estado activo de `username`
 * y detecta si Gerencia autorizó un cambio de contraseña (`requiere_cambio_clave`).
 */
export async function verificarUsuarioLoginAction(
  usernameInput: string
): Promise<VerificarUsuarioLoginResult> {
  const cleanRaw = (usernameInput ?? '').trim().toLowerCase().replace(/\s+/g, '');
  const cleanUsername = cleanRaw.includes('@')
    ? cleanRaw.split('@')[0]
    : cleanRaw;

  if (!cleanUsername) {
    return {
      ok: false,
      error: 'Ingrese su nombre de usuario para continuar.',
    };
  }

  // Si está configurada la Service Role Key, se puede consultar directamente
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('usuarios')
      .select('username, nombre_completo, rol, activo, requiere_cambio_clave')
      .ilike('username', cleanUsername)
      .maybeSingle<{
        username: string;
        nombre_completo: string;
        rol: RolUsuarioEnum;
        activo: boolean;
        requiere_cambio_clave?: boolean;
      }>();

    if (error) {
      return {
        ok: false,
        error: 'No se pudo verificar el usuario. Intente nuevamente.',
      };
    }

    if (!data) {
      return {
        ok: false,
        error: 'El usuario ingresado no existe en el sistema.',
      };
    }

    if (data.activo === false) {
      return {
        ok: false,
        error: 'Esta cuenta se encuentra desactivada. Contacte a Gerencia.',
      };
    }

    return {
      ok: true,
      data: {
        username: data.username,
        nombre_completo: data.nombre_completo,
        rol: data.rol,
        requiere_cambio_clave: Boolean(data.requiere_cambio_clave),
      },
    };
  }

  // Camino estándar seguro con clave anon: RPC SECURITY DEFINER
  const supabase = await createClient();
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'rpc_verificar_usuario_login',
    { p_username: cleanUsername }
  );

  if (rpcError) {
    console.error('[VERIFICAR USUARIO LOGIN RPC ERROR]:', rpcError.message);
    const msgLower = (rpcError.message ?? '').toLowerCase();
    if (
      rpcError.code === 'PGRST202' ||
      msgLower.includes('could not find the function') ||
      msgLower.includes('does not exist')
    ) {
      return {
        ok: false,
        error:
          'Falta aplicar la migración supabase/migrations/add_requiere_cambio_clave.sql en Supabase.',
      };
    }
    return {
      ok: false,
      error: 'No se pudo validar el usuario. Intente nuevamente.',
    };
  }

  const res = (rpcData ?? {}) as RpcVerificarUsuarioRaw;
  if (!res.encontrado) {
    return {
      ok: false,
      error: res.error || 'El usuario ingresado no existe en el sistema.',
    };
  }

  if (res.activo === false) {
    return {
      ok: false,
      error: 'Esta cuenta se encuentra desactivada. Contacte a Gerencia.',
    };
  }

  return {
    ok: true,
    data: {
      username: res.username ?? cleanUsername,
      nombre_completo: res.nombre_completo ?? cleanUsername,
      rol: res.rol ?? 'VENDEDOR',
      requiere_cambio_clave: Boolean(res.requiere_cambio_clave),
    },
  };
}

export interface CompletarCambioClaveInput {
  username: string;
  nueva_password: string;
  confirmar_password: string;
}

/**
 * Paso 2B del Login: actualiza contraseña cuando `requiere_cambio_clave = true`,
 * limpia el flag, inicia sesión automáticamente y redirige al módulo del rol.
 */
export async function completarCambioClaveYLoginAction(
  input: CompletarCambioClaveInput
): Promise<{ error?: string }> {
  const cleanRaw = (input.username ?? '').trim().toLowerCase().replace(/\s+/g, '');
  const cleanUsername = cleanRaw.includes('@')
    ? cleanRaw.split('@')[0]
    : cleanRaw;

  const nuevaPassword = input.nueva_password ?? '';
  const confirmarPassword = input.confirmar_password ?? '';

  if (!cleanUsername) {
    return { error: 'Identificador de usuario inválido.' };
  }

  if (nuevaPassword.length < 6) {
    return {
      error: 'La nueva contraseña debe tener al menos 6 caracteres.',
    };
  }

  if (nuevaPassword !== confirmarPassword) {
    return {
      error: 'Las contraseñas ingresadas no coinciden.',
    };
  }

  const email = `${cleanUsername}@euroalimentos.com`;
  let rolUsuario: RolUsuarioEnum = 'VENDEDOR';
  let idUsuario = 0;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const adminClient = createAdminClient();
    const { data: userRow, error: lookupErr } = await adminClient
      .from('usuarios')
      .select('id_usuario, auth_id, username, rol, activo, requiere_cambio_clave')
      .ilike('username', cleanUsername)
      .maybeSingle<{
        id_usuario: number;
        auth_id: string | null;
        username: string;
        rol: RolUsuarioEnum;
        activo: boolean;
        requiere_cambio_clave?: boolean;
      }>();

    if (lookupErr || !userRow) {
      return { error: 'El usuario ingresado no existe en el sistema.' };
    }
    if (!userRow.activo) {
      return {
        error: 'Esta cuenta se encuentra desactivada. Contacte a Gerencia.',
      };
    }
    if (!userRow.requiere_cambio_clave) {
      return {
        error: 'Esta cuenta no tiene habilitado un cambio de contraseña.',
      };
    }

    if (userRow.auth_id) {
      const { error: updAuthErr } =
        await adminClient.auth.admin.updateUserById(userRow.auth_id, {
          password: nuevaPassword,
          email_confirm: true,
        });
      if (updAuthErr) {
        return { error: updAuthErr.message };
      }
    }

    const { error: updDbErr } = await adminClient
      .from('usuarios')
      .update({ requiere_cambio_clave: false })
      .eq('id_usuario', userRow.id_usuario);

    if (updDbErr) {
      return { error: updDbErr.message };
    }

    rolUsuario = userRow.rol;
    idUsuario = userRow.id_usuario;
  } else {
    const supabaseRpc = await createClient();
    const { data: rpcRes, error: rpcErr } = await supabaseRpc.rpc(
      'rpc_completar_cambio_clave_login',
      {
        p_username: cleanUsername,
        p_nueva_password: nuevaPassword,
      }
    );

    if (rpcErr) {
      return {
        error:
          rpcErr.message ||
          'No se pudo actualizar la contraseña. Contacte a Gerencia.',
      };
    }

    const parsed = (rpcRes ?? {}) as {
      id_usuario?: number;
      rol?: RolUsuarioEnum;
    };
    rolUsuario = parsed.rol ?? 'VENDEDOR';
    idUsuario = Number(parsed.id_usuario ?? 0);
  }

  // Iniciar sesión automáticamente con la nueva contraseña
  const supabase = await createClient();
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password: nuevaPassword,
    });

  if (signInError || !signInData.user) {
    return {
      error:
        'La clave se actualizó, pero no se pudo iniciar sesión automáticamente. Ingresa nuevamente.',
    };
  }

  if (idUsuario > 0) {
    await supabase.auth.updateUser({
      data: {
        rol: rolUsuario,
        id_usuario: idUsuario,
      },
    });
  }

  revalidatePath('/', 'layout');
  redirect(getRoleHomeRoute(rolUsuario));
}

export async function completarCambioClaveFormAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  return completarCambioClaveYLoginAction({
    username: String(formData.get('username') ?? ''),
    nueva_password: String(formData.get('nueva_password') ?? ''),
    confirmar_password: String(formData.get('confirmar_password') ?? ''),
  });
}

