'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  FileText,
  MapPin,
  Minus,
  Phone,
  Plus,
  Scale,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  registrarPreventaAction,
  type CategoriaPreventaItem,
  type ClientePreventaItem,
  type ProductoPreventaItem,
  type ZonaPreventaItem,
} from '@/actions/preventa.actions';
import { ModalNuevoCliente } from '@/components/forms/ModalNuevoCliente';
import {
  CharcuteriePatternBg,
  PlantCardHeaderStrip,
} from '@/components/forms/PreventaBrandDecor';
import type { FormatoProductoEnum } from '@/types/database.types';

export interface PreventaMobileFormProps {
  clientesIniciales: ClientePreventaItem[];
  zonas: ZonaPreventaItem[];
  productos: ProductoPreventaItem[];
  categorias: CategoriaPreventaItem[];
  codigoVendedor: string;
  metaDiariaKilos: number;
}

interface LineaPreventa {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  precio_kilo_bs: number;
  kilos_estimados: number;
  requiere_produccion: boolean;
}

function formatearBs(monto: number): string {
  return `Bs. ${monto.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const PreventaMobileForm: React.FC<PreventaMobileFormProps> = ({
  clientesIniciales,
  zonas: zonasIniciales,
  productos,
  categorias,
  codigoVendedor,
  metaDiariaKilos,
}) => {
  const router = useRouter();

  const [pasoActivo, setPasoActivo] = useState<'cliente' | 'catalogo' | 'detalle'>(
    'cliente'
  );

  // --- Estado de Clientes y Zonas ---
  const [clientes, setClientes] =
    useState<ClientePreventaItem[]>(clientesIniciales);
  const [zonasLista, setZonasLista] =
    useState<ZonaPreventaItem[]>(zonasIniciales);
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<ClientePreventaItem | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState('');

  // --- Estado de Modal Nuevo Cliente ---
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [modalResetKey, setModalResetKey] = useState(0);
  const [nombreInicialModal, setNombreInicialModal] = useState('');

  // --- Estado de Catálogo y Kilos Estimados Enteros ---
  const [filtroFormato, setFiltroFormato] = useState<
    'TODOS' | FormatoProductoEnum
  >('TODOS');
  const [filtroCategoria, setFiltroCategoria] = useState<number | 'TODAS'>(
    'TODAS'
  );
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [kilosPorProducto, setKilosPorProducto] = useState<
    Record<number, number>
  >({});

  // --- Estado de Observaciones y Envío ---
  const [observaciones, setObservaciones] = useState('');
  const [enviandoPreventa, setEnviandoPreventa] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tipo: 'ok' | 'error';
    mensaje: string;
    idPedido?: number;
  } | null>(null);

  // --- Filtrado de Clientes ---
  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nombre_comercial.toLowerCase().includes(q) ||
        c.codigo_cliente_sac.toLowerCase().includes(q) ||
        c.zona.toLowerCase().includes(q) ||
        (c.nit_ci?.toLowerCase().includes(q) ?? false) ||
        (c.telefono?.toLowerCase().includes(q) ?? false)
    );
  }, [clientes, busquedaCliente]);

  // --- Filtrado de Productos ---
  const productosFiltrados = useMemo(() => {
    const q = busquedaProducto.trim().toLowerCase();
    return productos.filter((p) => {
      const cumpleFormato =
        filtroFormato === 'TODOS' || p.formato === filtroFormato;
      const cumpleCategoria =
        filtroCategoria === 'TODAS' || p.id_categoria === filtroCategoria;
      const cumpleTexto =
        !q ||
        p.nombre_producto.toLowerCase().includes(q) ||
        p.codigo_sku.toLowerCase().includes(q) ||
        (p.categorias_producto?.nombre_categoria.toLowerCase().includes(q) ??
          false);
      return cumpleFormato && cumpleCategoria && cumpleTexto;
    });
  }, [productos, filtroFormato, filtroCategoria, busquedaProducto]);

  // --- Líneas Activas y Totales ---
  const lineasActivas: LineaPreventa[] = useMemo(() => {
    return productos
      .filter((p) => (kilosPorProducto[p.id_producto] ?? 0) > 0)
      .map((p) => ({
        id_producto: p.id_producto,
        codigo_sku: p.codigo_sku,
        nombre_producto: p.nombre_producto,
        formato: p.formato,
        precio_kilo_bs: p.precio_kilo_bs,
        kilos_estimados: kilosPorProducto[p.id_producto],
        requiere_produccion: p.requiere_produccion,
      }));
  }, [productos, kilosPorProducto]);

  const totales = useMemo(() => {
    return lineasActivas.reduce(
      (acc, item) => {
        acc.totalKilos += item.kilos_estimados;
        acc.totalBs += item.kilos_estimados * item.precio_kilo_bs;
        if (item.requiere_produccion) acc.itemsProduccion += 1;
        return acc;
      },
      { totalKilos: 0, totalBs: 0, itemsProduccion: 0 }
    );
  }, [lineasActivas]);

  // --- Manipuladores de Kilos Enteros ---
  const actualizarKilos = (idProducto: number, nuevoValor: number) => {
    const entero = Math.max(
      0,
      Math.floor(Number.isFinite(nuevoValor) ? nuevoValor : 0)
    );
    setKilosPorProducto((prev) => {
      const next = { ...prev };
      if (entero === 0) {
        delete next[idProducto];
      } else {
        next[idProducto] = entero;
      }
      return next;
    });
  };

  const incrementarKilos = (idProducto: number, delta: number) => {
    const actual = kilosPorProducto[idProducto] ?? 0;
    actualizarKilos(idProducto, actual + delta);
  };

  // --- Selección de Cliente ---
  const seleccionarClienteYContinuar = (cliente: ClientePreventaItem) => {
    setClienteSeleccionado(cliente);
    setFeedbackBanner(null);
    setPasoActivo('catalogo');
  };

  const abrirModalNuevoCliente = (nombrePrefill = '') => {
    setNombreInicialModal(nombrePrefill);
    setModalResetKey((prev) => prev + 1);
    setModalClienteOpen(true);
  };

  const handleClienteCreado = (
    clienteCreado: ClientePreventaItem,
    zonaCreada?: ZonaPreventaItem
  ) => {
    if (zonaCreada) {
      setZonasLista((prev) =>
        prev.some((z) => z.id_zona === zonaCreada.id_zona)
          ? prev
          : [...prev, zonaCreada]
      );
    }
    setClientes((prev) => [clienteCreado, ...prev]);
    setModalClienteOpen(false);
    seleccionarClienteYContinuar(clienteCreado);
  };

  // --- Envío Transaccional de Preventa ---
  const handleConfirmarPreventa = async () => {
    if (!clienteSeleccionado) {
      setFeedbackBanner({
        tipo: 'error',
        mensaje: 'Seleccione un cliente antes de registrar la preventa.',
      });
      setPasoActivo('cliente');
      return;
    }

    if (lineasActivas.length === 0) {
      setFeedbackBanner({
        tipo: 'error',
        mensaje: 'Agregue al menos 1 Kg de producto al pedido.',
      });
      setPasoActivo('catalogo');
      return;
    }

    setFeedbackBanner(null);
    setEnviandoPreventa(true);

    try {
      const resultado = await registrarPreventaAction({
        id_cliente: clienteSeleccionado.id_cliente,
        observaciones: observaciones.trim(),
        items: lineasActivas.map((l) => ({
          id_producto: l.id_producto,
          kilos_estimados: l.kilos_estimados,
        })),
      });

      if (!resultado.ok) {
        setFeedbackBanner({
          tipo: 'error',
          mensaje: resultado.error,
        });
        return;
      }

      setFeedbackBanner({
        tipo: 'ok',
        idPedido: resultado.id_pedido,
        mensaje: `Preventa #${resultado.id_pedido} registrada: ${clienteSeleccionado.nombre_comercial} · ${totales.totalKilos} Kg · ${formatearBs(totales.totalBs)}`,
      });

      setKilosPorProducto({});
      setObservaciones('');
      setClienteSeleccionado(null);
      setPasoActivo('cliente');
      router.refresh();
    } catch {
      setFeedbackBanner({
        tipo: 'error',
        mensaje: 'Error al registrar la preventa. Verifique su conexión.',
      });
    } finally {
      setEnviandoPreventa(false);
    }
  };

  return (
    <div className="relative flex w-full flex-col overflow-x-hidden rounded-2xl bg-[#F1F5F9]/80 pb-28 text-slate-900 md:pb-24 lg:h-[calc(100dvh-5rem)] lg:max-h-[820px] lg:overflow-hidden lg:pb-0">
      <CharcuteriePatternBg variant="canvas" idSuffix="bg-canvas" />

      <div className="relative z-10 flex h-full w-full flex-1 flex-col lg:overflow-hidden">
        {/* ==================================================================
            CABECERA COMPACTA SOBRE BLANCO + ACCESO DIRECTO A CADA PANEL
           ================================================================== */}
        <header className="mb-3 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">
                Nueva Preventa
              </h1>
              <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                {codigoVendedor}
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600">
                Meta {metaDiariaKilos} kg/día
              </span>
            </div>

            {/* Píldoras Horizontales de Cambio Rápido (PC y Tablet) */}
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => setPasoActivo('cliente')}
                className={`touch-manipulation flex min-h-[42px] items-center gap-2 rounded-xl border-2 px-3 text-xs font-black transition ${
                  pasoActivo === 'cliente'
                    ? 'border-[#C8102E] bg-[#C8102E] text-white shadow-sm'
                    : clienteSeleccionado
                      ? 'border-emerald-600/40 bg-emerald-50 text-emerald-950 hover:bg-emerald-100/70'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="font-mono">01</span>
                <span className="max-w-[180px] truncate">
                  {clienteSeleccionado
                    ? clienteSeleccionado.nombre_comercial
                    : 'Elegir Cliente'}
                </span>
              </button>

              <ChevronRight className="h-4 w-4 text-slate-400" />

              <button
                type="button"
                onClick={() => setPasoActivo('catalogo')}
                className={`touch-manipulation flex min-h-[42px] items-center gap-2 rounded-xl border-2 px-3 text-xs font-black transition ${
                  pasoActivo === 'catalogo'
                    ? 'border-[#C8102E] bg-[#C8102E] text-white shadow-sm'
                    : lineasActivas.length > 0
                      ? 'border-amber-500/50 bg-amber-50 text-slate-900 hover:bg-amber-100/70'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="font-mono">02</span>
                <span>Productos ({totales.totalKilos} Kg)</span>
              </button>

              <ChevronRight className="h-4 w-4 text-slate-400" />

              <button
                type="button"
                onClick={() => setPasoActivo('detalle')}
                className={`touch-manipulation flex min-h-[42px] items-center gap-2 rounded-xl border-2 px-3 text-xs font-black transition ${
                  pasoActivo === 'detalle'
                    ? 'border-[#C8102E] bg-[#C8102E] text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="font-mono">03</span>
                <span>Confirmar ({formatearBs(totales.totalBs)})</span>
              </button>
            </div>
          </div>

          {/* Navegación por Pantallas Dedicadas en Celular (< md) */}
          <div className="grid grid-cols-3 border-t border-slate-200 bg-slate-50/90 md:hidden">
            <button
              type="button"
              onClick={() => setPasoActivo('cliente')}
              className={`touch-manipulation flex min-h-[48px] flex-col items-center justify-center border-b-2 px-1.5 py-1 text-[11px] font-black transition ${
                pasoActivo === 'cliente'
                  ? 'border-[#C8102E] bg-white text-[#C8102E]'
                  : clienteSeleccionado
                    ? 'border-emerald-600 text-emerald-800'
                    : 'border-transparent text-slate-500'
              }`}
            >
              <span className="font-mono text-[10px]">
                {clienteSeleccionado ? '✓ 01' : '01'}
              </span>
              <span className="max-w-[95px] truncate">
                {clienteSeleccionado
                  ? clienteSeleccionado.nombre_comercial
                  : 'Cliente'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPasoActivo('catalogo')}
              className={`touch-manipulation flex min-h-[48px] flex-col items-center justify-center border-b-2 px-1.5 py-1 text-[11px] font-black transition ${
                pasoActivo === 'catalogo'
                  ? 'border-[#C8102E] bg-white text-[#C8102E]'
                  : lineasActivas.length > 0
                    ? 'border-amber-500 text-slate-900'
                    : 'border-transparent text-slate-500'
              }`}
            >
              <span className="font-mono text-[10px]">
                02 · {totales.totalKilos} Kg
              </span>
              <span>Productos</span>
            </button>

            <button
              type="button"
              onClick={() => setPasoActivo('detalle')}
              className={`touch-manipulation flex min-h-[48px] flex-col items-center justify-center border-b-2 px-1.5 py-1 text-[11px] font-black transition ${
                pasoActivo === 'detalle'
                  ? 'border-[#C8102E] bg-white text-[#C8102E]'
                  : 'border-transparent text-slate-500'
              }`}
            >
              <span className="font-mono text-[10px]">
                03 · {lineasActivas.length} Ítems
              </span>
              <span>Resumen</span>
            </button>
          </div>
        </header>

        {/* ==================================================================
            BANNER DE FEEDBACK OPERATIVO COMPACTO
           ================================================================== */}
        {feedbackBanner && (
          <div
            role="status"
            className={`mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2.5 rounded-xl border-2 px-3.5 py-2.5 shadow-sm ${
              feedbackBanner.tipo === 'ok'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                : 'border-[#C8102E] bg-red-50 text-red-950'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackBanner.tipo === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#C8102E]" />
              )}
              <p className="text-xs font-extrabold sm:text-sm">
                {feedbackBanner.mensaje}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {feedbackBanner.tipo === 'ok' && (
                <Link
                  href="/vendedor/mis-pedidos"
                  className="inline-flex min-h-[36px] items-center rounded-lg bg-emerald-700 px-3 text-xs font-black text-white hover:bg-emerald-800"
                >
                  Ver Mis Pedidos
                </Link>
              )}
              <button
                type="button"
                onClick={() => setFeedbackBanner(null)}
                aria-label="Cerrar mensaje"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-black/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================
            ESPACIO HORIZONTAL DE 3 PANELES TIPO ACORDEÓN EN PC · PASOS EN MÓVIL
           ================================================================== */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
          {/* ----------------------------------------------------------------
              PANEL 01: CLIENTE (Acordeón: expandido en paso 1, minimizado a la izq.)
             ---------------------------------------------------------------- */}
          <section
            aria-labelledby="paso-cliente-titulo"
            className={`relative flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all duration-300 ease-out ${
              pasoActivo === 'cliente'
                ? 'flex min-h-0 flex-1 border-[#C8102E] lg:h-full lg:min-w-0 lg:flex-1'
                : 'hidden border-slate-200/90 lg:flex lg:h-full lg:w-[240px] lg:shrink-0 xl:w-[260px]'
            }`}
          >
            <CharcuteriePatternBg variant="card" idSuffix="card-cliente" />
            <PlantCardHeaderStrip />

            {pasoActivo === 'cliente' ? (
              <div className="relative z-10 flex min-h-0 flex-1 flex-col p-4">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C8102E] font-mono text-xs font-black text-white">
                      01
                    </span>
                    <div>
                      <h2
                        id="paso-cliente-titulo"
                        className="text-sm font-black uppercase tracking-tight text-slate-900"
                      >
                        Seleccionar Cliente
                      </h2>
                      <p className="text-[11px] font-medium text-slate-500">
                        Al elegir se minimiza a la izquierda
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => abrirModalNuevoCliente('')}
                      className="touch-manipulation inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-slate-900 bg-[#FFCD00] px-3 text-xs font-black text-slate-950 shadow-sm transition hover:bg-[#f2c200]"
                    >
                      <UserPlus className="h-4 w-4" strokeWidth={2.4} />
                      <span>+ Nuevo Cliente</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPasoActivo('catalogo')}
                      className="touch-manipulation inline-flex min-h-[48px] items-center gap-1 rounded-xl border-2 border-slate-200 bg-white px-2.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                    >
                      <span>Catálogo</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Buscador Rápido de Clientes */}
                <div className="relative mt-3 shrink-0">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    strokeWidth={2.2}
                  />
                  <input
                    type="text"
                    value={busquedaCliente}
                    onChange={(e) => setBusquedaCliente(e.target.value)}
                    placeholder="Buscar cliente, mercado o código SAC..."
                    className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-white/95 pl-9 pr-10 text-base font-medium text-slate-900 shadow-inner transition placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
                  />
                  {busquedaCliente && (
                    <button
                      type="button"
                      onClick={() => setBusquedaCliente('')}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Grilla de Clientes con Todos sus Datos Completos */}
                <div className="mt-3 grid flex-1 grid-cols-1 content-start gap-2.5 overflow-y-auto pr-1 2xl:grid-cols-2">
                  {clientesFiltrados.length === 0 ? (
                    <div className="col-span-full rounded-xl border-2 border-dashed border-slate-300 bg-white/80 p-4 text-center">
                      <p className="text-xs font-bold text-slate-600">
                        Sin resultados para &ldquo;{busquedaCliente}&rdquo;
                      </p>
                      <button
                        type="button"
                        onClick={() => abrirModalNuevoCliente(busquedaCliente)}
                        className="touch-manipulation mt-2 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-slate-900 px-3.5 text-xs font-black text-[#FFCD00]"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>Crear &ldquo;{busquedaCliente}&rdquo;</span>
                      </button>
                    </div>
                  ) : (
                    clientesFiltrados.map((cliente) => {
                      const esActivo =
                        clienteSeleccionado?.id_cliente === cliente.id_cliente;
                      return (
                        <button
                          key={cliente.id_cliente}
                          type="button"
                          onClick={() => seleccionarClienteYContinuar(cliente)}
                          className={`touch-manipulation flex min-h-[76px] w-full flex-col justify-between gap-2 rounded-xl border-2 p-3.5 text-left transition active:scale-[0.99] ${
                            esActivo
                              ? 'border-[#C8102E] bg-red-50/90 shadow-sm'
                              : 'border-slate-200 bg-white/95 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex shrink-0 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-black text-[#FFCD00]">
                                {cliente.codigo_cliente_sac}
                              </span>
                              {esActivo && (
                                <span className="inline-flex shrink-0 whitespace-nowrap rounded-md bg-[#C8102E] px-2 py-0.5 text-[10px] font-black uppercase text-white">
                                  Seleccionado
                                </span>
                              )}
                            </div>

                            <ChevronRight
                              className={`h-4 w-4 shrink-0 ${
                                esActivo ? 'text-[#C8102E]' : 'text-slate-400'
                              }`}
                            />
                          </div>

                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-black leading-snug text-slate-950 sm:text-base">
                              {cliente.nombre_comercial}
                            </p>

                            <p className="flex items-start gap-1.5 text-xs font-semibold leading-snug text-slate-600">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C8102E]" />
                              <span>{cliente.zona}</span>
                            </p>

                            {(cliente.nit_ci || cliente.telefono) && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] font-bold text-slate-500">
                                {cliente.nit_ci && (
                                  <span className="whitespace-nowrap font-mono">
                                    NIT/CI: {cliente.nit_ci}
                                  </span>
                                )}
                                {cliente.telefono && (
                                  <span className="inline-flex items-center gap-1 whitespace-nowrap font-mono">
                                    <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                                    {cliente.telefono}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* --- VISTA MINIMIZADA LATERAL DE CLIENTE --- */
              <div className="relative z-10 flex flex-1 flex-col justify-between p-3.5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-black ${
                          clienteSeleccionado
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {clienteSeleccionado ? '✓' : '01'}
                      </span>
                      <span
                        id="paso-cliente-titulo"
                        className="text-xs font-black uppercase tracking-wider text-slate-500"
                      >
                        Cliente
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPasoActivo('cliente')}
                      className="touch-manipulation inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-black text-[#C8102E] hover:bg-red-50"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>
                        {clienteSeleccionado ? 'Cambiar' : 'Elegir'}
                      </span>
                    </button>
                  </div>

                  {clienteSeleccionado ? (
                    <div className="mt-3 rounded-xl border border-emerald-600/30 bg-emerald-50/75 p-3">
                      <div className="flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                        <span className="shrink-0 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-black text-[#FFCD00]">
                          {clienteSeleccionado.codigo_cliente_sac}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-black leading-snug text-slate-950">
                        {clienteSeleccionado.nombre_comercial}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-600">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#C8102E]" />
                        <span>{clienteSeleccionado.zona}</span>
                      </p>
                      {clienteSeleccionado.nit_ci && (
                        <p className="mt-1.5 font-mono text-[11px] font-bold text-slate-500">
                          NIT/CI: {clienteSeleccionado.nit_ci}
                        </p>
                      )}
                      {clienteSeleccionado.telefono && (
                        <p className="mt-0.5 font-mono text-[11px] font-bold text-slate-500">
                          Tel: {clienteSeleccionado.telefono}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPasoActivo('cliente')}
                      className="touch-manipulation mt-2.5 flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/60 px-3 text-xs font-black text-slate-800 hover:bg-amber-100/60"
                    >
                      + Elegir cliente
                    </button>
                  )}
                </div>

                <div className="mt-3 hidden rounded-lg border border-slate-200/80 bg-slate-50/90 p-2.5 text-[11px] font-semibold text-slate-500 lg:block">
                  Haz clic en{' '}
                  <strong className="text-slate-800">&ldquo;Cambiar&rdquo;</strong>{' '}
                  si deseas reasignar la preventa.
                </div>
              </div>
            )}
          </section>

          {/* ----------------------------------------------------------------
              PANEL 02: CATÁLOGO DE PRODUCTOS (Acordeón: ocupa todo el centro)
             ---------------------------------------------------------------- */}
          <section
            aria-labelledby="paso-catalogo-titulo"
            className={`relative flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all duration-300 ease-out ${
              pasoActivo === 'catalogo'
                ? 'flex min-h-0 flex-1 border-[#C8102E] lg:h-full lg:min-w-0 lg:flex-1'
                : 'hidden border-slate-200/90 lg:flex lg:h-full lg:w-[250px] lg:shrink-0 xl:w-[280px]'
            }`}
          >
            <CharcuteriePatternBg variant="card" idSuffix="card-catalogo" />
            <PlantCardHeaderStrip />

            {pasoActivo === 'catalogo' ? (
              <div className="relative z-10 flex min-h-0 flex-1 flex-col p-4">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C8102E] font-mono text-xs font-black text-white">
                      02
                    </span>
                    <h2
                      id="paso-catalogo-titulo"
                      className="text-sm font-black uppercase tracking-tight text-slate-900"
                    >
                      Catálogo de Embutidos (Kg)
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['TODOS', 'GRANEL', 'VACIO', 'UNIDAD'] as const).map((tab) => {
                      const activo = filtroFormato === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setFiltroFormato(tab)}
                          className={`touch-manipulation min-h-[40px] shrink-0 whitespace-nowrap rounded-xl border-2 px-2.5 text-xs font-black uppercase transition ${
                            activo
                              ? 'border-slate-950 bg-slate-900 text-[#FFCD00]'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {tab === 'TODOS' ? 'Todos' : tab}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setPasoActivo('detalle')}
                      className="touch-manipulation inline-flex min-h-[40px] shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border-2 border-slate-900 bg-[#FFCD00] px-3 text-xs font-black text-slate-950 shadow-sm transition hover:bg-[#f2c200]"
                    >
                      <span>Listo ({totales.totalKilos} Kg)</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Buscador + Selector por Categoría */}
                <div className="mt-2.5 flex shrink-0 flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      strokeWidth={2.2}
                    />
                    <input
                      type="text"
                      value={busquedaProducto}
                      onChange={(e) => setBusquedaProducto(e.target.value)}
                      placeholder="Filtrar chorizo, salchicha, mortadela o SKU..."
                      className="min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-white/95 pl-9 pr-9 text-base font-medium text-slate-900 shadow-inner transition placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
                    />
                    {busquedaProducto && (
                      <button
                        type="button"
                        onClick={() => setBusquedaProducto('')}
                        aria-label="Limpiar filtro"
                        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {categorias.length > 0 && (
                    <select
                      aria-label="Filtrar por categoría"
                      value={
                        filtroCategoria === 'TODAS'
                          ? 'TODAS'
                          : String(filtroCategoria)
                      }
                      onChange={(e) =>
                        setFiltroCategoria(
                          e.target.value === 'TODAS'
                            ? 'TODAS'
                            : Number.parseInt(e.target.value, 10)
                        )
                      }
                      className="min-h-[44px] rounded-xl border-2 border-slate-200 bg-white/95 px-3 text-sm font-bold text-slate-800 shadow-inner focus:border-[#C8102E] focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30 sm:w-52"
                    >
                      <option value="TODAS">Todas las categorías</option>
                      {categorias.map((cat) => (
                        <option
                          key={cat.id_categoria}
                          value={String(cat.id_categoria)}
                        >
                          {cat.nombre_categoria}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Filas Horizontales de Productos */}
                <div className="mt-2.5 flex-1 space-y-2 overflow-y-auto pr-1">
                  {productosFiltrados.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white/80 p-6 text-center text-xs font-bold text-slate-500">
                      No se encontraron productos con el filtro aplicado.
                    </div>
                  ) : (
                    productosFiltrados.map((producto) => {
                      const kilosActuales =
                        kilosPorProducto[producto.id_producto] ?? 0;
                      const requiereProduccion = producto.requiere_produccion;
                      const tieneCantidad = kilosActuales > 0;
                      const subtotalProducto =
                        kilosActuales * producto.precio_kilo_bs;

                      return (
                        <article
                          key={producto.id_producto}
                          className={`flex flex-col gap-3 rounded-xl border-2 px-3.5 py-3 transition ${
                            tieneCantidad
                              ? 'border-[#C8102E] bg-red-50/45 shadow-sm'
                              : 'border-slate-200 bg-white/95 hover:border-slate-300'
                          }`}
                        >
                          {/* Fila 1: Información del producto (badges arriba, nombre y precio) */}
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                                {producto.codigo_sku}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-black uppercase ${
                                  producto.formato === 'VACIO'
                                    ? 'bg-sky-100 text-sky-900'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {producto.formato}
                              </span>
                              {producto.categorias_producto?.nombre_categoria && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                  {
                                    producto.categorias_producto
                                      .nombre_categoria
                                  }
                                </span>
                              )}
                              {requiereProduccion ? (
                                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-[#C8102E]">
                                  <AlertTriangle
                                    className="h-3 w-3 shrink-0"
                                    strokeWidth={2.5}
                                  />
                                  Requiere Producción
                                </span>
                              ) : (
                                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded bg-emerald-100/90 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                  Disponible
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <h3 className="text-base font-bold leading-snug text-slate-900">
                                {producto.nombre_producto}
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-slate-700">
                                  {formatearBs(producto.precio_kilo_bs)}/kg
                                </span>
                                {tieneCantidad && (
                                  <span className="whitespace-nowrap rounded bg-[#FFCD00]/70 px-2 py-0.5 font-mono text-xs font-black tabular-nums text-slate-950">
                                    = {formatearBs(subtotalProducto)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Fila 2: Controles táctiles de kilos enteros (100% ancho) */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 sm:flex-nowrap">
                            {/* Grupo Stepper (- / Input / +) */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  incrementarKilos(producto.id_producto, -1)
                                }
                                disabled={kilosActuales === 0}
                                aria-label={`Restar 1 kilo a ${producto.nombre_producto}`}
                                className="touch-manipulation flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 bg-slate-100 text-slate-900 transition active:scale-95 disabled:opacity-35"
                              >
                                <Minus className="h-4 w-4" strokeWidth={2.5} />
                              </button>

                              <div className="relative w-20">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  aria-label={`Kilos de ${producto.nombre_producto}`}
                                  value={
                                    kilosActuales === 0
                                      ? ''
                                      : String(kilosActuales)
                                  }
                                  placeholder="0"
                                  onChange={(e) => {
                                    const soloDigitos = e.target.value.replace(
                                      /\D/g,
                                      ''
                                    );
                                    actualizarKilos(
                                      producto.id_producto,
                                      soloDigitos === ''
                                        ? 0
                                        : Number.parseInt(soloDigitos, 10)
                                    );
                                  }}
                                  className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-2 pr-6 text-center font-mono text-base font-bold tabular-nums text-slate-950 shadow-inner focus:border-[#C8102E] focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
                                />
                                <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 font-mono text-[9px] font-black text-slate-400">
                                  KG
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  incrementarKilos(producto.id_producto, 1)
                                }
                                aria-label={`Sumar 1 kilo a ${producto.nombre_producto}`}
                                className="touch-manipulation flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[#C8102E] bg-[#C8102E] text-white shadow-sm transition active:scale-95"
                              >
                                <Plus className="h-4 w-4" strokeWidth={2.5} />
                              </button>
                            </div>

                            {/* Grupo Atajos (+5 / +10) */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  incrementarKilos(producto.id_producto, 5)
                                }
                                className="touch-manipulation h-12 shrink-0 whitespace-nowrap rounded-xl border-2 border-slate-200 bg-slate-50 px-3 font-mono text-xs font-black text-slate-800 transition hover:bg-slate-100 active:scale-95"
                              >
                                +5
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  incrementarKilos(producto.id_producto, 10)
                                }
                                className="touch-manipulation h-12 shrink-0 whitespace-nowrap rounded-xl border-2 border-slate-200 bg-slate-50 px-3 font-mono text-xs font-black text-slate-800 transition hover:bg-slate-100 active:scale-95"
                              >
                                +10
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* --- VISTA MINIMIZADA DE PRODUCTOS YA ELEGIDOS --- */
              <div className="relative z-10 flex min-h-0 flex-1 flex-col p-3.5">
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-black ${
                        lineasActivas.length > 0
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {lineasActivas.length > 0 ? '✓' : '02'}
                    </span>
                    <span
                      id="paso-catalogo-titulo"
                      className="text-xs font-black uppercase tracking-wider text-slate-500"
                    >
                      Productos ({lineasActivas.length})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPasoActivo('catalogo')}
                    className="touch-manipulation inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-black text-[#C8102E] hover:bg-red-50"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>
                      {lineasActivas.length > 0 ? 'Editar Kg' : 'Agregar'}
                    </span>
                  </button>
                </div>

                {lineasActivas.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setPasoActivo('catalogo')}
                    className="touch-manipulation mt-2.5 flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-3 text-xs font-black text-slate-700 hover:bg-slate-100"
                  >
                    + Cargar embutidos
                  </button>
                ) : (
                  <div className="mt-2.5 flex min-h-0 flex-1 flex-col justify-between gap-2">
                    <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white/95 px-2.5 py-1">
                      {lineasActivas.map((linea) => (
                        <li
                          key={linea.id_producto}
                          className="flex items-center justify-between gap-2 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-900">
                              {linea.nombre_producto}
                            </p>
                            {linea.requiere_produccion && (
                              <span className="inline-block rounded bg-red-100 px-1 text-[9px] font-black text-[#C8102E]">
                                REQ. PRODUCCIÓN
                              </span>
                            )}
                          </div>
                          <div className="shrink-0 text-right font-mono">
                            <span className="rounded bg-[#FFCD00] px-1.5 py-0.5 font-black text-slate-950">
                              {linea.kilos_estimados} Kg
                            </span>
                            <p className="mt-0.5 text-[11px] font-bold text-slate-600">
                              {formatearBs(
                                linea.kilos_estimados * linea.precio_kilo_bs
                              )}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="flex shrink-0 items-center justify-between rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white">
                      <span>Total Carga:</span>
                      <span className="font-mono text-[#FFCD00]">
                        {totales.totalKilos} Kg · {formatearBs(totales.totalBs)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ----------------------------------------------------------------
              PANEL 03: CIERRE Y CONFIRMACIÓN (Acordeón: compacto por defecto, expandible en detalle)
             ---------------------------------------------------------------- */}
          <section
            aria-labelledby="paso-confirmar-titulo"
            className={`relative flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-md transition-all duration-300 ease-out ${
              pasoActivo === 'detalle'
                ? 'flex min-h-0 flex-1 border-[#C8102E] lg:h-full lg:min-w-0 lg:flex-1'
                : 'hidden border-slate-200/90 lg:flex lg:h-full lg:w-[280px] lg:shrink-0 xl:w-[320px]'
            }`}
          >
            <CharcuteriePatternBg variant="card" idSuffix="card-resumen" />
            <PlantCardHeaderStrip />

            <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between p-4">
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C8102E] font-mono text-xs font-black text-white">
                      03
                    </span>
                    <h2
                      id="paso-confirmar-titulo"
                      className="text-sm font-black uppercase tracking-tight text-slate-900"
                    >
                      Resumen y Confirmación
                    </h2>
                  </div>

                  {pasoActivo !== 'detalle' && (
                    <button
                      type="button"
                      onClick={() => setPasoActivo('detalle')}
                      className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2 text-xs font-black text-slate-800 hover:bg-slate-200"
                    >
                      <span>Abrir</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Tarjeta del Cliente en Pantalla Final Móvil */}
                <div className="mt-2.5 shrink-0 rounded-xl border border-slate-200 bg-white/95 p-3 lg:hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Datos del Cliente
                    </span>
                    <button
                      type="button"
                      onClick={() => setPasoActivo('cliente')}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-[#C8102E]"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>{clienteSeleccionado ? 'Cambiar' : 'Elegir'}</span>
                    </button>
                  </div>
                  {clienteSeleccionado ? (
                    <div className="mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-black text-[#FFCD00]">
                          {clienteSeleccionado.codigo_cliente_sac}
                        </span>
                        <p className="text-sm font-black text-slate-950">
                          {clienteSeleccionado.nombre_comercial}
                        </p>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-600">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#C8102E]" />
                        <span>{clienteSeleccionado.zona}</span>
                      </p>
                      {(clienteSeleccionado.nit_ci ||
                        clienteSeleccionado.telefono) && (
                        <p className="mt-1 font-mono text-[11px] font-bold text-slate-500">
                          {clienteSeleccionado.nit_ci
                            ? `NIT/CI: ${clienteSeleccionado.nit_ci}`
                            : ''}
                          {clienteSeleccionado.nit_ci &&
                          clienteSeleccionado.telefono
                            ? ' · '
                            : ''}
                          {clienteSeleccionado.telefono
                            ? `Tel: ${clienteSeleccionado.telefono}`
                            : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs font-bold text-[#C8102E]">
                      ⚠ Falta seleccionar cliente
                    </p>
                  )}
                </div>

                {/* Resumen Consolidado de Totales */}
                <div className="mt-2.5 shrink-0 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/90 p-3">
                  <div className="hidden items-start justify-between gap-2 text-xs lg:flex">
                    <span className="shrink-0 font-bold text-slate-500">Cliente:</span>
                    <span className="text-right font-black leading-snug text-slate-900">
                      {clienteSeleccionado
                        ? clienteSeleccionado.nombre_comercial
                        : 'Pendiente'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">
                      Peso Total:
                    </span>
                    <span className="rounded bg-[#FFCD00] px-2 py-0.5 font-mono text-sm font-black tabular-nums text-slate-950">
                      {totales.totalKilos} Kg
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                    <span className="text-xs font-bold text-slate-600">
                      Monto Estimado:
                    </span>
                    <span className="font-mono text-lg font-black tabular-nums text-slate-950">
                      {formatearBs(totales.totalBs)}
                    </span>
                  </div>
                </div>

                {/* Lista Completa de Productos Seleccionados + Observaciones */}
                <div
                  className={`mt-2.5 min-h-0 flex-1 flex-col ${
                    pasoActivo === 'detalle' ? 'flex' : 'hidden lg:flex'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between lg:hidden">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Detalle de Productos ({lineasActivas.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setPasoActivo('catalogo')}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-[#C8102E]"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Editar Kg</span>
                    </button>
                  </div>

                  {lineasActivas.length === 0 ? (
                    <div className="mb-2.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-3 text-center text-xs font-bold text-slate-500 lg:hidden">
                      Aún no agregaste productos en kilos.
                    </div>
                  ) : (
                    <ul className="mb-2.5 min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white/95 px-2.5 py-1">
                      {lineasActivas.map((linea) => (
                        <li
                          key={linea.id_producto}
                          className="flex items-center justify-between gap-2 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-slate-900">
                              {linea.nombre_producto}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-slate-600">
                              <span className="font-black text-[#C8102E]">
                                {linea.kilos_estimados} Kg
                              </span>
                              <span>× {formatearBs(linea.precio_kilo_bs)}</span>
                              {linea.requiere_produccion && (
                                <span className="rounded bg-red-100 px-1 text-[9px] font-black text-[#C8102E]">
                                  REQ. PROD.
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs font-black tabular-nums text-slate-900">
                              {formatearBs(
                                linea.kilos_estimados * linea.precio_kilo_bs
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                actualizarKilos(linea.id_producto, 0)
                              }
                              aria-label={`Quitar ${linea.nombre_producto}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-[#C8102E]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Observaciones de Entrega */}
                  <div className="shrink-0">
                    <label
                      htmlFor="obs-preventa"
                      className="mb-1 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700"
                    >
                      <FileText className="h-3.5 w-3.5 text-[#C8102E]" />
                      <span>Observaciones de Entrega</span>
                    </label>
                    <input
                      id="obs-preventa"
                      type="text"
                      maxLength={180}
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Ej. Entregar antes de las 08:30 AM..."
                      className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-white/95 px-3 text-base font-medium text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[#C8102E] focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[
                        'Antes 08:30 AM',
                        'Puesto central',
                        'Contra entrega',
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() =>
                            setObservaciones((prev) =>
                              prev ? `${prev} · ${chip}` : chip
                            )
                          }
                          className="min-h-[34px] shrink-0 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-100 px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón Principal de Envío (PC) */}
              <button
                type="button"
                disabled={enviandoPreventa}
                onClick={handleConfirmarPreventa}
                className="touch-manipulation mt-3 hidden min-h-[52px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-4 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-105 active:translate-y-[2px] active:border-b-2 disabled:opacity-50 lg:flex"
              >
                <CheckCircle2
                  className="h-5 w-5 text-[#FFCD00]"
                  strokeWidth={2.5}
                />
                <span>
                  {enviandoPreventa ? 'Registrando...' : 'Registrar Preventa'}
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* ====================================================================
          BARRA INFERIOR FIJA EN THUMB-ZONE SOBRE EL BottomNav
         ==================================================================== */}
      <div className="no-print fixed inset-x-0 bottom-[74px] z-30 border-t-4 border-[#FFCD00] bg-white/95 px-3 py-2.5 shadow-[0_-8px_20px_-5px_rgba(15,23,42,0.16)] backdrop-blur-md md:bottom-0 md:left-72 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2.5">
          {/* Resumen Compacto Tocable */}
          <button
            type="button"
            onClick={() =>
              setPasoActivo(pasoActivo === 'detalle' ? 'catalogo' : 'detalle')
            }
            className="touch-manipulation flex min-h-[52px] flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-left"
          >
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-[#C8102E]" />
              <span className="rounded bg-[#FFCD00] px-1.5 py-0.5 font-mono text-xs font-black tabular-nums text-slate-950">
                {totales.totalKilos} Kg
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                ({lineasActivas.length})
              </span>
            </div>
            <span className="mt-0.5 font-mono text-sm font-black tabular-nums text-slate-950">
              {formatearBs(totales.totalBs)}
            </span>
          </button>

          {/* Acción Contextual Directa */}
          {pasoActivo === 'cliente' ? (
            <button
              type="button"
              onClick={() => setPasoActivo('catalogo')}
              className="touch-manipulation flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-b-4 border-slate-950 bg-slate-900 px-4 text-sm font-black uppercase text-[#FFCD00] shadow-md active:translate-y-[2px]"
            >
              <ShoppingBag className="h-5 w-5" />
              <span>Siguiente: Productos</span>
            </button>
          ) : pasoActivo === 'catalogo' ? (
            <button
              type="button"
              onClick={() => setPasoActivo('detalle')}
              className="touch-manipulation flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-4 text-sm font-black uppercase text-white shadow-md active:translate-y-[2px]"
            >
              <span>Ver Resumen Final</span>
              <ChevronRight className="h-5 w-5 text-[#FFCD00]" />
            </button>
          ) : (
            <button
              type="button"
              disabled={enviandoPreventa}
              onClick={handleConfirmarPreventa}
              className="touch-manipulation flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-4 text-sm font-black uppercase text-white shadow-md active:translate-y-[2px] disabled:opacity-50"
            >
              <CheckCircle2
                className="h-5 w-5 text-[#FFCD00]"
                strokeWidth={2.5}
              />
              <span>
                {enviandoPreventa ? 'Guardando...' : 'Registrar Preventa'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Modal Táctil de Creación Rápida de Cliente */}
      <ModalNuevoCliente
        key={modalResetKey}
        open={modalClienteOpen}
        zonas={zonasLista}
        nombreInicial={nombreInicialModal}
        onClose={() => setModalClienteOpen(false)}
        onClienteCreado={handleClienteCreado}
      />
    </div>
  );
};

