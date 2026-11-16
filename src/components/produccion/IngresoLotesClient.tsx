'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Barcode,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Equal,
  FileText,
  Loader2,
  Percent,
  Plus,
  RotateCcw,
  Scale,
  ThermometerSnowflake,
} from 'lucide-react';
import { registrarLoteProduccionAction } from '@/actions/produccion.actions';
import type { FormatoProductoEnum } from '@/types/database.types';

export interface ProductoProduccionItem {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  stock_fisico_kilos: number;
  stock_comprometido_kilos: number;
  stock_disponible_kilos: number;
}

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

function formatKg(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
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
  const [vistaMovil, setVistaMovil] = useState<'ingreso' | 'deficit'>(
    'ingreso'
  );

  const [selectedProductoId, setSelectedProductoId] = useState<number>(
    initialProductos[0]?.id_producto ?? 0
  );
  const [codigoLote, setCodigoLote] = useState<string>(codigoLoteInicial);
  const [fechaElaboracion, setFechaElaboracion] =
    useState<string>(fechaHoyBolivia);
  const [kilosInput, setKilosInput] = useState<string>('');
  const [observacion, setObservacion] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const formRef = useRef<HTMLElement>(null);
  const kilosInputRef = useRef<HTMLInputElement>(null);

  const productosEnDeficit = useMemo(() => {
    return productos
      .filter((p) => Number(p.stock_disponible_kilos) <= 0)
      .sort(
        (a, b) =>
          Number(a.stock_disponible_kilos) - Number(b.stock_disponible_kilos)
      );
  }, [productos]);

  const productosConStock = useMemo(() => {
    return productos.filter((p) => Number(p.stock_disponible_kilos) > 0);
  }, [productos]);

  const productoSeleccionado = useMemo(() => {
    return (
      productos.find((p) => p.id_producto === selectedProductoId) ??
      productos[0] ??
      null
    );
  }, [productos, selectedProductoId]);

  const kilosNumericos = useMemo(() => {
    const parsed = parseFloat(kilosInput);
    return Number.isFinite(parsed) && parsed > 0
      ? Number(parsed.toFixed(3))
      : 0;
  }, [kilosInput]);

  const stockActual = Number(productoSeleccionado?.stock_fisico_kilos ?? 0);
  const nuevoSaldoCamara = Number((stockActual + kilosNumericos).toFixed(3));

  const handleAutogenerarCodigo = () => {
    setCodigoLote(generarCodigoLoteTimestamp(fechaElaboracion));
  };

  const handleSeleccionarParaProducir = (prod: ProductoProduccionItem) => {
    setSelectedProductoId(prod.id_producto);
    const faltante = Math.abs(Number(prod.stock_disponible_kilos));
    setKilosInput(faltante > 0 ? faltante.toFixed(3) : '25.000');
    setObservacion(`Cobertura déficit preventa (${prod.codigo_sku})`);
    setFeedbackBanner(null);
    setVistaMovil('ingreso');

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      kilosInputRef.current?.focus();
    }, 120);
  };

  const handleSumarKilos = (cantidad: number) => {
    const base = parseFloat(kilosInput);
    const actual = Number.isFinite(base) && base >= 0 ? base : 0;
    setKilosInput((actual + cantidad).toFixed(3));
  };

  const handleLimpiarKilos = () => {
    setKilosInput('');
    kilosInputRef.current?.focus();
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
        message: 'La cantidad producida debe ser mayor a 0.000 kg.',
      });
      kilosInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const resultado = await registrarLoteProduccionAction({
        id_producto: productoSeleccionado.id_producto,
        codigo_lote_interno: codigoNormalizado,
        kilos_producidos: kilosNumericos,
        fecha_elaboracion: fechaElaboracion,
        observacion: observacion.trim() || undefined,
      });

      if (!resultado.ok) {
        setFeedbackBanner({
          type: 'error',
          message: resultado.error,
        });
        return;
      }

      const nuevoFisico = Number(resultado.data.saldo_nuevo.toFixed(3));
      const nuevoDisponible = Number(
        (
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
      setKilosInput('');
      setObservacion('');

      setFeedbackBanner({
        type: 'success',
        message: `Lote ${codigoNormalizado} (+${formatKg(kilosNumericos)} kg) registrado en Kardex (#${resultado.data.id_movimiento}). Nuevo físico en cámara: ${formatKg(nuevoFisico)} kg.`,
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
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
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
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs font-bold ${
              perfilProduccion.responsable_camara_frio
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
      </header>

      {/* Selector rápido en móvil (< lg) */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs lg:hidden">
        <button
          type="button"
          onClick={() => setVistaMovil('ingreso')}
          className={`touch-manipulation flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold transition ${
            vistaMovil === 'ingreso'
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
          className={`touch-manipulation flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold transition ${
            vistaMovil === 'deficit'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="h-4 w-4 shrink-0" />
          <span>Déficit Preventa</span>
          <span
            className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-black tabular-nums ${
              productosEnDeficit.length > 0
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
          className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-3.5 shadow-sm sm:p-4 ${
            feedbackBanner.type === 'success'
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
          CUERPO EN 2 COLUMNAS (MONITOR DE DÉFICIT + FORMULARIO DE LOTE)
         ==================================================================== */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* COLUMNA IZQUIERDA (lg:col-span-5) — MONITOR DE DÉFICIT (RF-13, CU-P03) */}
        <section
          aria-labelledby="titulo-deficit-preventa"
          className={`${
            vistaMovil === 'deficit' ? 'block' : 'hidden'
          } space-y-4 lg:col-span-5 lg:block`}
        >
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C8102E] text-white">
                <ClipboardList className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h2
                  id="titulo-deficit-preventa"
                  className="text-sm font-black uppercase tracking-tight text-slate-900 sm:text-base"
                >
                  Monitor de Déficit
                </h2>
                <p className="font-mono text-[11px] font-semibold text-slate-500">
                  Stock disponible &le; 0.000 kg (RF-13)
                </p>
              </div>
            </div>

            <span
              className={`shrink-0 rounded-lg border px-2.5 py-1 font-mono text-xs font-black tabular-nums ${
                productosEnDeficit.length > 0
                  ? 'border-red-300 bg-red-100 text-[#C8102E]'
                  : 'border-emerald-300 bg-emerald-100 text-emerald-800'
              }`}
            >
              {productosEnDeficit.length}
            </span>
          </div>

          {productosEnDeficit.length === 0 ? (
            <div className="rounded-2xl border-2 border-emerald-500/80 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" strokeWidth={2.4} />
                </div>
                <div>
                  <span className="font-mono text-[11px] font-black uppercase tracking-wider text-emerald-700">
                    INVENTARIO SIN FALTANTES
                  </span>
                  <p className="mt-1 text-base font-extrabold leading-snug text-slate-900">
                    Cámara Cubierta — Todos los productos superan la preventa
                    comprometida.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {productosEnDeficit.map((prod) => {
                const sinStock =
                  Number(prod.stock_fisico_kilos) === 0 &&
                  Number(prod.stock_comprometido_kilos) === 0;
                const kilosFaltantes = Math.abs(
                  Number(prod.stock_disponible_kilos)
                );
                const isSelected = prod.id_producto === selectedProductoId;

                return (
                  <article
                    key={prod.id_producto}
                    className={`overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all ${
                      isSelected
                        ? 'border-[#C8102E] ring-4 ring-[#FFCD00]/40'
                        : 'border-red-200 hover:border-red-400'
                    }`}
                  >
                    <div className="flex h-1.5 w-full">
                      <div className="w-2/3 bg-[#C8102E]" />
                      <div className="w-1/3 bg-[#FFCD00]" />
                    </div>

                    <div className="space-y-3.5 p-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                            {prod.codigo_sku}
                          </span>
                          <span
                            className={`rounded border px-2 py-0.5 font-mono text-[11px] font-black uppercase ${
                              prod.formato === 'VACIO'
                                ? 'border-sky-300 bg-sky-50 text-sky-800'
                                : 'border-amber-300 bg-amber-50 text-amber-900'
                            }`}
                          >
                            {prod.formato}
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-base font-black leading-snug text-slate-900">
                          {prod.nombre_producto}
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div>
                          <span className="block text-[11px] font-bold uppercase text-slate-500">
                            Stock Físico
                          </span>
                          <span className="mt-0.5 block font-mono text-base font-extrabold tabular-nums text-slate-900">
                            {formatKg(Number(prod.stock_fisico_kilos))} kg
                          </span>
                        </div>
                        <div className="border-l border-slate-200 pl-3">
                          <span className="block text-[11px] font-bold uppercase text-slate-500">
                            Preventa Comprometida
                          </span>
                          <span className="mt-0.5 block font-mono text-base font-extrabold tabular-nums text-slate-900">
                            {formatKg(Number(prod.stock_comprometido_kilos))} kg
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-xl border-2 border-[#C8102E] bg-red-50 px-3.5 py-2.5">
                        <span className="flex items-center gap-1.5 font-mono text-xs font-black uppercase text-[#C8102E]">
                          <AlertTriangle
                            className="h-4 w-4 shrink-0"
                            strokeWidth={2.5}
                          />
                          DÉFICIT
                        </span>
                        <span className="font-mono text-sm font-black tabular-nums text-[#C8102E] sm:text-base">
                          {sinStock
                            ? 'SIN STOCK'
                            : `FALTAN ${formatKg(kilosFaltantes)} kg`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSeleccionarParaProducir(prod)}
                        className="touch-manipulation flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:brightness-110 active:translate-y-[2px] active:border-b-2"
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

        {/* COLUMNA DERECHA (lg:col-span-7) — FORMULARIO DE INGRESO DE LOTE (RF-11, CU-P01) */}
        <section
          ref={formRef}
          aria-labelledby="titulo-form-lote"
          className={`${
            vistaMovil === 'ingreso' ? 'block' : 'hidden'
          } lg:col-span-7 lg:block`}
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
                <span
                  className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-black uppercase ${
                    productoSeleccionado.formato === 'VACIO'
                      ? 'border-sky-300 bg-sky-50 text-sky-900'
                      : 'border-amber-300 bg-amber-50 text-amber-900'
                  }`}
                >
                  {productoSeleccionado.formato}
                </span>
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
                {/* 1. Selector de Producto */}
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="select-producto-terminado"
                      className="text-xs font-extrabold uppercase tracking-wide text-slate-700"
                    >
                      1. Producto Activo
                    </label>
                    {productoSeleccionado && (
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="rounded bg-slate-900 px-2 py-0.5 font-bold text-white">
                          {productoSeleccionado.codigo_sku}
                        </span>
                        <span className="font-bold text-slate-600 tabular-nums">
                          Stock: {formatKg(stockActual)} kg
                        </span>
                      </div>
                    )}
                  </div>

                  <select
                    id="select-producto-terminado"
                    value={productoSeleccionado?.id_producto ?? ''}
                    onChange={(e) =>
                      setSelectedProductoId(Number(e.target.value))
                    }
                    className="min-h-[52px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-inner transition focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30 sm:text-base"
                  >
                    {productosEnDeficit.length > 0 && (
                      <optgroup label="PRIORIDAD — CON DÉFICIT DE PREVENTA">
                        {productosEnDeficit.map((prod) => (
                          <option
                            key={prod.id_producto}
                            value={prod.id_producto}
                          >
                            [{prod.codigo_sku}] {prod.nombre_producto} (
                            {prod.formato}) — Faltan{' '}
                            {formatKg(
                              Math.abs(Number(prod.stock_disponible_kilos))
                            )}{' '}
                            kg
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {productosConStock.length > 0 && (
                      <optgroup label="INVENTARIO CON STOCK CUBIERTO">
                        {productosConStock.map((prod) => (
                          <option
                            key={prod.id_producto}
                            value={prod.id_producto}
                          >
                            [{prod.codigo_sku}] {prod.nombre_producto} (
                            {prod.formato}) — Stock:{' '}
                            {formatKg(Number(prod.stock_fisico_kilos))} kg
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* 2. Kilos Producidos + Botones Rápidos */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="input-kilos-producidos"
                      className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700"
                    >
                      <Scale
                        className="h-3.5 w-3.5 text-[#C8102E]"
                        strokeWidth={2.4}
                      />
                      <span>2. Kilos Producidos</span>
                    </label>
                    <span className="font-mono text-[11px] font-semibold text-slate-500">
                      Precisión 3 dec. (0.001 kg)
                    </span>
                  </div>

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
                      onClick={handleLimpiarKilos}
                      className="touch-manipulation col-span-2 flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-slate-100 font-mono text-xs font-extrabold uppercase text-slate-700 transition hover:border-slate-300 hover:bg-slate-200 active:translate-y-[1px] sm:col-span-1"
                    >
                      <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} />
                      <span>Limpiar</span>
                    </button>
                  </div>
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
                    placeholder="Ej. Tanda 1 horno / cámara 2"
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

                {/* 6. Botón Principal (visible en móvil y escritorio sin solapar nav) */}
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
    </div>
  );
}

