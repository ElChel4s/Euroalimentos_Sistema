import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ModuleLoadingSkeleton } from '@/components/ui/ModuleLoadingSkeleton';
import {
  MisPedidosList,
  type DetallePedidoVendedorItem,
  type PedidoVendedorItem,
} from '@/components/vendedor/MisPedidosList';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type {
  EstadoPedidoEnum,
  FormatoProductoEnum,
} from '@/types/database.types';

interface ZonaRelationRaw {
  id_zona: number;
  nombre_zona: string;
}

interface ClienteRelationRaw {
  id_cliente: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  zonas_mercado: ZonaRelationRaw | ZonaRelationRaw[] | null;
}

interface ProductoRelationRaw {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
}

interface DetallePedidoRowRaw {
  id_detalle: number;
  kilos_estimados: number;
  kilos_reales: number | null;
  es_cortesia: boolean;
  precio_unitario_congelado: number;
  subtotal_bs: number | null;
  productos: ProductoRelationRaw | ProductoRelationRaw[] | null;
}

interface PedidoRowRaw {
  id_pedido: number;
  nro_nota_venta: number | null;
  estado: EstadoPedidoEnum;
  es_pedido_cortesia_pura: boolean;
  observaciones: string | null;
  fecha_preventa: string;
  fecha_despacho: string | null;
  clientes: ClienteRelationRaw | ClienteRelationRaw[] | null;
  detalle_pedidos: DetallePedidoRowRaw[] | null;
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toBoliviaDateYmd(isoOrDate: string | Date): string {
  try {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return typeof isoOrDate === 'string' ? isoOrDate.slice(0, 10) : '';
  }
}

async function MisPedidosContent() {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'VENDEDOR' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    redirect('/login');
  }

  const supabase = await createClient();

  // RF-05: Filtrado estricto por vendedor autenticado y sin consultar campos de stock
  const { data, error } = await supabase
    .from('pedidos')
    .select(
      `
      id_pedido,
      nro_nota_venta,
      estado,
      es_pedido_cortesia_pura,
      observaciones,
      fecha_preventa,
      fecha_despacho,
      clientes (
        id_cliente,
        codigo_cliente_sac,
        nombre_comercial,
        zonas_mercado (
          id_zona,
          nombre_zona
        )
      ),
      detalle_pedidos (
        id_detalle,
        kilos_estimados,
        kilos_reales,
        es_cortesia,
        precio_unitario_congelado,
        subtotal_bs,
        productos (
          id_producto,
          codigo_sku,
          nombre_producto,
          formato
        )
      )
    `
    )
    .eq('id_vendedor', usuario.id_usuario)
    .order('fecha_preventa', { ascending: false })
    .limit(100);

  const fechaHoy = toBoliviaDateYmd(new Date());

  const pedidos: PedidoVendedorItem[] = (
    (data ?? []) as unknown as PedidoRowRaw[]
  ).map((row) => {
    const clienteRel = normalizeRelation(row.clientes);
    const zonaRel = normalizeRelation(clienteRel?.zonas_mercado);

    const detalles: DetallePedidoVendedorItem[] = (
      row.detalle_pedidos ?? []
    ).map((det) => {
      const prodRel = normalizeRelation(det.productos);
      const kilosEst = Number(det.kilos_estimados ?? 0);
      const kilosReales =
        det.kilos_reales !== null && det.kilos_reales !== undefined
          ? Number(det.kilos_reales)
          : null;
      const precioUnit = Number(det.precio_unitario_congelado ?? 0);
      const esCortesia = Boolean(det.es_cortesia);
      const subtotalCalculado = esCortesia
        ? 0
        : det.subtotal_bs !== null && det.subtotal_bs !== undefined
          ? Number(det.subtotal_bs)
          : Number(((kilosReales ?? kilosEst) * precioUnit).toFixed(2));

      return {
        id_detalle: det.id_detalle,
        kilos_estimados: kilosEst,
        kilos_reales: kilosReales,
        es_cortesia: esCortesia,
        precio_unitario_congelado: precioUnit,
        subtotal_bs: subtotalCalculado,
        productos: prodRel
          ? {
              id_producto: prodRel.id_producto,
              codigo_sku: prodRel.codigo_sku,
              nombre_producto: prodRel.nombre_producto,
              formato: prodRel.formato,
            }
          : null,
      };
    });

    return {
      id_pedido: row.id_pedido,
      nro_nota_venta:
        row.nro_nota_venta !== null && row.nro_nota_venta !== undefined
          ? String(row.nro_nota_venta)
          : null,
      estado: row.estado,
      es_pedido_cortesia_pura: Boolean(row.es_pedido_cortesia_pura),
      observaciones: row.observaciones,
      fecha_preventa: row.fecha_preventa,
      fecha_despacho: row.fecha_despacho,
      fecha_jornada: toBoliviaDateYmd(row.fecha_preventa),
      cliente: {
        id_cliente: clienteRel?.id_cliente ?? 0,
        codigo_cliente_sac:
          clienteRel?.codigo_cliente_sac ??
          `CLI-${clienteRel?.id_cliente ?? row.id_pedido}`,
        nombre_comercial:
          clienteRel?.nombre_comercial ?? `Cliente de pedido #${row.id_pedido}`,
        zona: zonaRel?.nombre_zona ?? 'Sin zona asignada',
      },
      detalle_pedidos: detalles,
    };
  });

  const codigoVendedor =
    usuario.perfil_vendedor?.codigo_vendedor ??
    (usuario.rol === 'ADMINISTRADOR'
      ? `ADM-${usuario.id_usuario}`
      : `VND-${usuario.id_usuario}`);
  const metaDiariaKilos = Number(
    usuario.perfil_vendedor?.meta_diaria_kilos ?? 0
  );

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950"
        >
          No se pudieron cargar los pedidos: {error.message}
        </div>
      )}

      <MisPedidosList
        pedidos={pedidos}
        metaDiariaKilos={metaDiariaKilos}
        codigoVendedor={codigoVendedor}
        nombreVendedor={usuario.nombre_completo}
        fechaHoy={fechaHoy}
      />
    </div>
  );
}

export default function MisPedidosPage() {
  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton modulo="Sincronizando tus pedidos de ruta..." />
      }
    >
      <MisPedidosContent />
    </Suspense>
  );
}
