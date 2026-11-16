import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import {
  HistorialDespachosClient,
  type PedidoHistorialDespachado,
} from '@/components/despacho/HistorialDespachosClient';
import type {
  AnchoPapelTermico,
  DetallePedidoTicketItem,
} from '@/components/tickets/TicketTermicoEpson';
import { ModuleLoadingSkeleton } from '@/components/ui/ModuleLoadingSkeleton';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type {
  EstadoPedidoEnum,
  FormatoProductoEnum,
} from '@/types/database.types';

interface ZonaRelationRaw {
  id_zona: number;
  nombre_zona: string;
  ciudad: string;
}

interface ClienteRelationRaw {
  id_cliente: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  nit_ci: string | null;
  telefono: string | null;
  zonas_mercado: ZonaRelationRaw | ZonaRelationRaw[] | null;
}

interface PerfilVendedorRelationRaw {
  codigo_vendedor: string;
}

interface VendedorRelationRaw {
  id_usuario: number;
  nombre_completo: string;
  perfil_vendedor:
    | PerfilVendedorRelationRaw
    | PerfilVendedorRelationRaw[]
    | null;
}

interface PerfilDespachadorRelationRaw {
  identificador_balanza: string | null;
}

interface DespachadorRelationRaw {
  id_usuario: number;
  nombre_completo: string;
  perfil_despachador:
    | PerfilDespachadorRelationRaw
    | PerfilDespachadorRelationRaw[]
    | null;
}

interface ProductoRelationRaw {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
}

interface DetallePedidoRowRaw {
  id_detalle: number;
  id_pedido: number;
  id_producto: number;
  kilos_estimados: number;
  kilos_reales: number | null;
  es_cortesia: boolean;
  precio_unitario_congelado: number;
  subtotal_bs: number | null;
  productos: ProductoRelationRaw | ProductoRelationRaw[] | null;
}

interface PedidoHistorialRowRaw {
  id_pedido: number;
  nro_nota_venta: number | null;
  estado: EstadoPedidoEnum;
  es_pedido_cortesia_pura: boolean;
  observaciones: string | null;
  fecha_preventa: string;
  fecha_despacho: string | null;
  clientes: ClienteRelationRaw | ClienteRelationRaw[] | null;
  vendedor: VendedorRelationRaw | VendedorRelationRaw[] | null;
  despachador: DespachadorRelationRaw | DespachadorRelationRaw[] | null;
  detalle_pedidos: DetallePedidoRowRaw[] | null;
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function HistorialDespachosContent() {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'DESPACHADOR' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    redirect('/login');
  }

  const anchoPapelDefault: AnchoPapelTermico =
    usuario.perfil_despachador?.ancho_papel_mm === 58 ? 58 : 80;
  const balanzaActiva =
    usuario.perfil_despachador?.identificador_balanza ?? 'BALANZA-GANCHO-01';

  const supabase = await createClient();

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
      clientes!inner (
        id_cliente,
        codigo_cliente_sac,
        nombre_comercial,
        nit_ci,
        telefono,
        zonas_mercado (
          id_zona,
          nombre_zona,
          ciudad
        )
      ),
      vendedor:usuarios!pedidos_id_vendedor_fkey (
        id_usuario,
        nombre_completo,
        perfil_vendedor (
          codigo_vendedor
        )
      ),
      despachador:usuarios!pedidos_id_despachador_fkey (
        id_usuario,
        nombre_completo,
        perfil_despachador (
          identificador_balanza
        )
      ),
      detalle_pedidos (
        id_detalle,
        id_pedido,
        id_producto,
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
    .eq('estado', 'DESPACHADO')
    .order('fecha_despacho', { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border-2 border-red-200 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-[#C8102E]" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Error al cargar el historial de despachos
        </h1>
        <p className="mt-1 text-sm text-slate-600">{error.message}</p>
        <Link
          href="/despacho"
          className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#C8102E] px-4 text-sm font-black text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a Bandeja de Despacho</span>
        </Link>
      </div>
    );
  }

  const rows = (data ?? []) as unknown as PedidoHistorialRowRaw[];

  const pedidosDespachados: PedidoHistorialDespachado[] = rows.map((row) => {
    const clienteRel = normalizeRelation(row.clientes);
    const zonaRel = normalizeRelation(clienteRel?.zonas_mercado);
    const vendedorRel = normalizeRelation(row.vendedor);
    const perfilVendedorRel = normalizeRelation(vendedorRel?.perfil_vendedor);
    const despachadorRel = normalizeRelation(row.despachador);
    const perfilDespachadorRel = normalizeRelation(
      despachadorRel?.perfil_despachador
    );

    const detalles: DetallePedidoTicketItem[] = (row.detalle_pedidos ?? [])
      .map((det) => {
        const prodRel = normalizeRelation(det.productos);
        return {
          id_detalle: det.id_detalle,
          id_producto: det.id_producto,
          codigo_sku: prodRel?.codigo_sku ?? 'SIN-SKU',
          nombre_producto: prodRel?.nombre_producto ?? 'Producto sin nombre',
          formato: prodRel?.formato ?? 'GRANEL',
          kilos_estimados: Number(det.kilos_estimados ?? 0),
          kilos_reales:
            det.kilos_reales !== null && det.kilos_reales !== undefined
              ? Number(det.kilos_reales)
              : null,
          precio_unitario_congelado: Number(det.precio_unitario_congelado ?? 0),
          es_cortesia: Boolean(det.es_cortesia),
          subtotal_bs:
            det.subtotal_bs !== null && det.subtotal_bs !== undefined
              ? Number(det.subtotal_bs)
              : null,
        };
      })
      .sort((a, b) => a.id_detalle - b.id_detalle);

    const totales = detalles.reduce(
      (acc, det) => {
        const kilos = Number(det.kilos_reales ?? det.kilos_estimados ?? 0);
        const esCortesia = Boolean(
          det.es_cortesia || row.es_pedido_cortesia_pura
        );

        if (esCortesia) {
          return {
            vendidos: acc.vendidos,
            cortesia: acc.cortesia + kilos,
            cobrado: acc.cobrado,
          };
        }

        const subtotal =
          det.subtotal_bs !== null && det.subtotal_bs !== undefined
            ? Number(det.subtotal_bs)
            : kilos * Number(det.precio_unitario_congelado ?? 0);

        return {
          vendidos: acc.vendidos + kilos,
          cortesia: acc.cortesia,
          cobrado: acc.cobrado + subtotal,
        };
      },
      { vendidos: 0, cortesia: 0, cobrado: 0 }
    );

    return {
      id_pedido: row.id_pedido,
      nro_nota_venta: row.nro_nota_venta,
      estado: row.estado,
      es_pedido_cortesia_pura: Boolean(row.es_pedido_cortesia_pura),
      fecha_preventa: row.fecha_preventa,
      fecha_despacho: row.fecha_despacho,
      observaciones: row.observaciones,
      id_zona: zonaRel?.id_zona ?? 0,
      id_vendedor: vendedorRel?.id_usuario ?? 0,
      kilos_vendidos_total: totales.vendidos,
      kilos_cortesia_total: totales.cortesia,
      total_cobrado_bs: totales.cobrado,
      cliente: {
        codigo_cliente_sac: clienteRel?.codigo_cliente_sac ?? 'S/C',
        nombre_comercial: clienteRel?.nombre_comercial ?? 'Cliente sin nombre',
        nit_ci: clienteRel?.nit_ci ?? null,
        telefono: clienteRel?.telefono ?? null,
      },
      zona: {
        nombre_zona: zonaRel?.nombre_zona ?? 'Sin zona',
        ciudad: zonaRel?.ciudad ?? 'Bolivia',
      },
      vendedor: {
        codigo_vendedor: perfilVendedorRel?.codigo_vendedor ?? 'S/C',
        nombre_completo: vendedorRel?.nombre_completo ?? 'Vendedor',
      },
      despachador: {
        nombre_completo:
          despachadorRel?.nombre_completo ?? usuario.nombre_completo,
        identificador_balanza:
          perfilDespachadorRel?.identificador_balanza ?? balanzaActiva,
      },
      detalles,
    };
  });

  return (
    <HistorialDespachosClient
      pedidosDespachados={pedidosDespachados}
      anchoPapelDefault={anchoPapelDefault}
      nombreDespachadorActivo={usuario.nombre_completo}
      balanzaActiva={balanzaActiva}
    />
  );
}

export default function HistorialDespachosPage() {
  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton modulo="Cargando historial de despachos..." />
      }
    >
      <HistorialDespachosContent />
    </Suspense>
  );
}

