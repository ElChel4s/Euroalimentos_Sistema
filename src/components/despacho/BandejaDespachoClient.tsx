'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpDown,
  Banknote,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  FileText,
  Gift,
  Layers,
  Loader2,
  MapPin,
  Package,
  Play,
  Printer,
  Scale,
  Search,
  ShieldAlert,
  User,
} from 'lucide-react';
import { PlantCardHeaderStrip } from '@/components/forms/PreventaBrandDecor';
import type {
  ClienteDespachoItem,
  DetallePedidoDespachoItem,
  PedidoDespachoItem,
  PerfilDespachadorResumen,
  ProductoCatalogoPesajeItem,
  ProductoDespachoItem,
  VendedorDespachoItem,
  ZonaDespachoItem,
} from '@/lib/despacho/mappers';
import type { FormatoProductoEnum } from '@/types/database.types';

export type {
  ClienteDespachoItem,
  DetallePedidoDespachoItem,
  PedidoDespachoItem,
  PerfilDespachadorResumen,
  ProductoCatalogoPesajeItem,
  ProductoDespachoItem,
  VendedorDespachoItem,
  ZonaDespachoItem,
};

export interface BandejaDespachoClientProps {
  pedidosPendientes: PedidoDespachoItem[];
  productosCatalogo: ProductoCatalogoPesajeItem[];
  perfilDespachador: PerfilDespachadorResumen;
}

// ============================================================================
// 2. UTILIDADES DE FORMATO CONTABLE Y OPERATIVO
// ============================================================================

function formatKilos(kg: number): string {
  return `${kg.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} kg`;
}

function formatBolivianos(bs: number): string {
  return `Bs. ${bs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function calcularHoraYEspera(
  isoDate: string,
  ahoraMs: number | null
): { hora: string; espera: string | null; minutos: number } {
  const fecha = new Date(isoDate);
  const hora = Number.isNaN(fecha.getTime())
    ? '--:--'
    : fecha.toLocaleTimeString('es-BO', {
        timeZone: 'America/La_Paz',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

  if (ahoraMs === null || Number.isNaN(fecha.getTime())) {
    return { hora, espera: null, minutos: 0 };
  }

  const diffMin = Math.max(1, Math.round((ahoraMs - fecha.getTime()) / 60000));
  const espera =
    diffMin < 60
      ? `hace ${diffMin} min`
      : `hace ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;

  return { hora, espera, minutos: diffMin };
}

function badgeFormatoClass(formato: FormatoProductoEnum): string {
  switch (formato) {
    case 'GRANEL':
      return 'bg-[#FFCD00]/45 text-slate-950';
    case 'VACIO':
      return 'bg-sky-100 text-sky-900';
    case 'UNIDAD':
      return 'bg-purple-100 text-purple-900';
  }
}

function calcularMontoReferencialPedido(pedido: PedidoDespachoItem): number {
  if (pedido.es_pedido_cortesia_pura) return 0;
  return pedido.detalle_pedidos.reduce((acc, d) => {
    if (d.es_cortesia) return acc;
    return (
      acc +
      Number(
        d.subtotal_bs ??
          Number(d.kilos_estimados ?? 0) *
            Number(d.precio_unitario_congelado ?? 0)
      )
    );
  }, 0);
}

// ============================================================================
// 3. COMPONENTE PRINCIPAL: BANDEJA CONSOLIDADA DE DESPACHO (INTERFAZ 3.1)
// ============================================================================

export const BandejaDespachoClient: React.FC<BandejaDespachoClientProps> = ({
  pedidosPendientes,
  perfilDespachador,
}) => {
  // Reloj cliente para calcular espera sin hydration mismatch
  const [ahoraMs, setAhoraMs] = useState<number | null>(null);
  useEffect(() => {
    const initTimer = setTimeout(() => {
      setAhoraMs(Date.now());
    }, 0);
    const interval = setInterval(() => {
      setAhoraMs(Date.now());
    }, 60000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, []);

  // Estados de filtros y ordenamiento
  const [busqueda, setBusqueda] = useState<string>('');
  const [zonaSeleccionada, setZonaSeleccionada] = useState<string>('TODAS');
  const [vendedorSeleccionado, setVendedorSeleccionado] =
    useState<string>('TODOS');
  const [ordenCriterio, setOrdenCriterio] = useState<'ANTIGUEDAD' | 'ZONA'>(
    'ANTIGUEDAD'
  );

  // Estado operativo local para alistamiento rápido en cámara
  const [itemsAlistados, setItemsAlistados] = useState<Record<number, boolean>>(
    {}
  );
  const [consolidadoExpandidoMobile, setConsolidadoExpandidoMobile] =
    useState<boolean>(false);

  // Estado de feedback inmediato al navegar a /despacho/[id]
  const [pedidoNavegandoId, setPedidoNavegandoId] = useState<number | null>(
    null
  );

  const toggleItemAlistado = (idDetalle: number) => {
    setItemsAlistados((prev) => ({
      ...prev,
      [idDetalle]: !prev[idDetalle],
    }));
  };

  // Consolidado Matutino de Carga por Producto (RF-06)
  const consolidadoProductos = useMemo(() => {
    const mapa = new Map<
      number,
      {
        producto: ProductoDespachoItem;
        kilosComprometidos: number;
        cantidadPedidos: number;
      }
    >();

    pedidosPendientes.forEach((pedido) => {
      pedido.detalle_pedidos.forEach((det) => {
        const key = det.producto.id_producto;
        const actual = mapa.get(key);
        if (actual) {
          actual.kilosComprometidos += det.kilos_estimados;
          actual.cantidadPedidos += 1;
        } else {
          mapa.set(key, {
            producto: det.producto,
            kilosComprometidos: det.kilos_estimados,
            cantidadPedidos: 1,
          });
        }
      });
    });

    return Array.from(mapa.values()).sort((a, b) => {
      const deficitA =
        a.kilosComprometidos > a.producto.stock_fisico_kilos ? 1 : 0;
      const deficitB =
        b.kilosComprometidos > b.producto.stock_fisico_kilos ? 1 : 0;
      if (deficitB !== deficitA) return deficitB - deficitA;
      return b.kilosComprometidos - a.kilosComprometidos;
    });
  }, [pedidosPendientes]);

  const totalesGlobales = useMemo(() => {
    let totalKilosBandeja = 0;
    let totalStockReferencial = 0;
    let productosConDeficit = 0;

    consolidadoProductos.forEach((item) => {
      totalKilosBandeja += item.kilosComprometidos;
      totalStockReferencial += item.producto.stock_fisico_kilos;
      if (item.kilosComprometidos > item.producto.stock_fisico_kilos) {
        productosConDeficit += 1;
      }
    });

    return {
      totalKilosBandeja,
      totalStockReferencial,
      productosConDeficit,
    };
  }, [consolidadoProductos]);

  const zonasDisponibles = useMemo(() => {
    const map = new Map<number, string>();
    pedidosPendientes.forEach((p) => {
      map.set(p.cliente.zona.id_zona, p.cliente.zona.nombre_zona);
    });
    return Array.from(map.entries())
      .map(([id_zona, nombre_zona]) => ({
        id_zona,
        nombre_zona,
      }))
      .sort((a, b) => a.nombre_zona.localeCompare(b.nombre_zona));
  }, [pedidosPendientes]);

  const vendedoresDisponibles = useMemo(() => {
    const map = new Map<
      number,
      { nombre_completo: string; codigo_vendedor: string }
    >();
    pedidosPendientes.forEach((p) => {
      map.set(p.vendedor.id_usuario, {
        nombre_completo: p.vendedor.nombre_completo,
        codigo_vendedor: p.vendedor.codigo_vendedor,
      });
    });
    return Array.from(map.entries())
      .map(([id_usuario, data]) => ({
        id_usuario,
        ...data,
      }))
      .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
  }, [pedidosPendientes]);

  const pedidosFiltrados = useMemo(() => {
    const query = busqueda.trim().toLowerCase();

    return pedidosPendientes
      .filter((pedido) => {
        if (
          zonaSeleccionada !== 'TODAS' &&
          String(pedido.cliente.zona.id_zona) !== zonaSeleccionada
        ) {
          return false;
        }
        if (
          vendedorSeleccionado !== 'TODOS' &&
          String(pedido.vendedor.id_usuario) !== vendedorSeleccionado
        ) {
          return false;
        }
        if (query) {
          const idConHash = `#${pedido.id_pedido}`;
          const coincidePedido =
            String(pedido.id_pedido).includes(query) ||
            idConHash.includes(query);
          const coincideCliente = pedido.cliente.nombre_comercial
            .toLowerCase()
            .includes(query);
          const coincideCodigoSac = pedido.cliente.codigo_cliente_sac
            .toLowerCase()
            .includes(query);
          return coincidePedido || coincideCliente || coincideCodigoSac;
        }
        return true;
      })
      .sort((a, b) => {
        if (ordenCriterio === 'ANTIGUEDAD') {
          return (
            new Date(a.fecha_preventa).getTime() -
            new Date(b.fecha_preventa).getTime()
          );
        }
        const cmpZona = a.cliente.zona.nombre_zona.localeCompare(
          b.cliente.zona.nombre_zona
        );
        if (cmpZona !== 0) return cmpZona;
        return (
          new Date(a.fecha_preventa).getTime() -
          new Date(b.fecha_preventa).getTime()
        );
      });
  }, [
    pedidosPendientes,
    zonaSeleccionada,
    vendedorSeleccionado,
    busqueda,
    ordenCriterio,
  ]);

  const siguientePedidoPendiente = pedidosFiltrados[0] ?? null;

  return (
    <div className="relative space-y-4 pb-20 text-slate-900 selection:bg-[#FFCD00] selection:text-slate-950 md:pb-4">
      {/* ====================================================================
          CABECERA COMPACTA DEL MÓDULO (SIN DUPLICAR DASHBOARDSHELL)
         ==================================================================== */}
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
        <div>
          <h1 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">
            Bandeja de Despacho
          </h1>
          <p className="text-xs font-medium text-slate-500">
            Pedidos pendientes de pesaje
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-700">
          <Scale className="h-3.5 w-3.5 text-[#C8102E]" />
          <span>
            {perfilDespachador.identificador_balanza} •{' '}
            {perfilDespachador.ancho_papel_mm}mm
          </span>
        </div>
      </header>

      {/* ====================================================================
          SECCIÓN 1: CONSOLIDADO MATUTINO DE CARGA POR PRODUCTO (RF-06)
         ==================================================================== */}
      <section
        aria-label="Consolidado Matutino de Carga por Producto"
        className="overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-sm"
      >
        <PlantCardHeaderStrip />

        <div className="p-3.5 sm:p-4 lg:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-[#C8102E]">
                  <Layers className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 sm:text-base lg:text-lg">
                    1. Carga Total a Sacar de Cámara ({consolidadoProductos.length} SKUs)
                  </h2>
                  <p className="text-xs text-slate-600">
                    Comprometido en bandeja:{' '}
                    <strong className="font-mono tabular-nums text-slate-950">
                      {formatKilos(totalesGlobales.totalKilosBandeja)}
                    </strong>{' '}
                    • Stock Cámara (SKUs activos):{' '}
                    <strong className="font-mono tabular-nums text-emerald-700">
                      {formatKilos(totalesGlobales.totalStockReferencial)}
                    </strong>
                  </p>
                </div>
              </div>

              {/* Botón táctil para expandir/contraer tarjetas en móvil */}
              <button
                type="button"
                onClick={() => setConsolidadoExpandidoMobile((prev) => !prev)}
                className="touch-manipulation flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-800 lg:hidden"
              >
                <span>
                  {consolidadoExpandidoMobile ? 'Ocultar' : 'Ver SKUs'}
                </span>
                {consolidadoExpandidoMobile ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>

            {totalesGlobales.productosConDeficit > 0 && (
              <div className="flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2 text-red-900">
                <ShieldAlert
                  className="h-5 w-5 shrink-0 text-[#C8102E]"
                  strokeWidth={2.2}
                />
                <span className="text-xs font-black">
                  ALERTA: {totalesGlobales.productosConDeficit} producto(s)
                  superan el stock físico registrado en cámara
                </span>
              </div>
            )}
          </div>

          {consolidadoProductos.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center text-xs font-semibold text-slate-500">
              No hay kilos pendientes por consolidar en cámara.
            </div>
          ) : (
            <div
              className={`mt-4 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-4 ${
                consolidadoExpandidoMobile ? 'grid' : 'hidden'
              }`}
            >
              {consolidadoProductos.map(
                ({ producto, kilosComprometidos, cantidadPedidos }) => {
                  const tieneDeficit =
                    kilosComprometidos > producto.stock_fisico_kilos;
                  const saldoPostDespacho =
                    producto.stock_fisico_kilos - kilosComprometidos;

                  return (
                    <div
                      key={producto.id_producto}
                      className={`rounded-xl border-2 p-3 ${
                        tieneDeficit
                          ? 'border-[#C8102E] bg-red-50/70'
                          : 'border-slate-200 bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="shrink-0 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
                          {producto.codigo_sku}
                        </span>
                        <span
                          className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] font-black uppercase ${badgeFormatoClass(
                            producto.formato
                          )}`}
                        >
                          {producto.formato}
                        </span>
                      </div>

                      <h3 className="mt-1.5 text-sm font-extrabold leading-snug text-slate-900">
                        {producto.nombre_producto}
                      </h3>

                      <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2">
                        <div>
                          <span className="block text-[10px] font-bold uppercase text-slate-500">
                            Pendiente ({cantidadPedidos} ped)
                          </span>
                          <span
                            className={`font-mono text-base font-black tabular-nums ${
                              tieneDeficit ? 'text-[#C8102E]' : 'text-slate-950'
                            }`}
                          >
                            {formatKilos(kilosComprometidos)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] font-bold uppercase text-slate-500">
                            Cámara Física
                          </span>
                          <span className="font-mono text-xs font-bold tabular-nums text-slate-700">
                            {formatKilos(producto.stock_fisico_kilos)}
                          </span>
                        </div>
                      </div>

                      {tieneDeficit && (
                        <p className="mt-1.5 font-mono text-[11px] font-black tabular-nums text-[#C8102E]">
                          Déficit: {formatKilos(saldoPostDespacho)}
                        </p>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </section>

      {/* ====================================================================
          SECCIÓN 2: FILTROS INSTANTÁNEOS EN CLIENTE (CU-D01)
         ==================================================================== */}
      <section
        aria-label="Filtros Rápidos de Bandeja"
        className="rounded-2xl border-2 border-slate-200/90 bg-white p-3.5 shadow-sm sm:p-4"
      >
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="buscador-despacho"
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar #pedido, Cliente o código SAC..."
                className="min-h-[50px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 pl-11 pr-10 text-base font-semibold text-slate-900 shadow-inner transition-all placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-slate-200 px-2.5 py-1.5 font-mono text-xs font-black text-slate-800 hover:bg-slate-300"
                >
                  X
                </button>
              )}
            </div>
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filtrar por Zona de Mercado"
              value={zonaSeleccionada}
              onChange={(e) => setZonaSeleccionada(e.target.value)}
              className="min-h-[50px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3 text-base font-bold text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
            >
              <option value="TODAS">Todas las Zonas</option>
              {zonasDisponibles.map((z) => (
                <option key={z.id_zona} value={String(z.id_zona)}>
                  {z.nombre_zona}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Filtrar por Vendedor"
              value={vendedorSeleccionado}
              onChange={(e) => setVendedorSeleccionado(e.target.value)}
              className="min-h-[50px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3 text-base font-bold text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
            >
              <option value="TODOS">Todos Vendedores</option>
              {vendedoresDisponibles.map((v) => (
                <option key={v.id_usuario} value={String(v.id_usuario)}>
                  {v.codigo_vendedor} · {v.nombre_completo}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() =>
                setOrdenCriterio((prev) =>
                  prev === 'ANTIGUEDAD' ? 'ZONA' : 'ANTIGUEDAD'
                )
              }
              className="touch-manipulation flex min-h-[50px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-slate-300 bg-slate-100 px-3 text-xs font-black uppercase text-slate-900 hover:bg-slate-200"
            >
              <ArrowUpDown className="h-4 w-4 shrink-0 text-[#C8102E]" />
              <span>
                {ordenCriterio === 'ANTIGUEDAD' ? 'Por Llegada' : 'Por Zona'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECCIÓN 3: COLA OPERATIVA DE PEDIDOS PENDIENTE (CU-D01)
         ==================================================================== */}
      <section
        aria-label="Cola de Pedidos Pendientes para Alistamiento y Pesaje"
        className="space-y-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="text-base font-black uppercase tracking-tight text-slate-900">
            2. Pedidos PENDIENTE en Cola ({pedidosFiltrados.length})
          </h2>
          <span className="font-mono text-xs font-bold text-slate-600">
            Toca cada ítem para marcar alistamiento en canastillo
          </span>
        </div>

        {pedidosPendientes.length === 0 ? (
          <div className="rounded-2xl border-2 border-slate-200 bg-white px-6 py-12 text-center shadow-xs">
            <Package className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="mt-2 text-base font-black text-slate-900">
              No hay pedidos PENDIENTES por despachar
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Cuando un vendedor registre una nueva preventa aparecerá
              automáticamente en esta bandeja.
            </p>
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="rounded-2xl border-2 border-slate-200 bg-white px-6 py-12 text-center shadow-xs">
            <Package className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-2 text-base font-black text-slate-900">
              No hay pedidos que coincidan con el filtro aplicado
            </p>
            <button
              type="button"
              onClick={() => {
                setBusqueda('');
                setZonaSeleccionada('TODAS');
                setVendedorSeleccionado('TODOS');
              }}
              className="mt-4 min-h-[50px] rounded-xl border-2 border-slate-300 bg-slate-100 px-5 text-sm font-black text-slate-900 hover:bg-slate-200"
            >
              Mostrar Todos los Pedidos
            </button>
          </div>
        ) : (
          pedidosFiltrados.map((pedido) => {
            const { hora, espera, minutos } = calcularHoraYEspera(
              pedido.fecha_preventa,
              ahoraMs
            );
            const totalKilosEstimados = pedido.detalle_pedidos.reduce(
              (acc, d) => acc + Number(d.kilos_estimados ?? 0),
              0
            );
            const totalBsReferencial = calcularMontoReferencialPedido(pedido);
            const cantidadAlistados = pedido.detalle_pedidos.filter(
              (d) => itemsAlistados[d.id_detalle]
            ).length;
            const todoAlistado =
              pedido.detalle_pedidos.length > 0 &&
              cantidadAlistados === pedido.detalle_pedidos.length;
            const estaNavegando = pedidoNavegandoId === pedido.id_pedido;

            return (
              <article
                key={pedido.id_pedido}
                className={`overflow-hidden rounded-2xl border-2 transition-all ${
                  estaNavegando
                    ? 'border-[#C8102E] bg-white shadow-lg ring-4 ring-[#FFCD00]/45'
                    : todoAlistado
                      ? 'border-amber-400 bg-white shadow-md'
                      : 'border-slate-200/95 bg-white shadow-sm'
                }`}
              >
                {/* Barra Superior de Identificación Rápida */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="shrink-0 whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1 font-mono text-sm font-black tabular-nums text-[#FFCD00]">
                      #{pedido.id_pedido}
                    </span>

                    <span
                      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-xs font-bold tabular-nums ${
                        minutos >= 40
                          ? 'bg-red-100 text-[#C8102E]'
                          : 'bg-slate-200/80 text-slate-800'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {hora}
                      {espera ? ` (${espera})` : ''}
                    </span>

                    <span className="shrink-0 whitespace-nowrap rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                      {pedido.cliente.codigo_cliente_sac}
                    </span>

                    <span
                      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 font-mono text-[11px] font-black uppercase ${
                        pedido.tipo_venta === 'CREDITO'
                          ? 'bg-sky-100 text-sky-900'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {pedido.tipo_venta === 'CREDITO' ? (
                        <>
                          <CreditCard className="h-3 w-3" />
                          <span>CRÉDITO • {pedido.plazo_dias}d</span>
                        </>
                      ) : (
                        <>
                          <Banknote className="h-3 w-3" />
                          <span>CONTADO</span>
                        </>
                      )}
                    </span>

                    {pedido.cliente.regla_cortesia_habitual && (
                      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-amber-400 bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-amber-950">
                        <Gift className="h-3 w-3 text-[#C8102E]" />
                        <span>CORTESÍA HABITUAL</span>
                      </span>
                    )}

                    {pedido.es_pedido_cortesia_pura && (
                      <span className="shrink-0 whitespace-nowrap rounded bg-purple-700 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-white">
                        CORTESÍA PURA
                      </span>
                    )}
                  </div>

                  <span
                    className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 font-mono text-xs font-black tabular-nums ${
                      todoAlistado
                        ? 'bg-[#FFCD00] text-slate-950'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    ALISTADO: {cantidadAlistados}/{pedido.detalle_pedidos.length}
                  </span>
                </div>

                {/* Cuerpo Principal: Datos Cliente + Checklist Táctil + Acciones */}
                <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12 lg:items-center">
                  {/* Cliente, Zona, Vendedor y Observación */}
                  <div className="space-y-2 lg:col-span-4">
                    <h3 className="text-lg font-black leading-tight text-slate-950">
                      {pedido.cliente.nombre_comercial}
                    </h3>

                    <div className="flex flex-col gap-1 text-xs font-bold text-slate-700">
                      <span className="inline-flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#C8102E]" />
                        <span>
                          {pedido.cliente.zona.nombre_zona}
                          {pedido.cliente.localidad &&
                          pedido.cliente.localidad.toLowerCase() !==
                            pedido.cliente.zona.nombre_zona.toLowerCase()
                            ? ` · ${pedido.cliente.localidad}`
                            : pedido.cliente.zona.ciudad
                              ? ` · ${pedido.cliente.zona.ciudad}`
                              : ''}
                        </span>
                      </span>
                      {pedido.cliente.direccion && (
                        <span className="pl-5 text-[11px] font-semibold text-slate-500">
                          Dir.: {pedido.cliente.direccion}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <User className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        <span>
                          {pedido.vendedor.nombre_completo}{' '}
                          <strong className="font-mono text-slate-800">
                            ({pedido.vendedor.codigo_vendedor})
                          </strong>
                        </span>
                      </span>
                    </div>

                    {pedido.cliente.regla_cortesia_habitual && (
                      <div className="flex items-start gap-2 rounded-xl border-l-4 border-[#C8102E] bg-amber-50 p-2.5 text-xs font-extrabold text-amber-950">
                        <Gift className="mt-0.5 h-4 w-4 shrink-0 text-[#C8102E]" />
                        <span>{pedido.cliente.regla_cortesia_habitual}</span>
                      </div>
                    )}

                    {pedido.observaciones && (
                      <div className="flex items-start gap-2 rounded-xl border-l-4 border-[#FFCD00] bg-amber-50 p-2.5 text-xs font-bold text-slate-950">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                        <span>{pedido.observaciones}</span>
                      </div>
                    )}
                  </div>

                  {/* Checklist Táctil de Productos (1 Toque = Marcado en Canasta) */}
                  <div className="space-y-2 lg:col-span-5">
                    {pedido.detalle_pedidos.map((det) => {
                      const marcado = !!itemsAlistados[det.id_detalle];
                      const stockInsuficiente =
                        det.kilos_estimados > det.producto.stock_fisico_kilos;

                      return (
                        <button
                          key={det.id_detalle}
                          type="button"
                          onClick={() => toggleItemAlistado(det.id_detalle)}
                          className={`touch-manipulation flex min-h-[52px] w-full items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 text-left transition-all active:scale-[0.99] ${
                            marcado
                              ? 'border-emerald-500 bg-emerald-50/90 text-emerald-950'
                              : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${
                                marcado
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-slate-400 bg-white text-transparent'
                              }`}
                            >
                              <Check className="h-4 w-4" strokeWidth={3} />
                            </span>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] font-black uppercase ${badgeFormatoClass(
                                    det.producto.formato
                                  )}`}
                                >
                                  {det.producto.formato}
                                </span>
                                {det.es_cortesia && (
                                  <span className="shrink-0 whitespace-nowrap rounded bg-purple-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-purple-900">
                                    CORTESÍA
                                  </span>
                                )}
                                {stockInsuficiente && (
                                  <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-[#C8102E]">
                                    <AlertTriangle className="h-3 w-3" />
                                    STOCK BAJO
                                  </span>
                                )}
                              </div>
                              <p
                                className={`mt-0.5 text-sm font-extrabold leading-snug ${
                                  marcado
                                    ? 'line-through opacity-75'
                                    : 'text-slate-900'
                                }`}
                              >
                                {det.producto.nombre_producto}
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 whitespace-nowrap rounded-lg bg-white px-2.5 py-1 font-mono text-sm font-black tabular-nums text-slate-950 ring-1 ring-slate-300">
                            {String(det.producto.unidad_medida).toUpperCase() ===
                              'UNIDAD' && det.producto.peso_unidad_kilos > 0
                              ? `${Math.round(det.kilos_estimados / det.producto.peso_unidad_kilos)} u. · ${formatKilos(det.kilos_estimados)}`
                              : formatKilos(det.kilos_estimados)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Totales, Botón Principal "Pesar y Despachar" y Enlace a Reimpresión */}
                  <div className="flex flex-col gap-2 lg:col-span-3">
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2">
                      <span className="font-mono text-[11px] font-bold uppercase text-slate-500">
                        Est. Total:
                      </span>
                      <div className="text-right">
                        <span className="block font-mono text-base font-black tabular-nums text-slate-950">
                          {formatKilos(totalKilosEstimados)}
                        </span>
                        <span className="font-mono text-[11px] font-bold tabular-nums text-slate-600">
                          {pedido.es_pedido_cortesia_pura
                            ? 'Bs. 0.00 (Cortesía)'
                            : formatBolivianos(totalBsReferencial)}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/despacho/${pedido.id_pedido}`}
                      prefetch={true}
                      onClick={() => setPedidoNavegandoId(pedido.id_pedido)}
                      className={`touch-manipulation flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl border-b-4 px-4 py-3 text-sm font-black uppercase tracking-wide shadow-md transition-all active:translate-y-[2px] active:border-b-2 ${
                        estaNavegando
                          ? 'border-slate-950 bg-slate-900 text-[#FFCD00]'
                          : 'border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] text-white hover:from-[#d61333] hover:to-[#85081C]'
                      }`}
                    >
                      {estaNavegando ? (
                        <Loader2
                          className="h-5 w-5 shrink-0 animate-spin text-[#FFCD00]"
                          strokeWidth={2.4}
                        />
                      ) : (
                        <Scale
                          className="h-5 w-5 shrink-0 text-[#FFCD00]"
                          strokeWidth={2.4}
                        />
                      )}
                      <span>
                        {estaNavegando
                          ? 'Abriendo balanza...'
                          : 'Pesar y Despachar'}
                      </span>
                    </Link>

                    <Link
                      href={`/despacho/imprimir/${pedido.id_pedido}`}
                      prefetch={true}
                      className="touch-manipulation inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                    >
                      <Printer className="h-3.5 w-3.5 text-[#C8102E]" />
                      <span>Ver / Imprimir Ticket</span>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* ====================================================================
          BARRA INFERIOR FIJA EN CELULAR SOBRE BottomNav (THUMB-ZONE)
         ==================================================================== */}
      {siguientePedidoPendiente && (
        <div className="no-print fixed inset-x-0 bottom-[74px] z-30 border-t-2 border-slate-300 bg-white/95 px-3 py-2 shadow-[0_-6px_20px_rgba(0,0,0,0.12)] backdrop-blur-md md:hidden">
          <Link
            href={`/despacho/${siguientePedidoPendiente.id_pedido}`}
            prefetch={true}
            onClick={() =>
              setPedidoNavegandoId(siguientePedidoPendiente.id_pedido)
            }
            className="touch-manipulation flex min-h-[52px] w-full items-center justify-between rounded-xl border-b-4 border-red-950 bg-gradient-to-r from-[#C8102E] to-[#9E0B22] px-4 text-white shadow-md active:translate-y-[2px]"
          >
            <div className="flex min-w-0 items-center gap-2.5 text-left">
              {pedidoNavegandoId === siguientePedidoPendiente.id_pedido ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#FFCD00]" />
              ) : (
                <Play className="h-5 w-5 shrink-0 fill-[#FFCD00] text-[#FFCD00]" />
              )}
              <div className="min-w-0">
                <span className="block font-mono text-[10px] font-bold uppercase text-red-100">
                  SIGUIENTE EN BALANZA: #{siguientePedidoPendiente.id_pedido}
                </span>
                <span className="block truncate text-sm font-black">
                  {siguientePedidoPendiente.cliente.nombre_comercial}
                </span>
              </div>
            </div>
            <span className="ml-2 shrink-0 whitespace-nowrap rounded-lg bg-[#FFCD00] px-2.5 py-1 font-mono text-xs font-black text-slate-950">
              {pedidoNavegandoId === siguientePedidoPendiente.id_pedido
                ? 'ABRIENDO...'
                : 'PESAR'}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
};

export default BandejaDespachoClient;

