'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  Layers,
  Package,
  RefreshCw,
  Scale,
  Search,
  Snowflake,
  UserCheck,
  X,
} from 'lucide-react';
import type { PerfilProduccionResumen } from '@/components/produccion/IngresoLotesClient';
import type { FormatoProductoEnum } from '@/types/database.types';

export type TipoMovimientoPlanta =
  | 'INGRESO_PRODUCCION'
  | 'SALIDA_TRANSFORMACION'
  | 'ENTRADA_TRANSFORMACION';

export interface MovimientoKardexPlantaItem {
  id_movimiento: number;
  tipo_movimiento: TipoMovimientoPlanta;
  cantidad_kilos: number;
  saldo_anterior_kilos: number;
  saldo_nuevo_kilos: number;
  observacion: string | null;
  fecha_movimiento: string;
  producto: {
    id_producto: number;
    codigo_sku: string;
    nombre_producto: string;
    formato: FormatoProductoEnum;
  };
  usuario: {
    id_usuario: number;
    nombre_completo: string;
  };
  lote_produccion: {
    id_lote: number;
    codigo_lote_interno: string;
    fecha_elaboracion: string;
  } | null;
  transformacion: {
    id_transformacion: number;
    kilos_origen_usados: number;
    kilos_destino_obtenidos: number;
    merma_kilos: number;
  } | null;
}

export interface HistorialPlantaClientProps {
  movimientos: MovimientoKardexPlantaItem[];
  perfilProduccion: PerfilProduccionResumen;
  fechaReferenciaHoy?: string;
}

const TIMEZONE_BOLIVIA = 'America/La_Paz';

function obtenerFechaBoliviaIso(offsetDias = 0): string {
  const base = new Date(Date.now() + offsetDias * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base);
}

function formatKg(valor: number, mostrarSigno = false): string {
  const absFormatted = Math.abs(valor).toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  if (!mostrarSigno) return `${absFormatted} kg`;
  return valor >= 0 ? `+${absFormatted} kg` : `-${absFormatted} kg`;
}

function formatFechaHoraBolivia(isoDate: string): {
  fecha: string;
  hora: string;
  soloFechaISO: string;
} {
  const fechaObj = new Date(isoDate);
  if (Number.isNaN(fechaObj.getTime())) {
    return { fecha: 'S/F', hora: '--:--', soloFechaISO: '' };
  }

  const soloFechaISO = new Intl.DateTimeFormat('en-CA', {
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

  return { fecha, hora, soloFechaISO };
}

function getYesterdayISO(todayISO: string): string {
  const [y, m, d] = todayISO.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d - 1));
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function HistorialPlantaClient({
  movimientos,
  perfilProduccion,
  fechaReferenciaHoy,
}: HistorialPlantaClientProps) {
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroJornada, setFiltroJornada] = useState<
    'TODOS' | 'HOY' | 'AYER' | 'CUSTOM'
  >('TODOS');
  const [fechaPersonalizada, setFechaPersonalizada] = useState<string>('');
  const [filtroOperacion, setFiltroOperacion] = useState<
    'TODOS' | 'PRODUCCION' | 'TRANSFORMACION'
  >('TODOS');

  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [itemsPorPagina, setItemsPorPagina] = useState<10 | 20 | 50>(10);
  const [movimientoSeleccionado, setMovimientoSeleccionado] =
    useState<MovimientoKardexPlantaItem | null>(null);

  const fechaHoyISO = useMemo(
    () => fechaReferenciaHoy ?? obtenerFechaBoliviaIso(0),
    [fechaReferenciaHoy]
  );
  const fechaAyerISO = useMemo(
    () => getYesterdayISO(fechaHoyISO),
    [fechaHoyISO]
  );

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((mov) => {
      const { soloFechaISO } = formatFechaHoraBolivia(mov.fecha_movimiento);

      if (filtroJornada === 'HOY' && soloFechaISO !== fechaHoyISO) return false;
      if (filtroJornada === 'AYER' && soloFechaISO !== fechaAyerISO)
        return false;
      if (
        filtroJornada === 'CUSTOM' &&
        fechaPersonalizada &&
        soloFechaISO !== fechaPersonalizada
      ) {
        return false;
      }

      if (
        filtroOperacion === 'PRODUCCION' &&
        mov.tipo_movimiento !== 'INGRESO_PRODUCCION'
      ) {
        return false;
      }

      if (
        filtroOperacion === 'TRANSFORMACION' &&
        mov.tipo_movimiento !== 'SALIDA_TRANSFORMACION' &&
        mov.tipo_movimiento !== 'ENTRADA_TRANSFORMACION'
      ) {
        return false;
      }

      if (busqueda.trim() !== '') {
        const term = busqueda.toLowerCase().trim();
        const matchProducto = mov.producto.nombre_producto
          .toLowerCase()
          .includes(term);
        const matchSku = mov.producto.codigo_sku.toLowerCase().includes(term);
        const matchLote =
          mov.lote_produccion?.codigo_lote_interno
            .toLowerCase()
            .includes(term) ?? false;
        const matchObs = (mov.observacion ?? '').toLowerCase().includes(term);
        const matchId = String(mov.id_movimiento).includes(term);

        if (
          !matchProducto &&
          !matchSku &&
          !matchLote &&
          !matchObs &&
          !matchId
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    movimientos,
    filtroJornada,
    fechaHoyISO,
    fechaAyerISO,
    fechaPersonalizada,
    filtroOperacion,
    busqueda,
  ]);

  const resumenCompacto = useMemo(() => {
    let totalProducido = 0;
    let transformadoAVacio = 0;
    let mermaAcumulada = 0;

    movimientosFiltrados.forEach((mov) => {
      if (mov.tipo_movimiento === 'INGRESO_PRODUCCION') {
        totalProducido += Number(mov.cantidad_kilos);
      }
      if (mov.tipo_movimiento === 'ENTRADA_TRANSFORMACION') {
        transformadoAVacio += Number(mov.cantidad_kilos);
        if (mov.transformacion) {
          mermaAcumulada += Number(mov.transformacion.merma_kilos);
        }
      }
    });

    return {
      totalProducido,
      transformadoAVacio,
      mermaAcumulada,
      totalRegistros: movimientosFiltrados.length,
    };
  }, [movimientosFiltrados]);

  const totalItems = movimientosFiltrados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItems / itemsPorPagina));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const indiceInicio = (paginaSegura - 1) * itemsPorPagina;
  const indiceFin = Math.min(indiceInicio + itemsPorPagina, totalItems);
  const movimientosPaginados = movimientosFiltrados.slice(
    indiceInicio,
    indiceFin
  );

  const handleCambiarBusqueda = (val: string) => {
    setBusqueda(val);
    setPaginaActual(1);
  };

  const handleCambiarJornada = (jornada: 'TODOS' | 'HOY' | 'AYER') => {
    setFiltroJornada(jornada);
    setFechaPersonalizada('');
    setPaginaActual(1);
  };

  const handleCambiarFechaInput = (dateVal: string) => {
    setFechaPersonalizada(dateVal);
    setFiltroJornada(dateVal ? 'CUSTOM' : 'TODOS');
    setPaginaActual(1);
  };

  const handleCambiarOperacion = (
    op: 'TODOS' | 'PRODUCCION' | 'TRANSFORMACION'
  ) => {
    setFiltroOperacion(op);
    setPaginaActual(1);
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroJornada('TODOS');
    setFechaPersonalizada('');
    setFiltroOperacion('TODOS');
    setPaginaActual(1);
  };

  const renderBadgeOperacion = (tipo: TipoMovimientoPlanta) => {
    switch (tipo) {
      case 'INGRESO_PRODUCCION':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-extrabold tracking-wide text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            LOTE PRODUCCIÓN
          </span>
        );
      case 'SALIDA_TRANSFORMACION':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-extrabold tracking-wide text-amber-900">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            TRANSF. SALIDA (GRANEL)
          </span>
        );
      case 'ENTRADA_TRANSFORMACION':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-extrabold tracking-wide text-sky-900">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />
            TRANSF. ENTRADA (VACÍO)
          </span>
        );
    }
  };

  const renderBadgeFormato = (formato: FormatoProductoEnum) => {
    if (formato === 'GRANEL') {
      return (
        <span className="inline-flex items-center rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-700">
          GRANEL
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded border border-[#FFCD00] bg-[#FFCD00]/25 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-900">
        {formato === 'VACIO' ? 'VACÍO' : formato}
      </span>
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-6 text-slate-900">
      {/* =====================================================================
          1. BARRA DE CONTEXTO COMPACTA (SIN HEADER ROJO DUPLICADO)
      ===================================================================== */}
      <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">
                Historial y Kardex de Planta
              </h1>
              <span className="hidden rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600 sm:inline-block">
                CU-P04
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500">
              Auditoría de lotes ingresados, transformaciones a vacío y mermas
              de turno
            </p>
          </div>

          <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 font-mono text-xs font-bold text-slate-800 sm:self-center">
            <Snowflake className="h-3.5 w-3.5 text-[#C8102E]" strokeWidth={2.2} />
            <span>
              Turno {perfilProduccion.turno_planta} •{' '}
              {perfilProduccion.responsable_camara_frio
                ? 'Cámara Activa'
                : 'Cámara Inactiva'}
            </span>
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. BARRA ÚNICA DE BÚSQUEDA, FILTROS Y RESUMEN EN LÍNEA
      ===================================================================== */}
      <section className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs sm:p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="relative lg:col-span-6">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400"
              strokeWidth={2.2}
            />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => handleCambiarBusqueda(e.target.value)}
              placeholder="Buscar por lote (LOT-...), producto, SKU u observación..."
              aria-label="Buscar en kardex de planta"
              className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 pr-10 pl-11 text-base text-slate-900 shadow-inner transition-all placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => handleCambiarBusqueda('')}
                aria-label="Limpiar búsqueda"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:col-span-6">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1">
              {(['TODOS', 'HOY', 'AYER'] as const).map((jornada) => {
                const activo = filtroJornada === jornada;
                const label =
                  jornada === 'TODOS'
                    ? 'Todos'
                    : jornada === 'HOY'
                      ? 'Hoy'
                      : 'Ayer';
                return (
                  <button
                    key={jornada}
                    type="button"
                    onClick={() => handleCambiarJornada(jornada)}
                    className={`touch-manipulation min-h-[40px] whitespace-nowrap rounded-lg px-3.5 text-xs font-bold transition-all sm:text-sm ${
                      activo
                        ? 'bg-[#C8102E] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white/80'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="relative min-w-[155px] flex-1">
              <Calendar
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500"
                strokeWidth={2.2}
              />
              <input
                type="date"
                value={fechaPersonalizada}
                onChange={(e) => handleCambiarFechaInput(e.target.value)}
                aria-label="Filtrar por fecha exacta"
                className={`min-h-[48px] w-full rounded-xl border-2 pr-3 pl-9 font-mono text-base tabular-nums transition-all focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none ${
                  filtroJornada === 'CUSTOM' && fechaPersonalizada
                    ? 'border-[#C8102E] bg-white font-bold text-slate-900'
                    : 'border-slate-200 bg-slate-50/70 text-slate-700 focus:border-[#C8102E] focus:bg-white'
                }`}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="mr-1 inline-flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              Operación:
            </span>

            <button
              type="button"
              onClick={() => handleCambiarOperacion('TODOS')}
              className={`touch-manipulation min-h-[42px] whitespace-nowrap rounded-xl border-2 px-3.5 text-xs font-bold transition-all sm:text-sm ${
                filtroOperacion === 'TODOS'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              Todos
            </button>

            <button
              type="button"
              onClick={() => handleCambiarOperacion('PRODUCCION')}
              className={`touch-manipulation min-h-[42px] whitespace-nowrap rounded-xl border-2 px-3.5 text-xs font-bold transition-all sm:text-sm ${
                filtroOperacion === 'PRODUCCION'
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-emerald-200 bg-emerald-50/60 text-emerald-900 hover:bg-emerald-100/70'
              }`}
            >
              Lotes Producidos
            </button>

            <button
              type="button"
              onClick={() => handleCambiarOperacion('TRANSFORMACION')}
              className={`touch-manipulation min-h-[42px] whitespace-nowrap rounded-xl border-2 px-3.5 text-xs font-bold transition-all sm:text-sm ${
                filtroOperacion === 'TRANSFORMACION'
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-amber-200 bg-amber-50/60 text-amber-900 hover:bg-amber-100/70'
              }`}
            >
              Transformaciones
            </button>
          </div>

          {(busqueda ||
            filtroJornada !== 'TODOS' ||
            filtroOperacion !== 'TODOS') && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-[#C8102E] hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Restablecer filtros
            </button>
          )}
        </div>

        {/* Resumen Compacto en Línea */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm lg:grid-cols-4">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between lg:border-r lg:border-slate-200 lg:pr-3">
            <span className="font-medium text-slate-600">Total Producido:</span>
            <span className="font-mono font-black tabular-nums text-emerald-700">
              {formatKg(resumenCompacto.totalProducido, true)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between lg:border-r lg:border-slate-200 lg:pr-3">
            <span className="font-medium text-slate-600">
              Transformado a Vacío:
            </span>
            <span className="font-mono font-black tabular-nums text-slate-900">
              {formatKg(resumenCompacto.transformadoAVacio, false)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between lg:border-r lg:border-slate-200 lg:pr-3">
            <span className="font-medium text-slate-600">Merma Acumulada:</span>
            <span className="font-mono font-black tabular-nums text-amber-700">
              {formatKg(resumenCompacto.mermaAcumulada, false)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-slate-600">Movimientos:</span>
            <span className="font-mono font-black tabular-nums text-slate-900">
              {resumenCompacto.totalRegistros}{' '}
              {resumenCompacto.totalRegistros === 1 ? 'registro' : 'registros'}
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. TABLA PAGINADA EN DESKTOP (7 COLUMNAS) Y TARJETAS EN MÓVIL
      ===================================================================== */}
      <section className="overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-xs">
        {movimientosPaginados.length === 0 ? (
          <div className="space-y-2 px-4 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-400">
              <Layers className="h-6 w-6" />
            </div>
            <p className="text-base font-bold text-slate-900">
              No se encontraron movimientos en el Kardex
            </p>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              Ajusta los filtros de fecha, tipo de operación o término de
              búsqueda para inspeccionar otros registros de planta.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-4 border-[#FFCD00] bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-white">
                    <th className="whitespace-nowrap px-3.5 py-3">
                      Fecha y Hora
                    </th>
                    <th className="whitespace-nowrap px-3.5 py-3">
                      Tipo de Operación
                    </th>
                    <th className="px-3.5 py-3">Producto y Formato</th>
                    <th className="px-3.5 py-3">Referencia / Trazabilidad</th>
                    <th className="whitespace-nowrap px-3.5 py-3 text-right">
                      Variación (Kg)
                    </th>
                    <th className="whitespace-nowrap px-3.5 py-3 text-right">
                      Saldo en Cámara
                    </th>
                    <th className="whitespace-nowrap px-3.5 py-3 text-center">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {movimientosPaginados.map((mov) => {
                    const { fecha, hora } = formatFechaHoraBolivia(
                      mov.fecha_movimiento
                    );
                    const esPositivo = mov.cantidad_kilos >= 0;
                    const mermaPct =
                      mov.transformacion &&
                      mov.transformacion.kilos_origen_usados > 0
                        ? (
                            (mov.transformacion.merma_kilos /
                              mov.transformacion.kilos_origen_usados) *
                            100
                          ).toFixed(2)
                        : null;

                    return (
                      <tr
                        key={mov.id_movimiento}
                        className="group transition-colors hover:bg-slate-50/90"
                      >
                        <td className="whitespace-nowrap px-3.5 py-3 font-mono text-xs tabular-nums text-slate-700">
                          <span className="font-bold text-slate-900">
                            {fecha}
                          </span>
                          <span className="mx-1 text-slate-400">•</span>
                          <span>{hora}</span>
                        </td>

                        <td className="whitespace-nowrap px-3.5 py-3">
                          {renderBadgeOperacion(mov.tipo_movimiento)}
                        </td>

                        <td className="px-3.5 py-3">
                          <div className="font-bold leading-snug text-slate-900">
                            {mov.producto.nombre_producto}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-500">
                              {mov.producto.codigo_sku}
                            </span>
                            {renderBadgeFormato(mov.producto.formato)}
                          </div>
                        </td>

                        <td className="px-3.5 py-3">
                          {mov.lote_produccion ? (
                            <div className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                              <Package className="h-3.5 w-3.5 text-[#C8102E]" />
                              {mov.lote_produccion.codigo_lote_interno}
                            </div>
                          ) : mov.transformacion ? (
                            <div className="font-mono text-xs tabular-nums text-slate-700">
                              <span className="font-semibold text-amber-800">
                                Merma:{' '}
                                {mov.transformacion.merma_kilos.toFixed(3)} kg
                              </span>
                              {mermaPct && (
                                <span className="ml-1 text-slate-500">
                                  • {mermaPct}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-slate-400">
                              —
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-3.5 py-3 text-right">
                          <span
                            className={`font-mono text-sm font-black tabular-nums ${
                              esPositivo ? 'text-emerald-700' : 'text-[#C8102E]'
                            }`}
                          >
                            {formatKg(mov.cantidad_kilos, true)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-3.5 py-3 text-right font-mono text-xs tabular-nums">
                          <div className="text-slate-500">
                            Anterior: {mov.saldo_anterior_kilos.toFixed(3)}
                          </div>
                          <div className="text-sm font-black text-slate-900">
                            Nuevo: {mov.saldo_nuevo_kilos.toFixed(3)} kg
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-3.5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setMovimientoSeleccionado(mov)}
                            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 transition-all hover:border-[#C8102E] hover:text-[#C8102E] focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                          >
                            <Eye className="h-3.5 w-3.5" strokeWidth={2.2} />
                            Detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vista Móvil (< md) */}
            <div className="divide-y divide-slate-200 md:hidden">
              {movimientosPaginados.map((mov) => {
                const { fecha, hora } = formatFechaHoraBolivia(
                  mov.fecha_movimiento
                );
                const esPositivo = mov.cantidad_kilos >= 0;
                const mermaPct =
                  mov.transformacion &&
                  mov.transformacion.kilos_origen_usados > 0
                    ? (
                        (mov.transformacion.merma_kilos /
                          mov.transformacion.kilos_origen_usados) *
                        100
                      ).toFixed(2)
                    : null;

                return (
                  <article
                    key={mov.id_movimiento}
                    className="space-y-2.5 bg-white p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold tabular-nums text-slate-600">
                        {fecha} • {hora}
                      </span>
                      {renderBadgeOperacion(mov.tipo_movimiento)}
                    </div>

                    <div>
                      <h3 className="text-sm font-black leading-snug text-slate-900">
                        {mov.producto.nombre_producto}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">
                          {mov.producto.codigo_sku}
                        </span>
                        {renderBadgeFormato(mov.producto.formato)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2">
                      <div className="text-xs">
                        {mov.lote_produccion ? (
                          <span className="font-mono font-bold text-slate-800">
                            Lote: {mov.lote_produccion.codigo_lote_interno}
                          </span>
                        ) : mov.transformacion ? (
                          <span className="font-mono font-semibold tabular-nums text-amber-800">
                            Merma: {mov.transformacion.merma_kilos.toFixed(3)} kg (
                            {mermaPct}%)
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            Sin lote asociado
                          </span>
                        )}
                      </div>

                      <div
                        className={`font-mono text-base font-black tabular-nums ${
                          esPositivo ? 'text-emerald-700' : 'text-[#C8102E]'
                        }`}
                      >
                        {formatKg(mov.cantidad_kilos, true)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="font-mono text-xs tabular-nums">
                        <span className="block text-slate-500">
                          Ant: {mov.saldo_anterior_kilos.toFixed(3)} kg
                        </span>
                        <span className="font-black text-slate-900">
                          Nuevo: {mov.saldo_nuevo_kilos.toFixed(3)} kg
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setMovimientoSeleccionado(mov)}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-900 active:bg-slate-200"
                      >
                        <Eye
                          className="h-4 w-4 text-[#C8102E]"
                          strokeWidth={2.2}
                        />
                        Detalle
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {/* ===================================================================
            PIE DE PAGINACIÓN REAL
        =================================================================== */}
        <footer className="flex flex-col justify-between gap-3 border-t-2 border-slate-200 bg-slate-50 px-3.5 py-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 sm:justify-start sm:text-sm">
            <span className="font-mono tabular-nums">
              Mostrando{' '}
              <strong className="text-slate-900">
                {totalItems === 0 ? 0 : indiceInicio + 1}–{indiceFin}
              </strong>{' '}
              de <strong className="text-slate-900">{totalItems}</strong>{' '}
              movimientos
            </span>

            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
              {([10, 20, 50] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setItemsPorPagina(size);
                    setPaginaActual(1);
                  }}
                  className={`min-h-[34px] rounded-lg px-2.5 font-mono text-xs font-bold transition-colors ${
                    itemsPorPagina === size
                      ? 'bg-[#FFCD00] font-black text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {size}
                </button>
              ))}
              <span className="px-1.5 text-[11px] font-medium text-slate-500">
                / pág
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={paginaSegura <= 1}
              onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border-2 border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 transition-all hover:border-slate-300 disabled:pointer-events-none disabled:opacity-40 sm:text-sm"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>

            <span className="px-2 font-mono text-xs font-bold tabular-nums text-slate-700">
              {paginaSegura} / {totalPaginas}
            </span>

            <button
              type="button"
              disabled={paginaSegura >= totalPaginas}
              onClick={() =>
                setPaginaActual((p) => Math.min(totalPaginas, p + 1))
              }
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border-2 border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 transition-all hover:border-slate-300 disabled:pointer-events-none disabled:opacity-40 sm:text-sm"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </section>

      {/* =====================================================================
          4. MODAL LIGERO DE AUDITORÍA Y TRAZABILIDAD COMPLETA
      ===================================================================== */}
      {movimientoSeleccionado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-auditoria-titulo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setMovimientoSeleccionado(null)}
        >
          <div
            className="w-full overflow-hidden rounded-t-2xl border-2 border-slate-200 bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-1.5">
              <div className="w-2/3 bg-[#C8102E]" />
              <div className="w-1/3 bg-[#FFCD00]" />
            </div>

            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3.5">
              <div>
                <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Auditoría de Movimiento • MOV-
                  {String(movimientoSeleccionado.id_movimiento).padStart(
                    5,
                    '0'
                  )}
                </span>
                <h2
                  id="modal-auditoria-titulo"
                  className="text-base font-black text-slate-900 sm:text-lg"
                >
                  Detalle de Trazabilidad
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setMovimientoSeleccionado(null)}
                aria-label="Cerrar modal"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[75vh] space-y-4 overflow-y-auto p-4 text-sm">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {renderBadgeOperacion(movimientoSeleccionado.tipo_movimiento)}
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-600">
                    <Clock className="h-3.5 w-3.5" />
                    {
                      formatFechaHoraBolivia(
                        movimientoSeleccionado.fecha_movimiento
                      ).fecha
                    }{' '}
                    •{' '}
                    {
                      formatFechaHoraBolivia(
                        movimientoSeleccionado.fecha_movimiento
                      ).hora
                    }
                  </span>
                </div>

                <p className="pt-1 text-base font-black text-slate-900">
                  {movimientoSeleccionado.producto.nombre_producto}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-600">
                    SKU: {movimientoSeleccionado.producto.codigo_sku}
                  </span>
                  {renderBadgeFormato(movimientoSeleccionado.producto.formato)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono tabular-nums">
                <div>
                  <span className="block font-sans text-[11px] text-slate-500">
                    Saldo Anterior
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {movimientoSeleccionado.saldo_anterior_kilos.toFixed(3)} kg
                  </span>
                </div>

                <div className="border-x border-slate-200 px-2">
                  <span className="block font-sans text-[11px] text-slate-500">
                    Variación
                  </span>
                  <span
                    className={`text-sm font-black ${
                      movimientoSeleccionado.cantidad_kilos >= 0
                        ? 'text-emerald-700'
                        : 'text-[#C8102E]'
                    }`}
                  >
                    {formatKg(movimientoSeleccionado.cantidad_kilos, true)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="block font-sans text-[11px] text-slate-500">
                    Saldo Nuevo
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {movimientoSeleccionado.saldo_nuevo_kilos.toFixed(3)} kg
                  </span>
                </div>
              </div>

              {movimientoSeleccionado.lote_produccion && (
                <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    Trazabilidad de Lote de Planta
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                    <div>
                      <span className="block font-sans text-slate-600">
                        Código Lote Interno:
                      </span>
                      <strong className="text-slate-900">
                        {
                          movimientoSeleccionado.lote_produccion
                            .codigo_lote_interno
                        }
                      </strong>
                    </div>
                    <div>
                      <span className="block font-sans text-slate-600">
                        Fecha Elaboración:
                      </span>
                      <strong className="text-slate-900">
                        {
                          movimientoSeleccionado.lote_produccion
                            .fecha_elaboracion
                        }
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {movimientoSeleccionado.transformacion && (
                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-900">
                    <Scale className="h-4 w-4 text-amber-700" />
                    Balance de Transformación Granel → Vacío
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs tabular-nums">
                    <div>
                      <span className="block font-sans text-slate-600">
                        Origen Granel:
                      </span>
                      <strong className="text-slate-900">
                        {movimientoSeleccionado.transformacion.kilos_origen_usados.toFixed(
                          3
                        )}{' '}
                        kg
                      </strong>
                    </div>
                    <div>
                      <span className="block font-sans text-slate-600">
                        Destino Vacío:
                      </span>
                      <strong className="text-emerald-800">
                        {movimientoSeleccionado.transformacion.kilos_destino_obtenidos.toFixed(
                          3
                        )}{' '}
                        kg
                      </strong>
                    </div>
                    <div>
                      <span className="block font-sans text-slate-600">
                        Merma Proceso:
                      </span>
                      <strong className="text-amber-900">
                        {movimientoSeleccionado.transformacion.merma_kilos.toFixed(
                          3
                        )}{' '}
                        kg (
                        {movimientoSeleccionado.transformacion
                          .kilos_origen_usados > 0
                          ? (
                              (movimientoSeleccionado.transformacion
                                .merma_kilos /
                                movimientoSeleccionado.transformacion
                                  .kilos_origen_usados) *
                              100
                            ).toFixed(2)
                          : '0.00'}
                        %)
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-2 text-xs">
                  <UserCheck className="h-4 w-4 shrink-0 text-[#C8102E]" />
                  <span className="text-slate-500">Responsable en Planta:</span>
                  <strong className="text-slate-900">
                    {movimientoSeleccionado.usuario.nombre_completo}
                  </strong>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                    <FileText className="h-3.5 w-3.5" />
                    Observación de Turno
                  </div>
                  <p className="text-xs leading-relaxed text-slate-800 sm:text-sm">
                    {movimientoSeleccionado.observacion ||
                      'Sin observaciones registradas.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 p-3.5">
              <button
                type="button"
                onClick={() => setMovimientoSeleccionado(null)}
                className="min-h-[48px] w-full rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] text-sm font-black tracking-wide text-white transition-all active:translate-y-[2px] active:border-b-2"
              >
                CERRAR AUDITORÍA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

