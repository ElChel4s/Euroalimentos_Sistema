import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import {
  TicketTermicoEpson,
  type AnchoPapelTermico,
  type PedidoTicketTermico,
} from '@/components/tickets/TicketTermicoEpson';
import { ModuleLoadingSkeleton } from '@/components/ui/ModuleLoadingSkeleton';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type {
  EstadoPedidoEnum,
  FormatoProductoEnum,
  TipoVenta,
  UnidadMedidaEnum,
} from '@/types/database.types';

interface ImprimirTicketPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}

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
  perfil_vendedor: PerfilVendedorRelationRaw | PerfilVendedorRelationRaw[] | null;
}

interface PerfilDespachadorRelationRaw {
  identificador_balanza: string | null;
  ancho_papel_mm: number | null;
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
  unidad_medida?: UnidadMedidaEnum | (string & {});
  peso_unidad_kilos?: number;
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

interface PedidoTicketRowRaw {
  id_pedido: number;
  nro_nota_venta: number | null;
  nro_documento_sac: number | null;
  estado: EstadoPedidoEnum;
  tipo_venta: TipoVenta;
  plazo_dias: number;
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

async function ImprimirTicketContent({
  idParam,
  autoPrintParam,
}: {
  idParam: string;
  autoPrintParam?: string;
}) {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'DESPACHADOR' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    redirect('/login');
  }

  const anchoPapelMm: AnchoPapelTermico =
    usuario.perfil_despachador?.ancho_papel_mm === 58 ? 58 : 80;

  const pedidoId = Number(idParam);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return (
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-[#C8102E]" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Nota de despacho no encontrada
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          El identificador &ldquo;{idParam}&rdquo; no es válido.
        </p>
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

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('pedidos')
    .select(
      `
      id_pedido,
      nro_nota_venta,
      nro_documento_sac,
      estado,
      tipo_venta,
      plazo_dias,
      es_pedido_cortesia_pura,
      observaciones,
      fecha_preventa,
      fecha_despacho,
      clientes (
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
          identificador_balanza,
          ancho_papel_mm
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
          formato,
          unidad_medida,
          peso_unidad_kilos
        )
      )
    `
    )
    .eq('id_pedido', pedidoId)
    .maybeSingle();

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border-2 border-red-300 bg-red-50 p-6 text-red-950"
      >
        <p className="text-sm font-bold">
          Error al cargar la nota de despacho #{pedidoId}: {error.message}
        </p>
        <Link
          href="/despacho"
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a Bandeja de Despacho</span>
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Nota de despacho no encontrada
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          No existe registro para el pedido #{pedidoId}.
        </p>
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

  const row = data as unknown as PedidoTicketRowRaw;
  const cli = normalizeRelation(row.clientes);
  const zona = normalizeRelation(cli?.zonas_mercado);
  const vend = normalizeRelation(row.vendedor);
  const perfilVend = normalizeRelation(vend?.perfil_vendedor);
  const desp = normalizeRelation(row.despachador);
  const perfilDesp = normalizeRelation(desp?.perfil_despachador);

  const pedido: PedidoTicketTermico = {
    id_pedido: Number(row.id_pedido),
    nro_nota_venta:
      row.nro_nota_venta !== null && row.nro_nota_venta !== undefined
        ? Number(row.nro_nota_venta)
        : null,
    nro_documento_sac:
      row.nro_documento_sac !== null && row.nro_documento_sac !== undefined
        ? Number(row.nro_documento_sac)
        : null,
    estado: row.estado,
    tipo_venta: row.tipo_venta === 'CREDITO' ? 'CREDITO' : 'CONTADO',
    plazo_dias: Number(row.plazo_dias ?? 0),
    es_pedido_cortesia_pura: Boolean(row.es_pedido_cortesia_pura),
    fecha_preventa: row.fecha_preventa,
    fecha_despacho: row.fecha_despacho ?? null,
    observaciones: row.observaciones ?? null,
    cliente: {
      codigo_cliente_sac: cli?.codigo_cliente_sac ?? 'SIN-SAC',
      nombre_comercial: cli?.nombre_comercial ?? 'Cliente sin nombre',
      nit_ci: cli?.nit_ci ?? null,
      telefono: cli?.telefono ?? null,
    },
    zona: {
      nombre_zona: zona?.nombre_zona ?? 'Sin zona asignada',
      ciudad: zona?.ciudad ?? '',
    },
    vendedor: {
      codigo_vendedor:
        perfilVend?.codigo_vendedor ??
        (vend?.id_usuario ? `VND-${vend.id_usuario}` : 'SIN-COD'),
      nombre_completo: vend?.nombre_completo ?? 'Vendedor sin asignar',
    },
    despachador: {
      nombre_completo: desp?.nombre_completo ?? usuario.nombre_completo,
      identificador_balanza:
        perfilDesp?.identificador_balanza ??
        usuario.perfil_despachador?.identificador_balanza ??
        'BALANZA-GANCHO-01',
    },
    detalles: (row.detalle_pedidos ?? []).map((det) => {
      const prod = normalizeRelation(det.productos);
      return {
        id_detalle: Number(det.id_detalle),
        id_producto: Number(det.id_producto),
        codigo_sku: prod?.codigo_sku ?? `SKU-${det.id_producto}`,
        nombre_producto:
          prod?.nombre_producto ?? `Producto #${det.id_producto}`,
        formato: prod?.formato ?? 'GRANEL',
        unidad_medida: prod?.unidad_medida ?? 'KILO',
        peso_unidad_kilos: Number(prod?.peso_unidad_kilos ?? 1),
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
    }),
  };

  return (
    <TicketTermicoEpson
      pedido={pedido}
      anchoPapelMm={anchoPapelMm}
      autoPrint={autoPrintParam === '1'}
    />
  );
}

export default async function ImprimirTicketPage({
  params,
  searchParams,
}: ImprimirTicketPageProps) {
  const [{ id }, { autoprint }] = await Promise.all([params, searchParams]);

  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton
          modulo={`Generando comprobante térmico #${id}...`}
        />
      }
    >
      <ImprimirTicketContent idParam={id} autoPrintParam={autoprint} />
    </Suspense>
  );
}
