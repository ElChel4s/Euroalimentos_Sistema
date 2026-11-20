import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Printer } from 'lucide-react';
import { EstacionPesajeClient } from '@/components/despacho/EstacionPesajeClient';
import { ModuleLoadingSkeleton } from '@/components/ui/ModuleLoadingSkeleton';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import {
  buildPerfilDespachadorResumen,
  mapPedidoDespachoRow,
  mapProductosCatalogoPesaje,
  PEDIDO_DESPACHO_SELECT,
  type PedidoDespachoRowRaw,
  type ProductoCatalogoRowRaw,
} from '@/lib/despacho/mappers';
import { createClient } from '@/lib/supabase/server';

interface DespachoPedidoPageProps {
  params: Promise<{ id: string }>;
}

async function EstacionPesajeContent({ idParam }: { idParam: string }) {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'DESPACHADOR' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    redirect('/login');
  }

  const pedidoId = Number(idParam);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return (
      <div className="rounded-2xl border-2 border-red-200 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-[#C8102E]" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Número de pedido inválido
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          El identificador &ldquo;{idParam}&rdquo; no corresponde a un pedido
          válido.
        </p>
        <Link
          href="/despacho"
          className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-[#FFCD00]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a Bandeja de Despacho</span>
        </Link>
      </div>
    );
  }

  const supabase = await createClient();

  const [pedidoRes, productosRes] = await Promise.all([
    supabase
      .from('pedidos')
      .select(PEDIDO_DESPACHO_SELECT)
      .eq('id_pedido', pedidoId)
      .maybeSingle(),
    supabase
      .from('productos')
      .select(
        'id_producto, codigo_sku, nombre_producto, formato, unidad_medida, peso_unidad_kilos, precio_kilo_bs, stock_fisico_kilos'
      )
      .eq('activo', true)
      .order('nombre_producto', { ascending: true }),
  ]);

  if (pedidoRes.error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 text-amber-950"
      >
        <p className="text-sm font-bold">
          No se pudo consultar el pedido #{pedidoId}: {pedidoRes.error.message}
        </p>
        <Link
          href="/despacho"
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a Bandeja</span>
        </Link>
      </div>
    );
  }

  if (!pedidoRes.data) {
    return (
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Pedido #{pedidoId} no encontrado
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Verifique que el pedido exista o vuelva a la Bandeja Consolidada.
        </p>
        <Link
          href="/despacho"
          className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#C8102E] px-4 text-sm font-black text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a Bandeja</span>
        </Link>
      </div>
    );
  }

  const pedido = mapPedidoDespachoRow(
    pedidoRes.data as unknown as PedidoDespachoRowRaw
  );

  if (pedido.estado === 'DESPACHADO') {
    redirect(`/despacho/imprimir/${pedido.id_pedido}`);
  }

  if (pedido.estado === 'ANULADO') {
    return (
      <div className="rounded-2xl border-2 border-red-300 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-[#C8102E]" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Pedido #{pedido.id_pedido} ANULADO
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Este pedido fue anulado y no puede ser pesado ni despachado.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/despacho"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border-2 border-slate-300 bg-slate-100 px-4 text-sm font-black text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a Bandeja</span>
          </Link>
          <Link
            href={`/despacho/imprimir/${pedido.id_pedido}`}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-[#FFCD00]"
          >
            <Printer className="h-4 w-4" />
            <span>Ver Comprobante</span>
          </Link>
        </div>
      </div>
    );
  }

  const productosCatalogo = mapProductosCatalogoPesaje(
    (productosRes.data ?? []) as unknown as ProductoCatalogoRowRaw[]
  );
  const perfilDespachador = buildPerfilDespachadorResumen(usuario);

  return (
    <div className="w-full max-w-[1440px] mx-auto min-w-0 flex-1 overflow-x-hidden space-y-4">
      {productosRes.error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-950"
        >
          Advertencia al cargar catálogo completo para cortesías:{' '}
          {productosRes.error.message}
        </div>
      )}

      <EstacionPesajeClient
        pedido={pedido}
        productosCatalogo={productosCatalogo}
        perfilDespachador={perfilDespachador}
      />
    </div>
  );
}

export default async function DespachoPedidoPage({
  params,
}: DespachoPedidoPageProps) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton
          modulo={`Cargando estación de pesaje pedido #${id}...`}
        />
      }
    >
      <EstacionPesajeContent idParam={id} />
    </Suspense>
  );
}

