'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Edit3,
  FileText,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  RotateCcw,
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
import type { FormatoProductoEnum, TipoVenta } from '@/types/database.types';

export interface PreventaMobileFormProps {
  idVendedor?: number;
  clientesIniciales: ClientePreventaItem[];
  zonas: ZonaPreventaItem[];
  productos: ProductoPreventaItem[];
  categorias: CategoriaPreventaItem[];
  codigoVendedor: string;
  metaDiariaKilos: number;
}

interface PreventaDraftV1 {
  clienteSeleccionadoId: number | null;
  itemsCarrito: Record<number, number>;
  tipoVenta: TipoVenta;
  plazoDias: number;
  observaciones: string;
}

interface LineaPreventa {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  es_por_unidad: boolean;
  peso_unidad_kilos: number;
  unidades: number;
  precio_kilo_bs: number;
  kilos_estimados: number;
  requiere_produccion: boolean;
}

const CLIENTES_PAGE_SIZE = 40;
const PLAZOS_RAPIDOS_DIAS = [7, 15, 30] as const;

function formatearBs(monto: number): string {
  return `Bs. ${monto.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatearKilos(kilos: number, dec = 3): string {
  return kilos.toLocaleString('es-BO', {
    minimumFractionDigits: Number.isInteger(kilos) ? 0 : dec,
    maximumFractionDigits: dec,
  });
}

function normalizarTextoBusqueda(valor: string | null | undefined): string {
  if (!valor) return '';
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function esProductoPorUnidad(producto: ProductoPreventaItem): boolean {
  return String(producto.unidad_medida ?? 'KILO').toUpperCase() === 'UNIDAD';
}

function getPesoUnidadKilos(producto: ProductoPreventaItem): number {
  const peso = Number(producto.peso_unidad_kilos ?? 1);
  return Number.isFinite(peso) && peso > 0 ? peso : 1;
}

function etiquetaZonaCliente(cliente: ClientePreventaItem): string {
  const zona = cliente.zona?.trim() ?? '';
  const loc = cliente.localidad?.trim() ?? '';
  if (loc && zona && loc.toLowerCase() !== zona.toLowerCase()) {
    return `${zona} · ${loc}`;
  }
  return loc || zona || 'Sin zona asignada';
}

export const PreventaMobileForm: React.FC<PreventaMobileFormProps> = ({
  idVendedor,
  clientesIniciales,
  zonas: zonasIniciales,
  productos,
  categorias,
  codigoVendedor,
  metaDiariaKilos,
}) => {
  const router = useRouter();
  const draftStorageKey = `euroalimentos_preventa_draft_v1_${idVendedor ?? codigoVendedor}`;

  const [pasoActivo, setPasoActivo] = useState<
    'cliente' | 'catalogo' | 'detalle'
  >('cliente');

  // --- Estado de Clientes, Bottom Sheet (352 clientes) y Condición de Pago ---
  const [clientes, setClientes] =
    useState<ClientePreventaItem[]>(clientesIniciales);
  const [zonasLista, setZonasLista] =
    useState<ZonaPreventaItem[]>(zonasIniciales);
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<ClientePreventaItem | null>(null);

  const [sheetClienteOpen, setSheetClienteOpen] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [filtroZonaCliente, setFiltroZonaCliente] = useState<string>('TODAS');
  const [limiteClientesVisibles, setLimiteClientesVisibles] =
    useState<number>(CLIENTES_PAGE_SIZE);

  // --- Condición de Pago del Pedido ---
  const [tipoVenta, setTipoVenta] = useState<TipoVenta>('CONTADO');
  const [plazoDias, setPlazoDias] = useState<number>(0);

  // --- Estado de Modal Nuevo Cliente ---
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [modalResetKey, setModalResetKey] = useState(0);
  const [nombreInicialModal, setNombreInicialModal] = useState('');

  // --- Estado de Catálogo (KILO o UNIDAD entera) ---
  const [filtroFormato, setFiltroFormato] = useState<
    'TODOS' | 'GRANEL' | 'VACIO'
  >('TODOS');
  const [filtroCategoria, setFiltroCategoria] = useState<number | 'TODAS'>(
    'TODAS'
  );
  const [busquedaProducto, setBusquedaProducto] = useState('');
  // Almacena cantidad entera ingresada: kilos para 'KILO', unidades/paquetes para 'UNIDAD'
  const [cantidadPorProducto, setCantidadPorProducto] = useState<
    Record<number, number>
  >({});

  // --- Estado de Observaciones, Persistencia y Envío ---
  const [observaciones, setObservaciones] = useState('');
  const [hidratacionLista, setHidratacionLista] = useState(false);
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const [enviandoPreventa, setEnviandoPreventa] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tipo: 'ok' | 'error';
    mensaje: string;
    idPedido?: number;
  } | null>(null);

  // --- Hidratación Segura desde localStorage (aislada por vendedor) ---
  useEffect(() => {
    let cancelado = false;
    queueMicrotask(() => {
      if (cancelado) return;
      try {
        const raw = window.localStorage.getItem(draftStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PreventaDraftV1>;
          const clienteValido =
            typeof parsed.clienteSeleccionadoId === 'number'
              ? (clientesIniciales.find(
                  (c) => c.id_cliente === parsed.clienteSeleccionadoId
                ) ?? null)
              : null;

          const productosVigentesSet = new Set(
            productos.map((p) => p.id_producto)
          );
          const itemsValidos: Record<number, number> = {};
          if (parsed.itemsCarrito && typeof parsed.itemsCarrito === 'object') {
            for (const [idStr, cantRaw] of Object.entries(
              parsed.itemsCarrito
            )) {
              const idProd = Number(idStr);
              const cantNum = Math.floor(Number(cantRaw));
              if (
                productosVigentesSet.has(idProd) &&
                Number.isFinite(cantNum) &&
                cantNum > 0
              ) {
                itemsValidos[idProd] = cantNum;
              }
            }
          }

          const obsValida =
            typeof parsed.observaciones === 'string'
              ? parsed.observaciones
              : '';
          const tipoVentaValido: TipoVenta =
            parsed.tipoVenta === 'CREDITO' ? 'CREDITO' : 'CONTADO';
          const plazoNum = Math.trunc(Number(parsed.plazoDias ?? 0));
          const plazoValido =
            tipoVentaValido === 'CREDITO'
              ? plazoNum > 0
                ? plazoNum
                : clienteValido?.plazo_dias && clienteValido.plazo_dias > 0
                  ? clienteValido.plazo_dias
                  : 7
              : 0;

          const hayContenido =
            clienteValido !== null ||
            Object.keys(itemsValidos).length > 0 ||
            obsValida.trim().length > 0;

          if (hayContenido) {
            if (clienteValido) setClienteSeleccionado(clienteValido);
            if (Object.keys(itemsValidos).length > 0) {
              setCantidadPorProducto(itemsValidos);
            }
            setTipoVenta(tipoVentaValido);
            setPlazoDias(plazoValido);
            if (obsValida) setObservaciones(obsValida);
            setBorradorRestaurado(true);
          }
        }
      } catch {
        // Ignorar borradores corruptos en localStorage
      } finally {
        if (!cancelado) setHidratacionLista(true);
      }
    });

    return () => {
      cancelado = true;
    };
    // Solo al montar o cambiar de clave de vendedor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey]);

  // --- Auto-guardado en localStorage al modificar cliente, ítems, pago u obs ---
  useEffect(() => {
    if (!hidratacionLista) return;
    try {
      const sinContenido =
        !clienteSeleccionado &&
        Object.keys(cantidadPorProducto).length === 0 &&
        !observaciones.trim();

      if (sinContenido) {
        window.localStorage.removeItem(draftStorageKey);
        return;
      }

      const payload: PreventaDraftV1 = {
        clienteSeleccionadoId: clienteSeleccionado?.id_cliente ?? null,
        itemsCarrito: cantidadPorProducto,
        tipoVenta,
        plazoDias,
        observaciones,
      };
      window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    } catch {
      // Ignorar errores de cuota de almacenamiento
    }
  }, [
    hidratacionLista,
    draftStorageKey,
    clienteSeleccionado,
    cantidadPorProducto,
    tipoVenta,
    plazoDias,
    observaciones,
  ]);

  const handleDescartarBorrador = () => {
    try {
      window.localStorage.removeItem(draftStorageKey);
    } catch {
      // No-op
    }
    setClienteSeleccionado(null);
    setCantidadPorProducto({});
    setTipoVenta('CONTADO');
    setPlazoDias(0);
    setObservaciones('');
    setBorradorRestaurado(false);
    setPasoActivo('cliente');
    setFeedbackBanner(null);
  };

  // --- Opciones rápidas de Zona / Localidad desde los clientes reales ---
  const opcionesZonaLocalidad = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const c of clientes) {
      const z = c.zona?.trim();
      if (z) conteo.set(z, (conteo.get(z) ?? 0) + 1);
      const l = c.localidad?.trim();
      if (l && l.toLowerCase() !== z?.toLowerCase()) {
        conteo.set(l, (conteo.get(l) ?? 0) + 1);
      }
    }
    return Array.from(conteo.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .map(([nombre, count]) => ({ nombre, count }));
  }, [clientes]);

  // --- Filtrado Instantáneo de Clientes (sin lag) ---
  const clientesFiltrados = useMemo(() => {
    const q = normalizarTextoBusqueda(busquedaCliente);
    const zonaFiltroNorm =
      filtroZonaCliente === 'TODAS'
        ? ''
        : normalizarTextoBusqueda(filtroZonaCliente);

    return clientes.filter((c) => {
      if (zonaFiltroNorm) {
        const zNorm = normalizarTextoBusqueda(c.zona);
        const lNorm = normalizarTextoBusqueda(c.localidad);
        if (zNorm !== zonaFiltroNorm && lNorm !== zonaFiltroNorm) {
          return false;
        }
      }
      if (!q) return true;
      return (
        normalizarTextoBusqueda(c.nombre_comercial).includes(q) ||
        normalizarTextoBusqueda(c.codigo_cliente_sac).includes(q) ||
        normalizarTextoBusqueda(c.razon_social).includes(q) ||
        normalizarTextoBusqueda(c.localidad).includes(q) ||
        normalizarTextoBusqueda(c.zona).includes(q) ||
        normalizarTextoBusqueda(c.nit_ci).includes(q) ||
        normalizarTextoBusqueda(c.telefono).includes(q)
      );
    });
  }, [clientes, busquedaCliente, filtroZonaCliente]);

  const clientesVisibles = useMemo(
    () => clientesFiltrados.slice(0, limiteClientesVisibles),
    [clientesFiltrados, limiteClientesVisibles]
  );

  // --- Filtrado de Productos ---
  const productosFiltrados = useMemo(() => {
    const q = normalizarTextoBusqueda(busquedaProducto);
    return productos.filter((p) => {
      const cumpleFormato =
        filtroFormato === 'TODOS' || p.formato === filtroFormato;
      const cumpleCategoria =
        filtroCategoria === 'TODAS' || p.id_categoria === filtroCategoria;
      const cumpleTexto =
        !q ||
        normalizarTextoBusqueda(p.nombre_producto).includes(q) ||
        normalizarTextoBusqueda(p.codigo_sku).includes(q) ||
        normalizarTextoBusqueda(
          p.categorias_producto?.nombre_categoria
        ).includes(q);
      return cumpleFormato && cumpleCategoria && cumpleTexto;
    });
  }, [productos, filtroFormato, filtroCategoria, busquedaProducto]);

  // --- Líneas Activas y Totales ---
  const lineasActivas: LineaPreventa[] = useMemo(() => {
    return productos
      .filter((p) => (cantidadPorProducto[p.id_producto] ?? 0) > 0)
      .map((p) => {
        const cantidadIngresada = cantidadPorProducto[p.id_producto];
        const esUnidad = esProductoPorUnidad(p);
        const pesoUnidad = getPesoUnidadKilos(p);
        const kilosEstimados = esUnidad
          ? Number((cantidadIngresada * pesoUnidad).toFixed(3))
          : cantidadIngresada;

        return {
          id_producto: p.id_producto,
          codigo_sku: p.codigo_sku,
          nombre_producto: p.nombre_producto,
          formato: p.formato,
          es_por_unidad: esUnidad,
          peso_unidad_kilos: pesoUnidad,
          unidades: esUnidad ? cantidadIngresada : 0,
          precio_kilo_bs: p.precio_kilo_bs,
          kilos_estimados: kilosEstimados,
          requiere_produccion: p.requiere_produccion,
        };
      });
  }, [productos, cantidadPorProducto]);

  const totales = useMemo(() => {
    return lineasActivas.reduce(
      (acc, item) => {
        acc.totalKilos = Number(
          (acc.totalKilos + item.kilos_estimados).toFixed(3)
        );
        acc.totalBs = Number(
          (acc.totalBs + item.kilos_estimados * item.precio_kilo_bs).toFixed(2)
        );
        if (item.requiere_produccion) acc.itemsProduccion += 1;
        return acc;
      },
      { totalKilos: 0, totalBs: 0, itemsProduccion: 0 }
    );
  }, [lineasActivas]);

  // --- Manipuladores de Cantidad Entera (Kg o Unidades) ---
  const actualizarCantidad = (idProducto: number, nuevoValor: number) => {
    const entero = Math.max(
      0,
      Math.floor(Number.isFinite(nuevoValor) ? nuevoValor : 0)
    );
    setCantidadPorProducto((prev) => {
      const next = { ...prev };
      if (entero === 0) {
        delete next[idProducto];
      } else {
        next[idProducto] = entero;
      }
      return next;
    });
  };

  const incrementarCantidad = (idProducto: number, delta: number) => {
    const actual = cantidadPorProducto[idProducto] ?? 0;
    actualizarCantidad(idProducto, actual + delta);
  };

  // --- Selección de Cliente + Preselección Condición de Pago ---
  const aplicarClienteSeleccionado = (
    cliente: ClientePreventaItem,
    avanzarCatalogo = false
  ) => {
    setClienteSeleccionado(cliente);
    const formaHabitual: TipoVenta =
      cliente.forma_pago_habitual === 'CREDITO' ? 'CREDITO' : 'CONTADO';
    setTipoVenta(formaHabitual);
    setPlazoDias(
      formaHabitual === 'CREDITO'
        ? cliente.plazo_dias && cliente.plazo_dias > 0
          ? cliente.plazo_dias
          : 7
        : 0
    );
    setFeedbackBanner(null);
    setSheetClienteOpen(false);
    if (avanzarCatalogo) {
      setPasoActivo('catalogo');
    }
  };

  const handleCambiarTipoVenta = (nuevoTipo: TipoVenta) => {
    setTipoVenta(nuevoTipo);
    if (nuevoTipo === 'CONTADO') {
      setPlazoDias(0);
    } else {
      const plazoCliente = clienteSeleccionado?.plazo_dias ?? 0;
      setPlazoDias((prev) =>
        prev > 0 ? prev : plazoCliente > 0 ? plazoCliente : 7
      );
    }
  };

  const abrirSheetClientes = () => {
    setLimiteClientesVisibles(CLIENTES_PAGE_SIZE);
    setSheetClienteOpen(true);
  };

  const abrirModalNuevoCliente = (nombrePrefill = '') => {
    setSheetClienteOpen(false);
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
    aplicarClienteSeleccionado(clienteCreado, true);
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
        mensaje: 'Agregue al menos un producto al pedido.',
      });
      setPasoActivo('catalogo');
      return;
    }

    if (tipoVenta === 'CREDITO' && (!Number.isFinite(plazoDias) || plazoDias <= 0)) {
      setFeedbackBanner({
        tipo: 'error',
        mensaje: 'Indique los días de plazo para un pedido a CRÉDITO.',
      });
      setPasoActivo('detalle');
      return;
    }

    setFeedbackBanner(null);
    setEnviandoPreventa(true);

    try {
      const resultado = await registrarPreventaAction({
        id_cliente: clienteSeleccionado.id_cliente,
        observaciones: observaciones.trim(),
        tipo_venta: tipoVenta,
        plazo_dias: tipoVenta === 'CREDITO' ? plazoDias : 0,
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
        mensaje: `Preventa #${resultado.id_pedido} (${tipoVenta}${tipoVenta === 'CREDITO' ? ` ${plazoDias}d` : ''}) registrada: ${clienteSeleccionado.nombre_comercial} · ${formatearKilos(totales.totalKilos)} kg · ${formatearBs(totales.totalBs)}`,
      });

      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // No-op
      }
      setBorradorRestaurado(false);
      setCantidadPorProducto({});
      setObservaciones('');
      setClienteSeleccionado(null);
      setTipoVenta('CONTADO');
      setPlazoDias(0);
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

  // --- Bloque reutilizable de Ficha Comercial + Banner de Observación ---
  const renderFichaClienteCompacta = (cliente: ClientePreventaItem) => {
    const obsComercial = cliente.observaciones?.trim() ?? '';
    const reglaCortesia = cliente.regla_cortesia_habitual?.trim() ?? '';
    const mostrarRazon =
      Boolean(cliente.razon_social?.trim()) &&
      cliente.razon_social?.trim().toLowerCase() !==
        cliente.nombre_comercial.trim().toLowerCase();

    return (
      <div className="space-y-2.5">
        <div className="rounded-xl border border-emerald-600/30 bg-emerald-50/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
              <span className="shrink-0 whitespace-nowrap rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-black text-[#FFCD00]">
                {cliente.codigo_cliente_sac}
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                cliente.forma_pago_habitual === 'CREDITO'
                  ? 'bg-sky-100 text-sky-900'
                  : 'bg-slate-200 text-slate-800'
              }`}
            >
              {cliente.forma_pago_habitual === 'CREDITO' ? (
                <>
                  <CreditCard className="h-3 w-3" />
                  <span>
                    Habitual: Crédito ({cliente.plazo_dias || 7}d)
                  </span>
                </>
              ) : (
                <>
                  <Banknote className="h-3 w-3" />
                  <span>Habitual: Contado</span>
                </>
              )}
            </span>
          </div>

          <p className="mt-1.5 text-sm font-black leading-snug text-slate-950">
            {cliente.nombre_comercial}
          </p>
          {mostrarRazon && (
            <p className="text-[11px] font-semibold text-slate-600">
              Razón Social: {cliente.razon_social}
            </p>
          )}

          <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-slate-700">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C8102E]" />
            <span>{etiquetaZonaCliente(cliente)}</span>
          </p>

          {cliente.direccion && (
            <p className="mt-0.5 pl-5 text-[11px] font-medium text-slate-600">
              Dir.: {cliente.direccion}
            </p>
          )}

          {(cliente.nit_ci || cliente.telefono) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] font-bold text-slate-500">
              {cliente.nit_ci && <span>NIT/CI: {cliente.nit_ci}</span>}
              {cliente.telefono && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400" />
                  {cliente.telefono}
                </span>
              )}
            </div>
          )}
        </div>

        {(obsComercial || reglaCortesia) && (
          <div
            role="note"
            className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-950"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0 space-y-0.5">
              {reglaCortesia && (
                <div>
                  <p className="font-black uppercase tracking-tight text-[#9E0B22]">
                    Regla de Cortesía: {reglaCortesia}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold italic text-amber-800">
                    Informativo — Despacho cargará esta cortesía a 0.00 Bs
                  </p>
                </div>
              )}
              {obsComercial && obsComercial !== reglaCortesia && (
                <p className="font-semibold leading-snug">
                  Obs. Comercial: {obsComercial}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- Selector de Condición de Pago Reutilizable ---
  const renderSelectorCondicionPago = (compact = false) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
          Condición de Pago del Pedido
        </span>
        {clienteSeleccionado &&
          (clienteSeleccionado.limite_credito_bs ?? 0) > 0 && (
            <span className="font-mono text-[10px] font-bold text-slate-500">
              Límite: {formatearBs(clienteSeleccionado.limite_credito_bs ?? 0)}
            </span>
          )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleCambiarTipoVenta('CONTADO')}
          className={`touch-manipulation flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-xs font-black uppercase transition ${
            tipoVenta === 'CONTADO'
              ? 'border-slate-950 bg-slate-900 text-[#FFCD00] shadow-sm'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Banknote className="h-4 w-4 shrink-0" strokeWidth={2.3} />
          <span>CONTADO</span>
        </button>

        <button
          type="button"
          onClick={() => handleCambiarTipoVenta('CREDITO')}
          className={`touch-manipulation flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-xs font-black uppercase transition ${
            tipoVenta === 'CREDITO'
              ? 'border-[#C8102E] bg-[#C8102E] text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="h-4 w-4 shrink-0" strokeWidth={2.3} />
          <span>CRÉDITO</span>
        </button>
      </div>

      {tipoVenta === 'CREDITO' && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#C8102E]" />
            <span className="text-[11px] font-extrabold text-slate-700">
              Plazo (días):
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PLAZOS_RAPIDOS_DIAS.map((dias) => (
              <button
                key={dias}
                type="button"
                onClick={() => setPlazoDias(dias)}
                className={`touch-manipulation min-h-[44px] rounded-lg border px-3 font-mono text-xs font-black transition ${
                  plazoDias === dias
                    ? 'border-slate-900 bg-[#FFCD00] text-slate-950'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {dias}d
              </button>
            ))}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Días de plazo de crédito"
              value={plazoDias === 0 ? '' : String(plazoDias)}
              onChange={(e) => {
                const dig = e.target.value.replace(/\D/g, '');
                setPlazoDias(dig === '' ? 0 : Number.parseInt(dig, 10));
              }}
              className={`min-h-[44px] rounded-lg border-2 border-slate-300 bg-white px-2 text-center font-mono text-xs font-black text-slate-900 focus:border-[#C8102E] focus:outline-none ${
                compact ? 'w-16' : 'w-20'
              }`}
              placeholder="días"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative flex w-full flex-col overflow-x-hidden rounded-2xl bg-[#F1F5F9]/80 pb-28 text-slate-900 md:pb-24 lg:h-[calc(100dvh-5rem)] lg:max-h-[840px] lg:overflow-hidden lg:pb-0">
      <CharcuteriePatternBg variant="canvas" idSuffix="bg-canvas" />

      <div className="relative z-10 flex h-full w-full flex-1 flex-col lg:overflow-hidden">
        {/* ==================================================================
            CABECERA COMPACTA SOBRE BLANCO
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
                <span>
                  Productos ({formatearKilos(totales.totalKilos)} kg)
                </span>
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
              <span className="inline-flex items-center gap-1 font-mono text-[10px]">
                {clienteSeleccionado && <Check className="h-3 w-3" />}
                01
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
                02 · {formatearKilos(totales.totalKilos)} kg
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
            BANNER SUTIL DE BORRADOR RESTAURADO (localStorage)
           ================================================================== */}
        {borradorRestaurado && (
          <div
            role="status"
            className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50/95 px-3.5 py-2 text-xs text-amber-950 shadow-2xs"
          >
            <div className="flex items-center gap-2 font-bold">
              <RotateCcw className="h-3.5 w-3.5 shrink-0 text-amber-700" />
              <span>Borrador restaurado automáticamente</span>
            </div>
            <button
              type="button"
              onClick={handleDescartarBorrador}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 text-xs font-extrabold text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-[#C8102E]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Descartar borrador</span>
            </button>
          </div>
        )}

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
            ESPACIO DE 3 PANELES TIPO ACORDEÓN EN PC · PASOS EN MÓVIL
           ================================================================== */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
          {/* ----------------------------------------------------------------
              PANEL 01: CLIENTE + SELECTOR BOTTOM SHEET + CONDICIÓN DE PAGO
             ---------------------------------------------------------------- */}
          <section
            aria-labelledby="paso-cliente-titulo"
            className={`relative flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all duration-300 ease-out ${
              pasoActivo === 'cliente'
                ? 'flex min-h-0 flex-1 border-[#C8102E] lg:h-full lg:min-w-0 lg:flex-1'
                : 'hidden border-slate-200/90 lg:flex lg:h-full lg:w-[270px] lg:shrink-0 xl:w-[290px]'
            }`}
          >
            <CharcuteriePatternBg variant="card" idSuffix="card-cliente" />
            <PlantCardHeaderStrip />

            {pasoActivo === 'cliente' ? (
              <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
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
                        Cliente y Pago
                      </h2>
                      <p className="text-[11px] font-medium text-slate-500">
                        Cartera activa: {clientes.length} clientes SAC
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
                      <span>Nuevo</span>
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

                {/* Trigger Táctil Principal del Bottom Sheet de Clientes */}
                <button
                  type="button"
                  onClick={abrirSheetClientes}
                  className="touch-manipulation mt-3.5 flex min-h-[54px] w-full shrink-0 items-center justify-between gap-3 rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-left shadow-2xs transition hover:border-[#C8102E] active:scale-[0.99]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#C8102E]">
                      <Search className="h-5 w-5" strokeWidth={2.3} />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                        {clienteSeleccionado
                          ? 'Cliente Seleccionado (Tocar para cambiar)'
                          : 'Buscar en los 352 clientes SAC'}
                      </span>
                      <span className="block truncate text-sm font-black text-slate-900 sm:text-base">
                        {clienteSeleccionado
                          ? `${clienteSeleccionado.codigo_cliente_sac} — ${clienteSeleccionado.nombre_comercial}`
                          : 'Tocar para buscar cliente por nombre, código o zona...'}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                </button>

                {/* Ficha Comercial Compacta + Banner de Observación + Condición de Pago */}
                <div className="mt-3.5 space-y-3">
                  {clienteSeleccionado ? (
                    <>
                      {renderFichaClienteCompacta(clienteSeleccionado)}
                      {renderSelectorCondicionPago(false)}

                      <button
                        type="button"
                        onClick={() => setPasoActivo('catalogo')}
                        className="touch-manipulation flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border-b-4 border-slate-950 bg-slate-900 px-4 text-sm font-black uppercase text-[#FFCD00] shadow-sm transition active:translate-y-[1px]"
                      >
                        <ShoppingBag className="h-4 w-4" />
                        <span>Continuar al Catálogo</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-5 text-center">
                      <Store className="mx-auto h-8 w-8 text-slate-400" />
                      <p className="mt-2 text-sm font-black text-slate-800">
                        Ningún cliente seleccionado aún
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        Abre el selector táctil arriba para filtrar por código
                        SAC, nombre comercial, razón social o localidad.
                      </p>
                      <button
                        type="button"
                        onClick={abrirSheetClientes}
                        className="touch-manipulation mt-3 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#C8102E] px-4 text-xs font-black uppercase text-white shadow-sm"
                      >
                        <Search className="h-4 w-4 text-[#FFCD00]" />
                        <span>Buscar Cliente ({clientes.length})</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* --- VISTA MINIMIZADA LATERAL DE CLIENTE --- */
              <div className="relative z-10 flex flex-1 flex-col justify-between overflow-y-auto p-3.5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-black ${
                          clienteSeleccionado
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {clienteSeleccionado ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
                        ) : (
                          '01'
                        )}
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
                      onClick={abrirSheetClientes}
                      className="touch-manipulation inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-black text-[#C8102E] hover:bg-red-50"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>
                        {clienteSeleccionado ? 'Cambiar' : 'Elegir'}
                      </span>
                    </button>
                  </div>

                  {clienteSeleccionado ? (
                    renderFichaClienteCompacta(clienteSeleccionado)
                  ) : (
                    <button
                      type="button"
                      onClick={abrirSheetClientes}
                      className="touch-manipulation flex min-h-[54px] w-full items-center justify-center rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/60 px-3 text-xs font-black text-slate-800 hover:bg-amber-100/60"
                    >
                      + Elegir cliente ({clientes.length})
                    </button>
                  )}
                </div>

                <div className="mt-3 hidden rounded-lg border border-slate-200/80 bg-slate-50/90 p-2.5 text-[11px] font-semibold text-slate-500 lg:block">
                  Pago actual:{' '}
                  <strong className="text-slate-900">
                    {tipoVenta === 'CREDITO'
                      ? `CRÉDITO (${plazoDias}d)`
                      : 'CONTADO'}
                  </strong>
                </div>
              </div>
            )}
          </section>

          {/* ----------------------------------------------------------------
              PANEL 02: CATÁLOGO DE 19 PRODUCTOS (KILO vs UNIDAD)
             ---------------------------------------------------------------- */}
          <section
            aria-labelledby="paso-catalogo-titulo"
            className={`relative flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all duration-300 ease-out ${
              pasoActivo === 'catalogo'
                ? 'flex min-h-0 flex-1 border-[#C8102E] lg:h-full lg:min-w-0 lg:flex-1'
                : 'hidden border-slate-200/90 lg:flex lg:h-full lg:w-[250px] lg:shrink-0 xl:w-[270px]'
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
                      Catálogo ({productos.length} ítems)
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['TODOS', 'GRANEL', 'VACIO'] as const).map((tab) => {
                      const activo = filtroFormato === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setFiltroFormato(tab)}
                          className={`touch-manipulation min-h-[40px] shrink-0 whitespace-nowrap rounded-xl border-2 px-3 text-xs font-black uppercase transition ${
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
                      <span>
                        Listo ({formatearKilos(totales.totalKilos)} kg)
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Buscador + Píldoras de Categoría (cero <select> nativo) */}
                <div className="mt-2.5 space-y-2 shrink-0">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      strokeWidth={2.2}
                    />
                    <input
                      type="text"
                      value={busquedaProducto}
                      onChange={(e) => setBusquedaProducto(e.target.value)}
                      placeholder="Buscar por nombre o SKU (CHC001, CHMOR001, MA001)..."
                      className="min-h-[46px] w-full rounded-xl border-2 border-slate-200 bg-white/95 pl-9 pr-9 text-base font-medium text-slate-900 shadow-inner transition placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
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

                  {categorias.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      <button
                        type="button"
                        onClick={() => setFiltroCategoria('TODAS')}
                        className={`touch-manipulation min-h-[34px] shrink-0 whitespace-nowrap rounded-lg border px-2.5 text-[11px] font-black transition ${
                          filtroCategoria === 'TODAS'
                            ? 'border-[#C8102E] bg-red-50 text-[#C8102E]'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Todas las líneas
                      </button>
                      {categorias.map((cat) => (
                        <button
                          key={cat.id_categoria}
                          type="button"
                          onClick={() => setFiltroCategoria(cat.id_categoria)}
                          className={`touch-manipulation min-h-[34px] shrink-0 whitespace-nowrap rounded-lg border px-2.5 text-[11px] font-black transition ${
                            filtroCategoria === cat.id_categoria
                              ? 'border-[#C8102E] bg-red-50 text-[#C8102E]'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {cat.nombre_categoria}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Filas de Productos */}
                <div className="mt-2.5 flex-1 space-y-2 overflow-y-auto pr-1">
                  {productosFiltrados.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white/80 p-6 text-center text-xs font-bold text-slate-500">
                      No se encontraron productos con el filtro aplicado.
                    </div>
                  ) : (
                    productosFiltrados.map((producto) => {
                      const esUnidad = esProductoPorUnidad(producto);
                      const pesoUnidad = getPesoUnidadKilos(producto);
                      const cantidadIngresada =
                        cantidadPorProducto[producto.id_producto] ?? 0;
                      const kilosEquivalentes = esUnidad
                        ? Number((cantidadIngresada * pesoUnidad).toFixed(3))
                        : cantidadIngresada;
                      const requiereProduccion = producto.requiere_produccion;
                      const tieneCantidad = cantidadIngresada > 0;
                      const precioPorUnidad = Number(
                        (producto.precio_kilo_bs * pesoUnidad).toFixed(2)
                      );
                      const subtotalProducto = Number(
                        (kilosEquivalentes * producto.precio_kilo_bs).toFixed(2)
                      );

                      return (
                        <article
                          key={producto.id_producto}
                          className={`flex flex-col gap-3 rounded-xl border-2 px-3.5 py-3 transition ${
                            tieneCantidad
                              ? 'border-[#C8102E] bg-red-50/45 shadow-sm'
                              : 'border-slate-200 bg-white/95 hover:border-slate-300'
                          }`}
                        >
                          {/* Fila 1: Badges + Nombre + Precio */}
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
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

                              {esUnidad && (
                                <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-purple-950">
                                  <Package className="h-3 w-3" />
                                  PAQ. {Math.round(pesoUnidad * 1000)}g (
                                  {pesoUnidad.toFixed(3)} kg)
                                </span>
                              )}

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
                              <div className="flex flex-wrap items-center gap-2">
                                {esUnidad ? (
                                  <span className="whitespace-nowrap font-mono text-sm font-bold tabular-nums text-slate-800">
                                    {formatearBs(precioPorUnidad)} / unid.
                                  </span>
                                ) : (
                                  <span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-slate-700">
                                    {formatearBs(producto.precio_kilo_bs)}/kg
                                  </span>
                                )}
                                {tieneCantidad && (
                                  <span className="whitespace-nowrap rounded bg-[#FFCD00]/75 px-2 py-0.5 font-mono text-xs font-black tabular-nums text-slate-950">
                                    {esUnidad
                                      ? `${cantidadIngresada} unid. · ${kilosEquivalentes.toFixed(3)} kg = ${formatearBs(subtotalProducto)}`
                                      : `= ${formatearBs(subtotalProducto)}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Controles Táctiles en 2 Filas (Cero Amontonamiento) */}
                          <div className="space-y-2.5 border-t border-slate-100 pt-2.5">
                            {/* Fila 1: Control de Precisión (- / Input centrado / + rojo) */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  incrementarCantidad(producto.id_producto, -1)
                                }
                                disabled={cantidadIngresada === 0}
                                aria-label={`Restar 1 ${esUnidad ? 'unidad' : 'kilo'} a ${producto.nombre_producto}`}
                                className="touch-manipulation flex min-h-[52px] min-w-[52px] shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 bg-slate-100 text-slate-900 transition active:scale-95 disabled:opacity-35"
                              >
                                <Minus className="h-5 w-5" strokeWidth={2.5} />
                              </button>

                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  aria-label={`${esUnidad ? 'Unidades' : 'Kilos'} de ${producto.nombre_producto}`}
                                  value={
                                    cantidadIngresada === 0
                                      ? ''
                                      : String(cantidadIngresada)
                                  }
                                  placeholder="0"
                                  onChange={(e) => {
                                    const soloDigitos = e.target.value.replace(
                                      /\D/g,
                                      ''
                                    );
                                    actualizarCantidad(
                                      producto.id_producto,
                                      soloDigitos === ''
                                        ? 0
                                        : Number.parseInt(soloDigitos, 10)
                                    );
                                  }}
                                  className="min-h-[52px] w-full rounded-xl border-2 border-slate-300 bg-white px-3 pr-12 text-center font-mono text-lg font-bold tabular-nums text-slate-950 shadow-inner focus:border-[#C8102E] focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
                                />
                                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] font-black text-slate-400">
                                  {esUnidad ? 'UNID' : 'KG'}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  incrementarCantidad(producto.id_producto, 1)
                                }
                                aria-label={`Sumar 1 ${esUnidad ? 'unidad' : 'kilo'} a ${producto.nombre_producto}`}
                                className="touch-manipulation flex min-h-[52px] min-w-[52px] shrink-0 items-center justify-center rounded-xl border-2 border-[#C8102E] bg-[#C8102E] text-white shadow-sm transition hover:bg-[#a60d26] active:scale-95"
                              >
                                <Plus className="h-5 w-5" strokeWidth={2.5} />
                              </button>
                            </div>

                            {esUnidad && (
                              <p className="font-mono text-xs font-bold tabular-nums text-purple-900">
                                Equivale a{' '}
                                {(cantidadIngresada * pesoUnidad).toFixed(3)} kg
                              </p>
                            )}

                            {/* Fila 2: Atajos Rápidos en grilla uniforme + Limpiar */}
                            <div className="space-y-1.5">
                              <div className="grid grid-cols-4 gap-2">
                                {(esUnidad ? [1, 2, 5, 10] : [1, 5, 10, 20]).map(
                                  (salto) => (
                                    <button
                                      key={salto}
                                      type="button"
                                      onClick={() =>
                                        incrementarCantidad(
                                          producto.id_producto,
                                          salto
                                        )
                                      }
                                      className="touch-manipulation flex min-h-[44px] items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-50 font-mono text-xs font-black text-slate-800 transition hover:border-slate-300 hover:bg-slate-100 active:scale-95"
                                    >
                                      +{salto}
                                    </button>
                                  )
                                )}
                              </div>

                              {cantidadIngresada > 0 && (
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      actualizarCantidad(producto.id_producto, 0)
                                    }
                                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-slate-500 transition hover:bg-red-50 hover:text-[#C8102E]"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    <span>Limpiar (0)</span>
                                  </button>
                                </div>
                              )}
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
                      {lineasActivas.length > 0 ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
                      ) : (
                        '02'
                      )}
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
                      {lineasActivas.length > 0 ? 'Editar' : 'Agregar'}
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
                              {linea.es_por_unidad
                                ? `${linea.unidades} u. · ${linea.kilos_estimados.toFixed(3)} kg`
                                : `${linea.kilos_estimados} kg`}
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
                        {formatearKilos(totales.totalKilos)} kg ·{' '}
                        {formatearBs(totales.totalBs)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ----------------------------------------------------------------
              PANEL 03: CIERRE, CONDICIÓN DE PAGO Y CONFIRMACIÓN
             ---------------------------------------------------------------- */}
          <section
            aria-labelledby="paso-confirmar-titulo"
            className={`relative flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-md transition-all duration-300 ease-out ${
              pasoActivo === 'detalle'
                ? 'flex min-h-0 flex-1 border-[#C8102E] lg:h-full lg:min-w-0 lg:flex-1'
                : 'hidden border-slate-200/90 lg:flex lg:h-full lg:w-[300px] lg:shrink-0 xl:w-[340px]'
            }`}
          >
            <CharcuteriePatternBg variant="card" idSuffix="card-resumen" />
            <PlantCardHeaderStrip />

            <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between p-4">
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-0.5">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C8102E] font-mono text-xs font-black text-white">
                      03
                    </span>
                    <h2
                      id="paso-confirmar-titulo"
                      className="text-sm font-black uppercase tracking-tight text-slate-900"
                    >
                      Resumen y Cierre
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
                <div className="mt-2.5 shrink-0 lg:hidden">
                  {clienteSeleccionado ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                          Cliente
                        </span>
                        <button
                          type="button"
                          onClick={abrirSheetClientes}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-[#C8102E]"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Cambiar</span>
                        </button>
                      </div>
                      {renderFichaClienteCompacta(clienteSeleccionado)}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={abrirSheetClientes}
                      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#C8102E] bg-red-50 px-3 text-xs font-black text-[#C8102E]"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <span>Seleccionar cliente para continuar</span>
                    </button>
                  )}
                </div>

                {/* Condición de Pago (siempre visible y editable en el cierre) */}
                <div className="mt-2.5 shrink-0">
                  {renderSelectorCondicionPago(true)}
                </div>

                {/* Resumen Consolidado de Totales */}
                <div className="mt-2.5 shrink-0 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/90 p-3">
                  <div className="hidden items-start justify-between gap-2 text-xs lg:flex">
                    <span className="shrink-0 font-bold text-slate-500">
                      Cliente:
                    </span>
                    <span className="text-right font-black leading-snug text-slate-900">
                      {clienteSeleccionado
                        ? `${clienteSeleccionado.codigo_cliente_sac} · ${clienteSeleccionado.nombre_comercial}`
                        : 'Pendiente'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">
                      Peso Total Est.:
                    </span>
                    <span className="rounded bg-[#FFCD00] px-2 py-0.5 font-mono text-sm font-black tabular-nums text-slate-950">
                      {formatearKilos(totales.totalKilos)} kg
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
                      <span>Editar</span>
                    </button>
                  </div>

                  {lineasActivas.length === 0 ? (
                    <div className="mb-2.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-3 text-center text-xs font-bold text-slate-500 lg:hidden">
                      Aún no agregaste productos al pedido.
                    </div>
                  ) : (
                    <ul className="mb-2.5 min-h-[100px] flex-1 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white/95 px-2.5 py-1">
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
                                {linea.es_por_unidad
                                  ? `${linea.unidades} unid. · ${linea.kilos_estimados.toFixed(3)} kg`
                                  : `${linea.kilos_estimados} kg`}
                              </span>
                              <span>
                                × {formatearBs(linea.precio_kilo_bs)}/kg
                              </span>
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
                                actualizarCantidad(linea.id_producto, 0)
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
                {formatearKilos(totales.totalKilos)} kg
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                ({lineasActivas.length})
              </span>
            </div>
            <span className="mt-0.5 font-mono text-sm font-black tabular-nums text-slate-950">
              {formatearBs(totales.totalBs)}
            </span>
          </button>

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

      {/* ====================================================================
          BOTTOM SHEET / MODAL TÁCTIL DE 352 CLIENTES (Máx 40 renderizados)
         ==================================================================== */}
      {sheetClienteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-clientes-titulo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setSheetClienteOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border-2 border-slate-200 bg-white shadow-2xl sm:h-[82vh] sm:rounded-2xl"
          >
            <PlantCardHeaderStrip />

            {/* Header del Bottom Sheet */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <h3
                  id="sheet-clientes-titulo"
                  className="text-base font-black text-slate-900"
                >
                  Seleccionar Cliente SAC
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  Mostrando {clientesVisibles.length} de{' '}
                  {clientesFiltrados.length} coincidencias ({clientes.length}{' '}
                  totales)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => abrirModalNuevoCliente(busquedaCliente)}
                  className="touch-manipulation inline-flex min-h-[42px] items-center gap-1 rounded-xl border-2 border-slate-900 bg-[#FFCD00] px-3 text-xs font-black text-slate-950"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Nuevo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSheetClienteOpen(false)}
                  aria-label="Cerrar selector de clientes"
                  className="touch-manipulation flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Buscador Instantáneo + Píldoras Zona / Localidad */}
            <div className="shrink-0 space-y-2.5 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  strokeWidth={2.3}
                />
                <input
                  type="text"
                  autoFocus
                  value={busquedaCliente}
                  onChange={(e) => {
                    setBusquedaCliente(e.target.value);
                    setLimiteClientesVisibles(CLIENTES_PAGE_SIZE);
                  }}
                  placeholder="Buscar por nombre, CL-00010, razón social o localidad..."
                  className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-white pl-10 pr-10 text-base font-medium text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[#C8102E] focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
                />
                {busquedaCliente && (
                  <button
                    type="button"
                    onClick={() => {
                      setBusquedaCliente('');
                      setLimiteClientesVisibles(CLIENTES_PAGE_SIZE);
                    }}
                    aria-label="Limpiar búsqueda de cliente"
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setFiltroZonaCliente('TODAS');
                    setLimiteClientesVisibles(CLIENTES_PAGE_SIZE);
                  }}
                  className={`touch-manipulation min-h-[36px] shrink-0 whitespace-nowrap rounded-lg border px-3 text-xs font-black transition ${
                    filtroZonaCliente === 'TODAS'
                      ? 'border-slate-950 bg-slate-900 text-[#FFCD00]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Todas ({clientes.length})
                </button>
                {opcionesZonaLocalidad.map((z) => (
                  <button
                    key={z.nombre}
                    type="button"
                    onClick={() => {
                      setFiltroZonaCliente(z.nombre);
                      setLimiteClientesVisibles(CLIENTES_PAGE_SIZE);
                    }}
                    className={`touch-manipulation min-h-[36px] shrink-0 whitespace-nowrap rounded-lg border px-3 text-xs font-bold transition ${
                      filtroZonaCliente === z.nombre
                        ? 'border-[#C8102E] bg-[#C8102E] text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {z.nombre} ({z.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Lista Virtualizada / Paginada de 40 en 40 */}
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {clientesVisibles.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-bold text-slate-700">
                    Sin coincidencias para &ldquo;{busquedaCliente}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => abrirModalNuevoCliente(busquedaCliente)}
                    className="touch-manipulation mt-3 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-[#FFCD00]"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Crear cliente rápido</span>
                  </button>
                </div>
              ) : (
                <>
                  {clientesVisibles.map((cliente) => {
                    const esActual =
                      clienteSeleccionado?.id_cliente === cliente.id_cliente;
                    const tieneNotaComercial = Boolean(
                      cliente.observaciones?.trim() ||
                        cliente.regla_cortesia_habitual?.trim()
                    );

                    return (
                      <button
                        key={cliente.id_cliente}
                        type="button"
                        onClick={() =>
                          aplicarClienteSeleccionado(cliente, false)
                        }
                        className={`touch-manipulation flex min-h-[68px] w-full flex-col gap-1.5 rounded-xl border-2 p-3 text-left transition active:scale-[0.99] ${
                          esActual
                            ? 'border-[#C8102E] bg-red-50/80 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex w-full flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-black text-[#FFCD00]">
                              {cliente.codigo_cliente_sac}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
                                cliente.forma_pago_habitual === 'CREDITO'
                                  ? 'bg-sky-100 text-sky-900'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {cliente.forma_pago_habitual === 'CREDITO'
                                ? `Crédito ${cliente.plazo_dias || 7}d`
                                : 'Contado'}
                            </span>
                            {tieneNotaComercial && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-950">
                                <AlertTriangle className="h-3 w-3 text-amber-700" />
                                Obs./Cortesía
                              </span>
                            )}
                          </div>

                          {esActual ? (
                            <span className="inline-flex items-center gap-1 rounded bg-[#C8102E] px-2 py-0.5 text-[10px] font-black uppercase text-white">
                              <Check className="h-3 w-3" />
                              Actual
                            </span>
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                        </div>

                        <p className="text-sm font-black leading-snug text-slate-950">
                          {cliente.nombre_comercial}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-[#C8102E]" />
                            {etiquetaZonaCliente(cliente)}
                          </span>
                          {cliente.telefono && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500">
                              <Phone className="h-3 w-3" />
                              {cliente.telefono}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {clientesFiltrados.length > clientesVisibles.length && (
                    <button
                      type="button"
                      onClick={() =>
                        setLimiteClientesVisibles(
                          (prev) => prev + CLIENTES_PAGE_SIZE
                        )
                      }
                      className="touch-manipulation mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-slate-50 px-4 text-xs font-black uppercase text-slate-800 hover:bg-slate-100"
                    >
                      <span>
                        Mostrar más resultados (quedan{' '}
                        {clientesFiltrados.length - clientesVisibles.length})
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
