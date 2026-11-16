'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilterX,
  Gift,
  History,
  MapPin,
  PackageCheck,
  Printer,
  Scale,
  Search,
  User,
  X,
} from 'lucide-react';
import {
  TicketTermicoEpson,
  type AnchoPapelTermico,
  type PedidoTicketTermico,
} from '@/components/tickets/TicketTermicoEpson';

export interface PedidoHistorialDespachado extends PedidoTicketTermico {
  id_zona: number;
  id_vendedor: number;
  kilos_vendidos_total: number;
  kilos_cortesia_total: number;
  total_cobrado_bs: number;
}

export interface HistorialDespachosClientProps {
  pedidosDespachados: PedidoHistorialDespachado[];
  anchoPapelDefault: AnchoPapelTermico;
  nombreDespachadorActivo: string;
  balanzaActiva: string;
}

type FiltroRapidoFecha = 'TODOS' | 'HOY' | 'AYER';

const TIMEZONE_BOLIVIA = 'America/La_Paz';

function obtenerFechaBoliviaIso(offsetDias = 0): string {
  const fechaBase = new Date(Date.now() + offsetDias * 86_400_000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fechaBase);

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function extraerFechaIsoBolivia(isoTimestamp: string | null): string {
  if (!isoTimestamp) return '';
  const fecha = new Date(isoTimestamp);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

function formatearFechaCortaBolivia(isoTimestamp: string | null): {
  fecha: string;
  hora: string;
} {
  if (!isoTimestamp) {
    return { fecha: 'S/F', hora: '--:--' };
  }
  const fechaObj = new Date(isoTimestamp);
  if (Number.isNaN(fechaObj.getTime())) {
    return { fecha: 'S/F', hora: '--:--' };
  }

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

  return { fecha, hora };
}

function formatearNumeroNota(
  nroNotaVenta: number | null,
  idPedido: number
): string {
  if (nroNotaVenta !== null && nroNotaVenta !== undefined) {
    return `NV-${String(nroNotaVenta).padStart(6, '0')}`;
  }
  return `NV-${String(idPedido).padStart(6, '0')}`;
}

function formatearRefPedido(idPedido: number): string {
  return `#PED-${String(idPedido).padStart(3, '0')}`;
}

export function HistorialDespachosClient({
  pedidosDespachados,
  anchoPapelDefault,
  balanzaActiva,
}: HistorialDespachosClientProps) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroRapidoFecha, setFiltroRapidoFecha] =
    useState<FiltroRapidoFecha>('TODOS');
  const [fechaEspecifica, setFechaEspecifica] = useState('');
  const [zonaSeleccionada, setZonaSeleccionada] = useState<string>('TODAS');
  const [vendedorSeleccionado, setVendedorSeleccionado] =
    useState<string>('TODOS');
  const [filasPorPagina, setFilasPorPagina] = useState<number>(10);
  const [paginaActual, setPaginaActual] = useState<number>(1);

  const [pedidoDetalleModal, setPedidoDetalleModal] =
    useState<PedidoHistorialDespachado | null>(null);
  const [pedidoTicketModal, setPedidoTicketModal] =
    useState<PedidoHistorialDespachado | null>(null);
  const [anchoTicketModal, setAnchoTicketModal] =
    useState<AnchoPapelTermico>(anchoPapelDefault);

  const hoyBoliviaIso = useMemo(() => obtenerFechaBoliviaIso(0), []);
  const ayerBoliviaIso = useMemo(() => obtenerFechaBoliviaIso(-1), []);

  const opcionesZonas = useMemo(() => {
    const mapa = new Map<number, string>();
    pedidosDespachados.forEach((pedido) => {
      if (!mapa.has(pedido.id_zona)) {
        mapa.set(pedido.id_zona, pedido.zona.nombre_zona);
      }
    });
    return Array.from(mapa.entries())
      .map(([id, nombre]) => ({ id: String(id), nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [pedidosDespachados]);

  const opcionesVendedores = useMemo(() => {
    const mapa = new Map<number, string>();
    pedidosDespachados.forEach((pedido) => {
      if (!mapa.has(pedido.id_vendedor)) {
        mapa.set(pedido.id_vendedor, pedido.vendedor.nombre_completo);
      }
    });
    return Array.from(mapa.entries())
      .map(([id, nombre]) => ({ id: String(id), nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [pedidosDespachados]);

  const pedidosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return pedidosDespachados.filter((pedido) => {
      const fechaPedidoIso = extraerFechaIsoBolivia(
        pedido.fecha_despacho ?? pedido.fecha_preventa
      );

      if (fechaEspecifica) {
        if (fechaPedidoIso !== fechaEspecifica) return false;
      } else if (filtroRapidoFecha === 'HOY') {
        if (fechaPedidoIso !== hoyBoliviaIso) return false;
      } else if (filtroRapidoFecha === 'AYER') {
        if (fechaPedidoIso !== ayerBoliviaIso) return false;
      }

      if (
        zonaSeleccionada !== 'TODAS' &&
        String(pedido.id_zona) !== zonaSeleccionada
      ) {
        return false;
      }

      if (
        vendedorSeleccionado !== 'TODOS' &&
        String(pedido.id_vendedor) !== vendedorSeleccionado
      ) {
        return false;
      }

      if (termino) {
        const notaStr = formatearNumeroNota(
          pedido.nro_nota_venta,
          pedido.id_pedido
        ).toLowerCase();
        const refStr = formatearRefPedido(pedido.id_pedido).toLowerCase();
        const coincide =
          notaStr.includes(termino) ||
          String(pedido.nro_nota_venta ?? '').includes(termino) ||
          refStr.includes(termino) ||
          String(pedido.id_pedido).includes(termino) ||
          pedido.cliente.nombre_comercial.toLowerCase().includes(termino) ||
          pedido.zona.nombre_zona.toLowerCase().includes(termino) ||
          pedido.vendedor.nombre_completo.toLowerCase().includes(termino) ||
          pedido.detalles.some((d) =>
            d.nombre_producto.toLowerCase().includes(termino)
          );
        if (!coincide) return false;
      }

      return true;
    });
  }, [
    pedidosDespachados,
    busqueda,
    fechaEspecifica,
    filtroRapidoFecha,
    hoyBoliviaIso,
    ayerBoliviaIso,
    zonaSeleccionada,
    vendedorSeleccionado,
  ]);

  const totalKilosFiltrados = useMemo(
    () =>
      pedidosFiltrados.reduce(
        (acc, item) =>
          acc + item.kilos_vendidos_total + item.kilos_cortesia_total,
        0
      ),
    [pedidosFiltrados]
  );

  const totalPaginas = Math.max(
    1,
    Math.ceil(pedidosFiltrados.length / filasPorPagina)
  );
  const paginaSegura = Math.min(paginaActual, totalPaginas);

  const pedidosPaginados = useMemo(() => {
    const inicio = (paginaSegura - 1) * filasPorPagina;
    return pedidosFiltrados.slice(inicio, inicio + filasPorPagina);
  }, [pedidosFiltrados, paginaSegura, filasPorPagina]);

  const indiceInicioMostrar =
    pedidosFiltrados.length === 0 ? 0 : (paginaSegura - 1) * filasPorPagina + 1;
  const indiceFinMostrar = Math.min(
    paginaSegura * filasPorPagina,
    pedidosFiltrados.length
  );

  const hayFiltrosActivos =
    busqueda.trim() !== '' ||
    filtroRapidoFecha !== 'TODOS' ||
    fechaEspecifica !== '' ||
    zonaSeleccionada !== 'TODAS' ||
    vendedorSeleccionado !== 'TODOS';

  const handleLimpiarFiltros = () => {
    setBusqueda('');
    setFiltroRapidoFecha('TODOS');
    setFechaEspecifica('');
    setZonaSeleccionada('TODAS');
    setVendedorSeleccionado('TODOS');
    setPaginaActual(1);
  };

  const handleAbrirTicket = (pedido: PedidoHistorialDespachado) => {
    setAnchoTicketModal(anchoPapelDefault);
    setPedidoTicketModal(pedido);
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 text-slate-900">
      {/* ====================================================================
          CABECERA COMPACTA DEL MÓDULO (SIN DUPLICAR DASHBOARDSHELL)
         ==================================================================== */}
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
        <div>
          <h1 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">
            Historial de Despachos
          </h1>
          <p className="text-xs font-medium text-slate-500">
            Registro histórico de notas emitidas
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-700">
          <Scale className="h-3.5 w-3.5 text-[#C8102E]" />
          <span>
            Solo lectura • {balanzaActiva} • {anchoPapelDefault}mm
          </span>
        </span>
      </header>

      {/* ====================================================================
          BARRA ÚNICA Y COMPACTA DE FILTROS + RESUMEN
         ==================================================================== */}
      <section
        aria-label="Filtros del historial de despachos"
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {/* Buscador instantáneo */}
          <div className="relative lg:col-span-5">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPaginaActual(1);
              }}
              placeholder="Buscar por Nota NV, #PED, Cliente, Zona o Producto..."
              aria-label="Buscar despacho"
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50/60 pr-10 pl-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:ring-2 focus:ring-[#C8102E]/15 focus:outline-none"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda('');
                  setPaginaActual(1);
                }}
                aria-label="Limpiar búsqueda"
                className="absolute top-1/2 right-2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Pills rápidas de fecha + Input date */}
          <div className="flex flex-wrap items-center gap-2 lg:col-span-7 lg:justify-end">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              {(
                [
                  { id: 'TODOS', label: 'Todos' },
                  { id: 'HOY', label: 'Hoy' },
                  { id: 'AYER', label: 'Ayer' },
                ] as const
              ).map((pill) => {
                const activo =
                  !fechaEspecifica && filtroRapidoFecha === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => {
                      setFechaEspecifica('');
                      setFiltroRapidoFecha(pill.id);
                      setPaginaActual(1);
                    }}
                    className={`touch-manipulation min-h-[40px] rounded-lg px-3.5 text-xs font-extrabold uppercase tracking-wide transition ${
                      activo
                        ? 'bg-[#C8102E] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white hover:text-slate-950'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            <div className="relative flex-1 sm:max-w-[190px] sm:flex-none">
              <Calendar className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={fechaEspecifica}
                onChange={(e) => {
                  setFechaEspecifica(e.target.value);
                  setFiltroRapidoFecha('TODOS');
                  setPaginaActual(1);
                }}
                aria-label="Filtrar por fecha específica"
                className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white pr-3 pl-9 text-sm font-semibold text-slate-800 tabular-nums focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/15 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Segunda fila: Zona, Vendedor, Resumen y Limpiar */}
        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-center">
          <div className="relative lg:col-span-3">
            <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={zonaSeleccionada}
              onChange={(e) => {
                setZonaSeleccionada(e.target.value);
                setPaginaActual(1);
              }}
              aria-label="Filtrar por zona"
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white pr-3 pl-9 text-sm font-semibold text-slate-800 focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/15 focus:outline-none"
            >
              <option value="TODAS">Todas las zonas</option>
              {opcionesZonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="relative lg:col-span-3">
            <User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={vendedorSeleccionado}
              onChange={(e) => {
                setVendedorSeleccionado(e.target.value);
                setPaginaActual(1);
              }}
              aria-label="Filtrar por vendedor"
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white pr-3 pl-9 text-sm font-semibold text-slate-800 focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/15 focus:outline-none"
            >
              <option value="TODOS">Todos los vendedores</option>
              {opcionesVendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Resumen inline + Limpiar filtros */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
            <div className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-slate-700 tabular-nums sm:text-sm">
              <PackageCheck className="h-4 w-4 shrink-0 text-[#C8102E]" />
              <span>
                <strong className="font-black text-slate-950">
                  {pedidosFiltrados.length}
                </strong>{' '}
                {pedidosFiltrados.length === 1 ? 'nota' : 'notas'} •{' '}
                <strong className="font-black text-slate-950">
                  {totalKilosFiltrados.toFixed(3)} kg
                </strong>{' '}
                despachados
              </span>
            </div>

            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={handleLimpiarFiltros}
                className="touch-manipulation inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-extrabold uppercase tracking-wide text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-[#9E0B22]"
              >
                <FilterX className="h-4 w-4" />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ====================================================================
          CONTENEDOR PRINCIPAL: TABLA ALTA DENSIDAD (PC) / TARJETAS (MÓVIL)
         ==================================================================== */}
      {pedidosFiltrados.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-xs">
          <History className="mx-auto h-11 w-11 text-slate-300" />
          <h2 className="mt-3 text-base font-black text-slate-900">
            {pedidosDespachados.length === 0
              ? 'Aún no hay pedidos despachados'
              : 'Sin resultados para los filtros actuales'}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            {pedidosDespachados.length === 0
              ? 'Cuando cierres tu primer pesaje en gancho en la Bandeja de Despacho, la nota emitida aparecerá aquí.'
              : 'Prueba cambiando el criterio de búsqueda, el rango de fecha, la zona o el vendedor.'}
          </p>
          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={handleLimpiarFiltros}
              className="touch-manipulation mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#C8102E] px-5 text-sm font-extrabold text-white shadow-xs transition hover:bg-[#9E0B22]"
            >
              <FilterX className="h-4 w-4" />
              <span>Mostrar todos los despachos</span>
            </button>
          )}
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Vista Desktop: Tabla 7 columnas */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <th className="px-4 py-3.5">Nota / Pedido</th>
                  <th className="px-4 py-3.5">Fecha y Hora Despacho</th>
                  <th className="px-4 py-3.5">Cliente y Zona</th>
                  <th className="px-4 py-3.5">Vendedor</th>
                  <th className="px-4 py-3.5 text-right">
                    Peso Real Despachado
                  </th>
                  <th className="px-4 py-3.5 text-right">Total Cobrado</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {pedidosPaginados.map((pedido) => {
                  const { fecha, hora } = formatearFechaCortaBolivia(
                    pedido.fecha_despacho ?? pedido.fecha_preventa
                  );
                  return (
                    <tr
                      key={pedido.id_pedido}
                      className="transition hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="font-mono text-sm font-black text-slate-950 tabular-nums">
                          {formatearNumeroNota(
                            pedido.nro_nota_venta,
                            pedido.id_pedido
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-600 tabular-nums">
                            {formatearRefPedido(pedido.id_pedido)}
                          </span>
                          {pedido.es_pedido_cortesia_pura && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-900">
                              <Gift className="h-3 w-3" />
                              Cortesía
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle tabular-nums">
                        <div className="font-bold text-slate-900">{fecha}</div>
                        <div className="text-xs font-medium text-slate-500">
                          {hora} hrs
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <div className="font-bold text-slate-950">
                          {pedido.cliente.nombre_comercial}
                        </div>
                        <div className="text-xs font-medium text-slate-500">
                          {pedido.zona.nombre_zona}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <span className="font-semibold text-slate-800">
                          {pedido.vendedor.nombre_completo}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right align-middle tabular-nums">
                        <div className="font-mono font-black text-slate-950">
                          {pedido.kilos_vendidos_total.toFixed(3)} kg
                        </div>
                        {pedido.kilos_cortesia_total > 0 && (
                          <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-amber-800 ring-1 ring-amber-200">
                            +{pedido.kilos_cortesia_total.toFixed(3)} kg cort.
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right align-middle tabular-nums">
                        {pedido.es_pedido_cortesia_pura ? (
                          <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-black text-amber-900">
                            Bs 0.00 (Cortesía)
                          </span>
                        ) : (
                          <span className="font-mono text-base font-black text-slate-950">
                            Bs {pedido.total_cobrado_bs.toFixed(2)}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right align-middle">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPedidoDetalleModal(pedido)}
                            className="touch-manipulation inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-extrabold text-slate-800 transition hover:border-slate-400 hover:bg-slate-100"
                          >
                            <Eye className="h-4 w-4 text-slate-600" />
                            <span>Detalle</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAbrirTicket(pedido)}
                            className="touch-manipulation inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#C8102E] px-3 text-xs font-extrabold text-white shadow-xs transition hover:bg-[#9E0B22]"
                          >
                            <Printer className="h-4 w-4 text-[#FFCD00]" />
                            <span>Ticket</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista Móvil: Tarjetas Táctiles Compactas */}
          <div className="divide-y divide-slate-200 md:hidden">
            {pedidosPaginados.map((pedido) => {
              const { fecha, hora } = formatearFechaCortaBolivia(
                pedido.fecha_despacho ?? pedido.fecha_preventa
              );
              return (
                <article key={pedido.id_pedido} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-base font-black text-slate-950 tabular-nums">
                          {formatearNumeroNota(
                            pedido.nro_nota_venta,
                            pedido.id_pedido
                          )}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-600 tabular-nums">
                          {formatearRefPedido(pedido.id_pedido)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-slate-500 tabular-nums">
                        {fecha} • {hora} hrs
                      </p>
                    </div>

                    <div className="text-right tabular-nums">
                      <div className="font-mono text-base font-black text-[#9E0B22]">
                        Bs {pedido.total_cobrado_bs.toFixed(2)}
                      </div>
                      {pedido.es_pedido_cortesia_pura && (
                        <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-900">
                          Cortesía pura
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs">
                    <div className="font-bold text-slate-900">
                      {pedido.cliente.nombre_comercial}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 text-slate-600">
                      <span>{pedido.zona.nombre_zona}</span>
                      <span>Vend: {pedido.vendedor.nombre_completo}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-1.5 font-mono tabular-nums">
                      <span className="font-black text-slate-900">
                        {pedido.kilos_vendidos_total.toFixed(3)} kg
                      </span>
                      {pedido.kilos_cortesia_total > 0 && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-900">
                          +{pedido.kilos_cortesia_total.toFixed(3)} kg cort.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPedidoDetalleModal(pedido)}
                      className="touch-manipulation inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-extrabold text-slate-800"
                    >
                      <Eye className="h-4 w-4 text-slate-600" />
                      <span>Detalle</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAbrirTicket(pedido)}
                      className="touch-manipulation inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-[#C8102E] px-3 text-xs font-extrabold text-white"
                    >
                      <Printer className="h-4 w-4 text-[#FFCD00]" />
                      <span>Ticket</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* ================================================================
              PIE DE PAGINACIÓN REAL
             ================================================================ */}
          <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600 tabular-nums sm:text-sm">
              <span>
                Mostrando{' '}
                <strong className="font-black text-slate-900">
                  {indiceInicioMostrar}–{indiceFinMostrar}
                </strong>{' '}
                de{' '}
                <strong className="font-black text-slate-900">
                  {pedidosFiltrados.length}
                </strong>{' '}
                despachos
              </span>

              <label className="inline-flex items-center gap-2">
                <span className="text-slate-500">Filas:</span>
                <select
                  value={filasPorPagina}
                  onChange={(e) => {
                    setFilasPorPagina(Number(e.target.value));
                    setPaginaActual(1);
                  }}
                  aria-label="Filas por página"
                  className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 focus:border-[#C8102E] focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <button
                type="button"
                disabled={paginaSegura <= 1}
                onClick={() => setPaginaActual((prev) => Math.max(1, prev - 1))}
                className="touch-manipulation inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-xs font-extrabold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Anterior</span>
              </button>

              <span className="px-2 font-mono text-xs font-bold text-slate-700 tabular-nums">
                Pág. {paginaSegura} / {totalPaginas}
              </span>

              <button
                type="button"
                disabled={paginaSegura >= totalPaginas}
                onClick={() =>
                  setPaginaActual((prev) => Math.min(totalPaginas, prev + 1))
                }
                className="touch-manipulation inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-xs font-extrabold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </section>
      )}

      {/* ====================================================================
          MODAL 1: DETALLE RÁPIDO DEL PEDIDO DESPACHADO (SOLO LECTURA)
         ==================================================================== */}
      {pedidoDetalleModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle del despacho ${formatearNumeroNota(
            pedidoDetalleModal.nro_nota_venta,
            pedidoDetalleModal.id_pedido
          )}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:p-5"
          onClick={() => setPedidoDetalleModal(null)}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-1.5 w-full shrink-0">
              <div className="h-full w-3/4 bg-[#C8102E]" />
              <div className="h-full w-1/4 bg-[#FFCD00]" />
            </div>

            {/* Cabecera Modal */}
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-black text-slate-950 tabular-nums">
                    {formatearNumeroNota(
                      pedidoDetalleModal.nro_nota_venta,
                      pedidoDetalleModal.id_pedido
                    )}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700 tabular-nums">
                    {formatearRefPedido(pedidoDetalleModal.id_pedido)}
                  </span>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-extrabold uppercase text-emerald-900">
                    DESPACHADO
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Detalle histórico consolidado (solo lectura)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPedidoDetalleModal(null)}
                aria-label="Cerrar detalle"
                className="touch-manipulation inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* Cuerpo Modal */}
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* Metadata operativa */}
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Cliente y Zona
                  </span>
                  <p className="font-black text-slate-950">
                    {pedidoDetalleModal.cliente.nombre_comercial}
                  </p>
                  <p className="text-xs font-medium text-slate-600">
                    {pedidoDetalleModal.zona.nombre_zona} •{' '}
                    {pedidoDetalleModal.zona.ciudad}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Fecha y Hora de Despacho
                  </span>
                  <p className="font-bold text-slate-950 tabular-nums">
                    {(() => {
                      const fmt = formatearFechaCortaBolivia(
                        pedidoDetalleModal.fecha_despacho ??
                          pedidoDetalleModal.fecha_preventa
                      );
                      return `${fmt.fecha} a las ${fmt.hora} hrs`;
                    })()}
                  </p>
                  <p className="text-xs font-medium text-slate-600 tabular-nums">
                    Preventa:{' '}
                    {
                      formatearFechaCortaBolivia(
                        pedidoDetalleModal.fecha_preventa
                      ).fecha
                    }
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Vendedor Asignado
                  </span>
                  <p className="font-bold text-slate-900">
                    {pedidoDetalleModal.vendedor.nombre_completo}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Despachado en Planta Por
                  </span>
                  <p className="font-bold text-slate-900">
                    {pedidoDetalleModal.despachador.nombre_completo}
                  </p>
                </div>

                {pedidoDetalleModal.observaciones &&
                  pedidoDetalleModal.observaciones.trim() !== '' && (
                    <div className="border-t border-slate-200 pt-2 sm:col-span-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Observaciones
                      </span>
                      <p className="mt-0.5 text-sm font-medium text-slate-800">
                        {pedidoDetalleModal.observaciones}
                      </p>
                    </div>
                  )}
              </div>

              {/* Tabla de ítems pesados */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-[11px] font-black uppercase text-slate-600">
                      <th className="px-3.5 py-2.5">Producto</th>
                      <th className="px-3.5 py-2.5 text-right">Est. (kg)</th>
                      <th className="px-3.5 py-2.5 text-right">Real (kg)</th>
                      <th className="px-3.5 py-2.5 text-right">P.U. (Bs)</th>
                      <th className="px-3.5 py-2.5 text-right">Subtotal (Bs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {pedidoDetalleModal.detalles.map((item) => {
                      const kilosReales = Number(
                        item.kilos_reales ?? item.kilos_estimados ?? 0
                      );
                      const esCortesia =
                        item.es_cortesia ||
                        pedidoDetalleModal.es_pedido_cortesia_pura;
                      const subtotal = esCortesia
                        ? 0
                        : item.subtotal_bs !== null &&
                            item.subtotal_bs !== undefined
                          ? Number(item.subtotal_bs)
                          : kilosReales *
                            Number(item.precio_unitario_congelado ?? 0);

                      return (
                        <tr key={item.id_detalle}>
                          <td className="px-3.5 py-2.5">
                            <div className="font-bold text-slate-900">
                              {item.nombre_producto}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                                {item.formato}
                              </span>
                              {esCortesia && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-900">
                                  CORTESÍA SIN COSTO
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-500">
                            {Number(item.kilos_estimados).toFixed(3)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-950">
                            {kilosReales.toFixed(3)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-700">
                            {esCortesia
                              ? '0.00'
                              : Number(item.precio_unitario_congelado).toFixed(
                                  2
                                )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-950">
                            {subtotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumen de Totales */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-white tabular-nums">
                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                  <div>
                    <span className="text-slate-400">Peso Facturado: </span>
                    <strong className="font-mono font-black">
                      {pedidoDetalleModal.kilos_vendidos_total.toFixed(3)} kg
                    </strong>
                  </div>
                  {pedidoDetalleModal.kilos_cortesia_total > 0 && (
                    <div>
                      <span className="text-amber-300">Peso Cortesía: </span>
                      <strong className="font-mono font-black text-[#FFCD00]">
                        {pedidoDetalleModal.kilos_cortesia_total.toFixed(3)} kg
                      </strong>
                    </div>
                  )}
                </div>

                <div className="font-mono text-base font-black sm:text-lg">
                  TOTAL: Bs {pedidoDetalleModal.total_cobrado_bs.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Footer Acciones Modal Detalle */}
            <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => setPedidoDetalleModal(null)}
                className="touch-manipulation min-h-[48px] rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = pedidoDetalleModal;
                  setPedidoDetalleModal(null);
                  handleAbrirTicket(target);
                }}
                className="touch-manipulation inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#C8102E] px-5 text-sm font-extrabold text-white shadow-xs transition hover:bg-[#9E0B22]"
              >
                <Printer className="h-4 w-4 text-[#FFCD00]" />
                <span>Reimprimir Ticket Térmico</span>
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: REIMPRESIÓN DE TICKET TÉRMICO EPSON (58MM / 80MM)
         ==================================================================== */}
      {pedidoTicketModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Reimpresión Ticket ${formatearNumeroNota(
            pedidoTicketModal.nro_nota_venta,
            pedidoTicketModal.id_pedido
          )}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-xs sm:p-5"
          onClick={() => setPedidoTicketModal(null)}
        >
          <div
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-1.5 w-full shrink-0">
              <div className="h-full w-3/4 bg-[#C8102E]" />
              <div className="h-full w-1/4 bg-[#FFCD00]" />
            </div>

            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
              <div>
                <h2 className="text-base font-black text-slate-950 sm:text-lg">
                  Reimprimir Ticket Térmico •{' '}
                  <span className="font-mono">
                    {formatearNumeroNota(
                      pedidoTicketModal.nro_nota_venta,
                      pedidoTicketModal.id_pedido
                    )}
                  </span>
                </h2>
                <p className="text-xs font-medium text-slate-500">
                  Selecciona el ancho de rollo y presiona &ldquo;Imprimir
                  Ticket&rdquo;.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                  {([58, 80] as const).map((mm) => (
                    <button
                      key={mm}
                      type="button"
                      onClick={() => setAnchoTicketModal(mm)}
                      className={`touch-manipulation min-h-[38px] rounded-lg px-3 font-mono text-xs font-extrabold transition ${
                        anchoTicketModal === mm
                          ? 'bg-slate-900 text-[#FFCD00] shadow-xs'
                          : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      {mm} mm
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setPedidoTicketModal(null)}
                  aria-label="Cerrar vista previa de ticket"
                  className="touch-manipulation inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <TicketTermicoEpson
                key={`${pedidoTicketModal.id_pedido}-${anchoTicketModal}`}
                pedido={pedidoTicketModal}
                anchoPapelMm={anchoTicketModal}
                esVistaPrevia={false}
                soloTicket={true}
                autoPrint={false}
              />
            </div>

            <footer className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setPedidoTicketModal(null)}
                className="touch-manipulation min-h-[48px] rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

