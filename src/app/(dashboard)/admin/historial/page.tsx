import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import {
  AuditorVentasAdminClient,
  type DetallePedidoAuditoriaItem,
  type PedidoAuditoriaAdmin,
  type PerfilAdminResumen,
} from '@/components/admin/AuditorVentasAdminClient';
import { ModuleLoadingSkeleton } from '@/components/ui/ModuleLoadingSkeleton';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type {
  EstadoPedidoEnum,
  FormatoProductoEnum,
  TipoVenta,
  UnidadMedidaEnum,
} from '@/types/database.types';

interface ZonaRelRaw {
  id_zona: number;
  nombre_zona: string;
}

interface ClienteRelRaw {
  id_cliente: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  zonas_mercado: ZonaRelRaw | ZonaRelRaw[] | null;
}

interface UsuarioRelRaw {
  id_usuario: number;
  nombre_completo: string;
}

interface ProductoRelRaw {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  unidad_medida?: UnidadMedidaEnum | (string & {});
  peso_unidad_kilos?: number;
}

interface DetallePedidoRowRaw {
  id_detalle: number;
  id_producto: number;
  kilos_estimados: number;
  kilos_reales: number | null;
  es_cortesia: boolean;
  precio_unitario_congelado: number;
  subtotal_bs: number | null;
  productos: ProductoRelRaw | ProductoRelRaw[] | null;
}

interface AnulacionRowRaw {
  id_anulacion: number;
  id_administrador: number;
  motivo_rebote: string;
  kilos_reingresados_total: number;
  fecha_anulacion: string;
}

interface PedidoAdminRowRaw {
  id_pedido: number;
  nro_nota_venta: number | null;
  nro_documento_sac: number | null;
  estado: EstadoPedidoEnum;
  tipo_venta: TipoVenta | null;
  plazo_dias: number | null;
  es_pedido_cortesia_pura: boolean;
  observaciones: string | null;
  fecha_preventa: string;
  fecha_despacho: string | null;
  clientes: ClienteRelRaw | ClienteRelRaw[] | null;
  vendedor: UsuarioRelRaw | UsuarioRelRaw[] | null;
  despachador: UsuarioRelRaw | UsuarioRelRaw[] | null;
  detalle_pedidos: DetallePedidoRowRaw[] | null;
  anulaciones_pedido: AnulacionRowRaw | AnulacionRowRaw[] | null;
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function obtenerFechaHoyBoliviaIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function AdminHistorialContent() {
  const usuario = await getUsuarioConPerfilActivo();
  if (!usuario || usuario.rol !== 'ADMINISTRADOR') {
    redirect('/login');
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
      clientes!inner (
        id_cliente,
        codigo_cliente_sac,
        nombre_comercial,
        zonas_mercado (
          id_zona,
          nombre_zona
        )
      ),
      vendedor:usuarios!pedidos_id_vendedor_fkey (
        id_usuario,
        nombre_completo
      ),
      despachador:usuarios!pedidos_id_despachador_fkey (
        id_usuario,
        nombre_completo
      ),
      detalle_pedidos (
        id_detalle,
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
      ),
      anulaciones_pedido (
        id_anulacion,
        id_administrador,
        motivo_rebote,
        kilos_reingresados_total,
        fecha_anulacion
      )
    `
    )
    .order('fecha_preventa', { ascending: false })
    .limit(500);

  if (error) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-2xl rounded-2xl border-2 border-red-200 bg-white p-6 text-center shadow-sm"
      >
        <AlertTriangle className="mx-auto h-10 w-10 text-[#C8102E]" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Error al cargar auditoría de ventas
        </h1>
        <p className="mt-1 text-sm text-slate-600">{error.message}</p>
      </div>
    );
  }

  const rows = (data ?? []) as unknown as PedidoAdminRowRaw[];

  const adminIds = Array.from(
    new Set(
      rows
        .map((r) => normalizeRelation(r.anulaciones_pedido)?.id_administrador)
        .filter((id): id is number => typeof id === 'number' && id > 0)
    )
  );

  const adminNombreMap = new Map<number, string>();
  if (adminIds.length > 0) {
    const { data: adminsData } = await supabase
      .from('usuarios')
      .select('id_usuario, nombre_completo')
      .in('id_usuario', adminIds);

    (adminsData ?? []).forEach(
      (adm: { id_usuario: number; nombre_completo: string }) => {
        adminNombreMap.set(adm.id_usuario, adm.nombre_completo);
      }
    );
  }

  const pedidos: PedidoAuditoriaAdmin[] = rows.map((row) => {
    const clienteRel = normalizeRelation(row.clientes);
    const zonaRel = normalizeRelation(clienteRel?.zonas_mercado);
    const vendedorRel = normalizeRelation(row.vendedor);
    const despachadorRel = normalizeRelation(row.despachador);
    const anulacionRel = normalizeRelation(row.anulaciones_pedido);
    const adminNombre = anulacionRel
      ? adminNombreMap.get(anulacionRel.id_administrador)
      : undefined;

    const detalles: DetallePedidoAuditoriaItem[] = (row.detalle_pedidos ?? [])
      .map((det) => {
        const prodRel = normalizeRelation(det.productos);
        const kilosReales =
          det.kilos_reales !== null && det.kilos_reales !== undefined
            ? Number(det.kilos_reales)
            : null;
        const kilosEfectivos = kilosReales ?? Number(det.kilos_estimados ?? 0);
        const esCort = Boolean(det.es_cortesia || row.es_pedido_cortesia_pura);
        const subtotal = esCort
          ? 0
          : det.subtotal_bs !== null && det.subtotal_bs !== undefined
            ? Number(det.subtotal_bs)
            : Number(
                (
                  kilosEfectivos * Number(det.precio_unitario_congelado ?? 0)
                ).toFixed(2)
              );

        return {
          id_detalle: det.id_detalle,
          id_producto: det.id_producto,
          kilos_estimados: Number(det.kilos_estimados ?? 0),
          kilos_reales: kilosReales,
          es_cortesia: esCort,
          precio_unitario_congelado: Number(det.precio_unitario_congelado ?? 0),
          subtotal_bs: subtotal,
          producto: {
            id_producto: prodRel?.id_producto ?? det.id_producto,
            codigo_sku: prodRel?.codigo_sku ?? 'SIN-SKU',
            nombre_producto: prodRel?.nombre_producto ?? 'Producto sin nombre',
            formato: prodRel?.formato ?? 'GRANEL',
            unidad_medida: prodRel?.unidad_medida ?? 'KILO',
            peso_unidad_kilos: Number(prodRel?.peso_unidad_kilos ?? 1),
          },
        };
      })
      .sort((a, b) => a.id_detalle - b.id_detalle);

    return {
      id_pedido: row.id_pedido,
      nro_nota_venta: row.nro_nota_venta,
      nro_documento_sac:
        row.nro_documento_sac !== null && row.nro_documento_sac !== undefined
          ? Number(row.nro_documento_sac)
          : null,
      estado: row.estado,
      tipo_venta: row.tipo_venta === 'CREDITO' ? 'CREDITO' : 'CONTADO',
      plazo_dias: Number(row.plazo_dias ?? 0),
      es_pedido_cortesia_pura: Boolean(row.es_pedido_cortesia_pura),
      observaciones: row.observaciones,
      fecha_preventa: row.fecha_preventa,
      fecha_despacho: row.fecha_despacho,
      clientes: {
        id_cliente: clienteRel?.id_cliente ?? 0,
        codigo_cliente_sac: clienteRel?.codigo_cliente_sac ?? 'S/C',
        nombre_comercial: clienteRel?.nombre_comercial ?? 'Cliente sin nombre',
        zona: {
          id_zona: zonaRel?.id_zona ?? 0,
          nombre_zona: zonaRel?.nombre_zona ?? 'Sin zona',
        },
      },
      vendedor: {
        id_usuario: vendedorRel?.id_usuario ?? 0,
        nombre_completo: vendedorRel?.nombre_completo ?? 'Vendedor',
      },
      despachador: despachadorRel
        ? {
            id_usuario: despachadorRel.id_usuario,
            nombre_completo: despachadorRel.nombre_completo,
          }
        : null,
      detalle_pedidos: detalles,
      anulacion: anulacionRel
        ? {
            id_anulacion: anulacionRel.id_anulacion,
            motivo_rebote: anulacionRel.motivo_rebote,
            kilos_reingresados_total: Number(
              anulacionRel.kilos_reingresados_total ?? 0
            ),
            fecha_anulacion: anulacionRel.fecha_anulacion,
            administrador: {
              id_usuario: anulacionRel.id_administrador,
              nombre_completo: adminNombre ?? 'Gerencia General',
            },
          }
        : null,
    };
  });

  const perfilAdmin: PerfilAdminResumen = {
    id_usuario: usuario.id_usuario,
    nombre_completo: usuario.nombre_completo,
    cargo_gerencial:
      usuario.perfil_administrador?.cargo_gerencial ?? 'Gerencia General',
    puede_anular_despachos:
      usuario.perfil_administrador?.puede_anular_despachos ?? false,
  };

  return (
    <AuditorVentasAdminClient
      pedidos={pedidos}
      perfilAdmin={perfilAdmin}
      fechaHoyBolivia={obtenerFechaHoyBoliviaIso()}
    />
  );
}

export default function AdminHistorialPage() {
  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton modulo="Cargando auditoría de ventas y rebotes..." />
      }
    >
      <AdminHistorialContent />
    </Suspense>
  );
}
