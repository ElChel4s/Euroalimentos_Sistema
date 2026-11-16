import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import {
  ReportesSacClient,
  type LogProductoKardexRow,
  type PerfilAdminReportes,
  type TipoMovimientoBitacora,
  type VentaDiariaSacRow,
} from '@/components/admin/ReportesSacClient';
import { ModuleLoadingSkeleton } from '@/components/ui/ModuleLoadingSkeleton';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type {
  FormatoProductoEnum,
  TipoMovimientoEnum,
  VwReporteVentasDiarioSac,
} from '@/types/database.types';

interface ProductoRelRaw {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  precio_kilo_bs: number;
}

interface UsuarioRelRaw {
  id_usuario: number;
  nombre_completo: string;
}

interface ClienteRelRaw {
  nombre_comercial: string;
}

interface VendedorRelRaw {
  nombre_completo: string;
}

interface PedidoRelRaw {
  id_pedido: number;
  nro_nota_venta: number | null;
  clientes: ClienteRelRaw | ClienteRelRaw[] | null;
  vendedor: VendedorRelRaw | VendedorRelRaw[] | null;
}

interface LoteRelRaw {
  codigo_lote_interno: string;
}

interface MovimientoKardexRowRaw {
  id_movimiento: number;
  id_producto: number;
  id_usuario: number;
  tipo_movimiento: TipoMovimientoEnum;
  cantidad_kilos: number;
  saldo_anterior_kilos: number;
  saldo_nuevo_kilos: number;
  referencia_pedido_id: number | null;
  observacion: string | null;
  fecha_movimiento: string;
  productos: ProductoRelRaw | ProductoRelRaw[] | null;
  usuarios: UsuarioRelRaw | UsuarioRelRaw[] | null;
  pedidos: PedidoRelRaw | PedidoRelRaw[] | null;
  lotes_produccion: LoteRelRaw | LoteRelRaw[] | null;
}

const TIMEZONE_BOLIVIA = 'America/La_Paz';

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function obtenerFechaHoyBoliviaIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function normalizarFechaYmdBolivia(rawFecha: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawFecha)) {
    return rawFecha;
  }
  const fechaObj = new Date(rawFecha);
  if (Number.isNaN(fechaObj.getTime())) {
    return rawFecha.slice(0, 10);
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fechaObj);
}

function formatearFechaHoraBolivia(isoDate: string): {
  fechaHora: string;
  fechaIso: string;
} {
  const fechaObj = new Date(isoDate);
  if (Number.isNaN(fechaObj.getTime())) {
    return { fechaHora: 'S/F', fechaIso: '' };
  }

  const fechaIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fechaObj);

  const fecha = new Intl.DateTimeFormat('es-BO', {
    timeZone: TIMEZONE_BOLIVIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fechaObj);

  const hora = new Intl.DateTimeFormat('es-BO', {
    timeZone: TIMEZONE_BOLIVIA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fechaObj);

  return {
    fechaHora: `${fecha} • ${hora}`,
    fechaIso,
  };
}

function mapTipoMovimiento(tipo: TipoMovimientoEnum): TipoMovimientoBitacora {
  switch (tipo) {
    case 'SALIDA_VENTA':
      return 'VENTA_DESPACHADA';
    case 'SALIDA_CORTESIA':
      return 'CORTESIA_0_BS';
    case 'INGRESO_PRODUCCION':
      return 'INGRESO_PRODUCCION';
    case 'REINGRESO_ANULACION':
      return 'REINGRESO_REBOTE';
    case 'SALIDA_TRANSFORMACION':
    case 'ENTRADA_TRANSFORMACION':
      return 'TRANSF_GRANEL_VACIO';
    case 'AJUSTE_AUDITORIA':
      return 'AJUSTE_AUDITORIA';
  }
}

async function ReportesSacContent() {
  const usuario = await getUsuarioConPerfilActivo();
  if (!usuario || usuario.rol !== 'ADMINISTRADOR') {
    redirect('/login');
  }

  const supabase = await createClient();

  const [sacRes, kardexRes] = await Promise.all([
    supabase
      .from('vw_reporte_ventas_diario_sac')
      .select(
        'nro_nota, fecha_venta, codigo_cliente, cliente, zona_mercado, vendedor, total_kilos_vendidos, total_kilos_cortesia, monto_total_bs, estado'
      )
      .order('fecha_venta', { ascending: false })
      .order('nro_nota', { ascending: false })
      .limit(1000),
    supabase
      .from('movimientos_kardex')
      .select(
        `
        id_movimiento,
        id_producto,
        id_usuario,
        tipo_movimiento,
        cantidad_kilos,
        saldo_anterior_kilos,
        saldo_nuevo_kilos,
        referencia_pedido_id,
        observacion,
        fecha_movimiento,
        productos!inner (
          id_producto,
          codigo_sku,
          nombre_producto,
          formato,
          precio_kilo_bs
        ),
        usuarios!inner (
          id_usuario,
          nombre_completo
        ),
        pedidos (
          id_pedido,
          nro_nota_venta,
          clientes (
            nombre_comercial
          ),
          vendedor:usuarios!pedidos_id_vendedor_fkey (
            nombre_completo
          )
        ),
        lotes_produccion (
          codigo_lote_interno
        )
      `
      )
      .order('fecha_movimiento', { ascending: false })
      .limit(1000),
  ]);

  if (sacRes.error || kardexRes.error) {
    const errMsg =
      sacRes.error?.message ??
      kardexRes.error?.message ??
      'Error desconocido al consultar datos.';
    return (
      <div
        role="alert"
        className="mx-auto max-w-2xl rounded-2xl border-2 border-red-200 bg-white p-6 text-center shadow-sm"
      >
        <AlertTriangle className="mx-auto h-10 w-10 text-[#C8102E]" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Error al cargar reportes contables SAC
        </h1>
        <p className="mt-1 text-sm text-slate-600">{errMsg}</p>
      </div>
    );
  }

  const sacRaw = (sacRes.data ?? []) as VwReporteVentasDiarioSac[];
  const ventasSac: VentaDiariaSacRow[] = sacRaw.map((row, index) => ({
    id: `sac-${row.nro_nota ?? 'sn'}-${row.codigo_cliente}-${index}`,
    nro_nota:
      row.nro_nota !== null && row.nro_nota !== undefined
        ? String(row.nro_nota).padStart(6, '0')
        : 'S/N',
    fecha_venta: normalizarFechaYmdBolivia(row.fecha_venta),
    codigo_cliente: row.codigo_cliente ?? 'S/C',
    cliente: row.cliente ?? 'Cliente sin nombre',
    zona_mercado: row.zona_mercado ?? 'Sin zona',
    vendedor: row.vendedor ?? 'Vendedor',
    total_kilos_vendidos: Number(row.total_kilos_vendidos ?? 0),
    total_kilos_cortesia: Number(row.total_kilos_cortesia ?? 0),
    monto_total_bs: Number(row.monto_total_bs ?? 0),
    estado: row.estado,
  }));

  const kardexRaw = (kardexRes.data ??
    []) as unknown as MovimientoKardexRowRaw[];

  const logsProducto: LogProductoKardexRow[] = kardexRaw.map((row) => {
    const prodRel = normalizeRelation(row.productos);
    const userRel = normalizeRelation(row.usuarios);
    const pedidoRel = normalizeRelation(row.pedidos);
    const clienteRel = normalizeRelation(pedidoRel?.clientes);
    const vendedorRel = normalizeRelation(pedidoRel?.vendedor);
    const loteRel = normalizeRelation(row.lotes_produccion);

    const { fechaHora, fechaIso } = formatearFechaHoraBolivia(
      row.fecha_movimiento
    );
    const tipoMapeado = mapTipoMovimiento(row.tipo_movimiento);
    const kilosMov = Number(row.cantidad_kilos ?? 0);
    const precioKilo = Number(prodRel?.precio_kilo_bs ?? 0);

    let documentoOrigen = `Mov. #${row.id_movimiento}`;
    if (loteRel?.codigo_lote_interno) {
      documentoOrigen = `Lote ${loteRel.codigo_lote_interno}`;
    } else if (pedidoRel?.nro_nota_venta) {
      const notaPad = String(pedidoRel.nro_nota_venta).padStart(6, '0');
      documentoOrigen =
        row.tipo_movimiento === 'REINGRESO_ANULACION'
          ? `Rebote Nota #${notaPad}`
          : `Nota #${notaPad}`;
    } else if (row.referencia_pedido_id) {
      documentoOrigen = `Pedido #PED-${String(row.referencia_pedido_id).padStart(3, '0')}`;
    } else if (
      row.tipo_movimiento === 'SALIDA_TRANSFORMACION' ||
      row.tipo_movimiento === 'ENTRADA_TRANSFORMACION'
    ) {
      documentoOrigen = 'Transformación';
    }

    const clienteDestino =
      clienteRel?.nombre_comercial &&
      row.tipo_movimiento !== 'REINGRESO_ANULACION'
        ? clienteRel.nombre_comercial
        : 'Cámara Fría Planta';

    const operadorNombre = userRel?.nombre_completo ?? 'Operador';
    const responsable =
      vendedorRel?.nombre_completo && pedidoRel
        ? `Vend: ${vendedorRel.nombre_completo} / Reg: ${operadorNombre}`
        : operadorNombre;

    const valorMovimientoBs =
      row.tipo_movimiento === 'SALIDA_CORTESIA'
        ? 0
        : Number((Math.abs(kilosMov) * precioKilo).toFixed(2));

    return {
      id: `mov-${row.id_movimiento}`,
      fecha_hora: fechaHora,
      fecha_iso: fechaIso,
      producto_id: prodRel?.id_producto ?? row.id_producto,
      codigo_sku: prodRel?.codigo_sku ?? 'SIN-SKU',
      nombre_producto: prodRel?.nombre_producto ?? 'Producto sin nombre',
      presentacion: prodRel?.formato ?? 'GRANEL',
      tipo_movimiento: tipoMapeado,
      documento_origen: documentoOrigen,
      cliente_destino: clienteDestino,
      responsable,
      kilos_movimiento: kilosMov,
      saldo_resultante_kilos: Number(row.saldo_nuevo_kilos ?? 0),
      valor_movimiento_bs: valorMovimientoBs,
    };
  });

  const perfilAdmin: PerfilAdminReportes = {
    id_usuario: usuario.id_usuario,
    nombre_completo: usuario.nombre_completo,
    cargo_gerencial:
      usuario.perfil_administrador?.cargo_gerencial ?? 'Contabilidad SAC',
    puede_exportar_sac:
      usuario.perfil_administrador?.puede_exportar_sac ?? true,
  };

  return (
    <ReportesSacClient
      ventasSac={ventasSac}
      logsProducto={logsProducto}
      perfilAdmin={perfilAdmin}
      fechaHoyBolivia={obtenerFechaHoyBoliviaIso()}
    />
  );
}

export default function AdminReportesPage() {
  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton modulo="Cargando reportes SAC y bitácora..." />
      }
    >
      <ReportesSacContent />
    </Suspense>
  );
}
