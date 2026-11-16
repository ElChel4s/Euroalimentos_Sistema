import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type {
  CategoriaPreventaItem,
  ClientePreventaItem,
  ProductoPreventaItem,
  ZonaPreventaItem,
} from '@/actions/preventa.actions';
import { PreventaMobileForm } from '@/components/forms/PreventaMobileForm';
import { ModuleLoadingSkeleton } from '@/components/ui/ModuleLoadingSkeleton';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { FormatoProductoEnum } from '@/types/database.types';

interface ZonaRelationRaw {
  id_zona: number;
  nombre_zona: string;
}

interface ClienteRowRaw {
  id_cliente: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  id_zona: number;
  nit_ci: string | null;
  telefono: string | null;
  zonas_mercado: ZonaRelationRaw | ZonaRelationRaw[] | null;
}

interface CategoriaRelationRaw {
  nombre_categoria: string;
}

interface ProductoRowRaw {
  id_producto: number;
  codigo_sku: string;
  id_categoria: number;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  precio_kilo_bs: number;
  stock_disponible_kilos: number | null;
  categorias_producto: CategoriaRelationRaw | CategoriaRelationRaw[] | null;
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function NuevaVentaContent() {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'VENDEDOR' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    redirect('/login');
  }

  const supabase = await createClient();

  const [clientesRes, zonasRes, productosRes, categoriasRes] =
    await Promise.all([
      supabase
        .from('clientes')
        .select(
          'id_cliente, codigo_cliente_sac, nombre_comercial, id_zona, nit_ci, telefono, zonas_mercado(id_zona, nombre_zona)'
        )
        .eq('activo', true)
        .order('nombre_comercial', { ascending: true }),
      supabase
        .from('zonas_mercado')
        .select('id_zona, nombre_zona')
        .eq('activo', true)
        .order('nombre_zona', { ascending: true }),
      supabase
        .from('productos')
        .select(
          'id_producto, codigo_sku, id_categoria, nombre_producto, formato, precio_kilo_bs, stock_disponible_kilos, categorias_producto(nombre_categoria)'
        )
        .eq('activo', true)
        .order('nombre_producto', { ascending: true }),
      supabase
        .from('categorias_producto')
        .select('id_categoria, nombre_categoria')
        .order('nombre_categoria', { ascending: true }),
    ]);

  const queryError =
    clientesRes.error ??
    zonasRes.error ??
    productosRes.error ??
    categoriasRes.error;

  const clientesIniciales: ClientePreventaItem[] = (
    (clientesRes.data ?? []) as unknown as ClienteRowRaw[]
  ).map((c) => {
    const zonaRel = normalizeRelation(c.zonas_mercado);
    return {
      id_cliente: c.id_cliente,
      codigo_cliente_sac: c.codigo_cliente_sac,
      nombre_comercial: c.nombre_comercial,
      id_zona: c.id_zona,
      zona: zonaRel?.nombre_zona ?? 'Sin zona asignada',
      nit_ci: c.nit_ci,
      telefono: c.telefono,
      zonas_mercado: zonaRel,
    };
  });

  const zonas: ZonaPreventaItem[] = (
    (zonasRes.data ?? []) as unknown as ZonaPreventaItem[]
  ).map((z) => ({
    id_zona: z.id_zona,
    nombre_zona: z.nombre_zona,
  }));

  // RF-05: Aislamiento estricto — nunca enviar stock físico/comprometido/disponible numérico al cliente
  const productos: ProductoPreventaItem[] = (
    (productosRes.data ?? []) as unknown as ProductoRowRaw[]
  ).map((p) => {
    const catRel = normalizeRelation(p.categorias_producto);
    return {
      id_producto: p.id_producto,
      codigo_sku: p.codigo_sku,
      id_categoria: p.id_categoria,
      nombre_producto: p.nombre_producto,
      formato: p.formato,
      precio_kilo_bs: Number(p.precio_kilo_bs ?? 0),
      requiere_produccion: Number(p.stock_disponible_kilos ?? 0) <= 0,
      categorias_producto: catRel
        ? { nombre_categoria: catRel.nombre_categoria }
        : undefined,
    };
  });

  const categorias: CategoriaPreventaItem[] = (
    (categoriasRes.data ?? []) as unknown as CategoriaPreventaItem[]
  ).map((cat) => ({
    id_categoria: cat.id_categoria,
    nombre_categoria: cat.nombre_categoria,
  }));

  const codigoVendedor =
    usuario.perfil_vendedor?.codigo_vendedor ??
    (usuario.rol === 'ADMINISTRADOR'
      ? `ADM-${usuario.id_usuario}`
      : `VND-${usuario.id_usuario}`);
  const metaDiariaKilos = Number(
    usuario.perfil_vendedor?.meta_diaria_kilos ?? 0
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-3">
      {queryError && (
        <div
          role="alert"
          className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3.5 text-sm font-semibold text-amber-950"
        >
          Error al cargar datos de preventa: {queryError.message}
        </div>
      )}

      <PreventaMobileForm
        clientesIniciales={clientesIniciales}
        zonas={zonas}
        productos={productos}
        categorias={categorias}
        codigoVendedor={codigoVendedor}
        metaDiariaKilos={metaDiariaKilos}
      />
    </div>
  );
}

export default function NuevaVentaPage() {
  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton modulo="Sincronizando catálogo y clientes..." />
      }
    >
      <NuevaVentaContent />
    </Suspense>
  );
}
