import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface TableHealthResult {
  ok: boolean;
  count: number | null;
  error: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  } | null;
}

interface UsuarioDiagnostico {
  username: string;
  rol: string;
  activo: boolean;
  auth_id_vinculado: boolean;
}

/**
 * Endpoint permanente de diagnóstico de conectividad, tablas y RLS en Supabase.
 * GET /api/health-db
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const [usuariosRes, productosRes, clientesRes, pedidosRes] =
      await Promise.all([
        supabase
          .from('usuarios')
          .select('username, rol, activo, auth_id', { count: 'exact' })
          .order('id_usuario', { ascending: true }),
        supabase
          .from('productos')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true }),
      ]);

    const formatHealth = (res: {
      count: number | null;
      error: {
        message: string;
        code?: string;
        details?: string;
        hint?: string;
      } | null;
    }): TableHealthResult => ({
      ok: !res.error,
      count: res.count ?? null,
      error: res.error
        ? {
            message: res.error.message,
            code: res.error.code,
            details: res.error.details,
            hint: res.error.hint,
          }
        : null,
    });

    const tablas = {
      usuarios: formatHealth(usuariosRes),
      productos: formatHealth(productosRes),
      clientes: formatHealth(clientesRes),
      pedidos: formatHealth(pedidosRes),
    };

    const allOk = Object.values(tablas).every((t) => t.ok);

    const usuarios: UsuarioDiagnostico[] = (usuariosRes.data ?? []).map(
      (u) => ({
        username: String(u.username),
        rol: String(u.rol),
        activo: Boolean(u.activo),
        auth_id_vinculado: Boolean(u.auth_id),
      })
    );

    return NextResponse.json(
      {
        status: allOk ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        tablas,
        usuarios,
      },
      { status: allOk ? 200 : 500 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'Error inesperado al verificar la base de datos.';

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: message,
      },
      { status: 500 }
    );
  }
}
