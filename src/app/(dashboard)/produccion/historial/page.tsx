import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import {
  HistorialPlantaClient,
  type MovimientoKardexPlantaItem,
  type TipoMovimientoPlanta,
} from '@/components/produccion/HistorialPlantaClient';
import type { PerfilProduccionResumen } from '@/components/produccion/IngresoLotesClient';
import { ModuleLoadingSkeleton } from '@/components/ui/ModuleLoadingSkeleton';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { FormatoProductoEnum } from '@/types/database.types';

interface ProductoRelRaw {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
}

interface UsuarioRelRaw {
  id_usuario: number;
  nombre_completo: string;
}

interface LoteRelRaw {
  id_lote: number;
  codigo_lote_interno: string;
  fecha_elaboracion: string;
}

interface TransformacionRelRaw {
  id_transformacion: number;
  kilos_origen_usados: number;
  kilos_destino_obtenidos: number;
  merma_kilos: number | null;
}

interface MovimientoPlantaRowRaw {
  id_movimiento: number;
  tipo_movimiento: TipoMovimientoPlanta;
  cantidad_kilos: number;
  saldo_anterior_kilos: number;
  saldo_nuevo_kilos: number;
  observacion: string | null;
  fecha_movimiento: string;
  productos: ProductoRelRaw | ProductoRelRaw[] | null;
  usuarios: UsuarioRelRaw | UsuarioRelRaw[] | null;
  lotes_produccion: LoteRelRaw | LoteRelRaw[] | null;
  transf_salida: TransformacionRelRaw | TransformacionRelRaw[] | null;
  transf_entrada: TransformacionRelRaw | TransformacionRelRaw[] | null;
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

async function HistorialPlantaContent() {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'PRODUCCION' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    redirect('/login');
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('movimientos_kardex')
    .select(
      `
      id_movimiento,
      tipo_movimiento,
      cantidad_kilos,
      saldo_anterior_kilos,
      saldo_nuevo_kilos,
      observacion,
      fecha_movimiento,
      productos!inner (
        id_producto,
        codigo_sku,
        nombre_producto,
        formato
      ),
      usuarios!inner (
        id_usuario,
        nombre_completo
      ),
      lotes_produccion (
        id_lote,
        codigo_lote_interno,
        fecha_elaboracion
      ),
      transf_salida:transformaciones_inventario!transformaciones_inventario_id_movimiento_salida_fkey (
        id_transformacion,
        kilos_origen_usados,
        kilos_destino_obtenidos,
        merma_kilos
      ),
      transf_entrada:transformaciones_inventario!transformaciones_inventario_id_movimiento_entrada_fkey (
        id_transformacion,
        kilos_origen_usados,
        kilos_destino_obtenidos,
        merma_kilos
      )
    `
    )
    .in('tipo_movimiento', [
      'INGRESO_PRODUCCION',
      'SALIDA_TRANSFORMACION',
      'ENTRADA_TRANSFORMACION',
    ])
    .order('fecha_movimiento', { ascending: false })
    .limit(500);

  if (error) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-2xl rounded-2xl border-2 border-red-200 bg-white p-6 text-center shadow-sm"
      >
        <AlertTriangle className="mx-auto h-10 w-10 text-[#C8102E]" />
        <h1 className="mt-2 text-lg font-black text-slate-900">
          Error al cargar el Kardex de Planta
        </h1>
        <p className="mt-1 text-sm text-slate-600">{error.message}</p>
      </div>
    );
  }

  const rows = (data ?? []) as unknown as MovimientoPlantaRowRaw[];
  const movimientos: MovimientoKardexPlantaItem[] = rows.map((row) => {
    const prodRel = normalizeRelation(row.productos);
    const userRel = normalizeRelation(row.usuarios);
    const loteRel = normalizeRelation(row.lotes_produccion);
    const transfRel =
      normalizeRelation(row.transf_entrada) ??
      normalizeRelation(row.transf_salida);

    const kilosOrigen = Number(transfRel?.kilos_origen_usados ?? 0);
    const kilosDestino = Number(transfRel?.kilos_destino_obtenidos ?? 0);
    const mermaCalculada =
      transfRel?.merma_kilos !== null && transfRel?.merma_kilos !== undefined
        ? Number(transfRel.merma_kilos)
        : Number((kilosOrigen - kilosDestino).toFixed(3));

    return {
      id_movimiento: row.id_movimiento,
      tipo_movimiento: row.tipo_movimiento,
      cantidad_kilos: Number(row.cantidad_kilos ?? 0),
      saldo_anterior_kilos: Number(row.saldo_anterior_kilos ?? 0),
      saldo_nuevo_kilos: Number(row.saldo_nuevo_kilos ?? 0),
      observacion: row.observacion,
      fecha_movimiento: row.fecha_movimiento,
      producto: {
        id_producto: prodRel?.id_producto ?? 0,
        codigo_sku: prodRel?.codigo_sku ?? 'SIN-SKU',
        nombre_producto: prodRel?.nombre_producto ?? 'Producto sin nombre',
        formato: prodRel?.formato ?? 'GRANEL',
      },
      usuario: {
        id_usuario: userRel?.id_usuario ?? 0,
        nombre_completo: userRel?.nombre_completo ?? 'Operador de Planta',
      },
      lote_produccion: loteRel
        ? {
            id_lote: loteRel.id_lote,
            codigo_lote_interno: loteRel.codigo_lote_interno,
            fecha_elaboracion: loteRel.fecha_elaboracion,
          }
        : null,
      transformacion: transfRel
        ? {
            id_transformacion: transfRel.id_transformacion,
            kilos_origen_usados: kilosOrigen,
            kilos_destino_obtenidos: kilosDestino,
            merma_kilos: mermaCalculada,
          }
        : null,
    };
  });

  const perfilProduccion: PerfilProduccionResumen = {
    turno_planta: usuario.perfil_produccion?.turno_planta ?? 'MAÑANA',
    responsable_camara_frio:
      usuario.perfil_produccion?.responsable_camara_frio ?? true,
    tolerancia_merma_max_pct: Number(
      usuario.perfil_produccion?.tolerancia_merma_max_pct ?? 5.0
    ),
  };

  return (
    <HistorialPlantaClient
      movimientos={movimientos}
      perfilProduccion={perfilProduccion}
      fechaReferenciaHoy={obtenerFechaHoyBoliviaIso()}
    />
  );
}

export default function ProduccionHistorialPage() {
  return (
    <Suspense
      fallback={
        <ModuleLoadingSkeleton modulo="Cargando historial y kardex de planta..." />
      }
    >
      <HistorialPlantaContent />
    </Suspense>
  );
}

