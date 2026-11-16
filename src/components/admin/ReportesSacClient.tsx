'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck2,
  FileSpreadsheet,
  History,
  MapPin,
  Package,
  RotateCcw,
  Search,
  SlidersHorizontal,
  User,
  X,
} from 'lucide-react';
import {
  exportarBitacoraProductoExcel,
  exportarVentasSacExcel,
} from '@/lib/utils/export-excel';
import type {
  EstadoPedidoEnum,
  FormatoProductoEnum,
} from '@/types/database.types';

export type TipoMovimientoBitacora =
  | 'VENTA_DESPACHADA'
  | 'CORTESIA_0_BS'
  | 'INGRESO_PRODUCCION'
  | 'REINGRESO_REBOTE'
  | 'TRANSF_GRANEL_VACIO'
  | 'AJUSTE_AUDITORIA';

export interface VentaDiariaSacRow {
  id: string;
  nro_nota: string;
  fecha_venta: string;
  codigo_cliente: string;
  cliente: string;
  zona_mercado: string;
  vendedor: string;
  total_kilos_vendidos: number;
  total_kilos_cortesia: number;
  monto_total_bs: number;
  estado: EstadoPedidoEnum;
}

export interface LogProductoKardexRow {
  id: string;
  fecha_hora: string;
  fecha_iso: string;
  producto_id: number;
  codigo_sku: string;
  nombre_producto: string;
  presentacion: FormatoProductoEnum;
  tipo_movimiento: TipoMovimientoBitacora;
  documento_origen: string;
  cliente_destino: string;
  responsable: string;
  kilos_movimiento: number;
  saldo_resultante_kilos: number;
  valor_movimiento_bs: number;
}

export interface PerfilAdminReportes {
  id_usuario: number;
  nombre_completo: string;
  cargo_gerencial: string;
  puede_exportar_sac: boolean;
}

export type TabReporteId = 'VENTAS_SAC' | 'LOGS_PRODUCTO';

export interface ConfiguracionExcelTab {
  nombreArchivo: string;
  tituloHoja: string;
  columnasActivas: Record<string, boolean>;
  incluirFilaTotales: boolean;
  incluirColumnasCortesia: boolean;
  formatoNumericoContable: boolean;
}

export interface ReportesSacClientProps {
  ventasSac: VentaDiariaSacRow[];
  logsProducto: LogProductoKardexRow[];
  perfilAdmin: PerfilAdminReportes;
  fechaHoyBolivia?: string;
}

const TIMEZONE_BOLIVIA = 'America/La_Paz';

const COLS_VENTAS_SAC: { key: string; label: string }[] = [
  { key: 'nro_nota', label: 'Nº Nota' },
  { key: 'fecha_venta', label: 'Fecha' },
  { key: 'codigo_cliente', label: 'Cód. Cliente SAC' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'zona_mercado', label: 'Zona' },
  { key: 'vendedor', label: 'Vendedor' },
  { key: 'total_kilos_vendidos', label: 'Kilos Vendidos' },
  { key: 'total_kilos_cortesia', label: 'Kilos Cortesía' },
  { key: 'monto_total_bs', label: 'Monto Total (Bs.)' },
];

const COLS_LOGS_PRODUCTO: { key: string; label: string }[] = [
  { key: 'fecha_hora', label: 'Fecha y Hora' },
  { key: 'producto_sku', label: 'Producto / SKU' },
  { key: 'tipo_movimiento', label: 'Movimiento' },
  { key: 'documento_origen', label: 'Documento Origen' },
  { key: 'cliente_destino', label: 'Cliente / Destino' },
  { key: 'responsable', label: 'Responsable' },
  { key: 'kilos_movimiento', label: 'Kilos Mov.' },
  { key: 'saldo_valor', label: 'Saldo Resultante & Valor' },
];

const BADGE_MOVIMIENTO_META: Record<
  TipoMovimientoBitacora,
  { label: string; selectorLabel: string; className: string }
> = {
  VENTA_DESPACHADA: {
    label: 'VENTA DESPACHADA',
    selectorLabel: 'Venta Despachada',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  CORTESIA_0_BS: {
    label: 'CORTESÍA (0 BS)',
    selectorLabel: 'Cortesía (0 Bs)',
    className: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  INGRESO_PRODUCCION: {
    label: 'INGRESO PRODUCCIÓN',
    selectorLabel: 'Ingreso Producción',
    className: 'border-blue-300 bg-blue-50 text-blue-800',
  },
  REINGRESO_REBOTE: {
    label: 'REINGRESO REBOTE',
    selectorLabel: 'Reingreso Rebote',
    className: 'border-purple-300 bg-purple-50 text-purple-800',
  },
  TRANSF_GRANEL_VACIO: {
    label: 'TRANSF. A VACÍO',
    selectorLabel: 'Transformación Granel → Vacío',
    className: 'border-slate-300 bg-slate-100 text-slate-700',
  },
  AJUSTE_AUDITORIA: {
    label: 'AJUSTE AUDITORÍA',
    selectorLabel: 'Ajuste de Auditoría',
    className: 'border-slate-400 bg-slate-200 text-slate-900',
  },
};

function obtenerFechaBoliviaIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function restarDiasIso(isoYmd: string, dias: number): string {
  const [y, m, d] = isoYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - dias));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function primerDiaMesIso(isoYmd: string): string {
  return `${isoYmd.slice(0, 8)}01`;
}

function crearConfigDefault(
  tab: TabReporteId,
  fechaRef: string
): ConfiguracionExcelTab {
  if (tab === 'VENTAS_SAC') {
    return {
      nombreArchivo: `EUROALIMENTOS_SAC_${fechaRef}`,
      tituloHoja: 'EUROALIMENTOS SRL — DIARIO DE VENTAS SAC',
      columnasActivas: Object.fromEntries(
        COLS_VENTAS_SAC.map((c) => [c.key, true])
      ),
      incluirFilaTotales: true,
      incluirColumnasCortesia: true,
      formatoNumericoContable: true,
    };
  }
  return {
    nombreArchivo: `EUROALIMENTOS_BITACORA_${fechaRef}`,
    tituloHoja: 'EUROALIMENTOS SRL — BITÁCORA DE TRAZABILIDAD POR PRODUCTO',
    columnasActivas: Object.fromEntries(
      COLS_LOGS_PRODUCTO.map((c) => [c.key, true])
    ),
    incluirFilaTotales: true,
    incluirColumnasCortesia: true,
    formatoNumericoContable: true,
  };
}

function formatKg(valor: number, contable = true): string {
  return contable
    ? valor.toLocaleString('en-US', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })
    : String(Number(valor.toFixed(3)));
}

function formatBs(valor: number, contable = true): string {
  return contable
    ? valor.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : String(Number(valor.toFixed(2)));
}

function formatFechaDDMMYYYY(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function ReportesSacClient({
  ventasSac,
  logsProducto,
  perfilAdmin,
  fechaHoyBolivia,
}: ReportesSacClientProps) {
  const hoyIso = useMemo(
    () => fechaHoyBolivia ?? obtenerFechaBoliviaIso(),
    [fechaHoyBolivia]
  );

  const [activeTab, setActiveTab] = useState<TabReporteId>('VENTAS_SAC');

  const [presetActivo, setPresetActivo] = useState<
    'TODOS' | 'HOY' | 'AYER' | 'SEMANA' | 'MES' | 'PERSONALIZADO'
  >('MES');
  const [fechaDesde, setFechaDesde] = useState<string>(() =>
    primerDiaMesIso(fechaHoyBolivia ?? obtenerFechaBoliviaIso())
  );
  const [fechaHasta, setFechaHasta] = useState<string>(
    () => fechaHoyBolivia ?? obtenerFechaBoliviaIso()
  );
  const [busqueda, setBusqueda] = useState<string>('');

  // Filtros contextuales Pestaña A
  const [vendedorFiltro, setVendedorFiltro] = useState<string>('TODOS');
  const [zonaFiltro, setZonaFiltro] = useState<string>('TODAS');

  // Filtros contextuales Pestaña B
  const [formatoFiltro, setFormatoFiltro] = useState<
    'TODOS' | FormatoProductoEnum
  >('TODOS');
  const [productoFiltro, setProductoFiltro] = useState<string>('TODOS');
  const [tipoMovimientoFiltro, setTipoMovimientoFiltro] = useState<
    'TODOS' | TipoMovimientoBitacora
  >('TODOS');

  const [panelPersonalizarAbierto, setPanelPersonalizarAbierto] =
    useState<boolean>(false);
  const [configsExcel, setConfigsExcel] = useState<
    Record<TabReporteId, ConfiguracionExcelTab>
  >(() => ({
    VENTAS_SAC: crearConfigDefault('VENTAS_SAC', hoyIso),
    LOGS_PRODUCTO: crearConfigDefault('LOGS_PRODUCTO', hoyIso),
  }));

  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [itemsPorPagina, setItemsPorPagina] = useState<number>(10);

  const [exportando, setExportando] = useState<boolean>(false);
  const [notificacionExport, setNotificacionExport] = useState<{
    tipo: 'ok' | 'error';
    mensaje: string;
  } | null>(null);

  const configActual = configsExcel[activeTab];
  const listaColumnasMeta =
    activeTab === 'VENTAS_SAC' ? COLS_VENTAS_SAC : COLS_LOGS_PRODUCTO;

  const conteoColumnasActivas = useMemo(() => {
    const total = listaColumnasMeta.length;
    const activas = listaColumnasMeta.filter((c) => {
      if (
        activeTab === 'VENTAS_SAC' &&
        c.key === 'total_kilos_cortesia' &&
        !configActual.incluirColumnasCortesia
      ) {
        return false;
      }
      return Boolean(configActual.columnasActivas[c.key]);
    }).length;
    return { activas, total };
  }, [listaColumnasMeta, activeTab, configActual]);

  const opcionesVendedoresSac = useMemo(() => {
    return Array.from(new Set(ventasSac.map((v) => v.vendedor)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'));
  }, [ventasSac]);

  const opcionesZonasSac = useMemo(() => {
    return Array.from(new Set(ventasSac.map((v) => v.zona_mercado)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'));
  }, [ventasSac]);

  const opcionesProductosLogs = useMemo(() => {
    const mapa = new Map<number, string>();
    logsProducto.forEach((l) => {
      if (!mapa.has(l.producto_id)) {
        mapa.set(l.producto_id, `${l.nombre_producto} (${l.codigo_sku})`);
      }
    });
    return Array.from(mapa.entries())
      .map(([id, label]) => ({ id: String(id), label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [logsProducto]);

  const aplicarPresetFecha = (
    preset: 'TODOS' | 'HOY' | 'AYER' | 'SEMANA' | 'MES'
  ) => {
    setPresetActivo(preset);
    setPaginaActual(1);

    let nuevaDesde = '';
    let nuevaHasta = '';

    if (preset === 'HOY') {
      nuevaDesde = hoyIso;
      nuevaHasta = hoyIso;
    } else if (preset === 'AYER') {
      const ayer = restarDiasIso(hoyIso, 1);
      nuevaDesde = ayer;
      nuevaHasta = ayer;
    } else if (preset === 'SEMANA') {
      nuevaDesde = restarDiasIso(hoyIso, 6);
      nuevaHasta = hoyIso;
    } else if (preset === 'MES') {
      nuevaDesde = primerDiaMesIso(hoyIso);
      nuevaHasta = hoyIso;
    }

    setFechaDesde(nuevaDesde);
    setFechaHasta(nuevaHasta);

    const sufijoArchivo = nuevaHasta || hoyIso;
    setConfigsExcel((prev) => ({
      VENTAS_SAC: {
        ...prev.VENTAS_SAC,
        nombreArchivo: `EUROALIMENTOS_SAC_${sufijoArchivo}`,
      },
      LOGS_PRODUCTO: {
        ...prev.LOGS_PRODUCTO,
        nombreArchivo: `EUROALIMENTOS_BITACORA_${sufijoArchivo}`,
      },
    }));
  };

  const handleCambiarTab = (tab: TabReporteId) => {
    setActiveTab(tab);
    setBusqueda('');
    setPaginaActual(1);
    setNotificacionExport(null);
  };

  const ventasSacFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ventasSac.filter((row) => {
      if (row.estado !== 'DESPACHADO') return false;

      const enRango =
        (!fechaDesde || row.fecha_venta >= fechaDesde) &&
        (!fechaHasta || row.fecha_venta <= fechaHasta);
      if (!enRango) return false;

      if (vendedorFiltro !== 'TODOS' && row.vendedor !== vendedorFiltro) {
        return false;
      }

      if (zonaFiltro !== 'TODAS' && row.zona_mercado !== zonaFiltro) {
        return false;
      }

      if (!q) return true;
      return (
        row.nro_nota.toLowerCase().includes(q) ||
        row.codigo_cliente.toLowerCase().includes(q) ||
        row.cliente.toLowerCase().includes(q) ||
        row.zona_mercado.toLowerCase().includes(q) ||
        row.vendedor.toLowerCase().includes(q)
      );
    });
  }, [
    ventasSac,
    fechaDesde,
    fechaHasta,
    vendedorFiltro,
    zonaFiltro,
    busqueda,
  ]);

  const resumenSac = useMemo(() => {
    return ventasSacFiltradas.reduce(
      (acc, r) => {
        acc.notas += 1;
        acc.kilosFacturados += r.total_kilos_vendidos;
        acc.kilosCortesia += r.total_kilos_cortesia;
        acc.totalIngresoBs += r.monto_total_bs;
        return acc;
      },
      { notas: 0, kilosFacturados: 0, kilosCortesia: 0, totalIngresoBs: 0 }
    );
  }, [ventasSacFiltradas]);

  const logsProductoFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return logsProducto.filter((row) => {
      const enRango =
        (!fechaDesde || row.fecha_iso >= fechaDesde) &&
        (!fechaHasta || row.fecha_iso <= fechaHasta);
      if (!enRango) return false;

      if (formatoFiltro !== 'TODOS' && row.presentacion !== formatoFiltro) {
        return false;
      }

      if (
        productoFiltro !== 'TODOS' &&
        String(row.producto_id) !== productoFiltro
      ) {
        return false;
      }

      if (
        tipoMovimientoFiltro !== 'TODOS' &&
        row.tipo_movimiento !== tipoMovimientoFiltro
      ) {
        return false;
      }

      if (
        !configActual.incluirColumnasCortesia &&
        row.tipo_movimiento === 'CORTESIA_0_BS'
      ) {
        return false;
      }

      if (!q) return true;
      return (
        row.codigo_sku.toLowerCase().includes(q) ||
        row.nombre_producto.toLowerCase().includes(q) ||
        row.documento_origen.toLowerCase().includes(q) ||
        row.cliente_destino.toLowerCase().includes(q) ||
        row.responsable.toLowerCase().includes(q)
      );
    });
  }, [
    logsProducto,
    fechaDesde,
    fechaHasta,
    formatoFiltro,
    productoFiltro,
    tipoMovimientoFiltro,
    configActual.incluirColumnasCortesia,
    busqueda,
  ]);

  const resumenLogs = useMemo(() => {
    return logsProductoFiltrados.reduce(
      (acc, r) => {
        acc.movimientos += 1;
        if (r.tipo_movimiento === 'INGRESO_PRODUCCION') {
          acc.entradasProduccion += Math.max(0, r.kilos_movimiento);
        }
        if (r.tipo_movimiento === 'VENTA_DESPACHADA') {
          acc.salidasVenta += Math.abs(r.kilos_movimiento);
        }
        if (r.tipo_movimiento === 'CORTESIA_0_BS') {
          acc.salidasCortesia += Math.abs(r.kilos_movimiento);
        }
        if (r.tipo_movimiento === 'REINGRESO_REBOTE') {
          acc.reingresosRebote += Math.max(0, r.kilos_movimiento);
        }
        return acc;
      },
      {
        movimientos: 0,
        entradasProduccion: 0,
        salidasVenta: 0,
        salidasCortesia: 0,
        reingresosRebote: 0,
      }
    );
  }, [logsProductoFiltrados]);

  const totalRegistros =
    activeTab === 'VENTAS_SAC'
      ? ventasSacFiltradas.length
      : logsProductoFiltrados.length;

  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / itemsPorPagina));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const indiceInicio = (paginaSegura - 1) * itemsPorPagina;
  const indiceFin = indiceInicio + itemsPorPagina;

  const sacPaginado = useMemo(
    () => ventasSacFiltradas.slice(indiceInicio, indiceFin),
    [ventasSacFiltradas, indiceInicio, indiceFin]
  );

  const logsPaginados = useMemo(
    () => logsProductoFiltrados.slice(indiceInicio, indiceFin),
    [logsProductoFiltrados, indiceInicio, indiceFin]
  );

  const handleDescargarExcel = () => {
    if (!perfilAdmin.puede_exportar_sac || totalRegistros === 0) return;

    setExportando(true);
    setNotificacionExport(null);

    try {
      if (activeTab === 'VENTAS_SAC') {
        exportarVentasSacExcel(
          ventasSacFiltradas.map((r) => ({
            nro_nota: r.nro_nota,
            fecha_venta: formatFechaDDMMYYYY(r.fecha_venta),
            codigo_cliente: r.codigo_cliente,
            cliente: r.cliente,
            zona_mercado: r.zona_mercado,
            vendedor: r.vendedor,
            total_kilos_vendidos: r.total_kilos_vendidos,
            total_kilos_cortesia: r.total_kilos_cortesia,
            monto_total_bs: r.monto_total_bs,
          })),
          {
            ...configActual,
            rangoDesde: fechaDesde ? formatFechaDDMMYYYY(fechaDesde) : 'Inicio',
            rangoHasta: fechaHasta ? formatFechaDDMMYYYY(fechaHasta) : 'Actual',
          }
        );
      } else {
        exportarBitacoraProductoExcel(
          logsProductoFiltrados.map((r) => ({
            fecha_hora: r.fecha_hora,
            codigo_sku: r.codigo_sku,
            nombre_producto: r.nombre_producto,
            presentacion: r.presentacion,
            tipo_movimiento_label:
              BADGE_MOVIMIENTO_META[r.tipo_movimiento].label,
            documento_origen: r.documento_origen,
            cliente_destino: r.cliente_destino,
            responsable: r.responsable,
            kilos_movimiento: r.kilos_movimiento,
            saldo_resultante_kilos: r.saldo_resultante_kilos,
            valor_movimiento_bs: r.valor_movimiento_bs,
            es_cortesia: r.tipo_movimiento === 'CORTESIA_0_BS',
          })),
          {
            ...configActual,
            rangoDesde: fechaDesde ? formatFechaDDMMYYYY(fechaDesde) : 'Inicio',
            rangoHasta: fechaHasta ? formatFechaDDMMYYYY(fechaHasta) : 'Actual',
          }
        );
      }

      const nombreLimpio = configActual.nombreArchivo.replace(/\.xlsx$/i, '');
      setNotificacionExport({
        tipo: 'ok',
        mensaje: `Archivo generado: ${nombreLimpio}.xlsx (${totalRegistros} registros • ${conteoColumnasActivas.activas} columnas)`,
      });
    } catch {
      setNotificacionExport({
        tipo: 'error',
        mensaje:
          'No se pudo generar el archivo .xlsx. Intente nuevamente o reduzca el rango.',
      });
    } finally {
      setExportando(false);
    }
  };

  const mostrarColCortesiaSac =
    configActual.columnasActivas.total_kilos_cortesia &&
    configActual.incluirColumnasCortesia;

  const usaDecimalesContables = configActual.formatoNumericoContable;

  return (
    <section
      aria-label="Reportes Contables SAC y Bitácora de Producto"
      className="mx-auto w-full max-w-7xl space-y-4 pb-6 text-slate-900"
    >
      {/* ====================================================================
          1. BARRA DE CONTEXTO COMPACTA (SIN HEADER ROJO DUPLICADO)
         ==================================================================== */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
        <div className="absolute top-0 right-0 left-0 flex h-1">
          <div className="w-2/3 bg-[#C8102E]" />
          <div className="w-1/3 bg-[#FFCD00]" />
        </div>

        <div className="flex flex-col justify-between gap-2 pt-0.5 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">
                Reportes Contables SAC y Bitácora de Producto
              </h1>
              <span className="hidden rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600 md:inline-flex">
                RF-16 • CU-A03
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              Exportación oficial a Excel (.xlsx) para asientos SAC y auditoría
              cronológica por SKU
            </p>
          </div>

          <div className="shrink-0 self-start sm:self-center">
            <span
              title={`${perfilAdmin.cargo_gerencial}: ${perfilAdmin.nombre_completo}`}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800"
            >
              <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-[#059669]" />
              <span>Contabilidad SAC • Exportación .XLSX</span>
            </span>
          </div>
        </div>
      </header>

      {/* ====================================================================
          2. SELECTOR DE 2 PESTAÑAS, FILTROS Y BARRA DE EXPORTACIÓN
         ==================================================================== */}
      <div className="space-y-3.5 rounded-2xl border-2 border-slate-200/90 bg-white p-3 shadow-xs sm:p-4">
        <div
          role="tablist"
          aria-label="Seleccionar vista contable o bitácora de producto"
          className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:grid-cols-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'VENTAS_SAC'}
            onClick={() => handleCambiarTab('VENTAS_SAC')}
            className={`touch-manipulation flex min-h-[48px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              activeTab === 'VENTAS_SAC'
                ? 'border-b-2 border-[#FFCD00] bg-[#C8102E] text-white shadow-xs'
                : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet
              className={`h-4 w-4 shrink-0 ${
                activeTab === 'VENTAS_SAC' ? 'text-[#FFCD00]' : 'text-slate-500'
              }`}
            />
            <span>Diario de Ventas SAC</span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                activeTab === 'VENTAS_SAC'
                  ? 'bg-red-950/60 text-[#FFCD00]'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {ventasSacFiltradas.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'LOGS_PRODUCTO'}
            onClick={() => handleCambiarTab('LOGS_PRODUCTO')}
            className={`touch-manipulation flex min-h-[48px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              activeTab === 'LOGS_PRODUCTO'
                ? 'border-b-2 border-[#FFCD00] bg-[#C8102E] text-white shadow-xs'
                : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <History
              className={`h-4 w-4 shrink-0 ${
                activeTab === 'LOGS_PRODUCTO'
                  ? 'text-[#FFCD00]'
                  : 'text-slate-500'
              }`}
            />
            <span>Bitácora / Logs por Producto</span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                activeTab === 'LOGS_PRODUCTO'
                  ? 'bg-red-950/60 text-[#FFCD00]'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {logsProductoFiltrados.length}
            </span>
          </button>
        </div>

        {/* Presets Fecha + Rango Desde/Hasta + Botones Excel */}
        <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-end">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 lg:pb-0">
              {(
                [
                  { id: 'TODOS', label: 'Todos' },
                  { id: 'HOY', label: 'Hoy' },
                  { id: 'AYER', label: 'Ayer' },
                  { id: 'SEMANA', label: 'Esta Semana' },
                  { id: 'MES', label: 'Este Mes' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => aplicarPresetFecha(preset.id)}
                  className={`touch-manipulation min-h-[44px] cursor-pointer whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                    presetActivo === preset.id
                      ? 'border-slate-900 bg-slate-900 text-[#FFCD00] shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="filtro-fecha-desde"
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500"
                >
                  <Calendar className="h-3 w-3 text-[#C8102E]" />
                  <span>Desde</span>
                </label>
                <input
                  id="filtro-fecha-desde"
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => {
                    setFechaDesde(e.target.value);
                    setPresetActivo('PERSONALIZADO');
                    setPaginaActual(1);
                  }}
                  className="min-h-[44px] rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3 py-1.5 font-mono text-base tabular-nums text-slate-900 transition-all focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none sm:text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="filtro-fecha-hasta"
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500"
                >
                  <Calendar className="h-3 w-3 text-[#C8102E]" />
                  <span>Hasta</span>
                </label>
                <input
                  id="filtro-fecha-hasta"
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => {
                    setFechaHasta(e.target.value);
                    setPresetActivo('PERSONALIZADO');
                    setPaginaActual(1);
                  }}
                  className="min-h-[44px] rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3 py-1.5 font-mono text-base tabular-nums text-slate-900 transition-all focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setPanelPersonalizarAbierto((prev) => !prev)}
              aria-expanded={panelPersonalizarAbierto}
              className={`touch-manipulation flex min-h-[46px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 px-3.5 py-2 text-xs font-bold transition-all sm:text-sm ${
                panelPersonalizarAbierto
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" />
              <span>Personalizar Excel</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums ${
                  panelPersonalizarAbierto
                    ? 'bg-slate-700 text-[#FFCD00]'
                    : 'border border-slate-200 bg-slate-100 text-slate-700'
                }`}
              >
                {conteoColumnasActivas.activas}/{conteoColumnasActivas.total}{' '}
                cols
              </span>
            </button>

            <button
              type="button"
              onClick={handleDescargarExcel}
              disabled={
                exportando ||
                totalRegistros === 0 ||
                !perfilAdmin.puede_exportar_sac
              }
              className="touch-manipulation flex min-h-[46px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border-b-4 border-emerald-950 bg-[#059669] px-5 py-2 text-sm font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:translate-y-[2px] active:border-b-2 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-300"
            >
              <Download
                className={`h-4 w-4 shrink-0 ${exportando ? 'animate-bounce' : ''}`}
              />
              <span>Descargar Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Filtros Contextuales + Buscador */}
        <div className="flex flex-col justify-between gap-2.5 border-t border-slate-100 pt-2 lg:flex-row lg:items-center">
          {activeTab === 'VENTAS_SAC' ? (
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="relative min-w-0">
                <User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  aria-label="Filtrar por vendedor"
                  value={vendedorFiltro}
                  onChange={(e) => {
                    setVendedorFiltro(e.target.value);
                    setPaginaActual(1);
                  }}
                  className="min-h-[44px] w-full max-w-full truncate rounded-xl border-2 border-slate-200 bg-slate-50/70 pr-3 pl-9 text-xs font-bold text-slate-800 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                >
                  <option value="TODOS">Vendedor: Todos</option>
                  {opcionesVendedoresSac.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative min-w-0">
                <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  aria-label="Filtrar por zona"
                  value={zonaFiltro}
                  onChange={(e) => {
                    setZonaFiltro(e.target.value);
                    setPaginaActual(1);
                  }}
                  className="min-h-[44px] w-full max-w-full truncate rounded-xl border-2 border-slate-200 bg-slate-50/70 pr-3 pl-9 text-xs font-bold text-slate-800 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                >
                  <option value="TODAS">Zona / Mercado: Todas</option>
                  {opcionesZonasSac.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 lg:pb-0">
                <span className="mr-0.5 whitespace-nowrap text-xs font-bold text-slate-500">
                  Formato:
                </span>
                {(
                  [
                    { id: 'TODOS', label: 'Todos' },
                    { id: 'GRANEL', label: 'GRANEL' },
                    { id: 'VACIO', label: 'VACIO' },
                    { id: 'UNIDAD', label: 'UNIDAD' },
                  ] as const
                ).map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => {
                      setFormatoFiltro(fmt.id);
                      setPaginaActual(1);
                    }}
                    className={`touch-manipulation min-h-[42px] cursor-pointer whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                      formatoFiltro === fmt.id
                        ? 'border-[#C8102E] bg-[#C8102E] text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>

              <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  aria-label="Filtrar por producto o SKU"
                  value={productoFiltro}
                  onChange={(e) => {
                    setProductoFiltro(e.target.value);
                    setPaginaActual(1);
                  }}
                  className="min-h-[44px] w-full max-w-full truncate rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                >
                  <option value="TODOS">Producto: Todos</option>
                  {opcionesProductosLogs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar por tipo de movimiento"
                  value={tipoMovimientoFiltro}
                  onChange={(e) => {
                    setTipoMovimientoFiltro(
                      e.target.value as 'TODOS' | TipoMovimientoBitacora
                    );
                    setPaginaActual(1);
                  }}
                  className="min-h-[44px] w-full max-w-full truncate rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                >
                  <option value="TODOS">Movimiento: Todos</option>
                  <option value="VENTA_DESPACHADA">Venta Despachada</option>
                  <option value="CORTESIA_0_BS">Cortesía (0 Bs)</option>
                  <option value="INGRESO_PRODUCCION">Ingreso Producción</option>
                  <option value="REINGRESO_REBOTE">Reingreso Rebote</option>
                  <option value="TRANSF_GRANEL_VACIO">
                    Transformación Granel → Vacío
                  </option>
                  <option value="AJUSTE_AUDITORIA">Ajuste de Auditoría</option>
                </select>
              </div>
            </div>
          )}

          <div className="relative lg:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPaginaActual(1);
              }}
              placeholder={
                activeTab === 'VENTAS_SAC'
                  ? 'Buscar Nº nota, SAC, cliente...'
                  : 'Buscar SKU, documento o cliente...'
              }
              className="min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 py-1.5 pr-8 pl-10 text-base text-slate-900 transition-all placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none sm:text-sm"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda('');
                  setPaginaActual(1);
                }}
                aria-label="Limpiar búsqueda"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Panel Colapsable: Personalizar Excel */}
        {panelPersonalizarAbierto && (
          <div className="space-y-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/90 p-4">
            <div className="flex flex-col justify-between gap-2 border-b border-slate-200 pb-2.5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[#C8102E]" />
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-900 sm:text-sm">
                  Personalizar Excel (.xlsx) —{' '}
                  {activeTab === 'VENTAS_SAC'
                    ? 'Diario de Ventas SAC'
                    : 'Bitácora / Logs por Producto'}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setConfigsExcel((prev) => ({
                      ...prev,
                      [activeTab]: crearConfigDefault(
                        activeTab,
                        fechaHasta || hoyIso
                      ),
                    }))
                  }
                  className="flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restaurar estándar SAC</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelPersonalizarAbierto(false)}
                  aria-label="Cerrar panel"
                  className="flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3">
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  1. Archivo y Cabecera en Hoja
                </span>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Nombre del archivo (.xlsx)
                  </label>
                  <input
                    type="text"
                    value={configActual.nombreArchivo}
                    onChange={(e) =>
                      setConfigsExcel((prev) => ({
                        ...prev,
                        [activeTab]: {
                          ...prev[activeTab],
                          nombreArchivo: e.target.value,
                        },
                      }))
                    }
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-[#C8102E] focus:ring-2 focus:ring-[#FFCD00]/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Título de cabecera en hoja
                  </label>
                  <input
                    type="text"
                    value={configActual.tituloHoja}
                    onChange={(e) =>
                      setConfigsExcel((prev) => ({
                        ...prev,
                        [activeTab]: {
                          ...prev[activeTab],
                          tituloHoja: e.target.value,
                        },
                      }))
                    }
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-[#C8102E] focus:ring-2 focus:ring-[#FFCD00]/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3">
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  2. Columnas Activas ({conteoColumnasActivas.activas}/
                  {conteoColumnasActivas.total})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {listaColumnasMeta.map((col) => {
                    const activa = configActual.columnasActivas[col.key];
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() =>
                          setConfigsExcel((prev) => ({
                            ...prev,
                            [activeTab]: {
                              ...prev[activeTab],
                              columnasActivas: {
                                ...prev[activeTab].columnasActivas,
                                [col.key]:
                                  !prev[activeTab].columnasActivas[col.key],
                              },
                            },
                          }))
                        }
                        className={`flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                          activa
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-slate-50 text-slate-400 line-through'
                        }`}
                      >
                        <Check
                          className={`h-3.5 w-3.5 ${
                            activa ? 'text-emerald-600' : 'text-slate-300'
                          }`}
                        />
                        <span>{col.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  3. Opciones Contables SAC
                </span>

                <label className="flex min-h-[38px] cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <span className="text-xs font-bold text-slate-800">
                    Incluir fila de Totales al pie
                  </span>
                  <input
                    type="checkbox"
                    checked={configActual.incluirFilaTotales}
                    onChange={(e) =>
                      setConfigsExcel((prev) => ({
                        ...prev,
                        [activeTab]: {
                          ...prev[activeTab],
                          incluirFilaTotales: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 cursor-pointer rounded accent-[#C8102E]"
                  />
                </label>

                <label className="flex min-h-[38px] cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <span className="text-xs font-bold text-slate-800">
                    Incluir registros/columnas de Cortesía (0 Bs)
                  </span>
                  <input
                    type="checkbox"
                    checked={configActual.incluirColumnasCortesia}
                    onChange={(e) =>
                      setConfigsExcel((prev) => ({
                        ...prev,
                        [activeTab]: {
                          ...prev[activeTab],
                          incluirColumnasCortesia: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 cursor-pointer rounded accent-[#C8102E]"
                  />
                </label>

                <label className="flex min-h-[38px] cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <span className="text-xs font-bold text-slate-800">
                    Formato numérico contable (2 dec. Bs / 3 dec. Kg)
                  </span>
                  <input
                    type="checkbox"
                    checked={configActual.formatoNumericoContable}
                    onChange={(e) =>
                      setConfigsExcel((prev) => ({
                        ...prev,
                        [activeTab]: {
                          ...prev[activeTab],
                          formatoNumericoContable: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 cursor-pointer rounded accent-[#C8102E]"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {notificacionExport && (
          <div
            role="status"
            className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium sm:text-sm ${
              notificacionExport.tipo === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${
                  notificacionExport.tipo === 'ok'
                    ? 'text-emerald-600'
                    : 'text-[#C8102E]'
                }`}
              />
              <span className="truncate font-mono text-xs sm:text-sm">
                {notificacionExport.mensaje}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setNotificacionExport(null)}
              className="shrink-0 cursor-pointer text-xs font-bold hover:underline"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* ====================================================================
          3. PESTAÑA A — DIARIO DE VENTAS SAC
         ==================================================================== */}
      {activeTab === 'VENTAS_SAC' && (
        <div className="space-y-3.5">
          <div className="rounded-2xl border-2 border-slate-200/90 bg-white p-3 shadow-xs sm:px-4 sm:py-3">
            <div className="grid grid-cols-2 gap-3 divide-y divide-slate-200 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
              <div className="flex flex-col justify-center pr-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Notas Despachadas
                </span>
                <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
                  {resumenSac.notas}
                </span>
              </div>

              <div className="flex flex-col justify-center pt-2 pr-2 sm:pt-0 lg:pl-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Kilos Facturados
                </span>
                <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
                  {formatKg(resumenSac.kilosFacturados, usaDecimalesContables)}{' '}
                  <span className="text-xs font-bold text-slate-500">kg</span>
                </span>
              </div>

              <div className="flex flex-col justify-center pt-2 pr-2 lg:pt-0 lg:pl-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Kilos Cortesía (0 Bs)
                </span>
                <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-amber-700 sm:text-xl">
                  {formatKg(resumenSac.kilosCortesia, usaDecimalesContables)}{' '}
                  <span className="text-xs font-bold text-amber-600">kg</span>
                </span>
              </div>

              <div className="flex flex-col justify-center rounded-xl border border-[#FFCD00]/50 bg-amber-50/60 p-2 pt-2 lg:border-0 lg:bg-transparent lg:p-0 lg:pt-0 lg:pl-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8102E]">
                  Total Ingreso SAC Bs.
                </span>
                <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
                  Bs. {formatBs(resumenSac.totalIngresoBs, usaDecimalesContables)}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-xs lg:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-[#FFCD00] bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-white">
                    {configActual.columnasActivas.nro_nota && (
                      <th className="whitespace-nowrap px-3.5 py-3">Nº Nota</th>
                    )}
                    {configActual.columnasActivas.fecha_venta && (
                      <th className="whitespace-nowrap px-3 py-3">Fecha</th>
                    )}
                    {configActual.columnasActivas.codigo_cliente && (
                      <th className="whitespace-nowrap px-3 py-3">
                        Cód. Cliente SAC
                      </th>
                    )}
                    {configActual.columnasActivas.cliente && (
                      <th className="px-3 py-3">Cliente</th>
                    )}
                    {configActual.columnasActivas.zona_mercado && (
                      <th className="px-3 py-3">Zona</th>
                    )}
                    {configActual.columnasActivas.vendedor && (
                      <th className="px-3 py-3">Vendedor</th>
                    )}
                    {configActual.columnasActivas.total_kilos_vendidos && (
                      <th className="whitespace-nowrap px-3 py-3 text-right">
                        Kilos Vendidos
                      </th>
                    )}
                    {mostrarColCortesiaSac && (
                      <th className="whitespace-nowrap px-3 py-3 text-right">
                        Kilos Cortesía
                      </th>
                    )}
                    {configActual.columnasActivas.monto_total_bs && (
                      <th className="whitespace-nowrap px-3.5 py-3 text-right">
                        Monto Total (Bs.)
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {sacPaginado.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-10 text-center text-slate-500"
                      >
                        No existen notas despachadas para los filtros
                        seleccionados.
                      </td>
                    </tr>
                  ) : (
                    sacPaginado.map((row) => (
                      <tr
                        key={row.id}
                        className="transition-colors even:bg-slate-50/40 hover:bg-slate-50/90"
                      >
                        {configActual.columnasActivas.nro_nota && (
                          <td className="whitespace-nowrap px-3.5 py-2.5 font-mono font-bold tabular-nums text-[#C8102E]">
                            {row.nro_nota}
                          </td>
                        )}
                        {configActual.columnasActivas.fecha_venta && (
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs tabular-nums text-slate-600">
                            {formatFechaDDMMYYYY(row.fecha_venta)}
                          </td>
                        )}
                        {configActual.columnasActivas.codigo_cliente && (
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-slate-800">
                              {row.codigo_cliente}
                            </span>
                          </td>
                        )}
                        {configActual.columnasActivas.cliente && (
                          <td className="px-3 py-2.5 font-bold text-slate-900">
                            {row.cliente}
                          </td>
                        )}
                        {configActual.columnasActivas.zona_mercado && (
                          <td className="px-3 py-2.5 text-xs text-slate-600">
                            {row.zona_mercado}
                          </td>
                        )}
                        {configActual.columnasActivas.vendedor && (
                          <td className="px-3 py-2.5 text-xs font-medium text-slate-700">
                            {row.vendedor}
                          </td>
                        )}
                        {configActual.columnasActivas.total_kilos_vendidos && (
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                            {formatKg(
                              row.total_kilos_vendidos,
                              usaDecimalesContables
                            )}{' '}
                            kg
                          </td>
                        )}
                        {mostrarColCortesiaSac && (
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums">
                            {row.total_kilos_cortesia > 0 ? (
                              <span className="inline-flex items-center rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                                {formatKg(
                                  row.total_kilos_cortesia,
                                  usaDecimalesContables
                                )}{' '}
                                kg
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">
                                {formatKg(0, usaDecimalesContables)} kg
                              </span>
                            )}
                          </td>
                        )}
                        {configActual.columnasActivas.monto_total_bs && (
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-extrabold tabular-nums text-slate-900">
                            Bs.{' '}
                            {formatBs(
                              row.monto_total_bs,
                              usaDecimalesContables
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>

                {configActual.incluirFilaTotales && sacPaginado.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-100 text-xs font-extrabold uppercase text-slate-900">
                      <td
                        colSpan={
                          [
                            configActual.columnasActivas.nro_nota,
                            configActual.columnasActivas.fecha_venta,
                            configActual.columnasActivas.codigo_cliente,
                            configActual.columnasActivas.cliente,
                            configActual.columnasActivas.zona_mercado,
                            configActual.columnasActivas.vendedor,
                          ].filter(Boolean).length || 1
                        }
                        className="px-3.5 py-3 text-right tracking-wider text-slate-700"
                      >
                        TOTALES GENERALES SAC:
                      </td>
                      {configActual.columnasActivas.total_kilos_vendidos && (
                        <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm tabular-nums">
                          {formatKg(
                            resumenSac.kilosFacturados,
                            usaDecimalesContables
                          )}{' '}
                          kg
                        </td>
                      )}
                      {mostrarColCortesiaSac && (
                        <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm tabular-nums text-amber-800">
                          {formatKg(
                            resumenSac.kilosCortesia,
                            usaDecimalesContables
                          )}{' '}
                          kg
                        </td>
                      )}
                      {configActual.columnasActivas.monto_total_bs && (
                        <td className="whitespace-nowrap px-3.5 py-3 text-right font-mono text-sm tabular-nums text-[#C8102E]">
                          Bs.{' '}
                          {formatBs(
                            resumenSac.totalIngresoBs,
                            usaDecimalesContables
                          )}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="space-y-2.5 lg:hidden">
            {sacPaginado.length === 0 ? (
              <div className="rounded-2xl border-2 border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                No existen notas despachadas para los filtros seleccionados.
              </div>
            ) : (
              sacPaginado.map((row) => (
                <article
                  key={row.id}
                  className="space-y-2.5 rounded-2xl border-2 border-slate-200/90 bg-white p-3.5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black tabular-nums text-[#C8102E]">
                        {row.nro_nota}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-slate-500">
                        • {formatFechaDDMMYYYY(row.fecha_venta)}
                      </span>
                    </div>
                    <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-slate-800">
                      {row.codigo_cliente}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {row.cliente}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.zona_mercado} •{' '}
                      <span className="font-medium text-slate-700">
                        {row.vendedor}
                      </span>
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-xl border-t border-slate-100 bg-slate-50/80 p-2 pt-2">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-500">
                        Vendidos
                      </span>
                      <span className="font-mono text-xs font-bold tabular-nums text-slate-900">
                        {formatKg(
                          row.total_kilos_vendidos,
                          usaDecimalesContables
                        )}{' '}
                        kg
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-500">
                        Cortesía
                      </span>
                      <span className="font-mono text-xs font-bold tabular-nums text-amber-700">
                        {formatKg(
                          row.total_kilos_cortesia,
                          usaDecimalesContables
                        )}{' '}
                        kg
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-bold uppercase text-[#C8102E]">
                        Total SAC
                      </span>
                      <span className="font-mono text-xs font-black tabular-nums text-slate-900">
                        Bs.{' '}
                        {formatBs(row.monto_total_bs, usaDecimalesContables)}
                      </span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          4. PESTAÑA B — BITÁCORA / LOGS POR PRODUCTO (SIN MERMA)
         ==================================================================== */}
      {activeTab === 'LOGS_PRODUCTO' && (
        <div className="space-y-3.5">
          <div className="rounded-2xl border-2 border-slate-200/90 bg-white p-3 shadow-xs sm:px-4 sm:py-3">
            <div className="grid grid-cols-2 gap-3 divide-y divide-slate-200 sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
              <div className="flex flex-col justify-center pr-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Movimientos
                </span>
                <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
                  {resumenLogs.movimientos}
                </span>
              </div>

              <div className="flex flex-col justify-center pt-2 pr-2 sm:pt-0 lg:pl-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Entradas Producción
                </span>
                <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-blue-700 sm:text-xl">
                  +
                  {formatKg(
                    resumenLogs.entradasProduccion,
                    usaDecimalesContables
                  )}{' '}
                  <span className="text-xs font-bold">kg</span>
                </span>
              </div>

              <div className="flex flex-col justify-center pt-2 pr-2 sm:pt-0 lg:pl-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Salidas Venta
                </span>
                <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-[#C8102E] sm:text-xl">
                  -{formatKg(resumenLogs.salidasVenta, usaDecimalesContables)}{' '}
                  <span className="text-xs font-bold">kg</span>
                </span>
              </div>

              <div className="flex flex-col justify-center pt-2 pr-2 lg:pt-0 lg:pl-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Salidas Cortesía
                </span>
                <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-amber-700 sm:text-xl">
                  -
                  {formatKg(resumenLogs.salidasCortesia, usaDecimalesContables)}{' '}
                  <span className="text-xs font-bold">kg</span>
                </span>
              </div>

              <div className="col-span-2 flex flex-col justify-center rounded-xl border border-purple-200 bg-purple-50/50 p-2 pt-2 sm:col-span-1 lg:border-0 lg:bg-transparent lg:p-0 lg:pt-0 lg:pl-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                  Reingresos Rebote
                </span>
                <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-purple-700 sm:text-xl">
                  +
                  {formatKg(
                    resumenLogs.reingresosRebote,
                    usaDecimalesContables
                  )}{' '}
                  <span className="text-xs font-bold">kg</span>
                </span>
              </div>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-xs lg:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-[#FFCD00] bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-white">
                    {configActual.columnasActivas.fecha_hora && (
                      <th className="whitespace-nowrap px-3.5 py-3">
                        Fecha y Hora
                      </th>
                    )}
                    {configActual.columnasActivas.producto_sku && (
                      <th className="px-3 py-3">Producto / SKU</th>
                    )}
                    {configActual.columnasActivas.tipo_movimiento && (
                      <th className="whitespace-nowrap px-3 py-3">
                        Movimiento
                      </th>
                    )}
                    {configActual.columnasActivas.documento_origen && (
                      <th className="whitespace-nowrap px-3 py-3">
                        Documento Origen
                      </th>
                    )}
                    {configActual.columnasActivas.cliente_destino && (
                      <th className="px-3 py-3">Cliente / Destino</th>
                    )}
                    {configActual.columnasActivas.responsable && (
                      <th className="px-3 py-3">Responsable</th>
                    )}
                    {configActual.columnasActivas.kilos_movimiento && (
                      <th className="whitespace-nowrap px-3 py-3 text-right">
                        Kilos Mov.
                      </th>
                    )}
                    {configActual.columnasActivas.saldo_valor && (
                      <th className="whitespace-nowrap bg-slate-800 px-3.5 py-3 text-right text-[#FFCD00]">
                        Saldo Resultante & Valor
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {logsPaginados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-10 text-center text-slate-500"
                      >
                        No se encontraron logs de trazabilidad para los filtros
                        seleccionados.
                      </td>
                    </tr>
                  ) : (
                    logsPaginados.map((row) => {
                      const badge = BADGE_MOVIMIENTO_META[row.tipo_movimiento];
                      const esPositivo = row.kilos_movimiento >= 0;

                      return (
                        <tr
                          key={row.id}
                          className="transition-colors even:bg-slate-50/40 hover:bg-slate-50/90"
                        >
                          {configActual.columnasActivas.fecha_hora && (
                            <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-xs tabular-nums text-slate-600">
                              {row.fecha_hora}
                            </td>
                          )}

                          {configActual.columnasActivas.producto_sku && (
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-xs font-bold tabular-nums text-slate-700">
                                  {row.codigo_sku}
                                </span>
                                <span
                                  className={`rounded border px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${
                                    row.presentacion === 'GRANEL'
                                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                                      : 'border-sky-300 bg-sky-50 text-sky-800'
                                  }`}
                                >
                                  {row.presentacion}
                                </span>
                              </div>
                              <div className="mt-0.5 text-xs font-bold text-slate-900">
                                {row.nombre_producto}
                              </div>
                            </td>
                          )}

                          {configActual.columnasActivas.tipo_movimiento && (
                            <td className="whitespace-nowrap px-3 py-2.5">
                              <span
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                          )}

                          {configActual.columnasActivas.documento_origen && (
                            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-bold tabular-nums text-slate-800">
                              {row.documento_origen}
                            </td>
                          )}

                          {configActual.columnasActivas.cliente_destino && (
                            <td className="px-3 py-2.5 text-xs font-semibold text-slate-800">
                              {row.cliente_destino}
                            </td>
                          )}

                          {configActual.columnasActivas.responsable && (
                            <td className="px-3 py-2.5 text-xs text-slate-600">
                              {row.responsable}
                            </td>
                          )}

                          {configActual.columnasActivas.kilos_movimiento && (
                            <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-bold tabular-nums">
                              <span
                                className={`inline-flex items-center gap-0.5 ${
                                  esPositivo
                                    ? 'text-emerald-700'
                                    : row.tipo_movimiento === 'CORTESIA_0_BS'
                                      ? 'text-amber-700'
                                      : 'text-[#C8102E]'
                                }`}
                              >
                                {esPositivo ? (
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowDownRight className="h-3.5 w-3.5" />
                                )}
                                {esPositivo
                                  ? `+${formatKg(
                                      row.kilos_movimiento,
                                      usaDecimalesContables
                                    )}`
                                  : formatKg(
                                      row.kilos_movimiento,
                                      usaDecimalesContables
                                    )}{' '}
                                kg
                              </span>
                            </td>
                          )}

                          {configActual.columnasActivas.saldo_valor && (
                            <td className="whitespace-nowrap bg-amber-50/40 px-3.5 py-2.5 text-right font-mono tabular-nums">
                              <div className="text-xs font-black text-slate-900">
                                Saldo:{' '}
                                {formatKg(
                                  row.saldo_resultante_kilos,
                                  usaDecimalesContables
                                )}{' '}
                                kg
                              </div>
                              <div className="text-[11px] font-semibold text-slate-500">
                                Bs.{' '}
                                {formatBs(
                                  row.valor_movimiento_bs,
                                  usaDecimalesContables
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {configActual.incluirFilaTotales && logsPaginados.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-100 text-xs font-extrabold uppercase text-slate-900">
                      <td
                        colSpan={
                          [
                            configActual.columnasActivas.fecha_hora,
                            configActual.columnasActivas.producto_sku,
                            configActual.columnasActivas.tipo_movimiento,
                            configActual.columnasActivas.documento_origen,
                            configActual.columnasActivas.cliente_destino,
                            configActual.columnasActivas.responsable,
                          ].filter(Boolean).length || 1
                        }
                        className="px-3.5 py-3 text-right tracking-wider text-slate-700"
                      >
                        TOTALES BITÁCORA FILTRADA:
                      </td>
                      {configActual.columnasActivas.kilos_movimiento && (
                        <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm tabular-nums">
                          {formatKg(
                            logsProductoFiltrados.reduce(
                              (acc, r) => acc + r.kilos_movimiento,
                              0
                            ),
                            usaDecimalesContables
                          )}{' '}
                          kg
                        </td>
                      )}
                      {configActual.columnasActivas.saldo_valor && (
                        <td className="whitespace-nowrap bg-amber-100/70 px-3.5 py-3 text-right font-mono text-sm tabular-nums">
                          Bs.{' '}
                          {formatBs(
                            logsProductoFiltrados.reduce(
                              (acc, r) => acc + r.valor_movimiento_bs,
                              0
                            ),
                            usaDecimalesContables
                          )}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="space-y-2.5 lg:hidden">
            {logsPaginados.length === 0 ? (
              <div className="rounded-2xl border-2 border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                No se encontraron logs de trazabilidad para los filtros
                seleccionados.
              </div>
            ) : (
              logsPaginados.map((row) => {
                const badge = BADGE_MOVIMIENTO_META[row.tipo_movimiento];
                const esPositivo = row.kilos_movimiento >= 0;

                return (
                  <article
                    key={row.id}
                    className="space-y-2.5 rounded-2xl border-2 border-slate-200/90 bg-white p-3.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <span className="font-mono text-[11px] font-bold text-slate-500">
                        {row.fecha_hora}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] font-extrabold uppercase ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-[#C8102E]" />
                        <span className="font-mono text-xs font-bold text-slate-700">
                          {row.codigo_sku}
                        </span>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            row.presentacion === 'GRANEL'
                              ? 'border-amber-300 bg-amber-50 text-amber-800'
                              : 'border-sky-300 bg-sky-50 text-sky-800'
                          }`}
                        >
                          {row.presentacion}
                        </span>
                      </div>
                      <h3 className="mt-0.5 text-sm font-extrabold text-slate-900">
                        {row.nombre_producto}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-600">
                        <strong>{row.documento_origen}</strong> •{' '}
                        {row.cliente_destino}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {row.responsable}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-xl border-t border-slate-100 bg-slate-50/80 p-2 pt-2">
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-slate-500">
                          Kilos Mov.
                        </span>
                        <span
                          className={`font-mono text-xs font-black tabular-nums ${
                            esPositivo ? 'text-emerald-700' : 'text-[#C8102E]'
                          }`}
                        >
                          {esPositivo
                            ? `+${formatKg(
                                row.kilos_movimiento,
                                usaDecimalesContables
                              )}`
                            : formatKg(
                                row.kilos_movimiento,
                                usaDecimalesContables
                              )}{' '}
                          kg
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-slate-500">
                          Saldo Cámara
                        </span>
                        <span className="font-mono text-xs font-bold tabular-nums text-slate-900">
                          {formatKg(
                            row.saldo_resultante_kilos,
                            usaDecimalesContables
                          )}{' '}
                          kg
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-bold uppercase text-slate-500">
                          Valor
                        </span>
                        <span className="font-mono text-xs font-extrabold tabular-nums text-slate-900">
                          Bs.{' '}
                          {formatBs(
                            row.valor_movimiento_bs,
                            usaDecimalesContables
                          )}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          5. PAGINACIÓN REAL (10 / 20 / 50 POR PÁGINA)
         ==================================================================== */}
      <footer className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-600 sm:justify-start">
          <span className="font-mono tabular-nums">
            Mostrando{' '}
            <strong className="text-slate-900">
              {totalRegistros === 0 ? 0 : indiceInicio + 1}
            </strong>
            –
            <strong className="text-slate-900">
              {Math.min(indiceFin, totalRegistros)}
            </strong>{' '}
            de <strong className="text-slate-900">{totalRegistros}</strong>{' '}
            registros
          </span>

          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {([10, 20, 50] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setItemsPorPagina(size);
                  setPaginaActual(1);
                }}
                className={`min-h-[32px] rounded-lg px-2.5 font-mono text-xs font-bold transition-colors ${
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
            disabled={paginaSegura <= 1}
            onClick={() => setPaginaActual((prev) => Math.max(1, prev - 1))}
            className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Anterior</span>
          </button>

          <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-xs font-bold tabular-nums text-slate-800">
            Pág. {paginaSegura} / {totalPaginas}
          </span>

          <button
            type="button"
            disabled={paginaSegura >= totalPaginas}
            onClick={() =>
              setPaginaActual((prev) => Math.min(totalPaginas, prev + 1))
            }
            className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>Siguiente</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </section>
  );
}

