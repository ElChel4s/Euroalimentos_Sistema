'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Copy,
  CopyPlus,
  CreditCard,
  FileText,
  History,
  MapPin,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import type {
  EstadoPedidoEnum,
  FormatoProductoEnum,
  TipoVenta,
  UnidadMedidaEnum,
} from '@/types/database.types';

export interface DetallePedidoVendedorItem {
  id_detalle: number;
  kilos_estimados: number;
  kilos_reales: number | null;
  es_cortesia: boolean;
  precio_unitario_congelado: number;
  subtotal_bs: number;
  productos: {
    id_producto: number;
    codigo_sku: string;
    nombre_producto: string;
    formato: FormatoProductoEnum;
    unidad_medida?: UnidadMedidaEnum | (string & {});
    peso_unidad_kilos?: number;
  } | null;
}

export interface PedidoVendedorItem {
  id_pedido: number;
  nro_nota_venta: string | null;
  nro_documento_sac?: number | null;
  estado: EstadoPedidoEnum;
  tipo_venta?: TipoVenta;
  plazo_dias?: number;
  es_pedido_cortesia_pura: boolean;
  observaciones: string | null;
  fecha_preventa: string;
  fecha_despacho: string | null;
  fecha_jornada: string;
  cliente: {
    id_cliente: number;
    codigo_cliente_sac: string;
    nombre_comercial: string;
    zona: string;
  };
  detalle_pedidos: DetallePedidoVendedorItem[];
}

export interface MisPedidosListProps {
  pedidos: PedidoVendedorItem[];
  metaDiariaKilos: number;
  codigoVendedor: string;
  nombreVendedor?: string;
  fechaHoy?: string;
}

const CharcuteriePatternBg: React.FC<{ variant?: 'crimson' | 'light' }> = ({
  variant = 'crimson',
}) => {
  const strokeColor = variant === 'crimson' ? '#FFFFFF' : '#0F172A';
  const opacityClass =
    variant === 'crimson' ? 'opacity-[0.09]' : 'opacity-[0.05]';

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${opacityClass}`}
      aria-hidden="true"
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={`mis-pedidos-pattern-${variant}`}
            width="120"
            height="120"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M15 28 C 22 14, 42 14, 48 28 C 54 42, 74 42, 82 28"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <ellipse
              cx="31"
              cy="21"
              rx="11"
              ry="5"
              transform="rotate(-12 31 21)"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <ellipse
              cx="65"
              cy="35"
              rx="11"
              ry="5"
              transform="rotate(-12 65 35)"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <circle
              cx="96"
              cy="82"
              r="14"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <circle cx="91" cy="78" r="1.8" fill={strokeColor} />
            <circle cx="101" cy="80" r="1.5" fill={strokeColor} />
            <circle cx="95" cy="88" r="2" fill={strokeColor} />
            <path
              d="M24 76 L44 76 L48 98 L20 98 Z"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle
              cx="34"
              cy="72"
              r="3.5"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#mis-pedidos-pattern-${variant})`}
        />
      </svg>
    </div>
  );
};

const EuroalimentosEmblem: React.FC = () => (
  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[#FFCD00] bg-gradient-to-b from-[#C8102E] to-[#85081C] shadow-md">
    <div className="absolute inset-1 rounded-lg border border-dashed border-[#FFCD00]/70" />
    <svg
      viewBox="0 0 24 24"
      className="absolute top-1.5 h-2.5 w-2.5 text-[#FFCD00]"
      fill="currentColor"
    >
      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
    </svg>
    <span className="mt-1 text-base font-black leading-none tracking-tighter text-white">
      EA
    </span>
    <span className="absolute -bottom-1.5 rounded bg-[#FFCD00] px-1.5 py-[1px] text-[8px] font-black uppercase tracking-wider text-slate-950 shadow-2xs">
      SRL
    </span>
  </div>
);

const ChorizoCortesiaIcon: React.FC<{ className?: string }> = ({
  className = 'h-3.5 w-3.5',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2v3" />
    <path d="M9.5 4.5L14.5 5.5" />
    <rect x="7.5" y="5.5" width="9" height="6.5" rx="3.25" />
    <path d="M9 12h6" />
    <rect x="7.5" y="12" width="9" height="6.5" rx="3.25" />
    <path d="M12 18.5v3" />
  </svg>
);

function formatBs(amount: number): string {
  return amount.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatKg(kg: number, decimals = 2): string {
  return kg.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getUnidadesInfo(
  item: DetallePedidoVendedorItem,
  kilos: number
): { esUnidad: boolean; unidadesLabel: string | null } {
  const esUnidad =
    String(item.productos?.unidad_medida ?? 'KILO').toUpperCase() === 'UNIDAD';
  const pesoUnidad = Number(item.productos?.peso_unidad_kilos ?? 1);
  if (!esUnidad || !Number.isFinite(pesoUnidad) || pesoUnidad <= 0) {
    return { esUnidad: false, unidadesLabel: null };
  }
  const unidades = Number((kilos / pesoUnidad).toFixed(2));
  const unidadesStr = Number.isInteger(unidades)
    ? String(unidades)
    : unidades.toFixed(1);
  return { esUnidad: true, unidadesLabel: `${unidadesStr} unid.` };
}

function formatHora(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleTimeString('es-BO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/La_Paz',
    });
  } catch {
    return '--:--';
  }
}

function formatFechaLarga(ymd: string): string {
  try {
    const [y, m, d] = ymd.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-BO', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return ymd;
  }
}

function obtenerFechaAyer(fechaHoy: string): string {
  const [y, m, d] = fechaHoy.split('-').map(Number);
  const fecha = new Date(y, m - 1, d - 1);
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function calcularTotalesPedido(pedido: PedidoVendedorItem) {
  let kgEstimados = 0;
  let kgRealesVenta = 0;
  let kgRealesCortesia = 0;
  let totalBs = 0;
  let tieneCortesia = pedido.es_pedido_cortesia_pura;

  for (const item of pedido.detalle_pedidos) {
    kgEstimados += Number(item.kilos_estimados ?? 0);
    if (item.es_cortesia) {
      tieneCortesia = true;
      if (item.kilos_reales !== null) {
        kgRealesCortesia += Number(item.kilos_reales);
      }
    } else {
      if (item.kilos_reales !== null) {
        kgRealesVenta += Number(item.kilos_reales);
      }
      totalBs += Number(item.subtotal_bs ?? 0);
    }
  }

  return {
    kgEstimados,
    kgRealesVenta,
    kgRealesCortesia,
    kgRealesTotal: kgRealesVenta + kgRealesCortesia,
    totalBs,
    tieneCortesia,
  };
}

export const MisPedidosList: React.FC<MisPedidosListProps> = ({
  pedidos,
  metaDiariaKilos,
  codigoVendedor,
  nombreVendedor = 'Vendedor Activo',
  fechaHoy: fechaHoyProp,
}) => {
  const router = useRouter();
  const fechaHoy = fechaHoyProp ?? '2026-11-13';

  const tienePedidosHoy = useMemo(
    () => pedidos.some((p) => p.fecha_jornada === fechaHoy),
    [pedidos, fechaHoy]
  );

  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(() =>
    tienePedidosHoy ? fechaHoy : pedidos.length > 0 ? 'TODAS' : fechaHoy
  );
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | EstadoPedidoEnum>(
    'TODOS'
  );
  const [busqueda, setBusqueda] = useState<string>('');
  const [resumenExpandido, setResumenExpandido] = useState<boolean>(false);
  const [expandedPedidos, setExpandedPedidos] = useState<
    Record<number, boolean>
  >({});
  const [pedidoDetalleActivo, setPedidoDetalleActivo] =
    useState<PedidoVendedorItem | null>(null);

  const [sincronizando, setSincronizando] = useState<boolean>(false);
  const [copiadoId, setCopiadoId] = useState<number | null>(null);
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);

  const fechaAyer = useMemo(() => obtenerFechaAyer(fechaHoy), [fechaHoy]);
  const esJornadaHoy = fechaSeleccionada === fechaHoy;
  const esJornadaAyer = fechaSeleccionada === fechaAyer;
  const esTodasJornadas = fechaSeleccionada === 'TODAS';
  const esFechaPersonalizada =
    !esJornadaHoy && !esJornadaAyer && !esTodasJornadas;

  const mostrarNotificacion = (msg: string) => {
    setToastMensaje(msg);
    setTimeout(() => setToastMensaje(null), 3200);
  };

  // 1) Filtrar por jornada seleccionada
  const pedidosDeLaJornada = useMemo(() => {
    if (fechaSeleccionada === 'TODAS') return pedidos;
    return pedidos.filter((p) => p.fecha_jornada === fechaSeleccionada);
  }, [pedidos, fechaSeleccionada]);

  // 2) KPIs de jornada
  const kpis = useMemo(() => {
    const activos = pedidosDeLaJornada.filter((p) => p.estado !== 'ANULADO');
    const totalPedidosJornada = pedidosDeLaJornada.length;

    let kilosSolicitados = 0;
    let kilosRealesDespachados = 0;
    let kilosCortesiaDespachados = 0;
    let montoTotalBs = 0;

    for (const pedido of activos) {
      for (const item of pedido.detalle_pedidos) {
        kilosSolicitados += Number(item.kilos_estimados ?? 0);
        if (pedido.estado === 'DESPACHADO' && item.kilos_reales !== null) {
          if (item.es_cortesia) {
            kilosCortesiaDespachados += Number(item.kilos_reales);
          } else {
            kilosRealesDespachados += Number(item.kilos_reales);
          }
        }
        if (!item.es_cortesia) {
          montoTotalBs += Number(item.subtotal_bs ?? 0);
        }
      }
    }

    const kilosComputablesMeta = activos.reduce((acc, pedido) => {
      const kgPedido = pedido.detalle_pedidos.reduce((sum, item) => {
        if (item.es_cortesia) return sum;
        if (pedido.estado === 'DESPACHADO' && item.kilos_reales !== null) {
          return sum + Number(item.kilos_reales);
        }
        return sum + Number(item.kilos_estimados ?? 0);
      }, 0);
      return acc + kgPedido;
    }, 0);

    const metaRef = Math.max(1, metaDiariaKilos || 150);
    const porcentajeMeta = Math.min(
      100,
      Math.round((kilosComputablesMeta / metaRef) * 100)
    );

    return {
      totalPedidosJornada,
      conteoPendientes: pedidosDeLaJornada.filter(
        (p) => p.estado === 'PENDIENTE'
      ).length,
      conteoDespachados: pedidosDeLaJornada.filter(
        (p) => p.estado === 'DESPACHADO'
      ).length,
      conteoAnulados: pedidosDeLaJornada.filter((p) => p.estado === 'ANULADO')
        .length,
      kilosSolicitados,
      kilosRealesDespachados,
      kilosCortesiaDespachados,
      kilosComputablesMeta,
      montoTotalBs,
      porcentajeMeta,
    };
  }, [pedidosDeLaJornada, metaDiariaKilos]);

  // 3) Filtrar por estado y término de búsqueda
  const pedidosFiltrados = useMemo(() => {
    return pedidosDeLaJornada.filter((pedido) => {
      const coincideEstado =
        filtroEstado === 'TODOS' ? true : pedido.estado === filtroEstado;

      const termino = busqueda.trim().toLowerCase();
      if (!termino) return coincideEstado;

      const coincideCliente = pedido.cliente.nombre_comercial
        .toLowerCase()
        .includes(termino);
      const coincideSac = pedido.cliente.codigo_cliente_sac
        .toLowerCase()
        .includes(termino);
      const coincideZona = pedido.cliente.zona.toLowerCase().includes(termino);
      const coincidePedido =
        String(pedido.id_pedido).includes(termino) ||
        `#ped-${String(pedido.id_pedido).padStart(3, '0')}`.includes(termino);
      const coincideNota = pedido.nro_nota_venta
        ? pedido.nro_nota_venta.toLowerCase().includes(termino)
        : false;
      const coincideDocSac = pedido.nro_documento_sac
        ? String(pedido.nro_documento_sac).includes(termino)
        : false;

      return (
        coincideEstado &&
        (coincideCliente ||
          coincideSac ||
          coincideZona ||
          coincidePedido ||
          coincideNota ||
          coincideDocSac)
      );
    });
  }, [pedidosDeLaJornada, filtroEstado, busqueda]);

  const toggleAcordeon = (idPedido: number) => {
    setExpandedPedidos((prev) => ({
      ...prev,
      [idPedido]: !prev[idPedido],
    }));
  };

  const generarTextoResumen = (pedido: PedidoVendedorItem): string => {
    const { kgEstimados, kgRealesVenta, totalBs } =
      calcularTotalesPedido(pedido);
    const lineas = pedido.detalle_pedidos
      .map((item) => {
        const nombreProd =
          item.productos?.nombre_producto ?? 'Producto sin nombre';
        const kgRef =
          pedido.estado === 'DESPACHADO' && item.kilos_reales !== null
            ? item.kilos_reales
            : item.kilos_estimados;
        const { unidadesLabel } = getUnidadesInfo(item, kgRef);
        const pesoBase =
          pedido.estado === 'DESPACHADO' && item.kilos_reales !== null
            ? `${formatKg(item.kilos_reales, 3)} kg`
            : `${formatKg(item.kilos_estimados, 2)} kg est.`;
        const peso = unidadesLabel ? `${unidadesLabel} · ${pesoBase}` : pesoBase;
        const tag = item.es_cortesia
          ? ' [Cortesía (0.00 Bs)]'
          : ` - Bs. ${formatBs(item.subtotal_bs)}`;
        return `• ${nombreProd} (${peso})${tag}`;
      })
      .join('\n');

    const notaTexto =
      pedido.estado === 'DESPACHADO' &&
      (pedido.nro_documento_sac || pedido.nro_nota_venta)
        ? `Nota N° ${pedido.nro_documento_sac ?? pedido.nro_nota_venta}`
        : `Preventa #PED-${String(pedido.id_pedido).padStart(3, '0')}`;

    const pagoTexto =
      pedido.tipo_venta === 'CREDITO'
        ? `CRÉDITO (${pedido.plazo_dias ?? 0}d)`
        : 'CONTADO';

    return [
      `*EUROALIMENTOS SRL* — ${notaTexto}`,
      `Cliente: ${pedido.cliente.nombre_comercial} (${pedido.cliente.codigo_cliente_sac})`,
      `Fecha: ${pedido.fecha_jornada} | Pago: ${pagoTexto} | Estado: ${pedido.estado}`,
      `-------------------------`,
      lineas,
      `-------------------------`,
      pedido.estado === 'DESPACHADO'
        ? `Peso Balanza: ${formatKg(kgRealesVenta, 3)} kg | Total: Bs. ${formatBs(totalBs)}`
        : `Peso Estimado: ${formatKg(kgEstimados, 2)} kg | Estimado: Bs. ${formatBs(totalBs)}`,
    ].join('\n');
  };

  const handleCompartirPedido = async (
    e: React.MouseEvent,
    pedido: PedidoVendedorItem
  ) => {
    e.stopPropagation();
    const texto = generarTextoResumen(pedido);

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Pedido #${pedido.id_pedido} - EUROALIMENTOS SRL`,
          text: texto,
        });
        return;
      } catch {
        // Fallback al portapapeles
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(texto);
        setCopiadoId(pedido.id_pedido);
        mostrarNotificacion(
          `Resumen de #${pedido.id_pedido} copiado para WhatsApp`
        );
        setTimeout(() => setCopiadoId(null), 2500);
      } catch {
        mostrarNotificacion('No se pudo copiar el comprobante');
      }
    }
  };

  const handleSincronizar = () => {
    setSincronizando(true);
    router.refresh();
    setTimeout(() => {
      setSincronizando(false);
      mostrarNotificacion('Estados actualizados desde planta');
    }, 550);
  };

  const handleSeleccionarFecha = (nuevaFecha: string) => {
    setFechaSeleccionada(nuevaFecha);
    setFiltroEstado('TODOS');
  };

  return (
    <div className="relative w-full space-y-4 text-slate-900 md:space-y-5">
      {/* ====================================================================
          1. CABECERA COMPACTA SOBRE BLANCO + SELECTOR LIMPIO DE JORNADAS
         ==================================================================== */}
      <header className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-base font-black tracking-tight text-slate-900 sm:text-lg">
              Mis Pedidos
            </h1>
            <span className="shrink-0 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
              {codigoVendedor}
            </span>
            <span className="hidden truncate text-xs font-medium text-slate-500 sm:inline">
              • {nombreVendedor}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSincronizar}
            disabled={sincronizando}
            aria-label="Actualizar estados de planta"
            className="touch-manipulation inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-200 active:scale-95"
          >
            <RefreshCw
              className={`h-4 w-4 text-slate-700 ${
                sincronizando ? 'animate-spin' : ''
              }`}
              strokeWidth={2.2}
            />
            <span className="hidden sm:inline">
              {sincronizando ? 'Actualizando...' : 'Actualizar'}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'TODAS', label: 'Todas' },
            { id: fechaHoy, label: 'Hoy' },
            { id: fechaAyer, label: 'Ayer' },
          ].map((pill) => {
            const activo = fechaSeleccionada === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => handleSeleccionarFecha(pill.id)}
                className={`touch-manipulation min-h-[40px] rounded-xl px-3.5 text-xs font-extrabold transition ${
                  activo
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {pill.label}
              </button>
            );
          })}

          <label
            className={`touch-manipulation relative inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-3.5 text-xs font-extrabold transition ${
              esFechaPersonalizada
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            <span className="tabular-nums">
              {esFechaPersonalizada ? fechaSeleccionada : 'Calendario'}
            </span>
            <input
              type="date"
              value={esFechaPersonalizada ? fechaSeleccionada : fechaHoy}
              max={fechaHoy}
              onChange={(e) => {
                if (e.target.value) handleSeleccionarFecha(e.target.value);
              }}
              aria-label="Seleccionar fecha en calendario"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </header>

      {/* Banner de consulta histórica si aplica */}
      {!esJornadaHoy && !esTodasJornadas && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFCD00] text-slate-950">
              <History className="h-5 w-5" strokeWidth={2.4} />
            </div>
            <div>
              <span className="block font-mono text-[10px] font-black uppercase tracking-wider text-amber-800">
                MODO CONSULTA HISTÓRICA
              </span>
              <p className="text-sm font-extrabold capitalize text-slate-900">
                {formatFechaLarga(fechaSeleccionada)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSeleccionarFecha(fechaHoy)}
            className="touch-manipulation min-h-[48px] rounded-xl border-b-2 border-red-950 bg-[#C8102E] px-4 py-2 text-xs font-extrabold text-white shadow-xs transition-all active:translate-y-[1px]"
          >
            Ir a Ventas de Hoy
          </button>
        </div>
      )}

      {/* ====================================================================
          2. KPIs DE JORNADA + BARRA DE PROGRESO CONTRA META DIARIA
         ==================================================================== */}
      <section
        aria-label="Resumen de jornada"
        className="overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-sm"
      >
        <div className="flex h-1.5 w-full">
          <div className="w-2/3 bg-[#C8102E]" />
          <div className="w-1/3 bg-[#FFCD00]" />
        </div>

        <button
          type="button"
          onClick={() => setResumenExpandido((prev) => !prev)}
          aria-expanded={resumenExpandido}
          className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/80 md:cursor-default md:hover:bg-white"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {esJornadaHoy
                  ? 'Venta Jornada Hoy'
                  : esTodasJornadas
                    ? 'Total Acumulado'
                    : `Venta del ${fechaSeleccionada}`}
              </span>
              <span className="font-mono text-lg font-black tabular-nums text-[#C8102E] sm:text-xl">
                Bs. {formatBs(kpis.montoTotalBs)}
              </span>
            </div>

            <div className="h-7 w-px bg-slate-200" />

            <div>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Meta Kilos ({kpis.porcentajeMeta}%)
              </span>
              <span className="font-mono text-sm font-extrabold tabular-nums text-slate-900 sm:text-base">
                {formatKg(kpis.kilosComputablesMeta, 1)}{' '}
                <span className="text-xs font-semibold text-slate-500">
                  / {formatKg(metaDiariaKilos, 0)} Kg
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-extrabold text-slate-700">
              {resumenExpandido ? 'Ocultar' : 'KPIs'}
            </span>
            {resumenExpandido ? (
              <ChevronUp className="h-5 w-5 text-slate-600" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-600" />
            )}
          </div>
        </button>

        <div className="h-2 w-full bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-[#C8102E] to-[#FFCD00] transition-all duration-500"
            style={{ width: `${kpis.porcentajeMeta}%` }}
          />
        </div>

        <div
          className={`${
            resumenExpandido ? 'block' : 'hidden'
          } border-t border-slate-100 p-4 md:block md:p-5`}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Pedidos Jornada
                </p>
                <p className="mt-0.5 font-mono text-2xl font-black tabular-nums text-slate-900">
                  {kpis.totalPedidosJornada}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                  <span className="font-bold text-emerald-700">
                    {kpis.conteoDespachados} desp.
                  </span>{' '}
                  •{' '}
                  <span className="font-bold text-amber-700">
                    {kpis.conteoPendientes} pend.
                  </span>
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#C8102E] shadow-2xs">
                <ClipboardList className="h-6 w-6" strokeWidth={2.2} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Kilos (Balanza / Est.)
                </p>
                <div className="mt-0.5 flex items-baseline gap-1.5 font-mono tabular-nums">
                  <span className="text-xl font-black text-slate-900">
                    {formatKg(kpis.kilosRealesDespachados, 3)}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    / {formatKg(kpis.kilosSolicitados, 1)} Kg
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">
                  {kpis.kilosCortesiaDespachados > 0
                    ? `+ ${formatKg(kpis.kilosCortesiaDespachados, 3)} kg cortesía`
                    : 'Pesado real verificado en planta'}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FFCD00] bg-[#FFCD00]/25 text-slate-900 shadow-2xs">
                <Scale className="h-6 w-6" strokeWidth={2.2} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Total Jornada (Bs.)
                </p>
                <p className="mt-0.5 font-mono text-2xl font-black tabular-nums text-[#C8102E]">
                  Bs. {formatBs(kpis.montoTotalBs)}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                  Facturado + Preventa activa
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#C8102E] text-white shadow-2xs">
                <TrendingUp className="h-6 w-6" strokeWidth={2.2} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          3. BUSCADOR Y PESTAÑAS TÁCTILES DE ESTADO
         ==================================================================== */}
      <section aria-label="Filtros y búsqueda" className="space-y-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-500"
            strokeWidth={2.2}
          />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente, código SAC (CLI-001) o Nº Nota..."
            className="min-h-[50px] w-full rounded-xl border-2 border-slate-200 bg-white pr-11 pl-11 text-base font-medium text-slate-900 shadow-inner transition-all placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              aria-label="Limpiar búsqueda"
              className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Filtrar pedidos por estado"
          className="flex items-center gap-2 overflow-x-auto pb-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filtroEstado === 'TODOS'}
            onClick={() => setFiltroEstado('TODOS')}
            className={`touch-manipulation flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition-all ${
              filtroEstado === 'TODOS'
                ? 'border-[#C8102E] bg-[#C8102E] text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <span>Todos</span>
            <span
              className={`rounded-md px-2 py-0.5 font-mono text-xs tabular-nums ${
                filtroEstado === 'TODOS'
                  ? 'bg-black/25 text-[#FFCD00]'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {kpis.totalPedidosJornada}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filtroEstado === 'PENDIENTE'}
            onClick={() => setFiltroEstado('PENDIENTE')}
            className={`touch-manipulation flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition-all ${
              filtroEstado === 'PENDIENTE'
                ? 'border-amber-500 bg-[#FFCD00] text-slate-950 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300'
            }`}
          >
            <Clock className="h-4 w-4 text-amber-700" strokeWidth={2.3} />
            <span>PENDIENTE</span>
            <span className="rounded-md bg-amber-950/10 px-2 py-0.5 font-mono text-xs font-black tabular-nums text-amber-950">
              {kpis.conteoPendientes}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filtroEstado === 'DESPACHADO'}
            onClick={() => setFiltroEstado('DESPACHADO')}
            className={`touch-manipulation flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition-all ${
              filtroEstado === 'DESPACHADO'
                ? 'border-emerald-700 bg-emerald-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
            }`}
          >
            <CheckCircle2
              className={`h-4 w-4 ${
                filtroEstado === 'DESPACHADO'
                  ? 'text-white'
                  : 'text-emerald-600'
              }`}
              strokeWidth={2.3}
            />
            <span>DESPACHADO</span>
            <span
              className={`rounded-md px-2 py-0.5 font-mono text-xs tabular-nums ${
                filtroEstado === 'DESPACHADO'
                  ? 'bg-black/20 text-white'
                  : 'bg-emerald-50 text-emerald-800'
              }`}
            >
              {kpis.conteoDespachados}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filtroEstado === 'ANULADO'}
            onClick={() => setFiltroEstado('ANULADO')}
            className={`touch-manipulation flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition-all ${
              filtroEstado === 'ANULADO'
                ? 'border-red-800 bg-red-700 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-red-300'
            }`}
          >
            <XCircle
              className={`h-4 w-4 ${
                filtroEstado === 'ANULADO' ? 'text-white' : 'text-red-600'
              }`}
              strokeWidth={2.3}
            />
            <span>ANULADO</span>
            <span
              className={`rounded-md px-2 py-0.5 font-mono text-xs tabular-nums ${
                filtroEstado === 'ANULADO'
                  ? 'bg-black/25 text-white'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {kpis.conteoAnulados}
            </span>
          </button>
        </div>
      </section>

      {/* ====================================================================
          4. TARJETAS EXPANDIBLES (ACORDEÓN TÁCTIL) + MODAL DE FICHA COMPLETA
         ==================================================================== */}
      {pedidosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-2xs">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Package className="h-9 w-9" strokeWidth={1.8} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Sin pedidos registrados
          </h2>
          <p className="mt-1 max-w-md text-sm text-slate-600">
            {busqueda
              ? `No hay coincidencias para "${busqueda}".`
              : esTodasJornadas
                ? 'Aún no registraste preventas en tu ruta.'
                : `No tienes pedidos registrados para el ${fechaSeleccionada}${
                    filtroEstado !== 'TODOS'
                      ? ` con estado ${filtroEstado}`
                      : ''
                  }.`}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {!esJornadaHoy && !esTodasJornadas && (
              <button
                type="button"
                onClick={() => handleSeleccionarFecha('TODAS')}
                className="touch-manipulation min-h-[48px] rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                Ver Todas las Jornadas
              </button>
            )}

            <Link
              href="/vendedor/nueva-venta"
              className="touch-manipulation inline-flex min-h-[48px] items-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-6 py-3 text-sm font-extrabold text-white shadow-md transition-all active:translate-y-[2px] active:border-b-2"
            >
              <Plus className="h-5 w-5 text-[#FFCD00]" strokeWidth={2.5} />
              <span>Registrar Nueva Preventa</span>
            </Link>
          </div>
        </div>
      ) : (
        <section
          aria-label="Lista de pedidos del vendedor"
          className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2"
        >
          {pedidosFiltrados.map((pedido) => {
            const {
              kgEstimados,
              kgRealesVenta,
              kgRealesCortesia,
              totalBs,
              tieneCortesia,
            } = calcularTotalesPedido(pedido);
            const estaExpandido = Boolean(expandedPedidos[pedido.id_pedido]);

            const configEstado = {
              PENDIENTE: {
                badgeBg: 'bg-amber-100 text-amber-950 border-amber-400',
                dotColor: 'bg-amber-500',
                label: 'PENDIENTE',
                sublabel: 'En espera de despacho',
                topStripe: 'bg-amber-400',
              },
              DESPACHADO: {
                badgeBg: 'bg-emerald-100 text-emerald-950 border-emerald-500',
                dotColor: 'bg-emerald-600',
                label: 'DESPACHADO',
                sublabel: 'Pesado y entregado',
                topStripe: 'bg-emerald-600',
              },
              ANULADO: {
                badgeBg: 'bg-red-100 text-red-900 border-red-400',
                dotColor: 'bg-red-600',
                label: 'ANULADO',
                sublabel: 'Anulado / Rebote',
                topStripe: 'bg-red-600',
              },
            }[pedido.estado];

            return (
              <article
                key={pedido.id_pedido}
                className={`overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all ${
                  pedido.estado === 'ANULADO'
                    ? 'border-slate-200/80 opacity-90'
                    : estaExpandido
                      ? 'border-[#C8102E] shadow-md'
                      : 'border-slate-200 hover:border-[#C8102E]/60'
                }`}
              >
                {/* Franja superior bicolor */}
                <div className="flex h-1.5 w-full">
                  <div className="w-2/3 bg-[#C8102E]" />
                  <div className={`w-1/3 ${configEstado.topStripe}`} />
                </div>

                {/* Zona tocable del Acordeón Táctil */}
                <button
                  type="button"
                  onClick={() => toggleAcordeon(pedido.id_pedido)}
                  aria-expanded={estaExpandido}
                  className="touch-manipulation w-full p-4 text-left transition-colors hover:bg-slate-50/60"
                >
                  {/* Fila 1: ID + Nota SAC + Condición de Pago + Hora + Estado */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-black tracking-wide text-white">
                        #PED-{String(pedido.id_pedido).padStart(3, '0')}
                      </span>

                      {(pedido.nro_documento_sac || pedido.nro_nota_venta) && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-mono text-xs font-extrabold text-emerald-900">
                          <FileText className="h-3.5 w-3.5 text-emerald-700" />
                          N° {pedido.nro_documento_sac ?? pedido.nro_nota_venta}
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[11px] font-black uppercase ${
                          pedido.tipo_venta === 'CREDITO'
                            ? 'border-sky-300 bg-sky-50 text-sky-900'
                            : 'border-slate-200 bg-slate-100 text-slate-800'
                        }`}
                      >
                        {pedido.tipo_venta === 'CREDITO' ? (
                          <>
                            <CreditCard className="h-3 w-3 text-sky-700" />
                            <span>
                              CRÉDITO • {pedido.plazo_dias ?? 0}d
                            </span>
                          </>
                        ) : (
                          <>
                            <Banknote className="h-3 w-3 text-slate-600" />
                            <span>CONTADO</span>
                          </>
                        )}
                      </span>

                      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        {pedido.fecha_jornada} •{' '}
                        {formatHora(pedido.fecha_preventa)}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black tracking-wide ${configEstado.badgeBg}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${configEstado.dotColor}`}
                      />
                      {configEstado.label}
                    </span>
                  </div>

                  {/* Fila 2: Cliente y Zona */}
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#FFCD00]/40 px-1.5 py-0.5 font-mono text-[11px] font-black text-slate-900">
                        {pedido.cliente.codigo_cliente_sac}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {configEstado.sublabel}
                      </span>
                    </div>

                    <h2
                      className={`mt-1 text-base font-extrabold leading-snug sm:text-lg ${
                        pedido.estado === 'ANULADO'
                          ? 'text-slate-600 line-through'
                          : 'text-slate-900'
                      }`}
                    >
                      {pedido.cliente.nombre_comercial}
                    </h2>

                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-600">
                      <MapPin
                        className="h-3.5 w-3.5 shrink-0 text-[#C8102E]"
                        strokeWidth={2.2}
                      />
                      <span>{pedido.cliente.zona}</span>
                    </p>
                  </div>

                  {/* Fila 3: Comparativa Kilos Estimados vs Reales + Monto Bs. */}
                  <div className="mt-3.5 rounded-xl border border-slate-200 bg-slate-50/90 p-3">
                    {pedido.estado === 'DESPACHADO' ? (
                      <div className="grid grid-cols-3 items-center gap-2">
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Kg Estimado
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums text-slate-600">
                            {formatKg(kgEstimados, 2)} kg
                          </span>
                        </div>

                        <div className="border-x border-slate-200 px-2">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                            Kg Balanza
                          </span>
                          <span className="font-mono text-sm font-black tabular-nums text-emerald-800 sm:text-base">
                            {formatKg(kgRealesVenta, 3)} kg
                          </span>
                          {kgRealesCortesia > 0 && (
                            <span className="block font-mono text-[10px] font-bold text-amber-700">
                              +{formatKg(kgRealesCortesia, 3)} cort.
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Total Real
                          </span>
                          <span className="font-mono text-sm font-black tabular-nums text-slate-950 sm:text-base">
                            Bs. {formatBs(totalBs)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Kilos Estimados
                          </span>
                          <span className="font-mono text-base font-black tabular-nums text-slate-900">
                            {formatKg(kgEstimados, 2)} kg
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {pedido.estado === 'ANULADO'
                              ? 'Monto Anulado'
                              : 'Monto Estimado'}
                          </span>
                          <span
                            className={`font-mono text-base font-black tabular-nums ${
                              pedido.estado === 'ANULADO'
                                ? 'text-slate-500 line-through'
                                : 'text-[#C8102E]'
                            }`}
                          >
                            Bs. {formatBs(totalBs)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fila 4: Indicador Acordeón */}
                  <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-600">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        {pedido.detalle_pedidos.length}{' '}
                        {pedido.detalle_pedidos.length === 1 ? 'ítem' : 'ítems'}
                      </span>
                      {tieneCortesia && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-amber-50 px-2 py-0.5 text-[11px] font-extrabold text-amber-950">
                          <ChorizoCortesiaIcon className="h-3.5 w-3.5 text-[#C8102E]" />
                          Cortesía (0.00 Bs)
                        </span>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 font-extrabold text-[#C8102E]">
                      <span>
                        {estaExpandido ? 'Ocultar líneas' : 'Desplegar ítems'}
                      </span>
                      {estaExpandido ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  </div>
                </button>

                {/* CONTENIDO DESPLEGABLE DEL ACORDEÓN */}
                {estaExpandido && (
                  <div className="space-y-2.5 border-t-2 border-slate-100 bg-slate-50/70 px-4 py-3.5">
                    {pedido.observaciones && (
                      <div className="flex items-start gap-2 rounded-xl border-l-4 border-[#FFCD00] bg-amber-50 p-3 text-xs text-slate-900">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                        <p className="leading-relaxed">
                          <strong className="uppercase">Obs.: </strong>
                          {pedido.observaciones}
                        </p>
                      </div>
                    )}

                    <ul className="space-y-2">
                      {pedido.detalle_pedidos.map((item) => (
                        <li
                          key={item.id_detalle}
                          className={`rounded-xl border-2 p-3 ${
                            item.es_cortesia
                              ? 'border-amber-400 bg-amber-50/90'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {item.productos?.codigo_sku && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                                    {item.productos.codigo_sku}
                                  </span>
                                )}
                                {item.productos?.formato && (
                                  <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-black text-[#FFCD00]">
                                    {item.productos.formato}
                                  </span>
                                )}
                                {item.es_cortesia && (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-[#FFCD00] bg-[#C8102E] px-2 py-0.5 text-[10px] font-extrabold text-white">
                                    <ChorizoCortesiaIcon className="h-3 w-3 text-[#FFCD00]" />
                                    Cortesía (0.00 Bs)
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 text-sm font-extrabold text-slate-900">
                                {item.productos?.nombre_producto ??
                                  'Producto sin nombre'}
                              </p>
                            </div>

                            <div className="shrink-0 text-right font-mono tabular-nums">
                              <span className="block text-sm font-black text-slate-950">
                                Bs. {formatBs(item.es_cortesia ? 0 : item.subtotal_bs)}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500">
                                Bs. {formatBs(item.precio_unitario_congelado)}/kg
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 font-mono text-xs tabular-nums">
                            <span className="text-slate-600">
                              Estimado:{' '}
                              <strong className="text-slate-900">
                                {(() => {
                                  const u = getUnidadesInfo(
                                    item,
                                    item.kilos_estimados
                                  );
                                  return u.unidadesLabel
                                    ? `${u.unidadesLabel} • ${formatKg(item.kilos_estimados, 3)} kg`
                                    : `${formatKg(item.kilos_estimados, 2)} kg`;
                                })()}
                              </strong>
                            </span>

                            {item.kilos_reales !== null ? (
                              <span className="rounded bg-emerald-100 px-2 py-0.5 font-extrabold text-emerald-900">
                                {(() => {
                                  const u = getUnidadesInfo(
                                    item,
                                    item.kilos_reales
                                  );
                                  return u.unidadesLabel
                                    ? `Balanza: ${u.unidadesLabel} • ${formatKg(item.kilos_reales, 3)} kg`
                                    : `Balanza: ${formatKg(item.kilos_reales, 3)} kg`;
                                })()}
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-amber-700">
                                Pendiente de pesaje
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Barra inferior rápida de la tarjeta */}
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setPedidoDetalleActivo(pedido)}
                    className={`touch-manipulation inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold shadow-2xs transition-colors ${
                      pedido.estado === 'DESPACHADO'
                        ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    <Receipt className="h-4 w-4" strokeWidth={2.2} />
                    <span>
                      {pedido.estado === 'DESPACHADO' && pedido.nro_nota_venta
                        ? `Nota #${pedido.nro_nota_venta}`
                        : 'Ficha Completa'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleCompartirPedido(e, pedido)}
                    aria-label={`Compartir pedido #${pedido.id_pedido}`}
                    className="touch-manipulation inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                  >
                    {copiadoId === pedido.id_pedido ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4 text-[#C8102E]" />
                    )}
                    <span className="hidden sm:inline">
                      {copiadoId === pedido.id_pedido ? 'Copiado' : 'Copiar'}
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* ====================================================================
          5. MODAL DE FICHA COMPLETA (DETALLE + COMPARTIR)
         ==================================================================== */}
      {pedidoDetalleActivo &&
        (() => {
          const {
            kgEstimados,
            kgRealesVenta,
            kgRealesCortesia,
            totalBs,
          } = calcularTotalesPedido(pedidoDetalleActivo);

          const badgeEstadoDetalle = {
            PENDIENTE: 'bg-[#FFCD00] text-slate-950 border-amber-500',
            DESPACHADO: 'bg-emerald-500 text-white border-emerald-400',
            ANULADO: 'bg-red-600 text-white border-red-400',
          }[pedidoDetalleActivo.estado];

          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="detalle-pedido-titulo"
              className="fixed inset-0 z-50 flex flex-col bg-[#F1F5F9] md:items-center md:justify-center md:bg-slate-950/75 md:p-6 md:backdrop-blur-xs"
              onClick={() => setPedidoDetalleActivo(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex h-full w-full flex-col overflow-hidden bg-[#F1F5F9] md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-2xl md:border-2 md:border-slate-300 md:bg-white md:shadow-2xl"
              >
                <div className="relative shrink-0 border-b-4 border-[#FFCD00] bg-gradient-to-r from-[#C8102E] to-[#85081C] px-4 py-3.5 text-white shadow-md md:px-6 md:py-4">
                  <CharcuteriePatternBg variant="crimson" />

                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPedidoDetalleActivo(null)}
                        aria-label="Volver al listado"
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-white/25 bg-black/25 text-white transition-all active:scale-95 md:hidden"
                      >
                        <ArrowLeft
                          className="h-5 w-5 text-[#FFCD00]"
                          strokeWidth={2.6}
                        />
                      </button>

                      <div className="hidden md:block">
                        <EuroalimentosEmblem />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black uppercase tracking-wider text-[#FFCD00]">
                            {pedidoDetalleActivo.estado === 'DESPACHADO' &&
                            (pedidoDetalleActivo.nro_documento_sac ||
                              pedidoDetalleActivo.nro_nota_venta)
                              ? `NOTA N° ${pedidoDetalleActivo.nro_documento_sac ?? pedidoDetalleActivo.nro_nota_venta}`
                              : `PREVENTA #PED-${String(pedidoDetalleActivo.id_pedido).padStart(3, '0')}`}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-black uppercase ${badgeEstadoDetalle}`}
                          >
                            {pedidoDetalleActivo.estado}
                          </span>
                          <span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase text-white">
                            {pedidoDetalleActivo.tipo_venta === 'CREDITO'
                              ? `CRÉDITO • ${pedidoDetalleActivo.plazo_dias ?? 0}d`
                              : 'CONTADO'}
                          </span>
                        </div>
                        <h2
                          id="detalle-pedido-titulo"
                          className="mt-0.5 truncate text-base font-extrabold text-white sm:text-lg"
                        >
                          {pedidoDetalleActivo.cliente.nombre_comercial}
                        </h2>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPedidoDetalleActivo(null)}
                      aria-label="Cerrar ventana"
                      className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-white/25 bg-black/25 text-white transition-colors hover:bg-black/40 md:flex"
                    >
                      <X className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
                    <div className="space-y-4 md:col-span-5">
                      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-2xs">
                        <div className="flex h-1.5 w-full">
                          <div className="w-2/3 bg-[#C8102E]" />
                          <div className="w-1/3 bg-[#FFCD00]" />
                        </div>
                        <div className="space-y-3 p-4">
                          <div className="flex items-center justify-between">
                            <span className="rounded bg-[#FFCD00]/40 px-2 py-0.5 font-mono text-xs font-black text-slate-900">
                              {pedidoDetalleActivo.cliente.codigo_cliente_sac}
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-500">
                              ID #{pedidoDetalleActivo.id_pedido}
                            </span>
                          </div>

                          <div>
                            <p className="text-base font-extrabold text-slate-900">
                              {pedidoDetalleActivo.cliente.nombre_comercial}
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                              <MapPin className="h-4 w-4 shrink-0 text-[#C8102E]" />
                              {pedidoDetalleActivo.cliente.zona}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 font-mono text-xs">
                            <div>
                              <span className="block text-[10px] font-bold uppercase text-slate-400">
                                Preventa
                              </span>
                              <span className="font-bold text-slate-800">
                                {pedidoDetalleActivo.fecha_jornada} •{' '}
                                {formatHora(pedidoDetalleActivo.fecha_preventa)}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-bold uppercase text-slate-400">
                                Despacho Planta
                              </span>
                              <span className="font-bold text-emerald-700">
                                {pedidoDetalleActivo.fecha_despacho
                                  ? formatHora(
                                      pedidoDetalleActivo.fecha_despacho
                                    )
                                  : 'Pendiente'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border-2 border-slate-900 bg-slate-900 p-4 text-white shadow-sm">
                        <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[#FFCD00]">
                          RESUMEN DE PESO Y LIQUIDACIÓN
                        </span>

                        <div className="mt-3 grid grid-cols-2 gap-3 border-b border-slate-800 pb-3 font-mono">
                          <div>
                            <span className="block text-[10px] uppercase text-slate-400">
                              Kg Solicitados
                            </span>
                            <span className="text-base font-bold text-slate-200">
                              {formatKg(kgEstimados, 2)} Kg
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase text-emerald-400">
                              Kg Reales Balanza
                            </span>
                            <span className="text-base font-black text-emerald-400">
                              {pedidoDetalleActivo.estado === 'DESPACHADO'
                                ? `${formatKg(kgRealesVenta, 3)} Kg`
                                : 'En espera'}
                            </span>
                            {kgRealesCortesia > 0 && (
                              <span className="block text-[11px] font-bold text-[#FFCD00]">
                                +{formatKg(kgRealesCortesia, 3)} Kg cortesía
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex items-baseline justify-between">
                          <span className="font-mono text-xs font-bold uppercase text-slate-300">
                            {pedidoDetalleActivo.estado === 'DESPACHADO'
                              ? 'Total Cobrado:'
                              : 'Total Estimado:'}
                          </span>
                          <span className="font-mono text-2xl font-black tabular-nums text-[#FFCD00]">
                            Bs. {formatBs(totalBs)}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl border-2 border-slate-200 bg-white p-3.5 shadow-2xs">
                        <span className="mb-2.5 block font-mono text-[10px] font-black uppercase tracking-wider text-slate-500">
                          ACCIONES RÁPIDAS
                        </span>
                        <Link
                          href="/vendedor/nueva-venta"
                          className="touch-manipulation flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-slate-800"
                        >
                          {pedidoDetalleActivo.estado === 'ANULADO' ? (
                            <RotateCcw className="h-4 w-4 text-[#FFCD00]" />
                          ) : (
                            <CopyPlus className="h-4 w-4 text-[#FFCD00]" />
                          )}
                          <span>
                            {pedidoDetalleActivo.estado === 'ANULADO'
                              ? 'Reprogramar Nueva Preventa'
                              : 'Nueva Preventa en Ruta'}
                          </span>
                        </Link>
                      </div>

                      {pedidoDetalleActivo.observaciones && (
                        <div
                          className={`flex items-start gap-2.5 rounded-2xl border-l-4 p-3.5 text-xs ${
                            pedidoDetalleActivo.estado === 'ANULADO'
                              ? 'border-red-600 bg-red-50 text-red-950'
                              : 'border-[#FFCD00] bg-amber-50 text-slate-900'
                          }`}
                        >
                          <AlertCircle
                            className={`mt-0.5 h-4 w-4 shrink-0 ${
                              pedidoDetalleActivo.estado === 'ANULADO'
                                ? 'text-red-600'
                                : 'text-amber-700'
                            }`}
                          />
                          <div>
                            <span className="block font-extrabold uppercase">
                              Observaciones de Ruta / Planta:
                            </span>
                            <p className="mt-0.5 leading-relaxed">
                              {pedidoDetalleActivo.observaciones}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 md:col-span-7">
                      <div className="flex items-center justify-between">
                        <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-700">
                          Desglose de Productos (
                          {pedidoDetalleActivo.detalle_pedidos.length})
                        </h3>
                        <span className="rounded bg-slate-200/80 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                          PRECIO CONGELADO EN BS/KG
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {pedidoDetalleActivo.detalle_pedidos.map((item) => (
                          <div
                            key={item.id_detalle}
                            className={`rounded-2xl border-2 p-3.5 transition-colors ${
                              item.es_cortesia
                                ? 'border-amber-400 bg-amber-50/80'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {item.productos?.codigo_sku && (
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-600">
                                      {item.productos.codigo_sku}
                                    </span>
                                  )}
                                  {item.productos?.formato && (
                                    <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-black text-[#FFCD00]">
                                      {item.productos.formato}
                                    </span>
                                  )}
                                  {item.es_cortesia && (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-[#FFCD00] bg-[#C8102E] px-2 py-0.5 text-[11px] font-extrabold text-white">
                                      <ChorizoCortesiaIcon className="h-3.5 w-3.5 text-[#FFCD00]" />
                                      Cortesía (0.00 Bs)
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-sm font-extrabold text-slate-900 sm:text-base">
                                  {item.productos?.nombre_producto ??
                                    'Producto sin nombre'}
                                </p>
                              </div>

                              <div className="text-right font-mono tabular-nums">
                                <span className="block text-base font-black text-slate-950">
                                  Bs.{' '}
                                  {formatBs(
                                    item.es_cortesia ? 0 : item.subtotal_bs
                                  )}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Bs. {formatBs(item.precio_unitario_congelado)}{' '}
                                  / kg
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 font-mono text-xs tabular-nums">
                              <div className="flex items-center gap-2.5">
                                <span className="text-slate-600">
                                  Solicitado:{' '}
                                  <strong className="text-slate-900">
                                    {(() => {
                                      const u = getUnidadesInfo(
                                        item,
                                        item.kilos_estimados
                                      );
                                      return u.unidadesLabel
                                        ? `${u.unidadesLabel} • ${formatKg(item.kilos_estimados, 3)} kg`
                                        : `${formatKg(item.kilos_estimados, 2)} kg`;
                                    })()}
                                  </strong>
                                </span>

                                {item.kilos_reales !== null && (
                                  <>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-extrabold text-emerald-900">
                                      {(() => {
                                        const u = getUnidadesInfo(
                                          item,
                                          item.kilos_reales
                                        );
                                        return u.unidadesLabel
                                          ? `Balanza: ${u.unidadesLabel} • ${formatKg(item.kilos_reales, 3)} kg`
                                          : `Balanza: ${formatKg(item.kilos_reales, 3)} kg`;
                                      })()}
                                    </span>
                                  </>
                                )}
                              </div>

                              {item.kilos_reales !== null &&
                                !item.es_cortesia && (
                                  <span
                                    className={`text-[11px] font-extrabold ${
                                      item.kilos_reales - item.kilos_estimados >=
                                      0
                                        ? 'text-emerald-700'
                                        : 'text-amber-700'
                                    }`}
                                  >
                                    {item.kilos_reales - item.kilos_estimados >=
                                    0
                                      ? `+${formatKg(
                                          item.kilos_reales -
                                            item.kilos_estimados,
                                          3
                                        )} kg`
                                      : `${formatKg(
                                          item.kilos_reales -
                                            item.kilos_estimados,
                                          3
                                        )} kg`}
                                  </span>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-t-2 border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4">
                  <div className="flex items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPedidoDetalleActivo(null)}
                      className="touch-manipulation inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                    >
                      <ArrowLeft className="h-4 w-4 md:hidden" />
                      <span>Volver</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) =>
                        handleCompartirPedido(e, pedidoDetalleActivo)
                      }
                      className="touch-manipulation inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition-all active:translate-y-[2px] active:border-b-2 sm:flex-initial"
                    >
                      <Copy className="h-4 w-4 text-[#FFCD00]" />
                      <span>
                        {pedidoDetalleActivo.estado === 'DESPACHADO' &&
                        pedidoDetalleActivo.nro_nota_venta
                          ? `Compartir Nota #${pedidoDetalleActivo.nro_nota_venta}`
                          : 'Compartir Comprobante'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ====================================================================
          6. TOAST DE CONFIRMACIÓN
         ==================================================================== */}
      {toastMensaje && (
        <div
          role="status"
          className="fixed top-20 right-4 left-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border-2 border-[#FFCD00] bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-xl"
        >
          <span>{toastMensaje}</span>
          <button
            type="button"
            onClick={() => setToastMensaje(null)}
            className="rounded-lg p-1 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

