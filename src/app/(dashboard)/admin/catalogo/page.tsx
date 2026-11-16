import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import type {
  ClienteSacAdminRow,
  ProductoCatalogoAdminRow,
  UsuarioSistemaAdminRow,
  ZonaMercadoAdminRow,
} from '@/actions/admin.actions';
import { CatalogoAdminClient } from '@/components/admin/CatalogoAdminClient';
import { ModuleLoadingSkeleton } from '@/components/ui/ModuleLoadingSkeleton';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type {
  FormatoProductoEnum,
  RolUsuarioEnum,
} from '@/types/database.types';

interface ProductoQueryRaw {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  precio_kilo_bs: number;
  stock_fisico_kilos: number;
  stock_disponible_kilos: number | null;
  activo: boolean;
}

interface UsuarioQueryRaw {
  id_usuario: number;
  nombre_completo: string;
  username: string;
  telefono: string | null;
  rol: RolUsuarioEnum;
  activo: boolean;
  requiere_cambio_clave?: boolean;
}

interface ZonaQueryRaw {
  id_zona: number;
  nombre_zona: string;
  ciudad: string;
  activo: boolean;
}

interface ClienteQueryRaw {
  id_cliente: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  nit_ci: string | null;
  telefono: string | null;
  id_zona: number;
  activo: boolean;
}

async function AdminCatalogoContent() {
  const usuario = await getUsuarioConPerfilActivo();
  if (!usuario || usuario.rol !== 'ADMINISTRADOR') {
    redirect('/login');
  }

  const supabase = await createClient();

  const [productosRes, usuariosResConFlag, zonasRes, clientesRes] =
    await Promise.all([
      supabase
        .from('productos')
        .select(
          'id_producto, codigo_sku, nombre_producto, formato, precio_kilo_bs, stock_fisico_kilos, stock_disponible_kilos, activo'
        )
        .in('formato', ['GRANEL', 'VACIO'])
        .order('id_producto', { ascending: true }),
      supabase
        .from('usuarios')
        .select(
          'id_usuario, nombre_completo, username, telefono, rol, activo, requiere_cambio_clave'
        )
        .order('id_usuario', { ascending: true }),
      supabase
        .from('zonas_mercado')
        .select('id_zona, nombre_zona, ciudad, activo')
        .order('nombre_zona', { ascending: true }),
      supabase
        .from('clientes')
        .select(
          'id_cliente, codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo'
        )
        .order('id_cliente', { ascending: false }),
    ]);

  let usuariosRowsRaw: UsuarioQueryRaw[] = [];
  let usuariosError = usuariosResConFlag.error;
  let migracionPendiente = false;

  if (
    usuariosError &&
    (usuariosError.message ?? '').toLowerCase().includes('requiere_cambio_clave')
  ) {
    migracionPendiente = true;
    const fallbackUsers = await supabase
      .from('usuarios')
      .select('id_usuario, nombre_completo, username, telefono, rol, activo')
      .order('id_usuario', { ascending: true });
    usuariosRowsRaw = (fallbackUsers.data ?? []) as UsuarioQueryRaw[];
    usuariosError = fallbackUsers.error;
  } else {
    usuariosRowsRaw = (usuariosResConFlag.data ?? []) as UsuarioQueryRaw[];
  }

  const primerError =
    productosRes.error?.message ??
    usuariosError?.message ??
    zonasRes.error?.message ??
    clientesRes.error?.message;

  if (primerError) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-2xl rounded-2xl border-2 border-red-200 bg-white p-6 text-center shadow-sm"
      >
        <AlertTriangle className="mx-auto h-10 w-10 text-[#C8102E]" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Error al cargar Gestión Maestra
        </h1>
        <p className="mt-1 text-sm text-slate-600">{primerError}</p>
      </div>
    );
  }

  const productos: ProductoCatalogoAdminRow[] = (
    (productosRes.data ?? []) as ProductoQueryRaw[]
  ).map((p) => ({
    id_producto: p.id_producto,
    codigo_sku: p.codigo_sku,
    nombre_producto: p.nombre_producto,
    formato: p.formato === 'VACIO' ? 'VACIO' : 'GRANEL',
    precio_kilo_bs: Number(p.precio_kilo_bs ?? 0),
    stock_fisico_kilos: Number(p.stock_fisico_kilos ?? 0),
    stock_disponible_kilos: Number(p.stock_disponible_kilos ?? 0),
    activo: Boolean(p.activo),
  }));

  const usuarios: UsuarioSistemaAdminRow[] = usuariosRowsRaw.map((u) => ({
    id_usuario: u.id_usuario,
    nombre_completo: u.nombre_completo,
    username: u.username,
    telefono: u.telefono ?? '',
    rol: u.rol,
    activo: Boolean(u.activo),
    requiere_cambio_clave: Boolean(u.requiere_cambio_clave),
  }));

  const zonas: ZonaMercadoAdminRow[] = (
    (zonasRes.data ?? []) as ZonaQueryRaw[]
  ).map((z) => ({
    id_zona: z.id_zona,
    nombre_zona: z.nombre_zona,
    ciudad: z.ciudad,
    activo: Boolean(z.activo),
  }));

  const clientes: ClienteSacAdminRow[] = (
    (clientesRes.data ?? []) as ClienteQueryRaw[]
  ).map((c) => ({
    id_cliente: c.id_cliente,
    codigo_cliente_sac: c.codigo_cliente_sac,
    nombre_comercial: c.nombre_comercial,
    nit_ci: c.nit_ci ?? '',
    telefono: c.telefono ?? '',
    id_zona: c.id_zona,
    activo: Boolean(c.activo),
  }));

  return (
    <CatalogoAdminClient
      productosIniciales={productos}
      usuariosIniciales={usuarios}
      zonasIniciales={zonas}
      clientesIniciales={clientes}
      usuarioActualId={usuario.id_usuario}
      migracionPendiente={migracionPendiente}
    />
  );
}

export default function AdminCatalogoPage() {
  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton modulo="Cargando gestión maestra del sistema..." />
      }
    >
      <AdminCatalogoContent />
    </Suspense>
  );
}
