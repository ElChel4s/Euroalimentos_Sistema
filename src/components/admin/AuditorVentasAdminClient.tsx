'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  Filter,
  Gift,
  MapPin,
  MoreVertical,
  Package,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import {
  anularPedidoPorReboteAction,
  editarPedidoAdminAction,
} from '@/actions/admin.actions';
import type {
  EstadoPedidoEnum,
  FormatoProductoEnum,
} from '@/types/database.types';

export interface DetallePedidoAuditoriaItem {
  id_detalle: number;
  id_producto: number;
  kilos_estimados: number;
  kilos_reales: number | null;
  es_cortesia: boolean;
  precio_unitario_congelado: number;
  subtotal_bs: number;
  producto: {
    id_producto: number;
    codigo_sku: string;
    nombre_producto: string;
    formato: FormatoProductoEnum;
  };
}

export interface AnulacionPedidoAdmin {
  id_anulacion: number;
  motivo_rebote: string;
  kilos_reingresados_total: number;
  fecha_anulacion: string;
  administrador: {
    id_usuario: number;
    nombre_completo: string;
  } | null;
}

export interface PedidoAuditoriaAdmin {
  id_pedido: number;
  nro_nota_venta: number | null;
  estado: EstadoPedidoEnum;
  es_pedido_cortesia_pura: boolean;
  observaciones: string | null;
  fecha_preventa: string;
  fecha_despacho: string | null;
  clientes: {
    id_cliente: number;
    codigo_cliente_sac: string;
    nombre_comercial: string;
    zona: {
      id_zona: number;
      nombre_zona: string;
    };
  };
  vendedor: {
    id_usuario: number;
    nombre_completo: string;
  };
  despachador: {
    id_usuario: number;
    nombre_completo: string;
  } | null;
  detalle_pedidos: DetallePedidoAuditoriaItem[];
  anulacion: AnulacionPedidoAdmin | null;
}

export interface PerfilAdminResumen {
  id_usuario: number;
  nombre_completo: string;
  cargo_gerencial: string;
  puede_anular_despachos: boolean;
}

export interface AuditorVentasAdminClientProps {
  pedidos: PedidoAuditoriaAdmin[];
  perfilAdmin: PerfilAdminResumen;
  fechaHoyBolivia?: string;
}

const TIMEZONE_BOLIVIA = 'America/La_Paz';

const MOTIVOS_FRECUENTES = [
  'Local cerrado en ruta',
  'Rechazo por horario de entrega',
  'Error de pedido del cliente',
];

function obtenerFechaBoliviaIso(offsetDias = 0): string {
  const base = new Date(Date.now() + offsetDias * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base);
}

function restarDiasIso(isoYmd: string, dias: number): string {
  const [y, m, d] = isoYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - dias));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function toFechaBoliviaYmd(isoString: string): string {
  const fechaObj = new Date(isoString);
  if (Number.isNaN(fechaObj.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fechaObj);
}

function formatFechaCortaBolivia(isoString: string | null): string {
  if (!isoString) return 'Sin fecha';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';

  const fecha = new Intl.DateTimeFormat('es-BO', {
    timeZone: TIMEZONE_BOLIVIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);

  const hora = new Intl.DateTimeFormat('es-BO', {
    timeZone: TIMEZONE_BOLIVIA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

  return `${fecha} • ${hora}`;
}

function formatBs(valor: number): string {
  return `Bs. ${valor.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatKg(valor: number): string {
  return `${valor.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} kg`;
}

function formatNota(nroNota: number | null): string | null {
  if (nroNota === null || nroNota === undefined) return null;
  return String(nroNota).padStart(6, '0');
}

function formatPedidoCode(idPedido: number): string {
  return `PED-${String(idPedido).padStart(3, '0')}`;
}

interface ResumenPedido {
  kgEstimados: number;
  kgRealesTotales: number;
  kgRealesVendidos: number;
  kgCortesia: number;
  totalBs: number;
  variacionKg: number;
}

function calcularResumenPedido(pedido: PedidoAuditoriaAdmin): ResumenPedido {
  let kgEstimados = 0;
  let kgRealesTotales = 0;
  let kgRealesVendidos = 0;
  let kgCortesia = 0;
  let totalBs = 0;

  for (const item of pedido.detalle_pedidos) {
    const est = Number(item.kilos_estimados ?? 0);
    const real =
      pedido.estado === 'PENDIENTE'
        ? 0
        : Number(item.kilos_reales ?? item.kilos_estimados ?? 0);
    const esCort = Boolean(item.es_cortesia || pedido.es_pedido_cortesia_pura);

    kgEstimados += est;
    kgRealesTotales += real;

    if (esCort) {
      kgCortesia += pedido.estado === 'PENDIENTE' ? est : real;
    } else {
      kgRealesVendidos += real;
      const sub =
        pedido.estado === 'PENDIENTE'
          ? est * Number(item.precio_unitario_congelado ?? 0)
          : Number(item.subtotal_bs ?? 0);
      totalBs += sub;
    }
  }

  const variacionKg =
    pedido.estado === 'PENDIENTE'
      ? 0
      : Number((kgRealesTotales - kgEstimados).toFixed(3));

  return {
    kgEstimados: Number(kgEstimados.toFixed(3)),
    kgRealesTotales: Number(kgRealesTotales.toFixed(3)),
    kgRealesVendidos: Number(kgRealesVendidos.toFixed(3)),
    kgCortesia: Number(kgCortesia.toFixed(3)),
    totalBs: Number(totalBs.toFixed(2)),
    variacionKg,
  };
}

export function AuditorVentasAdminClient({
  pedidos,
  perfilAdmin,
  fechaHoyBolivia,
}: AuditorVentasAdminClientProps) {
  const router = useRouter();

  const [pedidosInternos, setPedidosInternos] =
    useState<PedidoAuditoriaAdmin[]>(pedidos);

  const [busqueda, setBusqueda] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [rangoRapido, setRangoRapido] = useState<
    'TODAS' | 'HOY' | '7DIAS' | 'CUSTOM'
  >('TODAS');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('TODOS');
  const [filtroZona, setFiltroZona] = useState<string>('TODAS');
  const [filtroProducto, setFiltroProducto] = useState<string>('TODOS');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | EstadoPedidoEnum>(
    'TODOS'
  );

  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [itemsPorPagina, setItemsPorPagina] = useState<10 | 20 | 50>(10);

  // Menú contextual de 3 puntos (⋮)
  const [menuAbiertoId, setMenuAbiertoId] = useState<number | null>(null);

  // Modales: Auditoría, Edición y Anulación en 2 pasos
  const [pedidoAuditar, setPedidoAuditar] =
    useState<PedidoAuditoriaAdmin | null>(null);

  const [pedidoEditar, setPedidoEditar] = useState<PedidoAuditoriaAdmin | null>(
    null
  );
  const [observacionesEdit, setObservacionesEdit] = useState<string>('');
  const [detallesEdit, setDetallesEdit] = useState<
    { id_detalle: number; kilos_estimados: number; kilos_reales: number }[]
  >([]);
  const [guardandoEdicion, setGuardandoEdicion] = useState<boolean>(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const [pedidoAnular, setPedidoAnular] = useState<PedidoAuditoriaAdmin | null>(
    null
  );
  const [pasoAnulacion, setPasoAnulacion] = useState<1 | 2>(1);
  const [motivoRebote, setMotivoRebote] = useState<string>('');
  const [confirmacionSegura, setConfirmacionSegura] = useState<boolean>(false);
  const [procesandoAnulacion, setProcesandoAnulacion] =
    useState<boolean>(false);
  const [errorAnulacion, setErrorAnulacion] = useState<string | null>(null);
  const [toastFeedback, setToastFeedback] = useState<string | null>(null);

  const hoyBolivia = useMemo(
    () => fechaHoyBolivia ?? obtenerFechaBoliviaIso(0),
    [fechaHoyBolivia]
  );

  const opcionesVendedores = useMemo(() => {
    const map = new Map<number, string>();
    pedidosInternos.forEach((p) => {
      if (!map.has(p.vendedor.id_usuario)) {
        map.set(p.vendedor.id_usuario, p.vendedor.nombre_completo);
      }
    });
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id: String(id), nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [pedidosInternos]);

  const opcionesZonas = useMemo(() => {
    const map = new Map<number, string>();
    pedidosInternos.forEach((p) => {
      if (!map.has(p.clientes.zona.id_zona)) {
        map.set(p.clientes.zona.id_zona, p.clientes.zona.nombre_zona);
      }
    });
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id: String(id), nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [pedidosInternos]);

  const opcionesProductos = useMemo(() => {
    const map = new Map<number, string>();
    pedidosInternos.forEach((p) =>
      p.detalle_pedidos.forEach((d) => {
        if (!map.has(d.producto.id_producto)) {
          map.set(
            d.producto.id_producto,
            `${d.producto.nombre_producto} (${d.producto.codigo_sku})`
          );
        }
      })
    );
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id: String(id), nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [pedidosInternos]);

  const aplicarRangoRapido = (tipo: 'TODAS' | 'HOY' | '7DIAS') => {
    setRangoRapido(tipo);
    setPaginaActual(1);
    if (tipo === 'TODAS') {
      setFechaDesde('');
      setFechaHasta('');
    } else if (tipo === 'HOY') {
      setFechaDesde(hoyBolivia);
      setFechaHasta(hoyBolivia);
    } else {
      setFechaDesde(restarDiasIso(hoyBolivia, 6));
      setFechaHasta(hoyBolivia);
    }
  };

  const pedidosFiltradosSinEstado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    return pedidosInternos.filter((p) => {
      if (q) {
        const notaPad = formatNota(p.nro_nota_venta)?.toLowerCase() ?? '';
        const notaRaw = String(p.nro_nota_venta ?? '');
        const pedCode = formatPedidoCode(p.id_pedido).toLowerCase();
        const pedIdStr = String(p.id_pedido);

        const matchNota = notaPad.includes(q) || notaRaw.includes(q);
        const matchId =
          pedCode.includes(q) ||
          `#${pedCode}`.includes(q) ||
          pedIdStr.includes(q);
        const matchCliente =
          p.clientes.nombre_comercial.toLowerCase().includes(q) ||
          p.clientes.codigo_cliente_sac.toLowerCase().includes(q);
        const matchProducto = p.detalle_pedidos.some(
          (d) =>
            d.producto.nombre_producto.toLowerCase().includes(q) ||
            d.producto.codigo_sku.toLowerCase().includes(q)
        );
        if (!matchNota && !matchId && !matchCliente && !matchProducto) {
          return false;
        }
      }

      const fechaPedido = toFechaBoliviaYmd(p.fecha_preventa);
      if (fechaDesde && fechaPedido < fechaDesde) return false;
      if (fechaHasta && fechaPedido > fechaHasta) return false;

      if (
        filtroVendedor !== 'TODOS' &&
        String(p.vendedor.id_usuario) !== filtroVendedor
      ) {
        return false;
      }

      if (
        filtroZona !== 'TODAS' &&
        String(p.clientes.zona.id_zona) !== filtroZona
      ) {
        return false;
      }

      if (
        filtroProducto !== 'TODOS' &&
        !p.detalle_pedidos.some(
          (d) => String(d.producto.id_producto) === filtroProducto
        )
      ) {
        return false;
      }

      return true;
    });
  }, [
    pedidosInternos,
    busqueda,
    fechaDesde,
    fechaHasta,
    filtroVendedor,
    filtroZona,
    filtroProducto,
  ]);

  const contadoresEstado = useMemo(() => {
    return {
      TODOS: pedidosFiltradosSinEstado.length,
      DESPACHADO: pedidosFiltradosSinEstado.filter(
        (p) => p.estado === 'DESPACHADO'
      ).length,
      PENDIENTE: pedidosFiltradosSinEstado.filter(
        (p) => p.estado === 'PENDIENTE'
      ).length,
      ANULADO: pedidosFiltradosSinEstado.filter((p) => p.estado === 'ANULADO')
        .length,
    };
  }, [pedidosFiltradosSinEstado]);

  const pedidosFiltrados = useMemo(() => {
    if (filtroEstado === 'TODOS') return pedidosFiltradosSinEstado;
    return pedidosFiltradosSinEstado.filter((p) => p.estado === filtroEstado);
  }, [pedidosFiltradosSinEstado, filtroEstado]);

  const metricasLinea = useMemo(() => {
    const totalOrdenes = pedidosFiltrados.length;
    let kgEstimados = 0;
    let kgRealesVendidos = 0;
    let kgCortesia = 0;
    let totalFacturadoBs = 0;

    pedidosFiltrados.forEach((p) => {
      const res = calcularResumenPedido(p);
      kgEstimados += res.kgEstimados;
      if (p.estado === 'DESPACHADO') {
        kgRealesVendidos += res.kgRealesVendidos;
        kgCortesia += res.kgCortesia;
        totalFacturadoBs += res.totalBs;
      }
    });

    return {
      totalOrdenes,
      kgEstimados,
      kgRealesVendidos,
      kgCortesia,
      totalFacturadoBs,
    };
  }, [pedidosFiltrados]);

  const totalRegistros = pedidosFiltrados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / itemsPorPagina));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const indiceInicio = (paginaSegura - 1) * itemsPorPagina;
  const indiceFin = Math.min(indiceInicio + itemsPorPagina, totalRegistros);
  const pedidosPaginados = pedidosFiltrados.slice(indiceInicio, indiceFin);

  const abrirModalEdicion = (pedido: PedidoAuditoriaAdmin) => {
    setMenuAbiertoId(null);
    setPedidoEditar(pedido);
    setObservacionesEdit(pedido.observaciones ?? '');
    setErrorEdicion(null);
    setDetallesEdit(
      pedido.detalle_pedidos.map((d) => ({
        id_detalle: d.id_detalle,
        kilos_estimados: d.kilos_estimados,
        kilos_reales: Number(d.kilos_reales ?? d.kilos_estimados ?? 0),
      }))
    );
  };

  const guardarEdicionPedido = async () => {
    if (!pedidoEditar) return;
    setGuardandoEdicion(true);
    setErrorEdicion(null);

    try {
      const resultado = await editarPedidoAdminAction({
        id_pedido: pedidoEditar.id_pedido,
        observaciones: observacionesEdit.trim() || null,
        detalles: detallesEdit.map((d) => ({
          id_detalle: d.id_detalle,
          kilos_estimados: d.kilos_estimados,
          kilos_reales:
            pedidoEditar.estado === 'PENDIENTE' ? null : d.kilos_reales,
        })),
      });

      if (!resultado.ok) {
        setErrorEdicion(resultado.error);
        return;
      }

      setPedidosInternos((prev) =>
        prev.map((item) => {
          if (item.id_pedido !== pedidoEditar.id_pedido) return item;
          const nuevosDetalles = item.detalle_pedidos.map((det) => {
            const actualizado = resultado.detalles.find(
              (r) => r.id_detalle === det.id_detalle
            );
            if (!actualizado) return det;

            const esCort = Boolean(
              det.es_cortesia || item.es_pedido_cortesia_pura
            );
            return {
              ...det,
              kilos_estimados: actualizado.kilos_estimados,
              kilos_reales: actualizado.kilos_reales,
              subtotal_bs: esCort
                ? 0
                : Number(
                    actualizado.subtotal_bs ??
                      (actualizado.kilos_reales ??
                        actualizado.kilos_estimados) *
                        det.precio_unitario_congelado
                  ),
            };
          });

          return {
            ...item,
            observaciones: resultado.observaciones,
            detalle_pedidos: nuevosDetalles,
          };
        })
      );

      setToastFeedback(
        `Orden #${formatPedidoCode(pedidoEditar.id_pedido)} actualizada correctamente en el registro de auditoría.`
      );
      setPedidoEditar(null);
      router.refresh();
    } catch {
      setErrorEdicion(
        'Ocurrió un error inesperado al guardar los cambios de la orden.'
      );
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const abrirModalAnulacion = (pedido: PedidoAuditoriaAdmin) => {
    setMenuAbiertoId(null);
    setPedidoAnular(pedido);
    setPasoAnulacion(1);
    setMotivoRebote('');
    setConfirmacionSegura(false);
    setErrorAnulacion(null);
  };

  const handleReimprimirNota = (pedido: PedidoAuditoriaAdmin) => {
    setMenuAbiertoId(null);
    router.push(`/despacho/imprimir/${pedido.id_pedido}`);
  };

  const confirmarAnulacionRebote = async () => {
    if (
      !pedidoAnular ||
      motivoRebote.trim().length < 10 ||
      !confirmacionSegura
    ) {
      return;
    }

    setProcesandoAnulacion(true);
    setErrorAnulacion(null);

    try {
      const resultado = await anularPedidoPorReboteAction({
        id_pedido: pedidoAnular.id_pedido,
        motivo_rebote: motivoRebote.trim(),
      });

      if (!resultado.ok) {
        setErrorAnulacion(resultado.error);
        return;
      }

      const kilosReingresar = Number(
        resultado.data.kilos_reingresados_total.toFixed(3)
      );

      const nuevaAnulacion: AnulacionPedidoAdmin = {
        id_anulacion: resultado.data.id_anulacion,
        motivo_rebote: motivoRebote.trim(),
        kilos_reingresados_total: kilosReingresar,
        fecha_anulacion: new Date().toISOString(),
        administrador: {
          id_usuario: perfilAdmin.id_usuario,
          nombre_completo: perfilAdmin.nombre_completo,
        },
      };

      setPedidosInternos((prev) =>
        prev.map((item) =>
          item.id_pedido === pedidoAnular.id_pedido
            ? { ...item, estado: 'ANULADO', anulacion: nuevaAnulacion }
            : item
        )
      );

      const labelNota =
        formatNota(pedidoAnular.nro_nota_venta) ??
        formatPedidoCode(pedidoAnular.id_pedido);

      setToastFeedback(
        `Nota N° ${labelNota} anulada (Soft Delete). Reingresados ${formatKg(kilosReingresar)} a cámara vía Kardex.`
      );
      setPedidoAnular(null);
      setPasoAnulacion(1);
      setMotivoRebote('');
      setConfirmacionSegura(false);
      router.refresh();
    } catch {
      setErrorAnulacion(
        'Ocurrió un error inesperado al procesar la anulación por rebote.'
      );
    } finally {
      setProcesandoAnulacion(false);
    }
  };

  const renderMenuTresPuntos = (
    pedido: PedidoAuditoriaAdmin,
    alineacion: 'right' | 'top' = 'right'
  ) => {
    const abierto = menuAbiertoId === pedido.id_pedido;
    const puedeEditar = pedido.estado !== 'ANULADO';
    const puedeAnular =
      pedido.estado === 'DESPACHADO' && perfilAdmin.puede_anular_despachos;
    const notaPad = formatNota(pedido.nro_nota_venta);

    return (
      <div
        className="relative inline-block text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuAbiertoId(abierto ? null : pedido.id_pedido);
          }}
          aria-haspopup="menu"
          aria-expanded={abierto}
          aria-label={`Más opciones para ${
            notaPad ? `Nota ${notaPad}` : formatPedidoCode(pedido.id_pedido)
          }`}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 transition-all ${
            abierto
              ? 'border-slate-900 bg-slate-900 text-[#FFCD00] shadow-sm'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100'
          }`}
        >
          <MoreVertical className="h-5 w-5" strokeWidth={2.2} />
        </button>

        {abierto && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={(e) => {
                e.stopPropagation();
                setMenuAbiertoId(null);
              }}
            />

            <div
              role="menu"
              className={`absolute right-0 ${
                alineacion === 'top' ? 'bottom-full mb-2' : 'mt-2'
              } z-40 w-60 overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-2xl`}
            >
              <div className="flex items-center justify-between border-b-2 border-[#FFCD00] bg-slate-900 px-3.5 py-2 text-white">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Opciones de Venta
                </span>
                <span className="font-mono text-[11px] font-extrabold text-[#FFCD00]">
                  #{formatPedidoCode(pedido.id_pedido)}
                </span>
              </div>

              <div className="space-y-1 p-1.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuAbiertoId(null);
                    setPedidoAuditar(pedido);
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100"
                >
                  <Eye
                    className="h-4 w-4 shrink-0 text-slate-600"
                    strokeWidth={2.2}
                  />
                  <div>
                    <div className="text-slate-900">Ver detalle completo</div>
                    <div className="text-[10px] font-normal text-slate-500">
                      Pesaje, cortesías y trazabilidad
                    </div>
                  </div>
                </button>

                {puedeEditar && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => abrirModalEdicion(pedido)}
                    className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100"
                  >
                    <Edit3
                      className="h-4 w-4 shrink-0 text-amber-600"
                      strokeWidth={2.2}
                    />
                    <div>
                      <div className="text-slate-900">Editar orden / pesos</div>
                      <div className="text-[10px] font-normal text-slate-500">
                        Ajustar kilos o notas internas
                      </div>
                    </div>
                  </button>
                )}

                {pedido.estado === 'DESPACHADO' && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleReimprimirNota(pedido)}
                    className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100"
                  >
                    <Printer
                      className="h-4 w-4 shrink-0 text-slate-600"
                      strokeWidth={2.2}
                    />
                    <div>
                      <div className="text-slate-900">
                        Reimprimir comprobante
                      </div>
                      <div className="text-[10px] font-normal text-slate-500">
                        Ticket térmico Epson 58mm / 80mm
                      </div>
                    </div>
                  </button>
                )}

                {puedeAnular && (
                  <>
                    <div className="my-1 border-t border-slate-200" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => abrirModalAnulacion(pedido)}
                      className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl bg-red-50/70 px-3 py-2 text-left text-xs font-extrabold text-[#C8102E] transition-colors hover:bg-red-100"
                    >
                      <RotateCcw
                        className="h-4 w-4 shrink-0 text-[#C8102E]"
                        strokeWidth={2.2}
                      />
                      <div>
                        <div>Anular venta por rebote</div>
                        <div className="text-[10px] font-normal text-red-700">
                          Requiere confirmación y motivo
                        </div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderEstadoBadge = (estado: EstadoPedidoEnum) => {
    switch (estado) {
      case 'DESPACHADO':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
            <CheckCircle2
              className="h-3.5 w-3.5 shrink-0 text-emerald-600"
              strokeWidth={2.2}
            />
            DESPACHADO
          </span>
        );
      case 'PENDIENTE':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
            <Clock
              className="h-3.5 w-3.5 shrink-0 text-amber-600"
              strokeWidth={2.2}
            />
            PENDIENTE
          </span>
        );
      case 'ANULADO':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-[#C8102E]">
            <Ban
              className="h-3.5 w-3.5 shrink-0 text-[#C8102E]"
              strokeWidth={2.2}
            />
            ANULADO
          </span>
        );
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-6 text-slate-900">
      {toastFeedback && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border-l-4 border-[#FFCD00] bg-slate-900 px-4 py-3 text-white shadow-lg"
        >
          <div className="flex items-center gap-2.5 text-sm">
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-[#FFCD00]"
              strokeWidth={2.2}
            />
            <span className="font-medium">{toastFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastFeedback(null)}
            className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ====================================================================
          1. BARRA DE CONTEXTO COMPACTA (SIN HEADER ROJO DUPLICADO)
      ==================================================================== */}
      <header className="flex flex-col justify-between gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#C8102E] ring-2 ring-[#FFCD00]" />
            <h1 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">
              Auditoría de Ventas y Rebotes
            </h1>
          </div>
          <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">
            Control general de pedidos, comparativa de pesaje y anulación por
            devolución (Soft Delete)
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-2 self-start whitespace-nowrap rounded-xl border px-3 py-1.5 font-mono text-xs font-bold sm:self-center ${
            perfilAdmin.puede_anular_despachos
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-slate-100 text-slate-700'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              perfilAdmin.puede_anular_despachos
                ? 'bg-emerald-400'
                : 'bg-amber-500'
            }`}
          />
          <span>
            {perfilAdmin.cargo_gerencial} • Rebotes:{' '}
            {perfilAdmin.puede_anular_despachos ? 'Habilitado' : 'Solo lectura'}
          </span>
        </div>
      </header>

      {/* ====================================================================
          2. BARRA DE BÚSQUEDA, FILTROS AVANZADOS Y RESUMEN EN LÍNEA
      ==================================================================== */}
      <section className="overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-xs">
        <div className="flex h-1.5 w-full">
          <div className="w-2/3 bg-[#C8102E]" />
          <div className="w-1/3 bg-[#FFCD00]" />
        </div>

        <div className="space-y-3.5 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="relative lg:col-span-5">
              <label htmlFor="buscador-auditoria" className="sr-only">
                Buscar por nota, pedido, cliente o producto
              </label>
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400"
                strokeWidth={2}
              />
              <input
                id="buscador-auditoria"
                type="text"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPaginaActual(1);
                }}
                placeholder="N° Nota, #PED, Cliente SAC o Producto..."
                className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 pr-9 pl-11 text-base text-slate-900 shadow-inner transition-all placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => {
                    setBusqueda('');
                    setPaginaActual(1);
                  }}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:col-span-7">
              <div className="grid flex-1 grid-cols-2 gap-2">
                <div className="relative">
                  <span className="pointer-events-none absolute top-1.5 left-3 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Desde
                  </span>
                  <input
                    type="date"
                    aria-label="Fecha desde"
                    value={fechaDesde}
                    onChange={(e) => {
                      setFechaDesde(e.target.value);
                      setRangoRapido('CUSTOM');
                      setPaginaActual(1);
                    }}
                    className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3 pt-4 pb-1 font-mono text-sm tabular-nums text-slate-900 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                  />
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1.5 left-3 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Hasta
                  </span>
                  <input
                    type="date"
                    aria-label="Fecha hasta"
                    value={fechaHasta}
                    onChange={(e) => {
                      setFechaHasta(e.target.value);
                      setRangoRapido('CUSTOM');
                      setPaginaActual(1);
                    }}
                    className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3 pt-4 pb-1 font-mono text-sm tabular-nums text-slate-900 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
                {(
                  [
                    { id: 'TODAS', label: 'Todas' },
                    { id: 'HOY', label: 'Hoy' },
                    { id: '7DIAS', label: 'Últimos 7 días' },
                  ] as const
                ).map((btn) => {
                  const activo = rangoRapido === btn.id;
                  return (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => aplicarRangoRapido(btn.id)}
                      className={`touch-manipulation min-h-[48px] whitespace-nowrap rounded-xl border-2 px-3 text-xs font-bold transition-all ${
                        activo
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {btn.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="relative min-w-0">
                <User
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                  strokeWidth={2}
                />
                <select
                  aria-label="Filtrar por vendedor"
                  value={filtroVendedor}
                  onChange={(e) => {
                    setFiltroVendedor(e.target.value);
                    setPaginaActual(1);
                  }}
                  className="min-h-[48px] w-full max-w-full truncate rounded-xl border-2 border-slate-200 bg-slate-50/60 pr-3 pl-9 text-sm font-medium text-slate-800 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                >
                  <option value="TODOS">Vendedor: Todos</option>
                  {opcionesVendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative min-w-0">
                <MapPin
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                  strokeWidth={2}
                />
                <select
                  aria-label="Filtrar por zona o mercado"
                  value={filtroZona}
                  onChange={(e) => {
                    setFiltroZona(e.target.value);
                    setPaginaActual(1);
                  }}
                  className="min-h-[48px] w-full max-w-full truncate rounded-xl border-2 border-slate-200 bg-slate-50/60 pr-3 pl-9 text-sm font-medium text-slate-800 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                >
                  <option value="TODAS">Zona / Mercado: Todas</option>
                  {opcionesZonas.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative min-w-0">
                <Package
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                  strokeWidth={2}
                />
                <select
                  aria-label="Filtrar por producto"
                  value={filtroProducto}
                  onChange={(e) => {
                    setFiltroProducto(e.target.value);
                    setPaginaActual(1);
                  }}
                  className="min-h-[48px] w-full max-w-full truncate rounded-xl border-2 border-slate-200 bg-slate-50/60 pr-3 pl-9 text-sm font-medium text-slate-800 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                >
                  <option value="TODOS">Producto: Todos</option>
                  {opcionesProductos.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0">
              <button
                type="button"
                onClick={() => {
                  setFiltroEstado('TODOS');
                  setPaginaActual(1);
                }}
                className={`touch-manipulation flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-3 text-xs font-bold transition-all ${
                  filtroEstado === 'TODOS'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Todos</span>
                <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-slate-900">
                  {contadoresEstado.TODOS}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFiltroEstado('DESPACHADO');
                  setPaginaActual(1);
                }}
                className={`touch-manipulation flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-3 text-xs font-bold transition-all ${
                  filtroEstado === 'DESPACHADO'
                    ? 'border-emerald-800 bg-emerald-700 text-white'
                    : 'border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100/70'
                }`}
              >
                <span>DESPACHADO</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums ${
                    filtroEstado === 'DESPACHADO'
                      ? 'bg-emerald-900 text-emerald-100'
                      : 'bg-emerald-200/80 text-emerald-950'
                  }`}
                >
                  {contadoresEstado.DESPACHADO}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFiltroEstado('PENDIENTE');
                  setPaginaActual(1);
                }}
                className={`touch-manipulation flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-3 text-xs font-bold transition-all ${
                  filtroEstado === 'PENDIENTE'
                    ? 'border-amber-700 bg-amber-600 text-white'
                    : 'border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-100/80'
                }`}
              >
                <span>PENDIENTE</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums ${
                    filtroEstado === 'PENDIENTE'
                      ? 'bg-amber-900 text-amber-100'
                      : 'bg-amber-200/80 text-amber-950'
                  }`}
                >
                  {contadoresEstado.PENDIENTE}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFiltroEstado('ANULADO');
                  setPaginaActual(1);
                }}
                className={`touch-manipulation flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-3 text-xs font-bold transition-all ${
                  filtroEstado === 'ANULADO'
                    ? 'border-red-900 bg-[#C8102E] text-white'
                    : 'border-red-200 bg-red-50/70 text-[#C8102E] hover:bg-red-100/70'
                }`}
              >
                <span
                  className={
                    filtroEstado !== 'ANULADO'
                      ? 'line-through decoration-red-400'
                      : ''
                  }
                >
                  ANULADO
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums ${
                    filtroEstado === 'ANULADO'
                      ? 'bg-red-950 text-red-100'
                      : 'bg-red-200/80 text-red-950'
                  }`}
                >
                  {contadoresEstado.ANULADO}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-500">Órdenes:</span>
              <strong className="font-mono font-extrabold tabular-nums text-slate-900">
                {metricasLinea.totalOrdenes}
              </strong>
            </div>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-500">Kg Estimados:</span>
              <strong className="font-mono font-bold tabular-nums text-slate-800">
                {formatKg(metricasLinea.kgEstimados)}
              </strong>
            </div>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-500">
                Kg Reales Vendidos:
              </span>
              <strong className="font-mono font-extrabold tabular-nums text-emerald-700">
                {formatKg(metricasLinea.kgRealesVendidos)}
              </strong>
            </div>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-500">Kg Cortesía:</span>
              <strong className="font-mono font-bold tabular-nums text-amber-700">
                {formatKg(metricasLinea.kgCortesia)}
              </strong>
            </div>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-500">
                Total Facturado:
              </span>
              <strong className="rounded-md border border-[#FFCD00] bg-[#FFCD00]/25 px-2 py-0.5 font-mono font-extrabold tabular-nums text-[#C8102E]">
                {formatBs(metricasLinea.totalFacturadoBs)}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          3. TABLA PAGINADA (DESKTOP lg:) Y TARJETAS (MÓVIL <1024px)
      ==================================================================== */}
      <section className="overflow-visible rounded-2xl border-2 border-slate-200/90 bg-white shadow-xs">
        {pedidosPaginados.length === 0 ? (
          <div className="space-y-2 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-400">
              <Filter className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              No se encontraron órdenes con los filtros aplicados
            </h3>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              Intenta ampliar el rango de fechas o limpiar la búsqueda por
              código SAC, número de nota o producto.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-[#C8102E]" />
                <span>
                  Toca cualquier venta para inspeccionar su detalle completo o
                  usa el menú <strong className="text-slate-700">⋮</strong> para
                  más acciones.
                </span>
              </span>
            </div>

            {/* VISTA ESCRITORIO: Tabla clickable + menú de 3 puntos */}
            <div className="hidden overflow-visible lg:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-4 border-[#FFCD00] bg-slate-900 font-mono text-[11px] uppercase tracking-wider text-white">
                    <th className="px-3.5 py-3">Nota / Pedido</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3.5 py-3">Cliente y Zona</th>
                    <th className="px-3 py-3">Vendedor / Despachador</th>
                    <th className="px-3.5 py-3">
                      Comparativa Peso (Est. vs Real)
                    </th>
                    <th className="px-3.5 py-3 text-right">Total (Bs.)</th>
                    <th className="w-16 px-3.5 py-3 text-right">Opciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {pedidosPaginados.map((pedido, idx) => {
                    const resumen = calcularResumenPedido(pedido);
                    const esAnulado = pedido.estado === 'ANULADO';
                    const esPendiente = pedido.estado === 'PENDIENTE';
                    const notaPad = formatNota(pedido.nro_nota_venta);
                    const abrirHaciaArriba =
                      pedidosPaginados.length > 2 &&
                      idx >= pedidosPaginados.length - 2;

                    return (
                      <tr
                        key={pedido.id_pedido}
                        onClick={() => setPedidoAuditar(pedido)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setPedidoAuditar(pedido);
                          }
                        }}
                        className={`group cursor-pointer transition-colors ${
                          esAnulado
                            ? 'bg-red-50/25 hover:bg-red-50/60'
                            : 'hover:bg-amber-50/40'
                        }`}
                      >
                        <td className="px-3.5 py-3 align-top">
                          <div className="flex items-center gap-1.5 font-mono font-extrabold tabular-nums text-slate-900 transition-colors group-hover:text-[#C8102E]">
                            {notaPad ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="text-[#C8102E]">N°</span>
                                {notaPad}
                              </span>
                            ) : (
                              <span className="font-semibold italic text-slate-400">
                                Sin Nota
                              </span>
                            )}
                            <ArrowUpRight className="h-3.5 w-3.5 text-[#C8102E] opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                          <div className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-slate-600">
                            #{formatPedidoCode(pedido.id_pedido)}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
                            {formatFechaCortaBolivia(
                              pedido.fecha_despacho ?? pedido.fecha_preventa
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3 align-top">
                          {renderEstadoBadge(pedido.estado)}
                          {esAnulado && pedido.anulacion && (
                            <div className="mt-1.5 inline-block rounded border border-red-200 bg-red-100/70 px-2 py-0.5 font-mono text-[11px] text-red-700">
                              +
                              {formatKg(
                                pedido.anulacion.kilos_reingresados_total
                              )}{' '}
                              Kardex
                            </div>
                          )}
                        </td>

                        <td className="max-w-[240px] px-3.5 py-3 align-top">
                          <div className="font-bold leading-snug text-slate-900">
                            {pedido.clientes.nombre_comercial}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-slate-700">
                              {pedido.clientes.codigo_cliente_sac}
                            </span>
                            <span className="truncate text-xs text-slate-500">
                              {pedido.clientes.zona.nombre_zona}
                            </span>
                          </div>
                        </td>

                        <td className="space-y-1 px-3 py-3 align-top text-xs">
                          <div className="text-slate-700">
                            <span className="mr-1 font-mono text-[11px] uppercase text-slate-400">
                              Vend:
                            </span>
                            <span className="font-semibold">
                              {pedido.vendedor.nombre_completo}
                            </span>
                          </div>
                          <div className="text-slate-700">
                            <span className="mr-1 font-mono text-[11px] uppercase text-slate-400">
                              Desp:
                            </span>
                            {pedido.despachador ? (
                              <span className="font-semibold">
                                {pedido.despachador.nombre_completo}
                              </span>
                            ) : (
                              <span className="font-medium italic text-amber-700">
                                Pendiente
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-3.5 py-3 align-top font-mono text-xs tabular-nums">
                          <div className="text-slate-500">
                            Est:{' '}
                            <span className="font-semibold">
                              {formatKg(resumen.kgEstimados)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[13px] font-extrabold text-slate-900">
                              Real:{' '}
                              {esPendiente
                                ? '—'
                                : formatKg(resumen.kgRealesTotales)}
                            </span>
                            {!esPendiente && resumen.variacionKg !== 0 && (
                              <span
                                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-bold ${
                                  resumen.variacionKg > 0
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-amber-200 bg-amber-50 text-amber-800'
                                }`}
                              >
                                {resumen.variacionKg > 0
                                  ? `+${resumen.variacionKg.toFixed(3)} kg`
                                  : `${resumen.variacionKg.toFixed(3)} kg`}
                              </span>
                            )}
                          </div>
                          {resumen.kgCortesia > 0 && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 rounded border border-[#FFCD00] bg-[#FFCD00]/30 px-1.5 py-0.5 text-[11px] font-bold text-slate-900">
                                <Gift className="h-3 w-3 text-[#C8102E]" />+
                                {resumen.kgCortesia.toFixed(3)} kg cort.
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="px-3.5 py-3 text-right align-top font-mono tabular-nums">
                          <div
                            className={`text-sm font-extrabold ${
                              esAnulado
                                ? 'text-slate-400 line-through decoration-[#C8102E] decoration-2'
                                : 'text-slate-900'
                            }`}
                          >
                            {formatBs(resumen.totalBs)}
                          </div>
                          {esAnulado && (
                            <span className="text-[10px] font-bold uppercase text-[#C8102E]">
                              Anulado
                            </span>
                          )}
                        </td>

                        <td className="px-3.5 py-3 text-right align-top">
                          {renderMenuTresPuntos(
                            pedido,
                            abrirHaciaArriba ? 'top' : 'right'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VISTA MÓVIL / TABLET: Tarjetas tappeables + menú de 3 puntos */}
            <div className="divide-y-2 divide-slate-200 lg:hidden">
              {pedidosPaginados.map((pedido, idx) => {
                const resumen = calcularResumenPedido(pedido);
                const esAnulado = pedido.estado === 'ANULADO';
                const esPendiente = pedido.estado === 'PENDIENTE';
                const notaPad = formatNota(pedido.nro_nota_venta);
                const abrirHaciaArriba =
                  pedidosPaginados.length > 2 &&
                  idx >= pedidosPaginados.length - 2;

                return (
                  <article
                    key={pedido.id_pedido}
                    onClick={() => setPedidoAuditar(pedido)}
                    className={`cursor-pointer space-y-3 p-4 transition-colors active:bg-slate-100/70 ${
                      esAnulado ? 'bg-red-50/30' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base font-extrabold tabular-nums text-slate-900">
                            {notaPad ? (
                              <>
                                <span className="text-[#C8102E]">N°</span>{' '}
                                {notaPad}
                              </>
                            ) : (
                              <span className="italic text-slate-400">
                                Sin Nota
                              </span>
                            )}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums text-slate-700">
                            #{formatPedidoCode(pedido.id_pedido)}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
                          {formatFechaCortaBolivia(
                            pedido.fecha_despacho ?? pedido.fecha_preventa
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {renderEstadoBadge(pedido.estado)}
                        {renderMenuTresPuntos(
                          pedido,
                          abrirHaciaArriba ? 'top' : 'right'
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5">
                      <div className="text-sm font-bold text-slate-900">
                        {pedido.clientes.nombre_comercial}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono font-bold text-slate-800">
                          {pedido.clientes.codigo_cliente_sac}
                        </span>
                        <span>• {pedido.clientes.zona.nombre_zona}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-t border-slate-200/70 pt-1 text-xs text-slate-600">
                        <span>
                          <strong>Vend:</strong>{' '}
                          {pedido.vendedor.nombre_completo}
                        </span>
                        <span>
                          <strong>Desp:</strong>{' '}
                          {pedido.despachador
                            ? pedido.despachador.nombre_completo
                            : 'Pendiente'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-2 pt-0.5">
                      <div className="space-y-0.5 font-mono text-xs tabular-nums">
                        <div className="text-slate-500">
                          Est: {formatKg(resumen.kgEstimados)}
                        </div>
                        <div className="text-sm font-extrabold text-slate-900">
                          Real:{' '}
                          {esPendiente
                            ? '—'
                            : formatKg(resumen.kgRealesTotales)}
                        </div>
                        {resumen.kgCortesia > 0 && (
                          <span className="inline-flex items-center gap-1 rounded border border-[#FFCD00] bg-[#FFCD00]/30 px-1.5 py-0.5 text-[11px] font-bold text-slate-900">
                            +{resumen.kgCortesia.toFixed(3)} kg cort.
                          </span>
                        )}
                      </div>

                      <div className="text-right font-mono tabular-nums">
                        <div className="text-[11px] font-bold uppercase text-slate-500">
                          Total
                        </div>
                        <div
                          className={`text-base font-extrabold ${
                            esAnulado
                              ? 'text-slate-400 line-through decoration-[#C8102E] decoration-2'
                              : 'text-slate-900'
                          }`}
                        >
                          {formatBs(resumen.totalBs)}
                        </div>
                        <span className="mt-0.5 inline-flex items-center gap-0.5 font-sans text-[11px] font-semibold text-[#C8102E]">
                          Tocar para auditar{' '}
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {/* ==================================================================
            PIE DE PAGINACIÓN REAL (10 / 20 / 50 POR PÁGINA)
        ================================================================== */}
        <footer className="flex flex-col justify-between gap-3 border-t-2 border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 sm:text-sm">
            <span className="font-mono tabular-nums">
              Mostrando{' '}
              <strong className="text-slate-900">
                {totalRegistros === 0 ? 0 : indiceInicio + 1}–{indiceFin}
              </strong>{' '}
              de <strong className="text-slate-900">{totalRegistros}</strong>{' '}
              órdenes
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
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Anterior</span>
            </button>

            <span className="rounded-xl bg-slate-900 px-3 py-2 font-mono text-xs font-bold tabular-nums text-white">
              {paginaSegura} / {totalPaginas}
            </span>

            <button
              type="button"
              disabled={paginaSegura >= totalPaginas}
              onClick={() =>
                setPaginaActual((p) => Math.min(totalPaginas, p + 1))
              }
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
            >
              <span>Siguiente</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </section>

      {/* ====================================================================
          MODAL 1: AUDITORÍA COMPLETA DE PEDIDO
      ==================================================================== */}
      {pedidoAuditar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-auditoria-titulo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setPedidoAuditar(null)}
        >
          <div
            className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border-2 border-slate-300 bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-2 w-full shrink-0">
              <div className="w-2/3 bg-[#C8102E]" />
              <div className="w-1/3 bg-[#FFCD00]" />
            </div>

            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#FFCD00]">
                    REGISTRO DE AUDITORÍA
                  </span>
                  {renderEstadoBadge(pedidoAuditar.estado)}
                </div>
                <h2
                  id="modal-auditoria-titulo"
                  className="mt-1.5 font-mono text-lg font-extrabold tabular-nums text-slate-900 sm:text-xl"
                >
                  {formatNota(pedidoAuditar.nro_nota_venta)
                    ? `Nota de Venta N° ${formatNota(pedidoAuditar.nro_nota_venta)}`
                    : 'Pedido sin Nota Asignada'}{' '}
                  <span className="text-base text-slate-500">
                    (#{formatPedidoCode(pedidoAuditar.id_pedido)})
                  </span>
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setPedidoAuditar(null)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                aria-label="Cerrar modal de auditoría"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-5">
              {pedidoAuditar.estado === 'ANULADO' &&
                pedidoAuditar.anulacion && (
                  <div className="space-y-2 rounded-xl border-2 border-[#C8102E] bg-red-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-extrabold text-[#C8102E]">
                        <ShieldAlert
                          className="h-5 w-5 shrink-0"
                          strokeWidth={2.2}
                        />
                        <span>
                          NOTA ANULADA POR REBOTE — REINGRESO KARDEX EJECUTADO
                        </span>
                      </div>
                      <span className="rounded bg-[#C8102E] px-2 py-0.5 font-mono text-xs font-bold text-white">
                        ANU-
                        {String(pedidoAuditar.anulacion.id_anulacion).padStart(
                          3,
                          '0'
                        )}
                      </span>
                    </div>

                    <p className="rounded-lg border border-red-200 bg-white/80 p-3 text-sm text-red-950">
                      <strong>Motivo registrado:</strong>{' '}
                      {pedidoAuditar.anulacion.motivo_rebote}
                    </p>

                    <div className="grid grid-cols-1 gap-2 pt-1 text-xs sm:grid-cols-3">
                      <div className="rounded-lg border border-red-200 bg-white/80 px-3 py-2">
                        <span className="block text-slate-500">
                          Stock Reingresado:
                        </span>
                        <strong className="font-mono text-sm tabular-nums text-emerald-700">
                          +
                          {formatKg(
                            pedidoAuditar.anulacion.kilos_reingresados_total
                          )}
                        </strong>
                      </div>
                      <div className="rounded-lg border border-red-200 bg-white/80 px-3 py-2">
                        <span className="block text-slate-500">
                          Fecha Anulación:
                        </span>
                        <strong className="font-mono tabular-nums text-slate-900">
                          {formatFechaCortaBolivia(
                            pedidoAuditar.anulacion.fecha_anulacion
                          )}
                        </strong>
                      </div>
                      <div className="rounded-lg border border-red-200 bg-white/80 px-3 py-2">
                        <span className="block text-slate-500">
                          Autorizado por:
                        </span>
                        <strong className="text-slate-900">
                          {pedidoAuditar.anulacion.administrador
                            ?.nombre_completo ?? 'Gerencia'}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                    Cliente y Zona
                  </span>
                  <div className="text-sm font-bold text-slate-900">
                    {pedidoAuditar.clientes.nombre_comercial}
                  </div>
                  <div className="text-slate-600">
                    Código SAC:{' '}
                    <strong className="font-mono text-slate-900">
                      {pedidoAuditar.clientes.codigo_cliente_sac}
                    </strong>{' '}
                    • {pedidoAuditar.clientes.zona.nombre_zona}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                    Trazabilidad Operativa
                  </span>
                  <div className="text-slate-700">
                    <strong>Preventa:</strong>{' '}
                    {pedidoAuditar.vendedor.nombre_completo} (
                    <span className="font-mono tabular-nums">
                      {formatFechaCortaBolivia(pedidoAuditar.fecha_preventa)}
                    </span>
                    )
                  </div>
                  <div className="text-slate-700">
                    <strong>Despacho:</strong>{' '}
                    {pedidoAuditar.despachador
                      ? `${pedidoAuditar.despachador.nombre_completo} (${formatFechaCortaBolivia(pedidoAuditar.fecha_despacho)})`
                      : 'Pendiente de pesaje en planta'}
                  </div>
                </div>

                {pedidoAuditar.observaciones && (
                  <div className="border-t border-slate-200 pt-2 text-slate-700 sm:col-span-2">
                    <strong>Observaciones:</strong>{' '}
                    {pedidoAuditar.observaciones}
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex items-center justify-between bg-slate-900 px-3.5 py-2 font-mono text-xs uppercase tracking-wider text-white">
                  <span>Detalle de Ítems y Pesaje Verificado</span>
                  <span>{pedidoAuditar.detalle_pedidos.length} líneas</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 font-mono uppercase text-slate-600">
                        <th className="px-3 py-2.5">Producto / SKU</th>
                        <th className="px-3 py-2.5 text-right">Est. (Kg)</th>
                        <th className="px-3 py-2.5 text-right">Real (Kg)</th>
                        <th className="px-3 py-2.5 text-right">Precio Cong.</th>
                        <th className="px-3 py-2.5 text-right">
                          Subtotal (Bs.)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {pedidoAuditar.detalle_pedidos.map((det) => {
                        const esCort = Boolean(
                          det.es_cortesia ||
                            pedidoAuditar.es_pedido_cortesia_pura
                        );
                        const kilosReales = Number(
                          det.kilos_reales ?? det.kilos_estimados ?? 0
                        );
                        return (
                          <tr
                            key={det.id_detalle}
                            className={esCort ? 'bg-amber-50/60' : 'bg-white'}
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-900">
                                <span>{det.producto.nombre_producto}</span>
                                {esCort && (
                                  <span className="inline-flex items-center gap-1 rounded bg-[#FFCD00] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-slate-950">
                                    <Gift className="h-3 w-3 text-[#C8102E]" />
                                    CORTESÍA
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500">
                                {det.producto.codigo_sku} •{' '}
                                {det.producto.formato}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                              {Number(det.kilos_estimados).toFixed(3)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-slate-900">
                              {pedidoAuditar.estado === 'PENDIENTE'
                                ? '—'
                                : kilosReales.toFixed(3)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                              {esCort
                                ? 'Bs. 0.00'
                                : formatBs(det.precio_unitario_congelado)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-extrabold tabular-nums text-slate-900">
                              {esCort ? 'Bs. 0.00' : formatBs(det.subtotal_bs)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
              <div className="font-mono text-sm tabular-nums">
                <span className="mr-2 text-slate-500">Total Nota:</span>
                <strong
                  className={`text-base font-extrabold ${
                    pedidoAuditar.estado === 'ANULADO'
                      ? 'text-slate-400 line-through'
                      : 'text-[#C8102E]'
                  }`}
                >
                  {formatBs(calcularResumenPedido(pedidoAuditar).totalBs)}
                </strong>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                {pedidoAuditar.estado !== 'ANULADO' && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = pedidoAuditar;
                      setPedidoAuditar(null);
                      abrirModalEdicion(target);
                    }}
                    className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100"
                  >
                    <Edit3 className="h-4 w-4 text-amber-600" />
                    <span>Editar Orden</span>
                  </button>
                )}

                {pedidoAuditar.estado === 'DESPACHADO' &&
                  perfilAdmin.puede_anular_despachos && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = pedidoAuditar;
                        setPedidoAuditar(null);
                        abrirModalAnulacion(target);
                      }}
                      className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border-2 border-red-300 bg-red-50 px-4 text-xs font-extrabold text-[#C8102E] transition-colors hover:bg-[#C8102E] hover:text-white"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Anular Rebote</span>
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() => setPedidoAuditar(null)}
                  className="min-h-[48px] rounded-xl bg-slate-900 px-5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: EDICIÓN CONTROLADA DE ORDEN / PESOS
      ==================================================================== */}
      {pedidoEditar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edicion-titulo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => !guardandoEdicion && setPedidoEditar(null)}
        >
          <div
            className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border-2 border-slate-300 bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-2 w-full shrink-0">
              <div className="w-2/3 bg-slate-900" />
              <div className="w-1/3 bg-[#FFCD00]" />
            </div>

            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <span className="rounded bg-[#FFCD00] px-2 py-0.5 font-mono text-[11px] font-extrabold uppercase tracking-wider text-slate-950">
                  AJUSTE ADMINISTRATIVO
                </span>
                <h2
                  id="modal-edicion-titulo"
                  className="mt-1 font-mono text-lg font-extrabold tabular-nums text-slate-900"
                >
                  Editar Orden #{formatPedidoCode(pedidoEditar.id_pedido)}{' '}
                  {formatNota(pedidoEditar.nro_nota_venta)
                    ? `(Nota N° ${formatNota(pedidoEditar.nro_nota_venta)})`
                    : ''}
                </h2>
              </div>

              <button
                type="button"
                disabled={guardandoEdicion}
                onClick={() => setPedidoEditar(null)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Cerrar edición"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-5">
              {errorEdicion && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border-2 border-red-600 bg-red-50 p-3 text-xs font-extrabold text-red-900"
                >
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <span>{errorEdicion}</span>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                Cliente: <strong>{pedidoEditar.clientes.nombre_comercial}</strong>{' '}
                (
                <span className="font-mono">
                  {pedidoEditar.clientes.codigo_cliente_sac}
                </span>
                )
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
                  Detalle de Productos y Pesaje (Kg)
                </div>
                <div className="space-y-2">
                  {pedidoEditar.detalle_pedidos.map((det) => {
                    const actual = detallesEdit.find(
                      (e) => e.id_detalle === det.id_detalle
                    );
                    return (
                      <div
                        key={det.id_detalle}
                        className="flex flex-col justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white p-3 sm:flex-row sm:items-center"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                            <span>{det.producto.nombre_producto}</span>
                            {det.es_cortesia && (
                              <span className="rounded bg-[#FFCD00] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-slate-950">
                                CORTESÍA
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-xs text-slate-500">
                            {det.producto.codigo_sku} • Precio:{' '}
                            {formatBs(det.precio_unitario_congelado)}/kg
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:w-64">
                          <div>
                            <label className="mb-0.5 block font-mono text-[10px] font-bold uppercase text-slate-500">
                              Kg Estimado
                            </label>
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={
                                actual?.kilos_estimados ?? det.kilos_estimados
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setDetallesEdit((prev) =>
                                  prev.map((item) =>
                                    item.id_detalle === det.id_detalle
                                      ? { ...item, kilos_estimados: val }
                                      : item
                                  )
                                );
                              }}
                              className="min-h-[44px] w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-2.5 font-mono text-sm font-bold tabular-nums text-slate-900 focus:border-[#C8102E] focus:bg-white focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="mb-0.5 block font-mono text-[10px] font-bold uppercase text-slate-500">
                              Kg Real
                            </label>
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              disabled={pedidoEditar.estado === 'PENDIENTE'}
                              value={
                                actual?.kilos_reales ??
                                Number(
                                  det.kilos_reales ?? det.kilos_estimados ?? 0
                                )
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setDetallesEdit((prev) =>
                                  prev.map((item) =>
                                    item.id_detalle === det.id_detalle
                                      ? { ...item, kilos_reales: val }
                                      : item
                                  )
                                );
                              }}
                              className="min-h-[44px] w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-2.5 font-mono text-sm font-bold tabular-nums text-slate-900 focus:border-[#C8102E] focus:bg-white focus:outline-none disabled:opacity-45"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="obs-editar-input"
                  className="text-xs font-extrabold uppercase tracking-wide text-slate-800"
                >
                  Observaciones de Auditoría / Despacho
                </label>
                <textarea
                  id="obs-editar-input"
                  value={observacionesEdit}
                  onChange={(e) => setObservacionesEdit(e.target.value)}
                  placeholder="Notas operativas de la orden..."
                  className="min-h-[84px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 p-3 text-base text-slate-900 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPedidoEditar(null)}
                disabled={guardandoEdicion}
                className="min-h-[48px] rounded-xl border-2 border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoEdicion}
                onClick={guardarEdicionPedido}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-b-4 border-[#FFCD00] bg-slate-900 px-5 text-xs font-extrabold text-white transition-all hover:bg-slate-800 active:translate-y-[2px] disabled:opacity-50 sm:text-sm"
              >
                <Check className="h-4 w-4 text-[#FFCD00]" strokeWidth={2.5} />
                <span>
                  {guardandoEdicion ? 'Guardando...' : 'Guardar Cambios'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: ANULACIÓN POR REBOTE EN 2 PASOS (RF-15, CU-A02)
      ==================================================================== */}
      {pedidoAnular && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-rebote-titulo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => !procesandoAnulacion && setPedidoAnular(null)}
        >
          <div
            className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl border-2 border-slate-300 bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-2 w-full shrink-0 bg-[#C8102E]" />

            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-red-50/60 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C8102E] text-white">
                  <AlertTriangle className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#C8102E]">
                      CU-A02 • SOFT DELETE + KARDEX
                    </span>
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-extrabold text-[#FFCD00]">
                      Paso {pasoAnulacion} de 2
                    </span>
                  </div>
                  <h2
                    id="modal-rebote-titulo"
                    className="mt-0.5 text-lg font-extrabold text-slate-900"
                  >
                    {pasoAnulacion === 1
                      ? 'Registrar Motivo de Rebote'
                      : 'Confirmación Final de Anulación'}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                disabled={procesandoAnulacion}
                onClick={() => setPedidoAnular(null)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Cancelar anulación"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {pasoAnulacion === 1 ? (
              <>
                <div className="space-y-4 overflow-y-auto p-5">
                  <div className="rounded-r-xl border-l-4 border-[#FFCD00] bg-amber-50 p-3.5 text-sm leading-relaxed text-slate-800">
                    Vas a iniciar la anulación de la{' '}
                    <strong className="font-mono">
                      Nota N°{' '}
                      {formatNota(pedidoAnular.nro_nota_venta) ??
                        formatPedidoCode(pedidoAnular.id_pedido)}
                    </strong>{' '}
                    ({pedidoAnular.clientes.nombre_comercial}). Se reingresarán{' '}
                    <strong className="font-mono tabular-nums text-[#C8102E]">
                      {formatKg(
                        calcularResumenPedido(pedidoAnular).kgRealesTotales
                      )}
                    </strong>{' '}
                    al inventario físico mediante Kardex.
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="flex justify-between bg-slate-100 px-3.5 py-2 font-mono text-[11px] font-bold uppercase text-slate-600">
                      <span>Producto a reingresar a stock_fisico_kilos</span>
                      <span>Kilos Reales</span>
                    </div>
                    <ul className="divide-y divide-slate-200 text-xs">
                      {pedidoAnular.detalle_pedidos.map((det) => {
                        const kilosDevolver = Number(
                          det.kilos_reales ?? det.kilos_estimados ?? 0
                        );
                        return (
                          <li
                            key={det.id_detalle}
                            className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5"
                          >
                            <div>
                              <span className="font-bold text-slate-900">
                                {det.producto.nombre_producto}
                              </span>
                              {det.es_cortesia && (
                                <span className="ml-2 rounded bg-[#FFCD00]/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-900">
                                  Cortesía
                                </span>
                              )}
                              <span className="block font-mono text-[11px] text-slate-500">
                                {det.producto.codigo_sku}
                              </span>
                            </div>
                            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono font-extrabold tabular-nums text-emerald-700">
                              +{formatKg(kilosDevolver)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="motivo-rebote-input"
                        className="text-xs font-extrabold uppercase tracking-wide text-slate-800"
                      >
                        Motivo del Rebote / Devolución{' '}
                        <span className="text-[#C8102E]">*</span>
                      </label>
                      <span
                        className={`font-mono text-[11px] font-bold tabular-nums ${
                          motivoRebote.trim().length >= 10
                            ? 'text-emerald-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {motivoRebote.trim().length}/10 mín.
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {MOTIVOS_FRECUENTES.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setMotivoRebote(chip)}
                          className="min-h-[36px] rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200/70"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>

                    <textarea
                      id="motivo-rebote-input"
                      value={motivoRebote}
                      onChange={(e) => setMotivoRebote(e.target.value)}
                      placeholder="Describa el motivo detallado de la devolución en ruta o rechazo del cliente (mínimo 10 caracteres)..."
                      className="min-h-[96px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 p-3 text-base text-slate-900 shadow-inner transition-all placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setPedidoAnular(null)}
                    className="min-h-[48px] rounded-xl border-2 border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={motivoRebote.trim().length < 10}
                    onClick={() => {
                      setConfirmacionSegura(false);
                      setErrorAnulacion(null);
                      setPasoAnulacion(2);
                    }}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-b-4 border-[#FFCD00] bg-slate-900 px-5 text-xs font-extrabold text-white transition-all hover:bg-slate-800 active:translate-y-[2px] disabled:pointer-events-none disabled:opacity-45 sm:text-sm"
                  >
                    <span>Continuar a Verificación</span>
                    <ChevronRight
                      className="h-4 w-4 text-[#FFCD00]"
                      strokeWidth={2.5}
                    />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4 overflow-y-auto p-5">
                  {errorAnulacion && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border-2 border-red-600 bg-red-50 p-3 text-xs font-extrabold text-red-900"
                    >
                      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                      <span>{errorAnulacion}</span>
                    </div>
                  )}

                  <div className="space-y-3 rounded-2xl border-2 border-[#C8102E] bg-red-50 p-4">
                    <div className="flex items-center gap-2.5 text-[#C8102E]">
                      <ShieldAlert
                        className="h-6 w-6 shrink-0"
                        strokeWidth={2.4}
                      />
                      <h3 className="text-base font-extrabold">
                        ¿Estás completamente seguro de anular esta venta?
                      </h3>
                    </div>

                    <p className="text-xs leading-relaxed text-red-950 sm:text-sm">
                      Esta operación marcará la nota como{' '}
                      <strong>ANULADA (Soft Delete)</strong>, la descontará del
                      total facturado en Bolivianos y devolverá el peso físico al
                      stock de cámara bajo tu usuario administrador (
                      <strong>{perfilAdmin.nombre_completo}</strong>).
                    </p>

                    <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                      <div className="rounded-xl border border-red-200 bg-white p-3">
                        <span className="block text-slate-500">
                          Nota / Orden:
                        </span>
                        <strong className="font-mono text-sm tabular-nums text-slate-900">
                          {formatNota(pedidoAnular.nro_nota_venta)
                            ? `N° ${formatNota(pedidoAnular.nro_nota_venta)}`
                            : `#${formatPedidoCode(pedidoAnular.id_pedido)}`}
                        </strong>
                      </div>
                      <div className="rounded-xl border border-red-200 bg-white p-3">
                        <span className="block text-slate-500">
                          Monto Anulado:
                        </span>
                        <strong className="font-mono text-sm tabular-nums text-[#C8102E]">
                          {formatBs(
                            calcularResumenPedido(pedidoAnular).totalBs
                          )}
                        </strong>
                      </div>
                      <div className="col-span-2 flex items-center justify-between rounded-xl border border-red-200 bg-white p-3">
                        <span className="font-medium text-slate-600">
                          Reingreso automático Kardex:
                        </span>
                        <strong className="font-mono text-sm tabular-nums text-emerald-700">
                          +
                          {formatKg(
                            calcularResumenPedido(pedidoAnular).kgRealesTotales
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="rounded-xl border border-red-200 bg-white p-3 text-xs text-slate-700">
                      <span className="mb-0.5 block font-mono text-[10px] font-bold uppercase text-slate-400">
                        Motivo declarado:
                      </span>
                      &ldquo;{motivoRebote.trim()}&rdquo;
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-slate-300 bg-slate-50 p-3.5 transition-colors select-none hover:bg-slate-100/80">
                    <input
                      type="checkbox"
                      checked={confirmacionSegura}
                      onChange={(e) => setConfirmacionSegura(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-slate-400 text-[#C8102E] focus:ring-[#FFCD00]"
                    />
                    <span className="text-xs leading-snug font-bold text-slate-900 sm:text-sm">
                      Sí, confirmo que la mercadería retornó físicamente y
                      autorizo anular la venta y reingresar el stock al Kardex.
                    </span>
                  </label>
                </div>

                <div className="flex flex-col-reverse gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setPasoAnulacion(1)}
                    disabled={procesandoAnulacion}
                    className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Volver y revisar motivo</span>
                  </button>

                  <button
                    type="button"
                    disabled={!confirmacionSegura || procesandoAnulacion}
                    onClick={confirmarAnulacionRebote}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-5 text-xs font-extrabold text-white transition-all active:translate-y-[2px] active:border-b-2 disabled:pointer-events-none disabled:opacity-40 sm:text-sm"
                  >
                    <ShieldCheck className="h-4 w-4" strokeWidth={2.4} />
                    <span>
                      {procesandoAnulacion
                        ? 'Procesando Kardex...'
                        : 'Sí, Anular Venta Definitivamente'}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
