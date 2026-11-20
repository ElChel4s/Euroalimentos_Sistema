'use client';

import React, { useMemo, useState } from 'react';
import {
  Banknote,
  Calendar,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileCheck2,
  Gift,
  MapPin,
  Search,
  User,
  X,
} from 'lucide-react';
import { exportarVentasSacDesglosadoExcel } from '@/lib/utils/export-excel';
import type {
  TipoVenta,
  VwVentasDesglosadasSac,
} from '@/types/database.types';

export interface PerfilAdminReportes {
  id_usuario: number;
  nombre_completo: string;
  cargo_gerencial: string;
  puede_exportar_sac: boolean;
}

export type PeriodicidadSac = 'SEMANAL' | 'DIARIO';

export interface ReportesSacClientProps {
  ventasDesglosadas: VwVentasDesglosadasSac[];
  perfilAdmin: PerfilAdminReportes;
  fechaHoyBolivia?: string;
}

const TIMEZONE_BOLIVIA = 'America/La_Paz';

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

function formatKg(valor: number): string {
  return valor.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatBs(valor: number): string {
  return valor.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNota(nro: number | null): string {
  if (nro === null || nro === undefined) return 'S/N';
  return String(nro);
}

function formatVendedorSac(
  codigoEmpleado: string | null,
  vendedor: string
): string {
  if (codigoEmpleado && codigoEmpleado.trim()) {
    return `${codigoEmpleado.trim()} · ${vendedor}`;
  }
  return vendedor || 'Sin asignar';
}

export function ReportesSacClient({
  ventasDesglosadas,
  perfilAdmin,
  fechaHoyBolivia,
}: ReportesSacClientProps) {
  const hoyIso = useMemo(
    () => fechaHoyBolivia ?? obtenerFechaBoliviaIso(),
    [fechaHoyBolivia]
  );

  const semanaActualOperativa = useMemo(
    () => obtenerSemanaOperativaLunesSabado(hoyIso),
    [hoyIso]
  );

  const [periodicidadSac, setPeriodicidadSac] =
    useState<PeriodicidadSac>('SEMANAL');
  const [sacDesde, setSacDesde] = useState<string>(
    () =>
      obtenerSemanaOperativaLunesSabado(
        fechaHoyBolivia ?? obtenerFechaBoliviaIso()
      ).desde
  );
  const [sacHasta, setSacHasta] = useState<string>(
    () =>
      obtenerSemanaOperativaLunesSabado(
        fechaHoyBolivia ?? obtenerFechaBoliviaIso()
      ).hasta
  );
  const [sacFechaDiaria, setSacFechaDiaria] = useState<string>(
    () => fechaHoyBolivia ?? obtenerFechaBoliviaIso()
  );
  const [condicionFiltro, setCondicionFiltro] = useState<'TODOS' | TipoVenta>(
    'TODOS'
  );
  const [vendedorFiltro, setVendedorFiltro] = useState<string>('TODOS');
  const [zonaFiltro, setZonaFiltro] = useState<string>('TODAS');
  const [incluirCortesiasSac, setIncluirCortesiasSac] = useState<boolean>(true);
  const [busquedaSac, setBusquedaSac] = useState<string>('');
  const [paginaSac, setPaginaSac] = useState<number>(1);
  const [itemsPorPaginaSac, setItemsPorPaginaSac] = useState<number>(15);

  const [exportando, setExportando] = useState<boolean>(false);
  const [notificacionExport, setNotificacionExport] = useState<{
    tipo: 'ok' | 'error';
    mensaje: string;
  } | null>(null);

  const rangoActivoSac = useMemo(() => {
    if (periodicidadSac === 'DIARIO') {
      return { desde: sacFechaDiaria, hasta: sacFechaDiaria };
    }
    return { desde: sacDesde, hasta: sacHasta };
  }, [periodicidadSac, sacDesde, sacHasta, sacFechaDiaria]);

  const opcionesVendedoresSac = useMemo(() => {
    return Array.from(
      new Set(
        ventasDesglosadas
          .filter((v) => v.estado === 'DESPACHADO')
          .map((v) => formatVendedorSac(v.codigo_empleado_sac, v.vendedor))
      )
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'));
  }, [ventasDesglosadas]);

  const opcionesZonasSac = useMemo(() => {
    return Array.from(
      new Set(
        ventasDesglosadas
          .filter((v) => v.estado === 'DESPACHADO')
          .map((v) => v.zona_mercado)
      )
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'));
  }, [ventasDesglosadas]);

  const ventasSacFiltradas = useMemo(() => {
    const q = busquedaSac.trim().toLowerCase();
    const { desde, hasta } = rangoActivoSac;

    return ventasDesglosadas.filter((row) => {
      if (row.estado !== 'DESPACHADO') return false;
      if (!incluirCortesiasSac && row.es_cortesia) return false;

      const fechaYmd = normalizarFechaYmd(row.fecha_venta);
      if (desde && fechaYmd < desde) return false;
      if (hasta && fechaYmd > hasta) return false;

      if (condicionFiltro !== 'TODOS' && row.tipo_venta !== condicionFiltro) {
        return false;
      }

      const vendedorLabel = formatVendedorSac(
        row.codigo_empleado_sac,
        row.vendedor
      );
      if (vendedorFiltro !== 'TODOS' && vendedorLabel !== vendedorFiltro) {
        return false;
      }

      if (zonaFiltro !== 'TODAS' && row.zona_mercado !== zonaFiltro) {
        return false;
      }

      if (!q) return true;
      return (
        formatNota(row.nro_nota).toLowerCase().includes(q) ||
        String(row.nro_documento_sac ?? '')
          .toLowerCase()
          .includes(q) ||
        row.codigo_cliente.toLowerCase().includes(q) ||
        row.cliente.toLowerCase().includes(q) ||
        row.zona_mercado.toLowerCase().includes(q) ||
        vendedorLabel.toLowerCase().includes(q) ||
        row.codigo_sku.toLowerCase().includes(q) ||
        row.nombre_producto.toLowerCase().includes(q)
      );
    });
  }, [
    ventasDesglosadas,
    rangoActivoSac,
    incluirCortesiasSac,
    condicionFiltro,
    vendedorFiltro,
    zonaFiltro,
    busquedaSac,
  ]);

  const resumenSac = useMemo(() => {
    const notasSet = new Set<number>();
    let lineasFacturadas = 0;
    let lineasCortesia = 0;
    let kilosFacturados = 0;
    let kilosCortesia = 0;
    let totalIngresoBs = 0;

    for (const r of ventasSacFiltradas) {
      notasSet.add(r.id_pedido);
      if (r.es_cortesia) {
        lineasCortesia += 1;
        kilosCortesia += r.cantidad_final_kilos;
      } else {
        lineasFacturadas += 1;
        kilosFacturados += r.cantidad_final_kilos;
        totalIngresoBs += r.subtotal_bs;
      }
    }

    return {
      notasUnicas: notasSet.size,
      lineasFacturadas,
      lineasCortesia,
      kilosFacturados,
      kilosCortesia,
      totalIngresoBs,
    };
  }, [ventasSacFiltradas]);

  const totalPaginasSac = Math.max(
    1,
    Math.ceil(ventasSacFiltradas.length / itemsPorPaginaSac)
  );
  const paginaSacSegura = Math.min(paginaSac, totalPaginasSac);
  const inicioSac = (paginaSacSegura - 1) * itemsPorPaginaSac;
  const finSac = inicioSac + itemsPorPaginaSac;
  const sacPaginado = useMemo(
    () => ventasSacFiltradas.slice(inicioSac, finSac),
    [ventasSacFiltradas, inicioSac, finSac]
  );

  const handleDescargarExcelSac = () => {
    if (!perfilAdmin.puede_exportar_sac || ventasSacFiltradas.length === 0) {
      return;
    }

    setExportando(true);
    setNotificacionExport(null);

    try {
      const sufijo =
        periodicidadSac === 'SEMANAL'
          ? `SEMANAL_${rangoActivoSac.desde}_AL_${rangoActivoSac.hasta}`
          : `DIARIO_${rangoActivoSac.desde}`;
      const nombreArchivo = `EUROALIMENTOS_VENTAS_SAC_${sufijo}`;

      exportarVentasSacDesglosadoExcel(
        ventasSacFiltradas.map((r) => {
          const fechaParaSac =
            !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha_venta) || !r.fecha_despacho
              ? r.fecha_venta
              : r.fecha_despacho;

          return {
            fecha_venta: fechaParaSac,
            nro_nota: formatNota(r.nro_nota),
            nro_documento_sac: r.nro_documento_sac,
            tipo_venta: r.tipo_venta,
            plazo_dias: r.plazo_dias,
            nit_ci: r.nit_ci,
            razon_social: r.razon_social,
            codigo_cliente: r.codigo_cliente,
            cliente: r.cliente,
            codigo_empleado_sac: r.codigo_empleado_sac,
            vendedor: r.vendedor,
            codigo_sku: r.codigo_sku,
            producto: r.nombre_producto,
            cantidad_final_kilos: r.cantidad_final_kilos,
            unidad_medida: r.unidad_medida,
            peso_unidad_kilos: r.peso_unidad_kilos,
            cantidad_facturada_unidad_o_kg: r.cantidad_facturada_unidad_o_kg,
            precio_unitario_congelado: r.precio_unitario_congelado,
            costo_unitario_bs: r.costo_unitario_bs,
            subtotal_bs: r.subtotal_bs,
            es_cortesia: r.es_cortesia,
          };
        }),
        {
          nombreArchivo,
          tituloHoja: 'Hoja1',
          rangoDesde: rangoActivoSac.desde,
          rangoHasta: rangoActivoSac.hasta,
          columnasActivas: {},
          incluirFilaTotales: false,
          incluirColumnasCortesia: incluirCortesiasSac,
          formatoNumericoContable: true,
        }
      );

      setNotificacionExport({
        tipo: 'ok',
        mensaje: `Archivo generado: ${nombreArchivo}.xlsx (${ventasSacFiltradas.length} registros · 34 columnas · Hoja1)`,
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

  return (
    <section
      aria-label="Exportación Contable SAC"
      className="mx-auto w-full max-w-7xl space-y-4 overflow-x-hidden pb-6 text-slate-900"
    >
      {/* ====================================================================
          1. CABECERA EXCLUSIVA SAC + BOTÓN PRINCIPAL FIJO DE DESCARGA
         ==================================================================== */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-2xs">
        <div className="absolute top-0 right-0 left-0 flex h-1">
          <div className="w-2/3 bg-[#C8102E]" />
          <div className="w-1/3 bg-[#FFCD00]" />
        </div>

        <div className="flex flex-col justify-between gap-3 pt-0.5 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">
                Exportación Contable SAC
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
                <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>Formato Importación SAC (34 columnas · Hoja1)</span>
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              Exportación directa compatible con VENTAS.xls ({perfilAdmin.cargo_gerencial}) — Periodo activo:{' '}
              {formatFechaDDMMYYYY(rangoActivoSac.desde)} al{' '}
              {formatFechaDDMMYYYY(rangoActivoSac.hasta)}
            </p>
          </div>

          <button
            type="button"
            onClick={handleDescargarExcelSac}
            disabled={
              exportando ||
              ventasSacFiltradas.length === 0 ||
              !perfilAdmin.puede_exportar_sac
            }
            className="touch-manipulation inline-flex min-h-[44px] w-full shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 md:w-auto"
          >
            <Download
              className={`h-4 w-4 shrink-0 ${exportando ? 'animate-bounce' : ''}`}
            />
            <span>
              {periodicidadSac === 'SEMANAL'
                ? 'Descargar Excel SAC Semanal (.xlsx)'
                : 'Descargar Excel SAC Diario (.xlsx)'}
            </span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          2. PERIODICIDAD (SEMANAL POR DEFECTO / DIARIO) Y FILTROS SAC
         ==================================================================== */}
      <div className="space-y-3 rounded-2xl border-2 border-slate-200/90 bg-white p-3 shadow-xs sm:p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Periodicidad SAC
              </span>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setPeriodicidadSac('SEMANAL');
                    setPaginaSac(1);
                  }}
                  className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold transition-all ${
                    periodicidadSac === 'SEMANAL'
                      ? 'bg-slate-900 text-[#FFCD00] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarRange className="h-3.5 w-3.5" />
                  <span>Semanal</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPeriodicidadSac('DIARIO');
                    setPaginaSac(1);
                  }}
                  className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold transition-all ${
                    periodicidadSac === 'DIARIO'
                      ? 'bg-slate-900 text-[#FFCD00] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Diario</span>
                </button>
              </div>
            </div>

            {periodicidadSac === 'SEMANAL' ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSacDesde(semanaActualOperativa.desde);
                      setSacHasta(semanaActualOperativa.hasta);
                      setPaginaSac(1);
                    }}
                    className={`touch-manipulation min-h-[44px] cursor-pointer whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                      sacDesde === semanaActualOperativa.desde &&
                      sacHasta === semanaActualOperativa.hasta
                        ? 'border-slate-900 bg-slate-900 text-[#FFCD00] shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Semana Actual
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const prevDesde = sumarDiasIso(
                        semanaActualOperativa.desde,
                        -7
                      );
                      const prevHasta = sumarDiasIso(prevDesde, 5);
                      setSacDesde(prevDesde);
                      setSacHasta(prevHasta);
                      setPaginaSac(1);
                    }}
                    className={`touch-manipulation min-h-[44px] cursor-pointer whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                      sacDesde ===
                        sumarDiasIso(semanaActualOperativa.desde, -7) &&
                      sacHasta ===
                        sumarDiasIso(semanaActualOperativa.desde, -2)
                        ? 'border-slate-900 bg-slate-900 text-[#FFCD00] shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Semana Anterior
                  </button>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="sac-fecha-desde"
                      className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      <Calendar className="h-3 w-3 text-[#C8102E]" />
                      <span>Desde</span>
                    </label>
                    <input
                      id="sac-fecha-desde"
                      type="date"
                      value={sacDesde}
                      onChange={(e) => {
                        setSacDesde(e.target.value);
                        setPaginaSac(1);
                      }}
                      className="min-h-[44px] rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-[#C8102E] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="sac-fecha-hasta"
                      className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      <Calendar className="h-3 w-3 text-[#C8102E]" />
                      <span>Hasta</span>
                    </label>
                    <input
                      id="sac-fecha-hasta"
                      type="date"
                      value={sacHasta}
                      onChange={(e) => {
                        setSacHasta(e.target.value);
                        setPaginaSac(1);
                      }}
                      className="min-h-[44px] rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-[#C8102E] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSacFechaDiaria(hoyIso);
                      setPaginaSac(1);
                    }}
                    className={`touch-manipulation min-h-[44px] cursor-pointer whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                      sacFechaDiaria === hoyIso
                        ? 'border-slate-900 bg-slate-900 text-[#FFCD00] shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSacFechaDiaria(sumarDiasIso(hoyIso, -1));
                      setPaginaSac(1);
                    }}
                    className={`touch-manipulation min-h-[44px] cursor-pointer whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                      sacFechaDiaria === sumarDiasIso(hoyIso, -1)
                        ? 'border-slate-900 bg-slate-900 text-[#FFCD00] shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Ayer
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="sac-fecha-diaria"
                    className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    <Calendar className="h-3 w-3 text-[#C8102E]" />
                    <span>Fecha</span>
                  </label>
                  <input
                    id="sac-fecha-diaria"
                    type="date"
                    value={sacFechaDiaria}
                    onChange={(e) => {
                      setSacFechaDiaria(e.target.value);
                      setPaginaSac(1);
                    }}
                    className="min-h-[44px] rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-[#C8102E] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800">
            <input
              type="checkbox"
              checked={incluirCortesiasSac}
              onChange={(e) => {
                setIncluirCortesiasSac(e.target.checked);
                setPaginaSac(1);
              }}
              className="h-4 w-4 cursor-pointer rounded accent-[#C8102E]"
            />
            <span>Incluir Cortesías (Precio 0.00 Bs)</span>
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
          <div className="relative min-w-[160px] flex-1">
            <CreditCard className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              aria-label="Filtrar por tipo de venta"
              value={condicionFiltro}
              onChange={(e) => {
                setCondicionFiltro(e.target.value as 'TODOS' | TipoVenta);
                setPaginaSac(1);
              }}
              className="min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 pr-3 pl-9 text-xs font-bold text-slate-800 focus:border-[#C8102E] focus:bg-white focus:outline-none"
            >
              <option value="TODOS">Tipo Venta: Todos</option>
              <option value="CONTADO">CONTADO</option>
              <option value="CREDITO">CRÉDITO</option>
            </select>
          </div>

          <div className="relative min-w-[190px] flex-1">
            <User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              aria-label="Filtrar por vendedor"
              value={vendedorFiltro}
              onChange={(e) => {
                setVendedorFiltro(e.target.value);
                setPaginaSac(1);
              }}
              className="min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 pr-3 pl-9 text-xs font-bold text-slate-800 focus:border-[#C8102E] focus:bg-white focus:outline-none"
            >
              <option value="TODOS">Vendedor: Todos</option>
              {opcionesVendedoresSac.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[190px] flex-1">
            <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              aria-label="Filtrar por zona"
              value={zonaFiltro}
              onChange={(e) => {
                setZonaFiltro(e.target.value);
                setPaginaSac(1);
              }}
              className="min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 pr-3 pl-9 text-xs font-bold text-slate-800 focus:border-[#C8102E] focus:bg-white focus:outline-none"
            >
              <option value="TODAS">Zona / Mercado: Todas</option>
              {opcionesZonasSac.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[220px] flex-[1.4]">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busquedaSac}
              onChange={(e) => {
                setBusquedaSac(e.target.value);
                setPaginaSac(1);
              }}
              placeholder="Buscar Nº nota, SAC, SKU, cliente..."
              className="min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 py-1.5 pr-8 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:outline-none"
            />
            {busquedaSac && (
              <button
                type="button"
                onClick={() => {
                  setBusquedaSac('');
                  setPaginaSac(1);
                }}
                aria-label="Limpiar búsqueda SAC"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

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
          3. KPIS DEL PERIODO SAC
         ==================================================================== */}
      <div className="rounded-2xl border-2 border-slate-200/90 bg-white p-3 shadow-xs sm:px-4 sm:py-3">
        <div className="grid grid-cols-2 gap-3 divide-y divide-slate-200 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <div className="flex flex-col justify-center pr-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Notas Despachadas
            </span>
            <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
              {resumenSac.notasUnicas}
            </span>
          </div>

          <div className="flex flex-col justify-center pt-2 pr-2 sm:pt-0 lg:pl-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Líneas Facturadas
            </span>
            <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
              {resumenSac.lineasFacturadas}{' '}
              <span className="text-xs font-semibold text-slate-500">
                ({formatKg(resumenSac.kilosFacturados)} kg)
              </span>
            </span>
          </div>

          <div className="flex flex-col justify-center pt-2 pr-2 lg:pt-0 lg:pl-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Líneas Cortesía
            </span>
            <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-amber-700 sm:text-xl">
              {resumenSac.lineasCortesia}{' '}
              <span className="text-xs font-semibold text-amber-600">
                ({formatKg(resumenSac.kilosCortesia)} kg)
              </span>
            </span>
          </div>

          <div className="flex flex-col justify-center rounded-xl border border-[#FFCD00]/50 bg-amber-50/60 p-2 pt-2 lg:border-0 lg:bg-transparent lg:p-0 lg:pt-0 lg:pl-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8102E]">
              Total Facturado Bs.
            </span>
            <span className="mt-0.5 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
              Bs. {formatBs(resumenSac.totalIngresoBs)}
            </span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          4. TABLA PAGINADA VISTA PREVIA SAC (DESKTOP + MÓVIL)
         ==================================================================== */}
      <div className="hidden overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-xs lg:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-[#FFCD00] bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-white">
                <th className="whitespace-nowrap px-3 py-3">Fecha</th>
                <th className="whitespace-nowrap px-3 py-3">N° Doc / Nota</th>
                <th className="whitespace-nowrap px-3 py-3">Tipo Venta</th>
                <th className="whitespace-nowrap px-3 py-3">Cód. Cliente</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Vendedor</th>
                <th className="whitespace-nowrap px-3 py-3">SKU</th>
                <th className="px-3 py-3">Producto</th>
                <th className="whitespace-nowrap px-3 py-3 text-right">
                  Cantidad + Unid.
                </th>
                <th className="whitespace-nowrap px-3 py-3 text-right">
                  Precio (Bs.)
                </th>
                <th className="whitespace-nowrap px-3 py-3 text-right">
                  Costo (Bs.)
                </th>
                <th className="whitespace-nowrap px-3 py-3 text-right">
                  Subtotal (Bs.)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {sacPaginado.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="py-10 text-center text-sm text-slate-500"
                  >
                    No existen líneas despachadas para el periodo y filtros
                    seleccionados.
                  </td>
                </tr>
              ) : (
                sacPaginado.map((row) => {
                  const esUnidad =
                    String(row.unidad_medida ?? 'KILO').toUpperCase() ===
                    'UNIDAD';
                  const cantUnidades =
                    row.peso_unidad_kilos > 0
                      ? Math.round(
                          row.cantidad_final_kilos / row.peso_unidad_kilos
                        )
                      : Math.round(row.cantidad_facturada_unidad_o_kg);

                  return (
                    <tr
                      key={`${row.id_pedido}-${row.id_detalle}`}
                      className={`transition-colors hover:bg-slate-50/90 ${
                        row.es_cortesia
                          ? 'bg-amber-50/40'
                          : 'even:bg-slate-50/40'
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-slate-600">
                        {formatFechaDDMMYYYY(row.fecha_venta)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums">
                        <span className="font-bold text-[#C8102E]">
                          {formatNota(row.nro_nota)}
                        </span>
                        {row.nro_documento_sac !== null &&
                          row.nro_documento_sac !== undefined && (
                            <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                              SAC {row.nro_documento_sac}
                            </span>
                          )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {row.tipo_venta === 'CREDITO' ? (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-extrabold text-amber-950">
                            <CreditCard className="h-3 w-3" />
                            Credito ({row.plazo_dias}d)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-extrabold text-emerald-950">
                            <Banknote className="h-3 w-3" />
                            Contado
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="inline-flex items-center rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono font-bold tabular-nums text-slate-800">
                          {row.codigo_cliente.replace(/^0-/, '')}
                        </span>
                      </td>
                      <td className="max-w-[210px] truncate px-3 py-2.5 font-bold text-slate-900">
                        {row.cliente}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700">
                        {formatVendedorSac(
                          row.codigo_empleado_sac,
                          row.vendedor
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono font-bold text-slate-700">
                        {row.codigo_sku}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-900">
                            {row.nombre_producto}
                          </span>
                          {row.es_cortesia && (
                            <span className="inline-flex items-center gap-1 rounded bg-[#FFCD00] px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-950">
                              <Gift className="h-3 w-3 text-[#C8102E]" />
                              CORTESÍA
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums">
                        {esUnidad ? (
                          <>
                            <span className="font-bold text-purple-900">
                              {cantUnidades} UNIDAD
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              ({formatKg(row.cantidad_final_kilos)} kg)
                            </span>
                          </>
                        ) : (
                          <span className="font-bold text-slate-900">
                            {formatKg(row.cantidad_final_kilos)} KILO
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                        {row.es_cortesia
                          ? '0.00'
                          : formatBs(row.precio_unitario_congelado)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                        {formatBs(row.costo_unitario_bs)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-extrabold tabular-nums text-slate-900">
                        {row.es_cortesia ? '0.00' : formatBs(row.subtotal_bs)}
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
        {sacPaginado.length === 0 ? (
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No existen líneas despachadas para el periodo y filtros
            seleccionados.
          </div>
        ) : (
          sacPaginado.map((row) => {
            const esUnidad =
              String(row.unidad_medida ?? 'KILO').toUpperCase() === 'UNIDAD';
            const cantUnidades =
              row.peso_unidad_kilos > 0
                ? Math.round(row.cantidad_final_kilos / row.peso_unidad_kilos)
                : Math.round(row.cantidad_facturada_unidad_o_kg);

            return (
              <article
                key={`${row.id_pedido}-${row.id_detalle}`}
                className={`space-y-2 rounded-2xl border-2 p-3.5 shadow-xs ${
                  row.es_cortesia
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-slate-200/90 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="font-black text-[#C8102E]">
                      Nota {formatNota(row.nro_nota)}
                    </span>
                    {row.nro_documento_sac !== null &&
                      row.nro_documento_sac !== undefined && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700">
                          SAC {row.nro_documento_sac}
                        </span>
                      )}
                    <span className="text-slate-500">
                      • {formatFechaDDMMYYYY(row.fecha_venta)}
                    </span>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-black ${
                      row.tipo_venta === 'CREDITO'
                        ? 'bg-amber-100 text-amber-950'
                        : 'bg-emerald-100 text-emerald-950'
                    }`}
                  >
                    {row.tipo_venta === 'CREDITO'
                      ? `Credito (${row.plazo_dias}d)`
                      : 'Contado'}
                  </span>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-800">
                      {row.codigo_cliente.replace(/^0-/, '')}
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {row.cliente}
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatVendedorSac(row.codigo_empleado_sac, row.vendedor)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-slate-600">
                      {row.codigo_sku}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {row.nombre_producto}
                    </span>
                    {row.es_cortesia && (
                      <span className="rounded bg-[#FFCD00] px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-950">
                        CORTESÍA
                      </span>
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs tabular-nums sm:grid-cols-4">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        Cantidad
                      </span>
                      <span className="font-bold text-slate-900">
                        {esUnidad
                          ? `${cantUnidades} UNIDAD`
                          : `${formatKg(row.cantidad_final_kilos)} KILO`}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        Precio
                      </span>
                      <span className="text-slate-700">
                        Bs.{' '}
                        {row.es_cortesia
                          ? '0.00'
                          : formatBs(row.precio_unitario_congelado)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        Costo
                      </span>
                      <span className="text-slate-600">
                        Bs. {formatBs(row.costo_unitario_bs)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-bold uppercase text-[#C8102E]">
                        Subtotal
                      </span>
                      <span className="font-black text-slate-900">
                        Bs.{' '}
                        {row.es_cortesia ? '0.00' : formatBs(row.subtotal_bs)}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* ====================================================================
          5. PAGINACIÓN (15 / 30 / 50 POR PÁGINA)
         ==================================================================== */}
      <footer className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-600 sm:justify-start">
          <span className="font-mono tabular-nums">
            Mostrando{' '}
            <strong className="text-slate-900">
              {ventasSacFiltradas.length === 0 ? 0 : inicioSac + 1}
            </strong>
            –
            <strong className="text-slate-900">
              {Math.min(finSac, ventasSacFiltradas.length)}
            </strong>{' '}
            de{' '}
            <strong className="text-slate-900">
              {ventasSacFiltradas.length}
            </strong>{' '}
            registros
          </span>

          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {([15, 30, 50] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setItemsPorPaginaSac(size);
                  setPaginaSac(1);
                }}
                className={`min-h-[32px] cursor-pointer rounded-lg px-2.5 font-mono text-xs font-bold transition-colors ${
                  itemsPorPaginaSac === size
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
            disabled={paginaSacSegura <= 1}
            onClick={() => setPaginaSac((prev) => Math.max(1, prev - 1))}
            className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Anterior</span>
          </button>

          <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-xs font-bold tabular-nums text-slate-800">
            Pág. {paginaSacSegura} / {totalPaginasSac}
          </span>

          <button
            type="button"
            disabled={paginaSacSegura >= totalPaginasSac}
            onClick={() =>
              setPaginaSac((prev) => Math.min(totalPaginasSac, prev + 1))
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
