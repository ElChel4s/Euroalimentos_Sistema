'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Barcode,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Equal,
  FileText,
  Loader2,
  Package,
  Percent,
  Plus,
  RotateCcw,
  Scale,
  Search,
  ThermometerSnowflake,
  X,
} from 'lucide-react';
import { registrarLoteProduccionAction } from '@/actions/produccion.actions';
import {
  ProductoProduccionSelectorModal,
  type ProductoProduccionItem,
} from '@/components/produccion/ProductoProduccionSelectorModal';

export type { ProductoProduccionItem };

export interface PerfilProduccionResumen {
  turno_planta: string;
  responsable_camara_frio: boolean;
  tolerancia_merma_max_pct: number;
}

export interface IngresoLotesClientProps {
  productos: ProductoProduccionItem[];
  perfilProduccion: PerfilProduccionResumen;
  fechaHoyBolivia: string;
  codigoLoteInicial: string;
}

type FiltroMonitor = 'TODOS' | 'DEFICIT' | 'GRANEL' | 'VACIO';
type ModoIngresoUnidad = 'UNIDADES' | 'KILOS';

function formatKg(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function esProductoPorUnidad(prod: ProductoProduccionItem | null): boolean {
  return String(prod?.unidad_medida ?? 'KILO').toUpperCase() === 'UNIDAD';
}

function getPesoUnidadKg(prod: ProductoProduccionItem | null): number {
  const peso = Number(prod?.peso_unidad_kilos ?? 1);
  return Number.isFinite(peso) && peso > 0 ? peso : 0.5;
}

function generarCodigoLoteTimestamp(fechaIso?: string): string {
  const ahora = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(ahora);

  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00';

  const ymd =
    fechaIso && /^\d{4}-\d{2}-\d{2}$/.test(fechaIso)
      ? fechaIso.replace(/-/g, '')
      : `${getPart('year')}${getPart('month')}${getPart('day')}`;
  const hhmm = `${getPart('hour')}${getPart('minute')}`;

  return `LOT-${ymd}-${hhmm}`;
}

export function IngresoLotesClient({
  productos: initialProductos,
  perfilProduccion,
  fechaHoyBolivia,
  codigoLoteInicial,
}: IngresoLotesClientProps) {
  const router = useRouter();

  const [productos, setProductos] =
    useState<ProductoProduccionItem[]>(initialProductos);
  const [prevInitialProductos, setPrevInitialProductos] =
    useState<ProductoProduccionItem[]>(initialProductos);

  if (initialProductos !== prevInitialProductos) {
    setPrevInitialProductos(initialProductos);
    setProductos(initialProductos);
  }

  const [vistaMovil, setVistaMovil] = useState<'ingreso' | 'deficit'>(
    'ingreso'
  );

  // Filtros Monitor Izquierdo
  const [busquedaMonitor, setBusquedaMonitor] = useState<string>('');
  const [filtroMonitor, setFiltroMonitor] = useState<FiltroMonitor>('TODOS');

  // Selector táctil derecho
  const [selectorModalAbierto, setSelectorModalAbierto] =
    useState<boolean>(false);

  const [selectedProductoId, setSelectedProductoId] = useState<number>(
    initialProductos[0]?.id_producto ?? 0
  );
  const [codigoLote, setCodigoLote] = useState<string>(codigoLoteInicial);
  const [fechaElaboracion, setFechaElaboracion] =
    useState<string>(fechaHoyBolivia);

  const [modoIngresoUnidad, setModoIngresoUnidad] =
    useState<ModoIngresoUnidad>('UNIDADES');
  const [unidadesInput, setUnidadesInput] = useState<string>('');
  const [kilosInput, setKilosInput] = useState<string>('');
  const [observacion, setObservacion] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const formRef = useRef<HTMLElement>(null);
  const kilosInputRef = useRef<HTMLInputElement>(null);
  const unidadesInputRef = useRef<HTMLInputElement>(null);

  const productosEnDeficit = useMemo(() => {
    return productos
      .filter((p) => Number(p.stock_disponible_kilos) <= 0)
      .sort(
        (a, b) =>
          Number(a.stock_disponible_kilos) - Number(b.stock_disponible_kilos)
      );
  }, [productos]);

  const productosMonitorFiltrados = useMemo(() => {
    const q = busquedaMonitor.trim().toLowerCase();
    return productos
      .filter((p) => {
        if (filtroMonitor === 'DEFICIT' && Number(p.stock_disponible_kilos) > 0) {
          return false;
        }
        if (filtroMonitor === 'GRANEL' && p.formato !== 'GRANEL') {
          return false;
        }
        if (filtroMonitor === 'VACIO' && p.formato !== 'VACIO') {
          return false;
        }
        if (!q) return true;
        return (
          p.codigo_sku.toLowerCase().includes(q) ||
          p.nombre_producto.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aDef = Number(a.stock_disponible_kilos) <= 0 ? 0 : 1;
        const bDef = Number(b.stock_disponible_kilos) <= 0 ? 0 : 1;
        if (aDef !== bDef) return aDef - bDef;
        return Number(a.stock_disponible_kilos) - Number(b.stock_disponible_kilos);
      });
  }, [productos, busquedaMonitor, filtroMonitor]);

  const productoSeleccionado = useMemo(() => {
    return (
      productos.find((p) => p.id_producto === selectedProductoId) ??
      productos[0] ??
      null
    );
  }, [productos, selectedProductoId]);

  const seleccionadoEsUnidad = esProductoPorUnidad(productoSeleccionado);
  const pesoUnidadSeleccionada = getPesoUnidadKg(productoSeleccionado);
  const usarIngresoPorUnidades =
    seleccionadoEsUnidad && modoIngresoUnidad === 'UNIDADES';

  const unidadesNumericas = useMemo(() => {
    const parsed = parseInt(unidadesInput, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [unidadesInput]);

  const kilosNumericos = useMemo(() => {
    if (usarIngresoPorUnidades) {
      return Number((unidadesNumericas * pesoUnidadSeleccionada).toFixed(3));
    }
    const parsed = parseFloat(kilosInput);
    return Number.isFinite(parsed) && parsed > 0
      ? Number(parsed.toFixed(3))
      : 0;
  }, [
    usarIngresoPorUnidades,
    unidadesNumericas,
    pesoUnidadSeleccionada,
    kilosInput,
  ]);

  const stockActual = Number(productoSeleccionado?.stock_fisico_kilos ?? 0);
  const nuevoSaldoCamara = Number((stockActual + kilosNumericos).toFixed(3));

  const handleAutogenerarCodigo = () => {
    setCodigoLote(generarCodigoLoteTimestamp(fechaElaboracion));
  };

  const seleccionarProductoYResetearEntrada = (prod: ProductoProduccionItem) => {
    setSelectedProductoId(prod.id_producto);
    setModoIngresoUnidad('UNIDADES');
    setUnidadesInput('');
    setKilosInput('');
    setFeedbackBanner(null);
  };

  const handleSeleccionarParaProducir = (prod: ProductoProduccionItem) => {
    setSelectedProductoId(prod.id_producto);
    const faltante = Math.abs(Number(prod.stock_disponible_kilos));
    const esDeficitReal = Number(prod.stock_disponible_kilos) <= 0;

    if (esProductoPorUnidad(prod)) {
      const pesoU = getPesoUnidadKg(prod);
      const unidsSugeridas =
        esDeficitReal && faltante > 0 ? Math.max(1, Math.ceil(faltante / pesoU)) : 50;
      setModoIngresoUnidad('UNIDADES');
      setUnidadesInput(String(unidsSugeridas));
      setKilosInput('');
    } else {
      setKilosInput(
        esDeficitReal && faltante > 0 ? faltante.toFixed(3) : '25.000'
      );
      setUnidadesInput('');
    }

    setObservacion(
      esDeficitReal
        ? `Cobertura déficit preventa (${prod.codigo_sku})`
        : `Producción de stock (${prod.codigo_sku})`
    );
    setFeedbackBanner(null);
    setVistaMovil('ingreso');

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (esProductoPorUnidad(prod)) {
        unidadesInputRef.current?.focus();
      } else {
        kilosInputRef.current?.focus();
      }
    }, 120);
  };

  const handleSumarKilos = (cantidad: number) => {
    const base = parseFloat(kilosInput);
    const actual = Number.isFinite(base) && base >= 0 ? base : 0;
    setKilosInput((actual + cantidad).toFixed(3));
  };

  const handleSumarUnidades = (cantidad: number) => {
    const base = parseInt(unidadesInput, 10);
    const actual = Number.isFinite(base) && base >= 0 ? base : 0;
    setUnidadesInput(String(actual + cantidad));
  };

  const handleLimpiarCantidad = () => {
    if (usarIngresoPorUnidades) {
      setUnidadesInput('');
      unidadesInputRef.current?.focus();
    } else {
      setKilosInput('');
      kilosInputRef.current?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);

    if (!productoSeleccionado) {
      setFeedbackBanner({
        type: 'error',
        message: 'Seleccione un producto terminado válido.',
      });
      return;
    }

    const codigoNormalizado = codigoLote.trim().toUpperCase();
    if (codigoNormalizado.length < 3) {
      setFeedbackBanner({
        type: 'error',
        message: 'El código de lote interno debe tener al menos 3 caracteres.',
      });
      return;
    }

    if (kilosNumericos <= 0) {
      setFeedbackBanner({
        type: 'error',
        message: usarIngresoPorUnidades
          ? 'Ingrese al menos 1 unidad/paquete producido.'
          : 'La cantidad producida debe ser mayor a 0.000 kg.',
      });
      if (usarIngresoPorUnidades) {
        unidadesInputRef.current?.focus();
      } else {
        kilosInputRef.current?.focus();
      }
      return;
    }

    // Si el ingreso fue por unidades, enriquecemos la observación automática con las unidades
    let observacionFinal = observacion.trim();
    if (seleccionadoEsUnidad) {
      const unidadesResumen = usarIngresoPorUnidades
        ? unidadesNumericas
        : Math.round(kilosNumericos / pesoUnidadSeleccionada);
      const pesoGr = Math.round(pesoUnidadSeleccionada * 1000);
      const prefijoUnidades = `${unidadesResumen} unid. (${pesoGr}g)`;
      if (!observacionFinal) {
        observacionFinal = `${prefijoUnidades} — Lote ${productoSeleccionado.nombre_producto}`;
      } else if (!observacionFinal.toLowerCase().includes('unid.')) {
        observacionFinal = `${prefijoUnidades} — ${observacionFinal}`;
      }
    }

    setIsSubmitting(true);
    try {
      const resultado = await registrarLoteProduccionAction({
        id_producto: productoSeleccionado.id_producto,
        codigo_lote_interno: codigoNormalizado,
        kilos_producidos: kilosNumericos,
        fecha_elaboracion: fechaElaboracion,
        observacion: observacionFinal || undefined,
      });

      if (!resultado.ok) {
        setFeedbackBanner({
          type: 'error',
          message: resultado.error,
        });
        return;
      }

      const nuevoFisico = Number(
        (
          resultado.data.saldo_nuevo_kilos ??
          stockActual + kilosNumericos
        ).toFixed(3)
      );
      const nuevoDisponible = Number(
        (
          resultado.data.saldo_disponible_kilos ??
          nuevoFisico - Number(productoSeleccionado.stock_comprometido_kilos)
        ).toFixed(3)
      );

      setProductos((prev) =>
        prev.map((item) =>
          item.id_producto === productoSeleccionado.id_producto
            ? {
              ...item,
              stock_fisico_kilos: nuevoFisico,
              stock_disponible_kilos: nuevoDisponible,
            }
            : item
        )
      );

      setCodigoLote(generarCodigoLoteTimestamp(fechaHoyBolivia));
      setFechaElaboracion(fechaHoyBolivia);
      setUnidadesInput('');
      setKilosInput('');
      setObservacion('');

      setFeedbackBanner({
        type: 'success',
        message: `Lote ${codigoNormalizado} (+${formatKg(kilosNumericos)} kg${usarIngresoPorUnidades ? ` / ${unidadesNumericas} unid.` : ''
          }) registrado en Kardex (#${resultado.data.id_movimiento}). Nuevo físico en cámara: ${formatKg(nuevoFisico)} kg.`,
      });

      router.refresh();
    } catch {
      setFeedbackBanner({
        type: 'error',
        message:
          'Ocurrió un error inesperado al registrar el lote. Intente nuevamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 text-slate-900">
      {/* ====================================================================
          BARRA DE CONTEXTO COMPACTA (SIN HEADER ROJO DUPLICADO)
         ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
        <div>
          <h1 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">
            Ingreso de Lotes de Producción
          </h1>
          <p className="text-xs font-medium text-slate-500">
            Registro de producto terminado en cámara de frío y monitor de
            déficit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-800">
            <Clock className="h-3.5 w-3.5 text-[#C8102E]" />
            <span>Turno {perfilProduccion.turno_planta}</span>
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs font-bold ${perfilProduccion.responsable_camara_frio
              ? 'border-sky-200 bg-sky-50 text-sky-900'
              : 'border-slate-200 bg-slate-100 text-slate-600'
              }`}
          >
            <ThermometerSnowflake className="h-3.5 w-3.5 text-sky-600" />
            <span>
              Cámara{' '}
              {perfilProduccion.responsable_camara_frio ? 'ACTIVA' : 'INACTIVA'}
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold tabular-nums text-slate-700">
            <Percent className="h-3.5 w-3.5 text-slate-500" />
            <span>
              Tol. merma {perfilProduccion.tolerancia_merma_max_pct.toFixed(2)}%
            </span>
          </span>
        </div>
      </div>

      {/* Selector rápido en móvil (< lg) */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs lg:hidden">
        <button
          type="button"
          onClick={() => setVistaMovil('ingreso')}
          className={`touch-manipulation flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold transition ${vistaMovil === 'ingreso'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-700 hover:bg-slate-100'
            }`}
        >
          <Scale className="h-4 w-4 shrink-0" />
          <span>Registrar Lote</span>
        </button>

        <button
          type="button"
          onClick={() => setVistaMovil('deficit')}
          className={`touch-manipulation flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold transition ${vistaMovil === 'deficit'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-700 hover:bg-slate-100'
            }`}
        >
          <ClipboardList className="h-4 w-4 shrink-0" />
          <span>Catálogo / Déficit</span>
          <span
            className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-black tabular-nums ${productosEnDeficit.length > 0
              ? 'bg-[#C8102E] text-white'
              : 'bg-emerald-600 text-white'
              }`}
          >
            {productosEnDeficit.length}
          </span>
        </button>
      </div>

      {/* Banner de Confirmación o Error */}
      {feedbackBanner && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-3.5 shadow-sm sm:p-4 ${feedbackBanner.type === 'success'
            ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
            : 'border-red-700 bg-red-50 text-red-950'
            }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-emerald-600 sm:h-6 sm:w-6"
                strokeWidth={2.4}
              />
            ) : (
              <AlertTriangle
                className="h-5 w-5 shrink-0 text-[#C8102E] sm:h-6 sm:w-6"
                strokeWidth={2.4}
              />
            )}
            <p className="text-xs font-extrabold leading-snug sm:text-sm">
              {feedbackBanner.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="min-h-[36px] shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-black uppercase text-slate-600 hover:bg-black/5"
          >
            OK
          </button>
        </div>
      )}

      {/* Aviso compacto de déficit en móvil cuando está en pestaña de ingreso */}
      {vistaMovil === 'ingreso' && productosEnDeficit.length > 0 && (
        <button
          type="button"
          onClick={() => setVistaMovil('deficit')}
          className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl border-2 border-[#C8102E] bg-red-50 px-4 py-2.5 text-left shadow-xs transition hover:bg-red-100/80 lg:hidden"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle
              className="h-5 w-5 shrink-0 text-[#C8102E]"
              strokeWidth={2.4}
            />
            <div>
              <span className="block text-xs font-black uppercase text-[#C8102E]">
                {productosEnDeficit.length}{' '}
                {productosEnDeficit.length === 1 ? 'producto' : 'productos'} con
                déficit de preventa
              </span>
              <span className="block text-[11px] font-semibold text-slate-700">
                Toque aquí para seleccionar prioridad de producción
              </span>
            </div>
          </div>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-[#C8102E]"
            strokeWidth={2.5}
          />
        </button>
      )}

      {/* ====================================================================
          CUERPO EN 2 COLUMNAS (MONITOR IZQUIERDA + FORMULARIO STICKY DERECHA)
         ==================================================================== */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* COLUMNA IZQUIERDA (lg:col-span-5) — MONITOR DE DÉFICIT Y CATÁLOGO */}
        <section
          aria-labelledby="titulo-deficit-preventa"
          className={`${vistaMovil === 'deficit' ? 'block' : 'hidden'
            } space-y-3.5 lg:col-span-5 lg:block`}
        >
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C8102E] text-white">
                  <ClipboardList className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div>
                  <h2
                    id="titulo-deficit-preventa"
                    className="text-sm font-black uppercase tracking-tight text-slate-900 sm:text-base"
                  >
                    Monitor de Déficit y Catálogo
                  </h2>
                  <p className="font-mono text-[11px] font-semibold text-slate-500">
                    {productosEnDeficit.length} con déficit • {productos.length}{' '}
                    SKUs activos
                  </p>
                </div>
              </div>

              <span
                className={`shrink-0 rounded-lg border px-2.5 py-1 font-mono text-xs font-black tabular-nums ${productosEnDeficit.length > 0
                  ? 'border-red-300 bg-red-100 text-[#C8102E]'
                  : 'border-emerald-300 bg-emerald-100 text-emerald-800'
                  }`}
              >
                {productosEnDeficit.length} déficit
              </span>
            </div>

            {/* Buscador compacto + píldoras de filtro */}
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                strokeWidth={2.2}
              />
              <input
                type="text"
                value={busquedaMonitor}
                onChange={(e) => setBusquedaMonitor(e.target.value)}
                placeholder="Buscar SKU o producto..."
                className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-slate-50/70 pr-8 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#C8102E] focus:bg-white focus:ring-2 focus:ring-[#FFCD00]/40 focus:outline-none"
              />
              {busquedaMonitor && (
                <button
                  type="button"
                  onClick={() => setBusquedaMonitor('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'TODOS', label: `Todos (${productos.length})` },
                  {
                    id: 'DEFICIT',
                    label: `Con Déficit (${productosEnDeficit.length})`,
                  },
                  { id: 'GRANEL', label: 'GRANEL' },
                  { id: 'VACIO', label: 'VACIO' },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setFiltroMonitor(pill.id)}
                  className={`min-h-[36px] rounded-xl border px-2.5 font-mono text-[11px] font-bold transition ${filtroMonitor === pill.id
                    ? 'border-slate-900 bg-slate-900 text-[#FFCD00]'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {productosMonitorFiltrados.length === 0 ? (
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-center shadow-xs">
              {filtroMonitor === 'DEFICIT' && productosEnDeficit.length === 0 ? (
                <div className="flex flex-col items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  <p className="text-sm font-black">
                    Cámara Cubierta — Ningún producto presenta déficit
                  </p>
                </div>
              ) : (
                <p className="text-sm font-semibold text-slate-500">
                  No se encontraron productos para el filtro seleccionado.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {productosMonitorFiltrados.map((prod) => {
                const esDeficit = Number(prod.stock_disponible_kilos) <= 0;
                const sinStock =
                  Number(prod.stock_fisico_kilos) === 0 &&
                  Number(prod.stock_comprometido_kilos) === 0;
                const kilosFaltantes = Math.abs(
                  Number(prod.stock_disponible_kilos)
                );
                const isSelected = prod.id_producto === selectedProductoId;
                const esUnidad = esProductoPorUnidad(prod);
                const pesoUnidadGr = Math.round(getPesoUnidadKg(prod) * 1000);

                return (
                  <article
                    key={prod.id_producto}
                    className={`overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all ${isSelected
                      ? 'border-[#C8102E] ring-4 ring-[#FFCD00]/40'
                      : esDeficit
                        ? 'border-red-200 hover:border-red-400'
                        : 'border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <div className="flex h-1.5 w-full">
                      <div
                        className={`w-2/3 ${esDeficit ? 'bg-[#C8102E]' : 'bg-slate-800'
                          }`}
                      />
                      <div className="w-1/3 bg-[#FFCD00]" />
                    </div>

                    <div className="space-y-3 p-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                            {prod.codigo_sku}
                          </span>
                          <span
                            className={`rounded border px-2 py-0.5 font-mono text-[11px] font-black uppercase ${prod.formato === 'VACIO'
                              ? 'border-sky-300 bg-sky-50 text-sky-800'
                              : 'border-amber-300 bg-amber-50 text-amber-900'
                              }`}
                          >
                            {prod.formato}
                          </span>
                          {esUnidad && (
                            <span className="inline-flex items-center gap-1 rounded border border-purple-300 bg-purple-50 px-2 py-0.5 font-mono text-[10px] font-black text-purple-900">
                              <Package className="h-3 w-3" />
                              UNIDAD ({pesoUnidadGr}g)
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1.5 break-words text-sm font-black leading-snug text-slate-900 sm:text-base">
                          {prod.nombre_producto}
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div>
                          <span className="block text-[11px] font-bold uppercase text-slate-500">
                            Stock Físico
                          </span>
                          <span className="mt-0.5 block font-mono text-sm font-extrabold tabular-nums text-slate-900 sm:text-base">
                            {formatKg(Number(prod.stock_fisico_kilos))} kg
                          </span>
                        </div>
                        <div className="border-l border-slate-200 pl-3">
                          <span className="block text-[11px] font-bold uppercase text-slate-500">
                            Comprometido
                          </span>
                          <span className="mt-0.5 block font-mono text-sm font-extrabold tabular-nums text-slate-900 sm:text-base">
                            {formatKg(Number(prod.stock_comprometido_kilos))} kg
                          </span>
                        </div>
                      </div>

                      {esDeficit ? (
                        <div className="flex items-center justify-between rounded-xl border-2 border-[#C8102E] bg-red-50 px-3.5 py-2">
                          <span className="flex items-center gap-1.5 font-mono text-xs font-black uppercase text-[#C8102E]">
                            <AlertTriangle
                              className="h-4 w-4 shrink-0"
                              strokeWidth={2.5}
                            />
                            DÉFICIT
                          </span>
                          <span className="font-mono text-sm font-black tabular-nums text-[#C8102E]">
                            {sinStock
                              ? 'SIN STOCK'
                              : `FALTAN ${formatKg(kilosFaltantes)} kg`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2">
                          <span className="flex items-center gap-1.5 font-mono text-xs font-black uppercase text-emerald-800">
                            <CheckCircle2
                              className="h-4 w-4 shrink-0"
                              strokeWidth={2.4}
                            />
                            CUBIERTO
                          </span>
                          <span className="font-mono text-xs font-black tabular-nums text-emerald-900">
                            +{formatKg(Number(prod.stock_disponible_kilos))} kg
                            disp.
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSeleccionarParaProducir(prod)}
                        className={`touch-manipulation flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-b-4 px-4 py-2.5 text-sm font-extrabold shadow-sm transition active:translate-y-[2px] active:border-b-2 ${esDeficit
                          ? 'border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] text-white hover:brightness-110'
                          : 'border-slate-950 bg-slate-800 text-white hover:bg-slate-900'
                          }`}
                      >
                        <span>Seleccionar para Producir</span>
                        <ArrowRight
                          className="h-4 w-4 text-[#FFCD00]"
                          strokeWidth={2.5}
                        />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* COLUMNA DERECHA (lg:col-span-7, sticky en escritorio) — FORMULARIO DE LOTE */}
        <section
          ref={formRef}
          aria-labelledby="titulo-form-lote"
          className={`${vistaMovil === 'ingreso' ? 'block' : 'hidden'
            } lg:sticky lg:top-4 lg:col-span-7 lg:block`}
        >
          <div className="overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-md">
            <div className="flex h-2.5 w-full">
              <div className="w-2/3 bg-[#C8102E]" />
              <div className="w-1/3 bg-[#FFCD00]" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3.5 sm:px-6">
              <div>
                <span className="font-mono text-[11px] font-black uppercase tracking-widest text-[#C8102E]">
                  INGRESO A CÁMARA • RF-11 / CU-P01
                </span>
                <h2
                  id="titulo-form-lote"
                  className="mt-0.5 text-base font-black text-slate-900 sm:text-xl"
                >
                  Registrar Lote Producido
                </h2>
              </div>

              {productoSeleccionado && (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-black uppercase ${productoSeleccionado.formato === 'VACIO'
                      ? 'border-sky-300 bg-sky-50 text-sky-900'
                      : 'border-amber-300 bg-amber-50 text-amber-900'
                      }`}
                  >
                    {productoSeleccionado.formato}
                  </span>
                  {seleccionadoEsUnidad && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1 font-mono text-xs font-black text-purple-900">
                      <Package className="h-3.5 w-3.5" />
                      UNIDAD ({Math.round(pesoUnidadSeleccionada * 1000)}g)
                    </span>
                  )}
                </div>
              )}
            </div>

            {productos.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-600">
                No hay productos activos configurados en el catálogo.
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-4 p-4 sm:space-y-5 sm:p-6"
              >
                {/* 1. Selector Táctil de Producto (cero <select> nativo cortado) */}
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                      1. Producto Activo
                    </span>
                    {productoSeleccionado && (
                      <span className="font-mono text-xs font-bold text-slate-600 tabular-nums">
                        Stock físico: {formatKg(stockActual)} kg
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectorModalAbierto(true)}
                    className="touch-manipulation flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-left transition hover:border-[#C8102E] hover:bg-white focus:border-[#C8102E] focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
                  >
                    {productoSeleccionado ? (
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-extrabold text-white">
                            {productoSeleccionado.codigo_sku}
                          </span>
                          <span
                            className={`rounded border px-2 py-0.5 font-mono text-[10px] font-black uppercase ${productoSeleccionado.formato === 'VACIO'
                              ? 'border-sky-300 bg-sky-50 text-sky-900'
                              : 'border-amber-300 bg-amber-50 text-amber-900'
                              }`}
                          >
                            {productoSeleccionado.formato}
                          </span>
                          {seleccionadoEsUnidad && (
                            <span className="inline-flex items-center gap-1 rounded border border-purple-300 bg-purple-50 px-2 py-0.5 font-mono text-[10px] font-black text-purple-900">
                              <Package className="h-3 w-3" />
                              UNIDAD (
                              {Math.round(pesoUnidadSeleccionada * 1000)}g)
                            </span>
                          )}
                        </div>
                        <p className="break-words text-sm font-extrabold leading-snug text-slate-900 sm:text-base">
                          {productoSeleccionado.nombre_producto}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-slate-500">
                        Toque para seleccionar producto...
                      </span>
                    )}
                    <ChevronDown
                      className="h-5 w-5 shrink-0 text-slate-500"
                      strokeWidth={2.2}
                    />
                  </button>
                </div>

                {/* 2. Cantidad Producida (Soporte nativo UNIDAD vs KILO) */}
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor={
                        usarIngresoPorUnidades
                          ? 'input-unidades-producidas'
                          : 'input-kilos-producidos'
                      }
                      className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700"
                    >
                      {usarIngresoPorUnidades ? (
                        <Package
                          className="h-3.5 w-3.5 text-purple-700"
                          strokeWidth={2.4}
                        />
                      ) : (
                        <Scale
                          className="h-3.5 w-3.5 text-[#C8102E]"
                          strokeWidth={2.4}
                        />
                      )}
                      <span>
                        {usarIngresoPorUnidades
                          ? '2. Unidades / Paquetes Producidos'
                          : '2. Kilos Producidos'}
                      </span>
                    </label>

                    {seleccionadoEsUnidad ? (
                      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                        <button
                          type="button"
                          onClick={() => setModoIngresoUnidad('UNIDADES')}
                          className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-bold transition ${modoIngresoUnidad === 'UNIDADES'
                            ? 'bg-slate-900 text-[#FFCD00]'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                          Por Unidades
                        </button>
                        <button
                          type="button"
                          onClick={() => setModoIngresoUnidad('KILOS')}
                          className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-bold transition ${modoIngresoUnidad === 'KILOS'
                            ? 'bg-slate-900 text-[#FFCD00]'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                          Por Kilos
                        </button>
                      </div>
                    ) : (
                      <span className="font-mono text-[11px] font-semibold text-slate-500">
                        Precisión 3 dec. (0.001 kg)
                      </span>
                    )}
                  </div>

                  {usarIngresoPorUnidades ? (
                    <>
                      <div className="relative">
                        <input
                          ref={unidadesInputRef}
                          id="input-unidades-producidas"
                          type="number"
                          step="1"
                          min="1"
                          inputMode="numeric"
                          value={unidadesInput}
                          onChange={(e) =>
                            setUnidadesInput(
                              e.target.value.replace(/[^0-9]/g, '')
                            )
                          }
                          placeholder="0"
                          required
                          className="min-h-[56px] w-full rounded-xl border-2 border-purple-300 bg-purple-50/30 pr-20 pl-4 font-mono text-2xl font-black tabular-nums text-slate-900 shadow-inner transition focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 rounded-md bg-purple-700 px-2.5 py-1 font-mono text-xs font-black tracking-wider text-white">
                          UNID.
                        </span>
                      </div>

                      {/* Equivalencia exacta en kilogramos en tiempo real */}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-200 bg-purple-50/70 px-3.5 py-2 font-mono text-xs">
                        <span className="font-bold text-purple-900">
                          Equivalencia Kardex (
                          {Math.round(pesoUnidadSeleccionada * 1000)}g/paq.):
                        </span>
                        <span className="font-black tabular-nums text-slate-900">
                          {unidadesNumericas} unid. ×{' '}
                          {pesoUnidadSeleccionada.toFixed(3)} kg ={' '}
                          <span className="text-[#C8102E]">
                            {formatKg(kilosNumericos)} kg
                          </span>
                        </span>
                      </div>

                      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {[10, 25, 50, 100].map((valor) => (
                          <button
                            key={valor}
                            type="button"
                            onClick={() => handleSumarUnidades(valor)}
                            className="touch-manipulation flex min-h-[46px] items-center justify-center gap-1 rounded-xl border-2 border-slate-200 bg-white font-mono text-sm font-black tabular-nums text-slate-800 shadow-2xs transition hover:border-purple-400 hover:bg-purple-50/60 active:translate-y-[1px]"
                          >
                            <Plus
                              className="h-3.5 w-3.5 text-purple-700"
                              strokeWidth={2.6}
                            />
                            <span>{valor} unid.</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={handleLimpiarCantidad}
                          className="touch-manipulation col-span-2 flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-slate-100 font-mono text-xs font-extrabold uppercase text-slate-700 transition hover:border-slate-300 hover:bg-slate-200 active:translate-y-[1px] sm:col-span-1"
                        >
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} />
                          <span>Limpiar</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <input
                          ref={kilosInputRef}
                          id="input-kilos-producidos"
                          type="number"
                          step="0.001"
                          min="0.001"
                          inputMode="decimal"
                          value={kilosInput}
                          onChange={(e) => setKilosInput(e.target.value)}
                          placeholder="0.000"
                          required
                          className="min-h-[56px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 pr-16 pl-4 font-mono text-2xl font-black tabular-nums text-slate-900 shadow-inner transition focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 rounded-md bg-[#FFCD00] px-2.5 py-1 font-mono text-xs font-black tracking-wider text-slate-950">
                          KG
                        </span>
                      </div>

                      {seleccionadoEsUnidad && kilosNumericos > 0 && (
                        <div className="mt-2 flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/70 px-3.5 py-2 font-mono text-xs">
                          <span className="font-bold text-purple-900">
                            Equivalente en paquetes:
                          </span>
                          <span className="font-black tabular-nums text-slate-900">
                            {(kilosNumericos / pesoUnidadSeleccionada).toFixed(
                              1
                            )}{' '}
                            unid. ({Math.round(pesoUnidadSeleccionada * 1000)}g)
                          </span>
                        </div>
                      )}

                      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {[10, 25, 50, 100].map((valor) => (
                          <button
                            key={valor}
                            type="button"
                            onClick={() => handleSumarKilos(valor)}
                            className="touch-manipulation flex min-h-[46px] items-center justify-center gap-1 rounded-xl border-2 border-slate-200 bg-white font-mono text-sm font-black tabular-nums text-slate-800 shadow-2xs transition hover:border-[#FFCD00] hover:bg-amber-50/70 active:translate-y-[1px]"
                          >
                            <Plus
                              className="h-3.5 w-3.5 text-[#C8102E]"
                              strokeWidth={2.6}
                            />
                            <span>{valor} kg</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={handleLimpiarCantidad}
                          className="touch-manipulation col-span-2 flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-slate-100 font-mono text-xs font-extrabold uppercase text-slate-700 transition hover:border-slate-300 hover:bg-slate-200 active:translate-y-[1px] sm:col-span-1"
                        >
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} />
                          <span>Limpiar</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* 3. Código Lote Interno + Fecha Elaboración */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="input-codigo-lote"
                      className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700"
                    >
                      <Barcode
                        className="h-3.5 w-3.5 text-slate-500"
                        strokeWidth={2.2}
                      />
                      <span>3. Código Lote Interno</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="input-codigo-lote"
                        type="text"
                        value={codigoLote}
                        onChange={(e) =>
                          setCodigoLote(e.target.value.toUpperCase())
                        }
                        placeholder="LOT-YYYYMMDD-HHMM"
                        required
                        className="min-h-[48px] min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3 font-mono text-sm font-black uppercase tracking-wider text-slate-900 shadow-inner transition focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30 sm:text-base"
                      />
                      <button
                        type="button"
                        onClick={handleAutogenerarCodigo}
                        className="touch-manipulation flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-slate-100 px-3 text-xs font-extrabold uppercase text-slate-800 transition hover:border-slate-400 hover:bg-slate-200 active:translate-y-[1px]"
                      >
                        <RotateCcw
                          className="h-3.5 w-3.5 text-[#C8102E]"
                          strokeWidth={2.4}
                        />
                        <span>Autogenerar</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="input-fecha-elaboracion"
                      className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700"
                    >
                      <Calendar
                        className="h-3.5 w-3.5 text-slate-500"
                        strokeWidth={2.2}
                      />
                      <span>4. Fecha de Elaboración</span>
                    </label>
                    <input
                      id="input-fecha-elaboracion"
                      type="date"
                      value={fechaElaboracion}
                      onChange={(e) => setFechaElaboracion(e.target.value)}
                      required
                      className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 font-mono text-base font-bold text-slate-900 shadow-inner transition focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
                    />
                  </div>
                </div>

                {/* 4. Observación Kardex (Opcional) */}
                <div>
                  <label
                    htmlFor="input-observacion-kardex"
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700"
                  >
                    <FileText
                      className="h-3.5 w-3.5 text-slate-500"
                      strokeWidth={2.2}
                    />
                    <span>5. Observación para Kardex (Opcional)</span>
                  </label>
                  <input
                    id="input-observacion-kardex"
                    type="text"
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    placeholder={
                      seleccionadoEsUnidad
                        ? 'Ej. Lote Morcilla tanda mañana (se adjuntarán las unidades)'
                        : 'Ej. Tanda 1 horno / cámara 2'
                    }
                    className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 text-base font-medium text-slate-900 shadow-inner transition focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
                  />
                </div>

                {/* 5. Vista Previa Matemática en Vivo */}
                <div className="rounded-xl border-2 border-slate-800 bg-slate-900 p-3.5 text-white shadow-inner sm:p-4">
                  <div className="mb-2.5 flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-mono text-[10px] font-black uppercase tracking-widest text-[#FFCD00]">
                      IMPACTO EN CÁMARA DE FRÍO
                    </span>
                    <span className="font-mono text-[10px] font-semibold text-slate-400">
                      KARDEX EN VIVO
                    </span>
                  </div>

                  <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-11 sm:gap-3">
                    <div className="flex items-center justify-between rounded-lg bg-slate-800/80 px-3 py-2.5 sm:col-span-3 sm:block sm:p-3">
                      <span className="block text-[11px] font-semibold text-slate-400">
                        Stock Actual
                      </span>
                      <span className="block font-mono text-sm font-extrabold tabular-nums text-slate-100 sm:mt-0.5 sm:text-base">
                        {formatKg(stockActual)} kg
                      </span>
                    </div>

                    <div className="hidden justify-center sm:col-span-1 sm:flex">
                      <Plus
                        className="h-5 w-5 text-[#FFCD00]"
                        strokeWidth={2.6}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-slate-800/80 px-3 py-2.5 sm:col-span-3 sm:block sm:p-3">
                      <span className="block text-[11px] font-semibold text-emerald-300">
                        Ingreso Lote
                      </span>
                      <span className="block font-mono text-sm font-extrabold tabular-nums text-emerald-400 sm:mt-0.5 sm:text-base">
                        +{formatKg(kilosNumericos)} kg
                      </span>
                    </div>

                    <div className="hidden justify-center sm:col-span-1 sm:flex">
                      <Equal
                        className="h-5 w-5 text-[#FFCD00]"
                        strokeWidth={2.6}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-[#FFCD00]/50 bg-[#C8102E]/25 px-3 py-2.5 sm:col-span-3 sm:block sm:p-3">
                      <span className="block text-[11px] font-extrabold text-[#FFCD00]">
                        Nuevo Saldo en Cámara
                      </span>
                      <span className="block font-mono text-base font-black tabular-nums text-white sm:mt-0.5 sm:text-lg">
                        {formatKg(nuevoSaldoCamara)} kg
                      </span>
                    </div>
                  </div>
                </div>

                {/* 6. Botón Principal */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="touch-manipulation flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-6 py-3 text-sm font-black tracking-wide text-white shadow-md transition hover:brightness-110 active:translate-y-[2px] active:border-b-2 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#FFCD00]" />
                  ) : (
                    <Scale
                      className="h-5 w-5 text-[#FFCD00]"
                      strokeWidth={2.5}
                    />
                  )}
                  <span>
                    {isSubmitting
                      ? 'Registrando Lote...'
                      : 'Registrar Lote en Inventario'}
                  </span>
                </button>
              </form>
            )}
          </div>
        </section>
      </div>

      {selectorModalAbierto && (
        <ProductoProduccionSelectorModal
          onClose={() => setSelectorModalAbierto(false)}
          title="Seleccionar Producto Activo"
          subtitle="Busque por código SKU o nombre para registrar su lote de producción"
          accentColor="crimson"
          productos={productos}
          selectedId={selectedProductoId}
          onSelect={seleccionarProductoYResetearEntrada}
        />
      )}
    </div>
  );
}
