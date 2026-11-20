import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { BandejaDespachoClient } from '@/components/despacho/BandejaDespachoClient';
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

async function DespachoContent() {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'DESPACHADOR' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    redirect('/login');
  }

  const supabase = await createClient();

  const [pedidosRes, productosRes] = await Promise.all([
    supabase
      .from('pedidos')
      .select(PEDIDO_DESPACHO_SELECT)
      .eq('estado', 'PENDIENTE')
      .order('fecha_preventa', { ascending: true }),
    supabase
      .from('productos')
      .select(
        'id_producto, codigo_sku, nombre_producto, formato, unidad_medida, peso_unidad_kilos, precio_kilo_bs, stock_fisico_kilos'
      )
      .eq('activo', true)
      .order('nombre_producto', { ascending: true }),
  ]);

  const pedidosPendientes = (
    (pedidosRes.data ?? []) as unknown as PedidoDespachoRowRaw[]
  ).map(mapPedidoDespachoRow);

  const productosCatalogo = mapProductosCatalogoPesaje(
    (productosRes.data ?? []) as unknown as ProductoCatalogoRowRaw[]
  );

  const perfilDespachador = buildPerfilDespachadorResumen(usuario);

  return (
    <div className="space-y-4">
      {(pedidosRes.error || productosRes.error) && (
        <div
          role="alert"
          className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950"
        >
          No se pudo consultar completamente la bandeja de despacho:{' '}
          {pedidosRes.error?.message || productosRes.error?.message}
        </div>
      )}

      <BandejaDespachoClient
        pedidosPendientes={pedidosPendientes}
        productosCatalogo={productosCatalogo}
        perfilDespachador={perfilDespachador}
      />
    </div>
  );
}

export default function DespachoPage() {
  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton modulo="Sincronizando bandeja de despacho con cámara..." />
      }
    >
      <DespachoContent />
    </Suspense>
  );
}
