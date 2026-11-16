'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Eye,
  FileText,
  Gift,
  Info,
  Layers,
  MapPin,
  PackageCheck,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Scale,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { confirmarDespachoAction } from '@/actions/despacho.actions';
import {
  CharcuteriePatternBg,
  EuroalimentosEmblem,
  PlantCardHeaderStrip,
} from '@/components/forms/PreventaBrandDecor';
import {
  TicketTermicoEpson,
  type AnchoPapelTermico,
  type PedidoTicketTermico,
} from '@/components/tickets/TicketTermicoEpson';
import type {
  PedidoDespachoItem,
  PerfilDespachadorResumen,
  ProductoCatalogoPesajeItem,
} from '@/lib/despacho/mappers';
import type { FormatoProductoEnum } from '@/types/database.types';

export interface EstacionPesajeClientProps {
  pedido: PedidoDespachoItem;
  productosCatalogo: ProductoCatalogoPesajeItem[];
  perfilDespachador: PerfilDespachadorResumen;
}

interface LineaCortesia {
  id_temp: string;
  id_producto: number;
  kilos_reales: string;
}

function roundTo(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

function formatKg(val: number): string {
  if (Number.isNaN(val)) return '0.000';
  return val.toFixed(3);
}

function formatBs(val: number): string {
  if (Number.isNaN(val)) return '0.00';
  return val.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatFechaPreventa(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function sanitizeDecimalInput(raw: string): string {
  let cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
  }
  if (parts[1] && parts[1].length > 3) {
    cleaned = `${parts[0]}.${parts[1].slice(0, 3)}`;
  }
  return cleaned;
}

function badgeFormatoClass(formato: FormatoProductoEnum): string {
  switch (formato) {
    case 'GRANEL':
      return 'border border-amber-300 bg-[#FFCD00]/30 text-amber-950';
    case 'VACIO':
      return 'border border-sky-300 bg-sky-100 text-sky-900';
    case 'UNIDAD':
      return 'border border-purple-300 bg-purple-100 text-purple-900';
  }
}

export const EstacionPesajeClient: React.FC<EstacionPesajeClientProps> = ({
  pedido,
  productosCatalogo,
  perfilDespachador,
}) => {
  const router = useRouter();

  // Productos elegibles para cortesías (GRANEL o VACIO según RF-08, con fallback a catálogo completo)
  const productosCortesiaElegibles = useMemo(() => {
    const granelOVacio = productosCatalogo.filter(
      (p) => p.formato === 'GRANEL' || p.formato === 'VACIO'
    );
    return granelOVacio.length > 0 ? granelOVacio : productosCatalogo;
  }, [productosCatalogo]);

  // Estado de pesos reales por id_detalle (vacío al iniciar para forzar pesaje en gancho)
  const [pesosReales, setPesosReales] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    pedido.detalle_pedidos.forEach((item) => {
      initial[item.id_detalle] =
        item.kilos_reales !== null && item.kilos_reales > 0
          ? item.kilos_reales.toFixed(3)
          : '';
    });
    return initial;
  });

  // Estado de líneas de cortesía / degustación (RF-08 / CU-D03)
  const [cortesias, setCortesias] = useState<LineaCortesia[]>([]);

  // Estados de UI, vista previa y confirmación atómica
  const [enviando, setEnviando] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [modalConfirmacionAbierto, setModalConfirmacionAbierto] =
    useState(false);
  const [modalPreviewAbierto, setModalPreviewAbierto] = useState(false);
  const [anchoPreviewMm, setAnchoPreviewMm] = useState<AnchoPapelTermico>(() =>
    perfilDespachador.ancho_papel_mm === 58 ? 58 : 80
  );

  // Refs para navegación secuencial con Enter
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleKeyDownEnter = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentIndex: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = inputRefs.current[currentIndex + 1];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  const handleCambioPesoFacturado = (idDetalle: number, valor: string) => {
    const limpio = sanitizeDecimalInput(valor);
    setErrorBanner(null);
    setPesosReales((prev) => ({
      ...prev,
      [idDetalle]: limpio,
    }));
  };

  const handleAjustarGramos = (
    idDetalle: number,
    deltaKg: number,
    kilosBaseSiVacio = 0
  ) => {
    setErrorBanner(null);
    setPesosReales((prev) => {
      const actualStr = prev[idDetalle] ?? '';
      const actualNum =
        actualStr === '' ? kilosBaseSiVacio : parseFloat(actualStr) || 0;
      const nuevoValor = Math.max(0, roundTo(actualNum + deltaKg, 3));
      return {
        ...prev,
        [idDetalle]: nuevoValor > 0 ? nuevoValor.toFixed(3) : '',
      };
    });
  };

  const handleCopiarEstimado = (idDetalle: number, kilosEstimados: number) => {
    setErrorBanner(null);
    setPesosReales((prev) => ({
      ...prev,
      [idDetalle]: kilosEstimados.toFixed(3),
    }));
  };

  const handleCopiarTodosEstimados = () => {
    setErrorBanner(null);
    const nuevoMapa: Record<number, string> = {};
    pedido.detalle_pedidos.forEach((item) => {
      nuevoMapa[item.id_detalle] = item.kilos_estimados.toFixed(3);
    });
    setPesosReales(nuevoMapa);
  };

  const handleAgregarCortesia = (kilosIniciales = '') => {
    if (!perfilDespachador.autorizado_cortesias) return;
    const productoDefault = productosCortesiaElegibles[0];
    if (!productoDefault) return;

    setErrorBanner(null);
    const nuevaLinea: LineaCortesia = {
      id_temp: `cort-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      id_producto: productoDefault.id_producto,
      kilos_reales: kilosIniciales,
    };
    setCortesias((prev) => [...prev, nuevaLinea]);
  };

  const handleActualizarCortesiaProducto = (
    idTemp: string,
    idProducto: number
  ) => {
    setErrorBanner(null);
    setCortesias((prev) =>
      prev.map((c) =>
        c.id_temp === idTemp ? { ...c, id_producto: idProducto } : c
      )
    );
  };

  const handleActualizarCortesiaKilos = (idTemp: string, valor: string) => {
    setErrorBanner(null);
    const limpio = sanitizeDecimalInput(valor);
    setCortesias((prev) =>
      prev.map((c) =>
        c.id_temp === idTemp ? { ...c, kilos_reales: limpio } : c
      )
    );
  };

  const handleEliminarCortesia = (idTemp: string) => {
    setErrorBanner(null);
    setCortesias((prev) => prev.filter((c) => c.id_temp !== idTemp));
  };

  // ============================================================================
  // CÁLCULOS EN VIVO (TABULAR-NUMS + VERIFICACIÓN DE STOCK FÍSICO)
  // ============================================================================

  const calculos = useMemo(() => {
    const detallesProcesados = pedido.detalle_pedidos.map((det) => {
      const rawStr = pesosReales[det.id_detalle] ?? '';
      const kilosInputNum = parseFloat(rawStr);
      const valido = !Number.isNaN(kilosInputNum) && kilosInputNum > 0;
      const kilosEfectivos = valido ? roundTo(kilosInputNum, 3) : 0;
      const subtotalBs =
        det.es_cortesia || pedido.es_pedido_cortesia_pura
          ? 0
          : Number((kilosEfectivos * det.precio_unitario_congelado).toFixed(2));
      const variacionKg = roundTo(kilosEfectivos - det.kilos_estimados, 3);

      return {
        ...det,
        rawStr,
        kilosEfectivos,
        valido,
        subtotalBs,
        variacionKg,
      };
    });

    const cortesiasProcesadas = cortesias.map((cort) => {
      const prod =
        productosCatalogo.find((p) => p.id_producto === cort.id_producto) ??
        productosCortesiaElegibles[0];
      const kilosNum = parseFloat(cort.kilos_reales);
      const valido = !Number.isNaN(kilosNum) && kilosNum > 0;
      const kilosEfectivos = valido ? roundTo(kilosNum, 3) : 0;

      return {
        ...cort,
        producto: prod,
        kilosEfectivos,
        valido,
      };
    });

    let totalKilosEstimados = 0;
    let totalKilosFacturados = 0;
    let totalCobrarBs = 0;
    let lineasPesadasCount = 0;
    const consumoPorProducto: Record<number, number> = {};

    for (const det of detallesProcesados) {
      if (det.valido) {
        lineasPesadasCount += 1;
      }
      totalKilosEstimados = roundTo(
        totalKilosEstimados + det.kilos_estimados,
        3
      );
      totalKilosFacturados = roundTo(
        totalKilosFacturados + det.kilosEfectivos,
        3
      );
      totalCobrarBs = Number((totalCobrarBs + det.subtotalBs).toFixed(2));
      consumoPorProducto[det.id_producto] = roundTo(
        (consumoPorProducto[det.id_producto] ?? 0) + det.kilosEfectivos,
        3
      );
    }

    let totalKilosCortesia = 0;
    for (const cort of cortesiasProcesadas) {
      totalKilosCortesia = roundTo(
        totalKilosCortesia + cort.kilosEfectivos,
        3
      );
      if (cort.producto) {
        consumoPorProducto[cort.producto.id_producto] = roundTo(
          (consumoPorProducto[cort.producto.id_producto] ?? 0) +
            cort.kilosEfectivos,
          3
        );
      }
    }

    let hayExcesoStock = false;
    for (const [idProdStr, kilosTotales] of Object.entries(
      consumoPorProducto
    )) {
      const idProd = Number(idProdStr);
      const prodCatalogo = productosCatalogo.find(
        (p) => p.id_producto === idProd
      );
      const stockRef =
        prodCatalogo?.stock_fisico_kilos ??
        pedido.detalle_pedidos.find((d) => d.id_producto === idProd)?.producto
          .stock_fisico_kilos;
      if (stockRef !== undefined && kilosTotales > stockRef) {
        hayExcesoStock = true;
        break;
      }
    }

    const todasLineasFacturadasValidas =
      detallesProcesados.length > 0 &&
      detallesProcesados.every((d) => d.valido);
    const todasCortesiasValidas = cortesiasProcesadas.every((c) => c.valido);

    const totalKilosFisicos = roundTo(
      totalKilosFacturados + totalKilosCortesia,
      3
    );
    const formularioListo =
      todasLineasFacturadasValidas && todasCortesiasValidas;

    return {
      detallesProcesados,
      cortesiasProcesadas,
      consumoPorProducto,
      totalKilosEstimados,
      totalKilosFacturados,
      totalKilosCortesia,
      totalKilosFisicos,
      totalCobrarBs,
      lineasPesadasCount,
      totalLineasFacturadas: pedido.detalle_pedidos.length,
      formularioListo,
      hayExcesoStock,
    };
  }, [
    pedido.detalle_pedidos,
    pedido.es_pedido_cortesia_pura,
    pesosReales,
    cortesias,
    productosCatalogo,
    productosCortesiaElegibles,
  ]);

  const pedidoVistaPrevia = useMemo<PedidoTicketTermico>(() => {
    const detallesFacturados = calculos.detallesProcesados.map((det) => ({
      id_detalle: det.id_detalle,
      id_producto: det.id_producto,
      codigo_sku: det.producto.codigo_sku,
      nombre_producto: det.producto.nombre_producto,
      formato: det.producto.formato,
      kilos_estimados: det.kilos_estimados,
      kilos_reales: det.kilosEfectivos,
      precio_unitario_congelado: det.precio_unitario_congelado,
      es_cortesia: det.es_cortesia,
      subtotal_bs: det.subtotalBs,
    }));

    const detallesCortesia = calculos.cortesiasProcesadas
      .filter((cort) => Boolean(cort.producto))
      .map((cort, idx) => ({
        id_detalle: -(idx + 1),
        id_producto: cort.producto!.id_producto,
        codigo_sku: cort.producto!.codigo_sku,
        nombre_producto: cort.producto!.nombre_producto,
        formato: cort.producto!.formato,
        kilos_estimados: 0,
        kilos_reales: cort.kilosEfectivos,
        precio_unitario_congelado: 0,
        es_cortesia: true,
        subtotal_bs: 0,
      }));

    return {
      id_pedido: pedido.id_pedido,
      nro_nota_venta: pedido.nro_nota_venta,
      estado: pedido.estado,
      es_pedido_cortesia_pura: pedido.es_pedido_cortesia_pura,
      fecha_preventa: pedido.fecha_preventa,
      fecha_despacho: null,
      observaciones: pedido.observaciones,
      cliente: {
        codigo_cliente_sac: pedido.cliente.codigo_cliente_sac,
        nombre_comercial: pedido.cliente.nombre_comercial,
        nit_ci: pedido.cliente.nit_ci,
        telefono: pedido.cliente.telefono,
      },
      zona: {
        nombre_zona: pedido.cliente.zona.nombre_zona,
        ciudad: pedido.cliente.zona.ciudad,
      },
      vendedor: {
        codigo_vendedor: pedido.vendedor.codigo_vendedor,
        nombre_completo: pedido.vendedor.nombre_completo,
      },
      despachador: {
        nombre_completo: perfilDespachador.nombre_operador,
        identificador_balanza: perfilDespachador.identificador_balanza,
      },
      detalles: [...detallesFacturados, ...detallesCortesia],
    };
  }, [calculos, pedido, perfilDespachador]);

  const ejecutarConfirmacionFinal = async () => {
    if (!calculos.formularioListo || enviando) return;
    setEnviando(true);
    setErrorBanner(null);

    try {
      const resultado = await confirmarDespachoAction({
        id_pedido: pedido.id_pedido,
        detalles_pesados: calculos.detallesProcesados.map((d) => ({
          id_detalle: d.id_detalle,
          kilos_reales: d.kilosEfectivos,
        })),
        cortesias: calculos.cortesiasProcesadas.map((c) => ({
          id_producto: c.id_producto,
          kilos_reales: c.kilosEfectivos,
        })),
      });

      if (!resultado.ok) {
        setModalConfirmacionAbierto(false);
        setErrorBanner(resultado.error);
        return;
      }

      setModalConfirmacionAbierto(false);
      router.push(`/despacho/imprimir/${pedido.id_pedido}?autoprint=1`);
      router.refresh();
    } catch {
      setModalConfirmacionAbierto(false);
      setErrorBanner(
        'Error inesperado de red al confirmar el despacho. Intente nuevamente.'
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-[1440px] min-w-0 space-y-5 pb-24 lg:pb-8 text-slate-900 antialiased selection:bg-[#FFCD00] selection:text-slate-950">
      {/* =====================================================================
          1. BARRA SUPERIOR DE ESTACIÓN INDUSTRIAL
         ===================================================================== */}
      <header className="relative overflow-hidden rounded-2xl border-2 border-[#9E0B22] border-b-4 border-b-[#FFCD00] bg-gradient-to-r from-[#85081C] via-[#C8102E] to-[#9E0B22] text-white shadow-lg">
        <CharcuteriePatternBg variant="card" idSuffix="pesaje-header" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          {/* Izquierda: Volver + Identidad */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href="/despacho"
              className="touch-manipulation flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl border border-white/25 bg-black/25 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-black/40"
            >
              <ArrowLeft className="h-5 w-5 text-[#FFCD00]" strokeWidth={2.2} />
              <span className="hidden sm:inline">← Volver a Bandeja</span>
            </Link>

            <EuroalimentosEmblem size="sm" />

            <div className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-extrabold uppercase tracking-widest text-[#FFCD00]">
                EUROALIMENTOS SRL • CÁMARA Y BALANZA
              </span>
              <h1 className="break-words text-base font-black tracking-tight text-white sm:text-xl">
                Estación de Pesaje en Gancho y Cortesías
              </h1>
            </div>
          </div>

          {/* Derecha: Telemetría CTI */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2.5 rounded-xl border border-white/20 bg-slate-950/35 px-3.5 py-2 backdrop-blur-sm xl:flex">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <Scale className="h-4 w-4 text-[#FFCD00]" strokeWidth={2.2} />
                <span className="font-mono text-xs font-bold tracking-tight text-white">
                  {perfilDespachador.identificador_balanza}
                </span>
              </div>
              <span className="text-white/30">•</span>
              <div className="flex items-center gap-1.5">
                <Printer className="h-4 w-4 text-[#FFCD00]" strokeWidth={2.2} />
                <span className="font-mono text-xs font-semibold text-slate-200">
                  {perfilDespachador.impresora_termica_modelo} (
                  {perfilDespachador.ancho_papel_mm}mm)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#FFCD00]/40 bg-black/25 px-3 py-2">
              <ShieldCheck
                className="h-4 w-4 shrink-0 text-[#FFCD00]"
                strokeWidth={2.2}
              />
              <div className="min-w-0 leading-tight">
                <p className="font-mono text-[10px] font-bold uppercase text-[#FFCD00]">
                  {perfilDespachador.rol}
                </p>
                <p className="truncate text-xs font-bold text-white">
                  {perfilDespachador.nombre_operador}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. CONTENIDO PRINCIPAL
         ===================================================================== */}
      <div className="w-full min-w-0 space-y-5">
        {errorBanner && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-2xl border-2 border-[#C8102E] bg-red-50 px-4 py-3 text-sm font-bold text-red-950 shadow-sm"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#C8102E]" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              aria-label="Cerrar alerta"
              className="rounded-lg p-1 text-red-700 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* TARJETA DE CABECERA DE ORDEN Y CLIENTE */}
        <section className="overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-sm">
          <PlantCardHeaderStrip />

          <div className="p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-3.5 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <Link
                  href="/despacho"
                  className="touch-manipulation inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-800 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
                  <span>Volver a Bandeja</span>
                </Link>

                <div className="flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-slate-900 px-3.5 py-1.5 text-white">
                  <Tag className="h-4 w-4 text-[#FFCD00]" strokeWidth={2.2} />
                  <span className="font-mono text-lg font-black tracking-tight tabular-nums sm:text-xl">
                    #PED-{pedido.id_pedido}
                  </span>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-amber-400 bg-[#FFCD00]/25 px-3 py-1.5 font-mono text-xs font-black uppercase tracking-wider text-amber-950">
                  <span className="h-2 w-2 rounded-full bg-amber-600" />
                  {pedido.estado} DE PESAJE
                </span>

                {pedido.es_pedido_cortesia_pura && (
                  <span className="rounded-lg bg-purple-700 px-3 py-1.5 font-mono text-xs font-black uppercase text-white">
                    PEDIDO CORTESÍA PURA
                  </span>
                )}

                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} />
                  <span>Preventa:</span>
                  <span className="font-mono font-bold tabular-nums text-slate-900">
                    {formatFechaPreventa(pedido.fecha_preventa)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-700 xl:hidden">
                  <Scale className="h-4 w-4 text-[#C8102E]" strokeWidth={2.2} />
                  <span className="font-bold">
                    {perfilDespachador.identificador_balanza}
                  </span>
                  <span>•</span>
                  <span>{perfilDespachador.ancho_papel_mm}mm</span>
                </div>

                <button
                  type="button"
                  onClick={() => setModalPreviewAbierto(true)}
                  className="touch-manipulation inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-slate-900 bg-white px-3.5 py-2 text-xs font-black text-slate-900 shadow-xs transition hover:bg-slate-900 hover:text-[#FFCD00] active:translate-y-[1px]"
                >
                  <Eye className="h-4 w-4" strokeWidth={2.2} />
                  <span>Vista Previa Ticket (58mm/80mm)</span>
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {/* Cliente */}
              <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    CLIENTE DESTINO
                  </span>
                  <span className="rounded bg-slate-200/80 px-2 py-0.5 font-mono text-xs font-extrabold text-slate-800">
                    {pedido.cliente.codigo_cliente_sac}
                  </span>
                </div>
                <p className="mt-1 break-words text-base font-black text-slate-900 sm:text-lg">
                  {pedido.cliente.nombre_comercial}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-600">
                  <span className="flex items-center gap-1">
                    <FileText
                      className="h-3.5 w-3.5 shrink-0 text-slate-400"
                      strokeWidth={2}
                    />
                    NIT/CI:{' '}
                    <strong className="font-mono text-slate-900">
                      {pedido.cliente.nit_ci || 'S/N'}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin
                      className="h-3.5 w-3.5 shrink-0 text-[#C8102E]"
                      strokeWidth={2}
                    />
                    {pedido.cliente.zona.nombre_zona}
                    {pedido.cliente.zona.ciudad
                      ? ` · ${pedido.cliente.zona.ciudad}`
                      : ''}
                  </span>
                </div>
              </div>

              {/* Vendedor */}
              <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  PREVENTISTA / VENDEDOR
                </span>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C8102E]/10 text-[#C8102E]">
                    <User className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {pedido.vendedor.nombre_completo}
                    </p>
                    <p className="font-mono text-xs font-semibold text-slate-500">
                      {pedido.vendedor.codigo_vendedor}
                    </p>
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <div className="min-w-0 rounded-xl border border-y border-r border-amber-200 border-l-4 border-l-[#FFCD00] bg-amber-50/80 p-3.5">
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-extrabold uppercase tracking-wider text-amber-900">
                  <Info className="h-3.5 w-3.5 shrink-0 text-amber-700" strokeWidth={2.2} />
                  OBSERVACIONES PREVENTA
                </div>
                {pedido.observaciones ? (
                  <p className="mt-1 break-words text-xs font-semibold leading-relaxed text-amber-950">
                    {pedido.observaciones}
                  </p>
                ) : (
                  <p className="mt-1 text-xs italic text-amber-800/70">
                    Sin observaciones especiales registradas.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* GRID OPERATIVO: ZONA IZQUIERDA (PESAJE + CORTESÍAS) | ZONA DERECHA (LIQUIDACIÓN) */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="min-w-0 space-y-5 xl:col-span-8">
            {/* BLOQUE A: PESAJE EN GANCHO — LÍNEAS SOLICITADAS (RF-07, CU-D02) */}
            <section className="overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-sm">
              <PlantCardHeaderStrip />

              <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C8102E] text-white shadow-sm">
                      <Scale className="h-5 w-5" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-words text-base font-black text-slate-900">
                          1. Pesaje en Gancho — Líneas Solicitadas
                        </h2>
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-black tabular-nums ${
                            calculos.lineasPesadasCount ===
                            calculos.totalLineasFacturadas
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-200 text-amber-950'
                          }`}
                        >
                          {calculos.lineasPesadasCount}/
                          {calculos.totalLineasFacturadas} PESADOS
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-500">
                        Ingrese peso real (3 decimales) y presione{' '}
                        <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[10px] font-bold">
                          Enter
                        </kbd>{' '}
                        para saltar a la siguiente línea.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopiarTodosEstimados}
                    className="touch-manipulation flex min-h-[46px] shrink-0 items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-3.5 py-2 text-xs font-black text-slate-800 shadow-sm transition hover:border-[#C8102E] hover:bg-red-50/40 hover:text-[#C8102E] active:translate-y-[1px]"
                  >
                    <CheckCheck
                      className="h-4 w-4 text-[#C8102E]"
                      strokeWidth={2.4}
                    />
                    <span>Copiar Todos los Estimados</span>
                  </button>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-gradient-to-r from-[#C8102E] to-emerald-500 transition-all duration-300"
                    style={{
                      width: `${
                        calculos.totalLineasFacturadas > 0
                          ? (calculos.lineasPesadasCount /
                              calculos.totalLineasFacturadas) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Lista Responsiva Unificada (sin tablas rígidas ni scroll horizontal) */}
              <div className="divide-y divide-slate-200">
                {calculos.detallesProcesados.map((item, idx) => {
                  const consumoTotalSku =
                    calculos.consumoPorProducto[item.id_producto] ?? 0;
                  const stockProducto =
                    productosCatalogo.find(
                      (p) => p.id_producto === item.id_producto
                    )?.stock_fisico_kilos ??
                    item.producto.stock_fisico_kilos;
                  const superaStock = consumoTotalSku > stockProducto;

                  return (
                    <div
                      key={item.id_detalle}
                      className={`flex flex-col justify-between gap-4 p-4 transition-colors sm:p-5 md:flex-row md:items-center ${
                        item.valido
                          ? 'bg-white hover:bg-slate-50/70'
                          : 'bg-amber-50/35'
                      }`}
                    >
                      {/* Bloque izquierdo: Identidad, Precio y Estimado */}
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-500">
                            {item.producto.codigo_sku}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider ${badgeFormatoClass(
                              item.producto.formato
                            )}`}
                          >
                            {item.producto.formato}
                          </span>
                          {item.es_cortesia && (
                            <span className="rounded bg-purple-100 px-2 py-0.5 font-mono text-[10px] font-black text-purple-900">
                              CORTESÍA
                            </span>
                          )}
                        </div>

                        <h3 className="break-words text-sm font-black leading-snug text-slate-900 sm:text-base">
                          {item.producto.nombre_producto}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-xs tabular-nums text-slate-600">
                          <span>
                            P.U.:{' '}
                            <strong className="text-slate-900">
                              {item.es_cortesia
                                ? '0.00 Bs'
                                : `Bs. ${formatBs(item.precio_unitario_congelado)}/kg`}
                            </strong>
                          </span>
                          <span>
                            Estimado:{' '}
                            <strong className="text-[#C8102E]">
                              {formatKg(item.kilos_estimados)} kg
                            </strong>
                          </span>
                          <span>
                            Cámara:{' '}
                            <strong className="text-slate-800">
                              {formatKg(stockProducto)} kg
                            </strong>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopiarEstimado(
                                item.id_detalle,
                                item.kilos_estimados
                              )
                            }
                            className="touch-manipulation inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border-2 border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-700 transition hover:border-[#C8102E] hover:bg-[#C8102E]/5 hover:text-[#C8102E]"
                            title="Copiar Estimado"
                          >
                            <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />
                            <span>
                              Copiar Est. ({formatKg(item.kilos_estimados)} kg)
                            </span>
                          </button>

                          {superaStock && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-bold text-[#C8102E]">
                              <AlertTriangle
                                className="h-3.5 w-3.5 shrink-0"
                                strokeWidth={2.2}
                              />
                              <span>
                                Excede stock ({formatKg(consumoTotalSku)} /{' '}
                                {formatKg(stockProducto)} kg)
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bloque derecho: Input Gancho + Botones de ajuste + Subtotal */}
                      <div className="w-full shrink-0 space-y-2.5 md:w-[320px] lg:w-[340px]">
                        <div className="flex items-center gap-2">
                          <div className="relative min-w-0 flex-1">
                            <input
                              ref={(el) => {
                                inputRefs.current[idx] = el;
                              }}
                              type="number"
                              inputMode="decimal"
                              step="0.001"
                              min="0"
                              placeholder="0.000"
                              aria-label={`Kilos reales para ${item.producto.nombre_producto}`}
                              value={item.rawStr}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                handleCambioPesoFacturado(
                                  item.id_detalle,
                                  e.target.value
                                )
                              }
                              onKeyDown={(e) => handleKeyDownEnter(e, idx)}
                              className={`min-h-[52px] w-full rounded-xl border-2 px-3 pr-9 text-right font-mono text-xl font-black tabular-nums shadow-inner transition focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/40 ${
                                item.valido
                                  ? 'border-emerald-500/70 bg-emerald-50/25 text-slate-950 focus:border-[#C8102E]'
                                  : 'border-amber-400 bg-amber-50/60 text-slate-900 focus:border-[#C8102E]'
                              }`}
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs font-extrabold text-slate-400">
                              kg
                            </span>
                          </div>

                          {item.rawStr !== '' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCambioPesoFacturado(item.id_detalle, '')
                              }
                              className="flex h-[52px] w-[46px] shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-[#C8102E]"
                              title="Limpiar peso"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}

                          <div className="min-w-[92px] shrink-0 text-right">
                            <span className="block font-mono text-[10px] font-bold uppercase text-slate-400">
                              Subtotal
                            </span>
                            <span
                              className={`font-mono text-base font-black tabular-nums ${
                                item.valido ? 'text-slate-900' : 'text-slate-400'
                              }`}
                            >
                              Bs. {formatBs(item.subtotalBs)}
                            </span>
                          </div>
                        </div>

                        {/* Botones rápidos de gramos con flex-wrap para evitar recorte en 360px-390px */}
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: '-100g', delta: -0.1, neg: true },
                            { label: '-50g', delta: -0.05, neg: true },
                            { label: '+50g', delta: 0.05, neg: false },
                            { label: '+100g', delta: 0.1, neg: false },
                            { label: '+500g', delta: 0.5, neg: false },
                          ].map((btn) => (
                            <button
                              key={btn.label}
                              type="button"
                              onClick={() =>
                                handleAjustarGramos(
                                  item.id_detalle,
                                  btn.delta,
                                  item.kilos_estimados
                                )
                              }
                              className={`min-h-[38px] flex-1 rounded-lg border px-2.5 py-2 font-mono text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                                btn.neg
                                  ? 'border-red-200 bg-red-50/80 text-[#C8102E] hover:bg-red-100'
                                  : 'border-emerald-300 bg-emerald-50/80 text-emerald-900 hover:bg-emerald-100'
                              }`}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center justify-end">
                          {item.valido ? (
                            <span
                              className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums ${
                                item.variacionKg === 0
                                  ? 'bg-slate-100 text-slate-600'
                                  : item.variacionKg > 0
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {item.variacionKg > 0
                                ? `+${formatKg(item.variacionKg)} kg vs est.`
                                : item.variacionKg < 0
                                  ? `${formatKg(item.variacionKg)} kg vs est.`
                                  : 'Exacto (0.000 kg)'}
                            </span>
                          ) : (
                            <span className="font-mono text-[11px] font-bold text-amber-700">
                              Pendiente pesar
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* BLOQUE B: CORTESÍAS Y DEGUSTACIONES SIN COSTO (RF-08 / CU-D03) */}
            <section className="overflow-hidden rounded-2xl border-2 border-amber-300/90 bg-gradient-to-b from-amber-50/70 to-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/90 bg-amber-100/60 px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-slate-950 shadow-sm">
                    <Gift className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-base font-black text-slate-900">
                        2. Bonificaciones / Cortesías sin Costo (0.00 Bs)
                      </h2>
                      <span className="shrink-0 rounded-md bg-emerald-700 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider text-white">
                        KARDEX FÍSICO ACTIVO
                      </span>
                    </div>
                    <p className="text-xs font-medium text-amber-950/80">
                      Degustación o bonificación comercial. Suma{' '}
                      <strong>0.00 Bs</strong> al cobro, pero{' '}
                      <strong>sí descuenta stock físico</strong> de cámara.
                    </p>
                  </div>
                </div>

                {perfilDespachador.autorizado_cortesias ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAgregarCortesia('0.400')}
                      className="touch-manipulation flex min-h-[46px] shrink-0 items-center gap-1.5 rounded-xl border-2 border-amber-500 bg-white px-3 py-2 font-mono text-xs font-black text-amber-950 shadow-sm transition hover:bg-amber-50 active:translate-y-[1px]"
                    >
                      <Plus
                        className="h-4 w-4 text-amber-600"
                        strokeWidth={2.5}
                      />
                      <span>+0.400 kg</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAgregarCortesia('')}
                      className="touch-manipulation flex min-h-[46px] shrink-0 items-center gap-2 rounded-xl border-2 border-amber-600 bg-[#FFCD00] px-4 py-2 text-sm font-black text-slate-950 shadow-sm transition hover:bg-amber-400 active:translate-y-[1px]"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.5} />
                      <span>+ Agregar Cortesía</span>
                    </button>
                  </div>
                ) : (
                  <span className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 font-mono text-xs font-bold text-slate-500">
                    SIN PERMISO DE CORTESÍAS
                  </span>
                )}
              </div>

              <div className="p-4 sm:p-5">
                {!perfilDespachador.autorizado_cortesias ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-600">
                    Este perfil de despachador no está habilitado para registrar
                    cortesías o degustaciones.
                  </div>
                ) : cortesias.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-300/80 bg-white/70 px-4 py-6 text-center">
                    <ClipboardList
                      className="h-6 w-6 text-amber-600"
                      strokeWidth={2.2}
                    />
                    <p className="mt-1.5 text-sm font-bold text-slate-700">
                      Sin cortesías o bonificaciones añadidas en este despacho
                    </p>
                    <p className="mt-0.5 max-w-md text-xs text-slate-500">
                      Si el cliente recibe muestra o yapa sin cargo, utilice{' '}
                      <strong>&ldquo;+ Agregar Cortesía&rdquo;</strong> e
                      ingrese el peso real en gancho.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {calculos.cortesiasProcesadas.map((cort, cIdx) => {
                      const inputRefIndex =
                        pedido.detalle_pedidos.length + cIdx;
                      const consumoTotalSku = cort.producto
                        ? (calculos.consumoPorProducto[
                            cort.producto.id_producto
                          ] ?? 0)
                        : 0;
                      const superaStock =
                        cort.producto &&
                        consumoTotalSku > cort.producto.stock_fisico_kilos;

                      return (
                        <div
                          key={cort.id_temp}
                          className="flex flex-col justify-between gap-3 rounded-xl border-2 border-amber-300 bg-white p-3.5 shadow-sm lg:flex-row lg:items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-900">
                                CORTESÍA • 0.00 Bs
                              </span>
                              {cort.producto && (
                                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-slate-600">
                                  {cort.producto.formato} • Stock:{' '}
                                  {formatKg(cort.producto.stock_fisico_kilos)} kg
                                </span>
                              )}
                            </div>

                            <select
                              aria-label="Seleccionar producto para cortesía"
                              value={cort.id_producto}
                              onChange={(e) =>
                                handleActualizarCortesiaProducto(
                                  cort.id_temp,
                                  Number(e.target.value)
                                )
                              }
                              className="min-h-[48px] w-full min-w-0 truncate rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3 text-sm font-bold text-slate-900 transition focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
                            >
                              {productosCortesiaElegibles.map((prod) => (
                                <option
                                  key={prod.id_producto}
                                  value={prod.id_producto}
                                >
                                  [{prod.codigo_sku}] {prod.nombre_producto} (
                                  {prod.formato})
                                </option>
                              ))}
                            </select>

                            {superaStock && (
                              <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[#C8102E]">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                Atención: El total combinado supera el stock
                                físico en cámara.
                              </p>
                            )}
                          </div>

                          <div className="flex items-end justify-end gap-3 shrink-0">
                            <div className="w-40 sm:w-44">
                              <label className="mb-1 block font-mono text-[10px] font-bold uppercase text-slate-500">
                                Peso Gancho (Kg)
                              </label>
                              <div className="relative">
                                <input
                                  ref={(el) => {
                                    inputRefs.current[inputRefIndex] = el;
                                  }}
                                  type="number"
                                  inputMode="decimal"
                                  step="0.001"
                                  min="0"
                                  placeholder="0.000"
                                  value={cort.kilos_reales}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) =>
                                    handleActualizarCortesiaKilos(
                                      cort.id_temp,
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    handleKeyDownEnter(e, inputRefIndex)
                                  }
                                  className="min-h-[48px] w-full rounded-xl border-2 border-amber-400 bg-amber-50/40 px-3 pr-9 text-right font-mono text-lg font-bold tabular-nums text-slate-950 focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/35"
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-500">
                                  kg
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleEliminarCortesia(cort.id_temp)
                              }
                              className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-[#C8102E]"
                              title="Quitar línea de cortesía"
                            >
                              <Trash2 className="h-5 w-5" strokeWidth={2.2} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ZONA DERECHA (4 COLS EN XL): PANEL DE LIQUIDACIÓN ATÓMICA (RF-09) */}
          <aside className="min-w-0 xl:sticky xl:top-6 xl:col-span-4">
            <div className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-md">
              <PlantCardHeaderStrip />

              <div className="border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt
                      className="h-5 w-5 text-[#FFCD00]"
                      strokeWidth={2.2}
                    />
                    <h2 className="text-base font-black tracking-tight">
                      Liquidación y Cierre de Nota
                    </h2>
                  </div>
                  <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#FFCD00]">
                    CU-D04
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  Verificación de pesos reales antes de descontar inventario y
                  emitir ticket.
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-600">
                      Kilos Facturados:
                    </span>
                    <span className="font-mono text-base font-extrabold tabular-nums text-slate-900">
                      {formatKg(calculos.totalKilosFacturados)} kg
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-amber-800">
                      <Gift className="h-4 w-4 text-amber-600" strokeWidth={2} />
                      Kilos Cortesía:
                    </span>
                    <span className="font-mono text-base font-extrabold tabular-nums text-amber-800">
                      {formatKg(calculos.totalKilosCortesia)} kg
                    </span>
                  </div>

                  <div className="border-t border-dashed border-slate-300 pt-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-xs font-black uppercase tracking-wide text-slate-800">
                          Total Físico a Descontar
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Salida real de cámara frigorífica
                        </span>
                      </div>
                      <span className="rounded-lg bg-[#FFCD00]/35 px-2.5 py-1 font-mono text-base font-black tabular-nums text-slate-950">
                        {formatKg(calculos.totalKilosFisicos)} kg
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-[#C8102E]/25 bg-gradient-to-br from-red-50/80 via-white to-amber-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold uppercase tracking-wider text-slate-600">
                      TOTAL A COBRAR (BS.)
                    </span>
                    <span className="rounded bg-[#C8102E] px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                      NOTA DE VENTA
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-mono text-lg font-extrabold text-slate-500">
                      Bs.
                    </span>
                    <span className="font-mono text-3xl font-black tracking-tight tabular-nums text-[#C8102E] sm:text-4xl">
                      {formatBs(calculos.totalCobrarBs)}
                    </span>
                  </div>
                </div>

                {!calculos.formularioListo && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-950">
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                      strokeWidth={2.2}
                    />
                    <span>
                      Complete todos los pesos reales en gancho (mayores a{' '}
                      <strong>0.000 kg</strong>) para confirmar el despacho.
                    </span>
                  </div>
                )}

                {calculos.hayExcesoStock && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-[#C8102E]">
                    <Layers className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
                    <span>
                      Uno o más productos superan el stock físico registrado.
                      Verifique existencia física en cámara antes de confirmar.
                    </span>
                  </div>
                )}

                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setModalPreviewAbierto(true)}
                    className="touch-manipulation flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-white px-4 py-2.5 text-sm font-black text-slate-900 shadow-xs transition hover:bg-slate-900 hover:text-[#FFCD00] active:translate-y-[1px]"
                  >
                    <Eye className="h-4 w-4" strokeWidth={2.2} />
                    <span>Vista Previa Ticket (58mm/80mm)</span>
                  </button>

                  <button
                    type="button"
                    disabled={!calculos.formularioListo || enviando}
                    onClick={() => setModalConfirmacionAbierto(true)}
                    className="touch-manipulation flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-4 py-3 text-sm font-black uppercase tracking-wide text-white shadow-md transition hover:brightness-105 active:translate-y-[2px] active:border-b-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:from-slate-300 disabled:to-slate-400 disabled:text-slate-600 disabled:shadow-none"
                  >
                    <CheckCircle2
                      className="h-5 w-5 text-[#FFCD00]"
                      strokeWidth={2.4}
                    />
                    <span>
                      {enviando
                        ? 'Procesando Despacho...'
                        : 'CONFIRMAR DESPACHO Y GENERAR NOTA'}
                    </span>
                  </button>

                  <Link
                    href="/despacho"
                    className="touch-manipulation flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
                    <span>← Volver a Bandeja</span>
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* MODAL DE VISTA PREVIA DEL TICKET TÉRMICO EN TIEMPO REAL */}
      {modalPreviewAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs print:static print:overflow-visible print:bg-transparent print:p-0 print:backdrop-blur-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-preview-ticket-titulo"
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-2xl print:max-h-none print:overflow-visible print:border-0 print:bg-transparent print:shadow-none">
            <div className="no-print">
              <PlantCardHeaderStrip />
            </div>

            {/* Cabecera del Modal */}
            <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C8102E] text-[#FFCD00]">
                  <Printer className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      id="modal-preview-ticket-titulo"
                      className="truncate text-sm font-black sm:text-base"
                    >
                      Vista Previa Ticket Térmico
                    </h3>
                    {pedido.estado === 'PENDIENTE' && (
                      <span className="rounded bg-[#FFCD00] px-2 py-0.5 font-mono text-[10px] font-black uppercase text-slate-950">
                        [BORRADOR / VISTA PREVIA]
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-slate-300">
                    #PED-{pedido.id_pedido} •{' '}
                    {formatKg(calculos.totalKilosFisicos)} kg físicos • Bs.{' '}
                    {formatBs(calculos.totalCobrarBs)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-xl border border-white/20 bg-slate-800 p-1">
                  {([58, 80] as AnchoPapelTermico[]).map((mm) => {
                    const activo = anchoPreviewMm === mm;
                    return (
                      <button
                        key={mm}
                        type="button"
                        onClick={() => setAnchoPreviewMm(mm)}
                        className={`touch-manipulation min-h-[36px] rounded-lg px-3 py-1 font-mono text-xs font-black transition ${
                          activo
                            ? 'bg-[#FFCD00] text-slate-950 shadow-xs'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {mm}mm
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setModalPreviewAbierto(false)}
                  aria-label="Cerrar vista previa del ticket"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Cuerpo Scrolleable con el Ticket Térmico en Vivo */}
            <div className="flex-1 overflow-y-auto bg-slate-100 p-3 sm:p-5 print:overflow-visible print:bg-transparent print:p-0">
              <TicketTermicoEpson
                key={anchoPreviewMm}
                pedido={pedidoVistaPrevia}
                anchoPapelMm={anchoPreviewMm}
                autoPrint={false}
                esVistaPrevia={pedido.estado === 'PENDIENTE'}
                soloTicket={true}
              />
            </div>

            {/* Pie del Modal */}
            <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              <p className="text-xs font-medium text-slate-500">
                Esta vista previa no descuenta inventario ni cierra el pedido.
              </p>
              <button
                type="button"
                onClick={() => setModalPreviewAbierto(false)}
                className="touch-manipulation min-h-[44px] rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
              >
                Cerrar Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN ATÓMICA */}
      {modalConfirmacionAbierto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-confirmacion-despacho-titulo"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-2xl">
            <PlantCardHeaderStrip />

            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#C8102E]/10 text-[#C8102E]">
                  <PackageCheck className="h-7 w-7" strokeWidth={2.2} />
                </div>
                <div>
                  <span className="font-mono text-xs font-extrabold uppercase tracking-wider text-[#C8102E]">
                    TRANSACCIÓN ATÓMICA DE DESPACHO
                  </span>
                  <h3
                    id="modal-confirmacion-despacho-titulo"
                    className="text-lg font-black text-slate-900"
                  >
                    ¿Confirmar Pesaje y Emitir Nota de Venta?
                  </h3>
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-600">
                Esta acción cerrará el pedido{' '}
                <strong>#PED-{pedido.id_pedido}</strong> para{' '}
                <strong>{pedido.cliente.nombre_comercial}</strong>, descontará
                el inventario físico en Kardex y abrirá el ticket de{' '}
                <span className="font-mono text-xs font-bold text-slate-800">
                  {perfilDespachador.impresora_termica_modelo} (
                  {perfilDespachador.ancho_papel_mm}mm)
                </span>
                .
              </p>

              <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Kilos Facturados:</span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {formatKg(calculos.totalKilosFacturados)} kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-800">
                    Kilos Cortesía (0.00 Bs):
                  </span>
                  <span className="font-bold tabular-nums text-amber-800">
                    {formatKg(calculos.totalKilosCortesia)} kg
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-bold text-slate-800">
                    Total Salida Cámara:
                  </span>
                  <span className="font-black tabular-nums text-slate-950">
                    {formatKg(calculos.totalKilosFisicos)} kg
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
                  <span className="font-black text-slate-900">
                    TOTAL A COBRAR:
                  </span>
                  <span className="font-black tabular-nums text-[#C8102E]">
                    Bs. {formatBs(calculos.totalCobrarBs)}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => setModalConfirmacionAbierto(false)}
                  className="min-h-[48px] rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Revisar Pesos
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={ejecutarConfirmacionFinal}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-5 py-2.5 text-sm font-black text-white shadow transition active:translate-y-[2px] disabled:opacity-60"
                >
                  <Printer
                    className="h-4 w-4 text-[#FFCD00]"
                    strokeWidth={2.2}
                  />
                  <span>
                    {enviando
                      ? 'Procesando Kardex...'
                      : 'Sí, Confirmar e Imprimir'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstacionPesajeClient;

