'use client';

import React, { useMemo, useState, useTransition } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  History,
  Loader2,
  Package,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  obtenerBitacoraMovimientosKardexAction,
  obtenerReporteSemanalInventarioAction,
  type MovimientoKardexAuditoriaRow,
  type ReporteSemanalInventarioData,
} from '@/actions/admin.actions';
import type { TipoMovimientoEnum } from '@/types/database.types';

export type TabKardexId = 'CUADRE_SALDOS' | 'BITACORA_KARDEX';

export interface KardexAuditoriaClientProps {
  reporteSemanalInicial: ReporteSemanalInventarioData;
  movimientosKardexInicial: MovimientoKardexAuditoriaRow[];
  fechaHoyBolivia?: string;
}

const TIMEZONE_BOLIVIA = 'America/La_Paz';

const OPCIONES_TIPO_MOVIMIENTO: {
  value: 'TODOS' | TipoMovimientoEnum;
  label: string;
}[] = [
  { value: 'TODOS', label: 'Todos los movimientos' },
  { value: 'INGRESO_PRODUCCION', label: 'INGRESO_PRODUCCION' },
  { value: 'SALIDA_VENTA', label: 'SALIDA_VENTA' },
  { value: 'SALIDA_CORTESIA', label: 'SALIDA_CORTESIA' },
  { value: 'REINGRESO_ANULACION', label: 'REINGRESO_ANULACION' },
  { value: 'SALIDA_TRANSFORMACION', label: 'SALIDA_TRANSFORMACION' },
  { value: 'ENTRADA_TRANSFORMACION', label: 'ENTRADA_TRANSFORMACION' },
];

function obtenerFechaBoliviaIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function sumarDiasIso(isoYmd: string, dias: number): string {
  const [y, m, d] = isoYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function obtenerSemanaOperativaLunesSabado(isoYmd: string): {
  desde: string;
  hasta: string;
} {
  const [y, m, d] = isoYmd.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = utcDate.getUTCDay();
  const offsetLunes = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const desde = sumarDiasIso(isoYmd, offsetLunes);
  const hasta = sumarDiasIso(desde, 5);
  return { desde, hasta };
}

function normalizarFechaYmd(rawFecha: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawFecha)) return rawFecha;
  const parsed = new Date(rawFecha);
  if (Number.isNaN(parsed.getTime())) return rawFecha.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
}

function formatFechaDDMMYYYY(isoDate: string): string {
  const ymd = normalizarFechaYmd(isoDate);
  const parts = ymd.split('-');
  if (parts.length !== 3) return isoDate || '—';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatFechaHoraBolivia(isoTs: string): string {
  const parsed = new Date(isoTs);
  if (Number.isNaN(parsed.getTime())) return isoTs;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE_BOLIVIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(parsed);

  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get(
    'minute'
  )}:${get('second')}`;
}

function formatKg(valor: number): string {
  return valor.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatNotaPadded(nro: number | null): string {
  if (nro === null || nro === undefined) return 'S/N';
  return `NV-${String(nro).padStart(6, '0')}`;
}

function getBadgeMovimiento(tipo: TipoMovimientoEnum): {
  label: string;
  classes: string;
} {
  switch (tipo) {
    case 'INGRESO_PRODUCCION':
      return {
        label: 'Ingreso Producción',
        classes: 'border-emerald-300 bg-emerald-100 text-emerald-950',
      };
    case 'ENTRADA_TRANSFORMACION':
      return {
        label: 'Entrada Transformación',
        classes: 'border-sky-300 bg-sky-100 text-sky-950',
      };
    case 'SALIDA_TRANSFORMACION':
      return {
        label: 'Salida Transformación',
        classes: 'border-indigo-300 bg-indigo-100 text-indigo-950',
      };
    case 'SALIDA_VENTA':
      return {
        label: 'Salida Venta',
        classes: 'border-rose-300 bg-rose-100 text-rose-950',
      };
    case 'SALIDA_CORTESIA':
      return {
        label: 'Salida Cortesía',
        classes: 'border-amber-300 bg-amber-100 text-amber-950',
      };
    case 'REINGRESO_ANULACION':
      return {
        label: 'Reingreso Rebote',
        classes: 'border-purple-300 bg-purple-100 text-purple-950',
      };
    case 'AJUSTE_AUDITORIA':
      return {
        label: 'Ajuste Auditoría',
        classes: 'border-slate-300 bg-slate-200 text-slate-900',
      };
  }
}

export function KardexAuditoriaClient({
  reporteSemanalInicial,
  movimientosKardexInicial,
  fechaHoyBolivia,
}: KardexAuditoriaClientProps) {
  const hoyIso = useMemo(
    () => fechaHoyBolivia ?? obtenerFechaBoliviaIso(),
    [fechaHoyBolivia]
  );

  const semanaActual = useMemo(
    () => obtenerSemanaOperativaLunesSabado(hoyIso),
    [hoyIso]
  );
  const ultimos30Desde = useMemo(() => sumarDiasIso(hoyIso, -29), [hoyIso]);

  const [activeTab, setActiveTab] = useState<TabKardexId>('CUADRE_SALDOS');

  const [reporteSemanal, setReporteSemanal] =
    useState<ReporteSemanalInventarioData>(reporteSemanalInicial);
  const [movimientosKardex, setMovimientosKardex] = useState<
    MovimientoKardexAuditoriaRow[]
  >(movimientosKardexInicial);

  const [fechaDesde, setFechaDesde] = useState<string>(
    reporteSemanalInicial.fecha_inicio
  );
  const [fechaHasta, setFechaHasta] = useState<string>(
    reporteSemanalInicial.fecha_fin
  );
  const [errorAuditoria, setErrorAuditoria] = useState<string | null>(null);
  const [cargando, startTransition] = useTransition();

  // Pestaña 1 — Cuadre de Saldos
  const [formatoCuadreFiltro, setFormatoCuadreFiltro] = useState<
    'TODOS' | 'GRANEL' | 'VACIO'
  >('TODOS');
  const [busquedaCuadre, setBusquedaCuadre] = useState<string>('');
  const [paginaCuadre, setPaginaCuadre] = useState<number>(1);
  const [itemsPorPaginaCuadre, setItemsPorPaginaCuadre] = useState<number>(15);

  // Pestaña 2 — Bitácora Kardex
  const [productoFiltro, setProductoFiltro] = useState<string>('TODOS');
  const [tipoMovimientoFiltro, setTipoMovimientoFiltro] = useState<
    'TODOS' | TipoMovimientoEnum
  >('TODOS');
  const [busquedaBitacora, setBusquedaBitacora] = useState<string>('');
  const [paginaBitacora, setPaginaBitacora] = useState<number>(1);
  const [itemsPorPaginaBitacora, setItemsPorPaginaBitacora] =
    useState<number>(15);

  const consultarPeriodo = (desde: string, hasta: string) => {
    setErrorAuditoria(null);
    startTransition(async () => {
      const [semanalRes, kardexRes] = await Promise.all([
        obtenerReporteSemanalInventarioAction({
          fechaInicio: desde,
          fechaFin: hasta,
        }),
        obtenerBitacoraMovimientosKardexAction({
          fechaInicio: desde,
          fechaFin: hasta,
          limit: 1500,
        }),
      ]);

      if (!semanalRes.ok) {
        setErrorAuditoria(semanalRes.error);
        return;
      }
      if (!kardexRes.ok) {
        setErrorAuditoria(kardexRes.error);
        return;
      }

      setReporteSemanal(semanalRes.data);
      setMovimientosKardex(kardexRes.rows);
      setFechaDesde(semanalRes.data.fecha_inicio);
      setFechaHasta(semanalRes.data.fecha_fin);
      setPaginaCuadre(1);
      setPaginaBitacora(1);
    });
  };

  // ============================================================================
  // FILTROS PESTAÑA 1 — CUADRE DE SALDOS POR PRODUCTO
  // ============================================================================
  const filasCuadreFiltradas = useMemo(() => {
    const q = busquedaCuadre.trim().toLowerCase();
    return reporteSemanal.filas.filter((row) => {
      if (
        formatoCuadreFiltro !== 'TODOS' &&
        row.formato !== formatoCuadreFiltro
      ) {
        return false;
      }
      if (!q) return true;
      return (
        row.codigo.toLowerCase().includes(q) ||
        row.descripcion.toLowerCase().includes(q)
      );
    });
  }, [reporteSemanal.filas, formatoCuadreFiltro, busquedaCuadre]);

  const totalesCuadreFiltrados = useMemo(() => {
    return filasCuadreFiltradas.reduce(
      (acc, r) => ({
        saldo_inicial: acc.saldo_inicial + r.saldo_inicial,
        ingresos_produccion: acc.ingresos_produccion + r.ingresos_produccion,
        transformacion_granel_a_vacio:
          acc.transformacion_granel_a_vacio + r.transformacion_granel_a_vacio,
        merma_por_escurrido: acc.merma_por_escurrido + r.merma_por_escurrido,
        total_ventas_despachadas:
          acc.total_ventas_despachadas + r.total_ventas_despachadas,
        total_salidas_por_cortesia:
          acc.total_salidas_por_cortesia + r.total_salidas_por_cortesia,
        reingresos_anulacion_rebotes:
          acc.reingresos_anulacion_rebotes + r.reingresos_anulacion_rebotes,
        saldo_final: acc.saldo_final + r.saldo_final,
      }),
      {
        saldo_inicial: 0,
        ingresos_produccion: 0,
        transformacion_granel_a_vacio: 0,
        merma_por_escurrido: 0,
        total_ventas_despachadas: 0,
        total_salidas_por_cortesia: 0,
        reingresos_anulacion_rebotes: 0,
        saldo_final: 0,
      }
    );
  }, [filasCuadreFiltradas]);

  const totalPaginasCuadre = Math.max(
    1,
    Math.ceil(filasCuadreFiltradas.length / itemsPorPaginaCuadre)
  );
  const paginaCuadreSegura = Math.min(paginaCuadre, totalPaginasCuadre);
  const inicioCuadre = (paginaCuadreSegura - 1) * itemsPorPaginaCuadre;
  const finCuadre = inicioCuadre + itemsPorPaginaCuadre;
  const cuadrePaginado = useMemo(
    () => filasCuadreFiltradas.slice(inicioCuadre, finCuadre),
    [filasCuadreFiltradas, inicioCuadre, finCuadre]
  );

  // ============================================================================
  // FILTROS PESTAÑA 2 — BITÁCORA DE AUDITORÍA KARDEX
  // ============================================================================
  const opcionesProductos = useMemo(() => {
    return reporteSemanal.filas.map((f) => ({
      id_producto: f.id_producto,
      label: `${f.codigo} — ${f.descripcion}`,
    }));
  }, [reporteSemanal.filas]);

  const movimientosFiltrados = useMemo(() => {
    const q = busquedaBitacora.trim().toLowerCase();
    return movimientosKardex.filter((m) => {
      if (
        productoFiltro !== 'TODOS' &&
        String(m.id_producto) !== productoFiltro
      ) {
        return false;
      }
      if (
        tipoMovimientoFiltro !== 'TODOS' &&
        m.tipo_movimiento !== tipoMovimientoFiltro
      ) {
        return false;
      }
      if (!q) return true;
      const refNota = m.nro_nota_venta
        ? formatNotaPadded(m.nro_nota_venta)
        : '';
      return (
        m.codigo_sku.toLowerCase().includes(q) ||
        m.nombre_producto.toLowerCase().includes(q) ||
        m.responsable.toLowerCase().includes(q) ||
        refNota.toLowerCase().includes(q) ||
        (m.codigo_lote_interno ?? '').toLowerCase().includes(q) ||
        (m.observacion ?? '').toLowerCase().includes(q)
      );
    });
  }, [
    movimientosKardex,
    productoFiltro,
    tipoMovimientoFiltro,
    busquedaBitacora,
  ]);

  const totalPaginasBitacora = Math.max(
    1,
    Math.ceil(movimientosFiltrados.length / itemsPorPaginaBitacora)
  );
  const paginaBitacoraSegura = Math.min(paginaBitacora, totalPaginasBitacora);
  const inicioBitacora = (paginaBitacoraSegura - 1) * itemsPorPaginaBitacora;
  const finBitacora = inicioBitacora + itemsPorPaginaBitacora;
  const bitacoraPaginada = useMemo(
    () => movimientosFiltrados.slice(inicioBitacora, finBitacora),
    [movimientosFiltrados, inicioBitacora, finBitacora]
  );

  return (
    <section
      aria-label="Auditoría de Kardex e Inventario"
      className="mx-auto w-full max-w-7xl space-y-4 overflow-x-hidden pb-6 text-slate-900"
    >
      {/* ====================================================================
          1. BARRA DE CONTEXTO SUPERIOR (SIN BOTONES DE DESCARGA EXCEL)
         ==================================================================== */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-2xs">
        <div className="absolute top-0 right-0 left-0 flex h-1">
          <div className="w-2/3 bg-[#C8102E]" />
          <div className="w-1/3 bg-[#FFCD00]" />
        </div>

        <div className="space-y-3 pt-0.5">
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">
                  Auditoría de Kardex e Inventario
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-800">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#C8102E]" />
                  <span>Auditoría Interna · Solo Pantalla</span>
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                Control físico de cámara de frío, transformaciones, mermas,
                cortesías y rebotes
              </p>
            </div>

            <span className="shrink-0 self-start rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-semibold text-slate-600 md:self-center">
              Periodo:{' '}
              <strong className="text-slate-900">
                {formatFechaDDMMYYYY(reporteSemanal.fecha_inicio)} —{' '}
                {formatFechaDDMMYYYY(reporteSemanal.fecha_fin)}
              </strong>
            </span>
          </div>

          {/* Selector de rango de fechas */}
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={cargando}
                onClick={() =>
                  consultarPeriodo(semanaActual.desde, semanaActual.hasta)
                }
                className={`touch-manipulation min-h-[42px] cursor-pointer whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold transition-all disabled:opacity-60 ${
                  reporteSemanal.fecha_inicio === semanaActual.desde &&
                  reporteSemanal.fecha_fin === semanaActual.hasta
                    ? 'border-slate-900 bg-slate-900 text-[#FFCD00] shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Semana Actual
              </button>
              <button
                type="button"
                disabled={cargando}
                onClick={() => consultarPeriodo(hoyIso, hoyIso)}
                className={`touch-manipulation min-h-[42px] cursor-pointer whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold transition-all disabled:opacity-60 ${
                  reporteSemanal.fecha_inicio === hoyIso &&
                  reporteSemanal.fecha_fin === hoyIso
                    ? 'border-slate-900 bg-slate-900 text-[#FFCD00] shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                disabled={cargando}
                onClick={() => consultarPeriodo(ultimos30Desde, hoyIso)}
                className={`touch-manipulation min-h-[42px] cursor-pointer whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold transition-all disabled:opacity-60 ${
                  reporteSemanal.fecha_inicio === ultimos30Desde &&
                  reporteSemanal.fecha_fin === hoyIso
                    ? 'border-slate-900 bg-slate-900 text-[#FFCD00] shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Últimos 30 días
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="kardex-fecha-desde"
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500"
                >
                  <Calendar className="h-3 w-3 text-[#C8102E]" />
                  <span>Desde</span>
                </label>
                <input
                  id="kardex-fecha-desde"
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="min-h-[42px] rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-[#C8102E] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="kardex-fecha-hasta"
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500"
                >
                  <Calendar className="h-3 w-3 text-[#C8102E]" />
                  <span>Hasta</span>
                </label>
                <input
                  id="kardex-fecha-hasta"
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="min-h-[42px] rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-[#C8102E] focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="button"
                disabled={cargando || !fechaDesde || !fechaHasta}
                onClick={() => consultarPeriodo(fechaDesde, fechaHasta)}
                className="inline-flex min-h-[42px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white px-4 text-xs font-extrabold text-slate-900 transition hover:bg-slate-900 hover:text-[#FFCD00] disabled:opacity-50"
              >
                {cargando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span>Consultar</span>
              </button>
            </div>
          </div>

          {errorAuditoria && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-900"
            >
              <span>{errorAuditoria}</span>
              <button
                type="button"
                onClick={() => setErrorAuditoria(null)}
                className="shrink-0 font-bold hover:underline"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          2. PESTAÑAS INTERNAS LIMPIAS (BOTONES DIRECTOS SIN DROPDOWN)
         ==================================================================== */}
      <div className="rounded-2xl border-2 border-slate-200/90 bg-white p-3 shadow-xs sm:p-4">
        <div
          role="tablist"
          aria-label="Vistas de auditoría Kardex"
          className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:grid-cols-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'CUADRE_SALDOS'}
            onClick={() => setActiveTab('CUADRE_SALDOS')}
            className={`touch-manipulation flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              activeTab === 'CUADRE_SALDOS'
                ? 'border-b-2 border-[#FFCD00] bg-[#C8102E] text-white shadow-xs'
                : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <Scale
              className={`h-4 w-4 shrink-0 ${
                activeTab === 'CUADRE_SALDOS'
                  ? 'text-[#FFCD00]'
                  : 'text-slate-500'
              }`}
            />
            <span className="truncate">
              Cuadre de Saldos por Producto ({reporteSemanal.filas.length} SKUs)
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'BITACORA_KARDEX'}
            onClick={() => setActiveTab('BITACORA_KARDEX')}
            className={`touch-manipulation flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              activeTab === 'BITACORA_KARDEX'
                ? 'border-b-2 border-[#FFCD00] bg-[#C8102E] text-white shadow-xs'
                : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <History
              className={`h-4 w-4 shrink-0 ${
                activeTab === 'BITACORA_KARDEX'
                  ? 'text-[#FFCD00]'
                  : 'text-slate-500'
              }`}
            />
            <span>Bitácora de Auditoría Kardex</span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                activeTab === 'BITACORA_KARDEX'
                  ? 'bg-red-950/60 text-[#FFCD00]'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {movimientosFiltrados.length}
            </span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          3. PESTAÑA 1 — CUADRE DE SALDOS POR PRODUCTO
         ==================================================================== */}
      {activeTab === 'CUADRE_SALDOS' && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-slate-200/90 bg-white p-3.5 shadow-xs">
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(
                [
                  { id: 'TODOS', label: 'Todos' },
                  { id: 'GRANEL', label: 'GRANEL' },
                  { id: 'VACIO', label: 'VACIO' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => {
                    setFormatoCuadreFiltro(fmt.id);
                    setPaginaCuadre(1);
                  }}
                  className={`min-h-[38px] cursor-pointer rounded-lg px-3 text-xs font-bold transition-all ${
                    formatoCuadreFiltro === fmt.id
                      ? 'bg-[#C8102E] text-white'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[230px] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busquedaCuadre}
                onChange={(e) => {
                  setBusquedaCuadre(e.target.value);
                  setPaginaCuadre(1);
                }}
                placeholder="Buscar por SKU o descripción..."
                className="min-h-[42px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 pr-8 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:outline-none"
              />
              {busquedaCuadre && (
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaCuadre('');
                    setPaginaCuadre(1);
                  }}
                  aria-label="Limpiar búsqueda cuadre"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-xs lg:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-[#FFCD00] bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-white">
                    <th className="whitespace-nowrap px-3 py-3">SKU</th>
                    <th className="px-3 py-3">Producto y Presentación</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">
                      Saldo Inicial (Kg)
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">
                      + Producción (Kg)
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">
                      ± Transf. Granel/Vacío (Kg)
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">
                      - Merma (Kg)
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">
                      - Ventas (Kg)
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">
                      - Cortesías (Kg)
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">
                      + Rebotes (Kg)
                    </th>
                    <th className="whitespace-nowrap bg-slate-800 px-3 py-3 text-right text-[#FFCD00]">
                      Saldo Final (Kg)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {cuadrePaginado.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="py-10 text-center text-sm text-slate-500"
                      >
                        No se encontraron productos para el filtro aplicado.
                      </td>
                    </tr>
                  ) : (
                    cuadrePaginado.map((row) => (
                      <tr
                        key={row.id_producto}
                        className="transition-colors even:bg-slate-50/40 hover:bg-slate-50/90"
                      >
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono font-extrabold text-slate-900">
                          {row.codigo}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900">
                          {row.descripcion}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                          {formatKg(row.saldo_inicial)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-700">
                          {formatKg(row.ingresos_produccion)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                          {row.transformacion_granel_a_vacio > 0 ? '+' : ''}
                          {formatKg(row.transformacion_granel_a_vacio)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                          {formatKg(row.merma_por_escurrido)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-bold tabular-nums text-[#C8102E]">
                          {formatKg(row.total_ventas_despachadas)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-amber-700">
                          {formatKg(row.total_salidas_por_cortesia)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-purple-700">
                          {formatKg(row.reingresos_anulacion_rebotes)}
                        </td>
                        <td className="whitespace-nowrap bg-amber-50/40 px-3 py-2.5 text-right font-mono font-black tabular-nums text-slate-900">
                          {formatKg(row.saldo_final)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filasCuadreFiltradas.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-100 text-xs font-extrabold uppercase text-slate-900">
                      <td
                        colSpan={2}
                        className="px-3 py-3 text-right tracking-wider text-slate-700"
                      >
                        TOTALES CONCILIADOS (KG):
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums">
                        {formatKg(totalesCuadreFiltrados.saldo_inicial)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-emerald-700">
                        {formatKg(totalesCuadreFiltrados.ingresos_produccion)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums">
                        {formatKg(
                          totalesCuadreFiltrados.transformacion_granel_a_vacio
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums">
                        {formatKg(totalesCuadreFiltrados.merma_por_escurrido)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-[#C8102E]">
                        {formatKg(
                          totalesCuadreFiltrados.total_ventas_despachadas
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-amber-800">
                        {formatKg(
                          totalesCuadreFiltrados.total_salidas_por_cortesia
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-purple-800">
                        {formatKg(
                          totalesCuadreFiltrados.reingresos_anulacion_rebotes
                        )}
                      </td>
                      <td className="whitespace-nowrap bg-amber-100/80 px-3 py-3 text-right font-mono text-sm tabular-nums text-slate-950">
                        {formatKg(totalesCuadreFiltrados.saldo_final)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="space-y-2.5 lg:hidden">
            {cuadrePaginado.length === 0 ? (
              <div className="rounded-2xl border-2 border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                No se encontraron productos para el filtro aplicado.
              </div>
            ) : (
              cuadrePaginado.map((row) => (
                <article
                  key={row.id_producto}
                  className="space-y-2 rounded-2xl border-2 border-slate-200/90 bg-white p-3.5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-extrabold text-slate-900">
                      {row.codigo}
                    </span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-xs font-black tabular-nums text-emerald-900">
                      Final: {formatKg(row.saldo_final)} kg
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    {row.descripcion}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] tabular-nums">
                    <div>
                      <span className="text-slate-500">Inicial: </span>
                      <strong>{formatKg(row.saldo_inicial)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">+ Prod: </span>
                      <strong className="text-emerald-700">
                        {formatKg(row.ingresos_produccion)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">± Transf: </span>
                      <strong>
                        {formatKg(row.transformacion_granel_a_vacio)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">- Merma: </span>
                      <strong>{formatKg(row.merma_por_escurrido)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">- Ventas: </span>
                      <strong className="text-[#C8102E]">
                        {formatKg(row.total_ventas_despachadas)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">- Cort / + Reb: </span>
                      <strong>
                        {formatKg(row.total_salidas_por_cortesia)} /{' '}
                        {formatKg(row.reingresos_anulacion_rebotes)}
                      </strong>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <PaginacionBar
            totalRegistros={filasCuadreFiltradas.length}
            inicio={inicioCuadre}
            fin={finCuadre}
            pagina={paginaCuadreSegura}
            totalPaginas={totalPaginasCuadre}
            itemsPorPagina={itemsPorPaginaCuadre}
            onChangeItemsPorPagina={(size) => {
              setItemsPorPaginaCuadre(size);
              setPaginaCuadre(1);
            }}
            onChangePagina={setPaginaCuadre}
          />
        </div>
      )}

      {/* ====================================================================
          4. PESTAÑA 2 — BITÁCORA DE AUDITORÍA KARDEX
         ==================================================================== */}
      {activeTab === 'BITACORA_KARDEX' && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border-2 border-slate-200/90 bg-white p-3.5 shadow-xs">
            <div className="relative min-w-[210px] flex-1">
              <Package className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                aria-label="Filtrar bitácora por producto"
                value={productoFiltro}
                onChange={(e) => {
                  setProductoFiltro(e.target.value);
                  setPaginaBitacora(1);
                }}
                className="min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 pr-3 pl-9 text-xs font-bold text-slate-800 focus:border-[#C8102E] focus:bg-white focus:outline-none"
              >
                <option value="TODOS">Producto: Todos los SKUs</option>
                {opcionesProductos.map((p) => (
                  <option key={p.id_producto} value={String(p.id_producto)}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[210px] flex-1">
              <Filter className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                aria-label="Filtrar bitácora por tipo de movimiento"
                value={tipoMovimientoFiltro}
                onChange={(e) => {
                  setTipoMovimientoFiltro(
                    e.target.value as 'TODOS' | TipoMovimientoEnum
                  );
                  setPaginaBitacora(1);
                }}
                className="min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 pr-3 pl-9 text-xs font-bold text-slate-800 focus:border-[#C8102E] focus:bg-white focus:outline-none"
              >
                {OPCIONES_TIPO_MOVIMIENTO.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[220px] flex-[1.4]">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busquedaBitacora}
                onChange={(e) => {
                  setBusquedaBitacora(e.target.value);
                  setPaginaBitacora(1);
                }}
                placeholder="Buscar SKU, NV-, lote, responsable u observación..."
                className="min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 py-1.5 pr-8 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:outline-none"
              />
              {busquedaBitacora && (
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaBitacora('');
                    setPaginaBitacora(1);
                  }}
                  aria-label="Limpiar búsqueda bitácora"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-xs lg:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-[#FFCD00] bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-white">
                    <th className="whitespace-nowrap px-3 py-3">
                      Fecha y Hora
                    </th>
                    <th className="px-3 py-3">SKU y Producto</th>
                    <th className="whitespace-nowrap px-3 py-3">
                      Tipo de Movimiento
                    </th>
                    <th className="whitespace-nowrap px-3 py-3">Referencia</th>
                    <th className="px-3 py-3">Responsable</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">
                      Variación (+/- Kg)
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">
                      Saldo Anterior (Kg)
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">
                      Saldo Nuevo (Kg)
                    </th>
                    <th className="px-3 py-3">Observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {bitacoraPaginada.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-10 text-center text-sm text-slate-500"
                      >
                        No existen movimientos en Kardex para el periodo y
                        filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    bitacoraPaginada.map((mov) => {
                      const badge = getBadgeMovimiento(mov.tipo_movimiento);
                      const refText = mov.nro_nota_venta
                        ? formatNotaPadded(mov.nro_nota_venta)
                        : mov.codigo_lote_interno
                        ? `Lote ${mov.codigo_lote_interno}`
                        : mov.referencia_pedido_id
                        ? `Pedido #${mov.referencia_pedido_id}`
                        : mov.tipo_movimiento.includes('TRANSFORMACION')
                        ? 'Transformación'
                        : `Mov #${mov.id_movimiento}`;

                      return (
                        <tr
                          key={mov.id_movimiento}
                          className="transition-colors even:bg-slate-50/40 hover:bg-slate-50/90"
                        >
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-slate-600">
                            {formatFechaHoraBolivia(mov.fecha_movimiento)}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-800">
                                {mov.codigo_sku}
                              </span>
                              <span className="font-bold text-slate-900">
                                {mov.nombre_producto}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                ({mov.formato})
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] font-extrabold ${badge.classes}`}
                            >
                              {mov.variacion_kilos >= 0 ? (
                                <ArrowUpRight className="h-3 w-3" />
                              ) : (
                                <ArrowDownLeft className="h-3 w-3" />
                              )}
                              {badge.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono font-bold text-slate-800">
                            {refText}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700">
                            {mov.responsable}
                          </td>
                          <td
                            className={`whitespace-nowrap px-3 py-2.5 text-right font-mono font-black tabular-nums ${
                              mov.variacion_kilos >= 0
                                ? 'text-emerald-700'
                                : 'text-[#C8102E]'
                            }`}
                          >
                            {mov.variacion_kilos >= 0 ? '+' : ''}
                            {formatKg(mov.variacion_kilos)} kg
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                            {formatKg(mov.saldo_anterior_kilos)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-bold tabular-nums text-slate-900">
                            {formatKg(mov.saldo_nuevo_kilos)}
                          </td>
                          <td className="max-w-[260px] px-3 py-2.5 text-slate-600">
                            {mov.observacion || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2.5 lg:hidden">
            {bitacoraPaginada.length === 0 ? (
              <div className="rounded-2xl border-2 border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                No existen movimientos en Kardex para los filtros aplicados.
              </div>
            ) : (
              bitacoraPaginada.map((mov) => {
                const badge = getBadgeMovimiento(mov.tipo_movimiento);
                const refText = mov.nro_nota_venta
                  ? formatNotaPadded(mov.nro_nota_venta)
                  : mov.codigo_lote_interno
                  ? `Lote ${mov.codigo_lote_interno}`
                  : mov.referencia_pedido_id
                  ? `Pedido #${mov.referencia_pedido_id}`
                  : `Mov #${mov.id_movimiento}`;

                return (
                  <article
                    key={mov.id_movimiento}
                    className="space-y-2 rounded-2xl border-2 border-slate-200/90 bg-white p-3.5 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] font-extrabold ${badge.classes}`}
                      >
                        {mov.variacion_kilos >= 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3" />
                        )}
                        {badge.label}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {formatFechaHoraBolivia(mov.fecha_movimiento)}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-extrabold text-slate-900">
                        <span className="mr-1.5 font-mono text-slate-600">
                          {mov.codigo_sku}
                        </span>
                        {mov.nombre_producto} ({mov.formato})
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600">
                        Ref: <strong className="font-mono">{refText}</strong> •{' '}
                        {mov.responsable}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs tabular-nums">
                      <div>
                        <span className="block text-[10px] text-slate-400">
                          Variación
                        </span>
                        <strong
                          className={
                            mov.variacion_kilos >= 0
                              ? 'text-emerald-700'
                              : 'text-[#C8102E]'
                          }
                        >
                          {mov.variacion_kilos >= 0 ? '+' : ''}
                          {formatKg(mov.variacion_kilos)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400">
                          Anterior
                        </span>
                        <span>{formatKg(mov.saldo_anterior_kilos)}</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] text-slate-400">
                          Nuevo
                        </span>
                        <strong className="text-slate-900">
                          {formatKg(mov.saldo_nuevo_kilos)}
                        </strong>
                      </div>
                    </div>

                    {mov.observacion && (
                      <p className="text-xs text-slate-600">
                        {mov.observacion}
                      </p>
                    )}
                  </article>
                );
              })
            )}
          </div>

          <PaginacionBar
            totalRegistros={movimientosFiltrados.length}
            inicio={inicioBitacora}
            fin={finBitacora}
            pagina={paginaBitacoraSegura}
            totalPaginas={totalPaginasBitacora}
            itemsPorPagina={itemsPorPaginaBitacora}
            onChangeItemsPorPagina={(size) => {
              setItemsPorPaginaBitacora(size);
              setPaginaBitacora(1);
            }}
            onChangePagina={setPaginaBitacora}
          />
        </div>
      )}
    </section>
  );
}

interface PaginacionBarProps {
  totalRegistros: number;
  inicio: number;
  fin: number;
  pagina: number;
  totalPaginas: number;
  itemsPorPagina: number;
  onChangeItemsPorPagina: (size: number) => void;
  onChangePagina: (updater: (prev: number) => number) => void;
}

function PaginacionBar({
  totalRegistros,
  inicio,
  fin,
  pagina,
  totalPaginas,
  itemsPorPagina,
  onChangeItemsPorPagina,
  onChangePagina,
}: PaginacionBarProps) {
  return (
    <footer className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs sm:flex-row sm:items-center">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-600 sm:justify-start">
        <span className="font-mono tabular-nums">
          Mostrando{' '}
          <strong className="text-slate-900">
            {totalRegistros === 0 ? 0 : inicio + 1}
          </strong>
          –
          <strong className="text-slate-900">
            {Math.min(fin, totalRegistros)}
          </strong>{' '}
          de <strong className="text-slate-900">{totalRegistros}</strong>{' '}
          registros
        </span>

        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {([15, 30, 50] as const).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onChangeItemsPorPagina(size)}
              className={`min-h-[32px] cursor-pointer rounded-lg px-2.5 font-mono text-xs font-bold transition-colors ${
                itemsPorPagina === size
                  ? 'bg-[#FFCD00] font-black text-slate-900'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {size}
            </button>
          ))}
          <span className="px-1 text-[11px] font-medium text-slate-500">
            / pág
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button
          type="button"
          disabled={pagina <= 1}
          onClick={() => onChangePagina((prev) => Math.max(1, prev - 1))}
          className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Anterior</span>
        </button>

        <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-xs font-bold tabular-nums text-slate-800">
          Pág. {pagina} / {totalPaginas}
        </span>

        <button
          type="button"
          disabled={pagina >= totalPaginas}
          onClick={() =>
            onChangePagina((prev) => Math.min(totalPaginas, prev + 1))
          }
          className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>Siguiente</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </footer>
  );
}
