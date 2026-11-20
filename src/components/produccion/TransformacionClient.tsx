'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Info,
  Package,
  PackageCheck,
  PackageOpen,
  Scale,
  ShieldAlert,
  Sparkles,
  ThermometerSnowflake,
  X,
} from 'lucide-react';
import { registrarTransformacionInventarioAction } from '@/actions/produccion.actions';
import {
  ProductoProduccionSelectorModal,
  type ProductoProduccionItem,
} from '@/components/produccion/ProductoProduccionSelectorModal';
import type { PerfilProduccionResumen } from '@/components/produccion/IngresoLotesClient';

export interface TransformacionClientProps {
  productosGranel: ProductoProduccionItem[];
  productosVacio: ProductoProduccionItem[];
  perfilProduccion: PerfilProduccionResumen;
}

function formatKg(valor: number): string {
  if (Number.isNaN(valor) || !Number.isFinite(valor)) return '0.000';
  return valor.toFixed(3);
}

function formatPct(valor: number): string {
  if (Number.isNaN(valor) || !Number.isFinite(valor)) return '0.00';
  return valor.toFixed(2);
}

function parseDecimalInput(raw: string): number {
  const sanitized = raw.replace(',', '.').trim();
  if (!sanitized) return 0;
  const parsed = parseFloat(sanitized);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : Number(parsed.toFixed(3));
}

export function TransformacionClient({
  productosGranel,
  productosVacio,
  perfilProduccion,
}: TransformacionClientProps) {
  const router = useRouter();

  const [listaGranel, setListaGranel] =
    useState<ProductoProduccionItem[]>(productosGranel);
  const [listaVacio, setListaVacio] =
    useState<ProductoProduccionItem[]>(productosVacio);
  const [prevProductosGranel, setPrevProductosGranel] =
    useState<ProductoProduccionItem[]>(productosGranel);
  const [prevProductosVacio, setPrevProductosVacio] =
    useState<ProductoProduccionItem[]>(productosVacio);

  if (productosGranel !== prevProductosGranel) {
    setPrevProductosGranel(productosGranel);
    setListaGranel(productosGranel);
  }

  if (productosVacio !== prevProductosVacio) {
    setPrevProductosVacio(productosVacio);
    setListaVacio(productosVacio);
  }

  const [idOrigen, setIdOrigen] = useState<number>(
    productosGranel[0]?.id_producto ?? 0
  );
  const [idDestino, setIdDestino] = useState<number>(
    productosVacio[0]?.id_producto ?? 0
  );

  const [kilosOrigenRaw, setKilosOrigenRaw] = useState<string>('');
  const [kilosDestinoRaw, setKilosDestinoRaw] = useState<string>('');
  const [observacion, setObservacion] = useState<string>('');

  const [sheetOrigenOpen, setSheetOrigenOpen] = useState(false);
  const [sheetDestinoOpen, setSheetDestinoOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tipo: 'exito' | 'error';
    mensaje: string;
    detalle?: string;
  } | null>(null);

  const productoOrigen = useMemo(
    () => listaGranel.find((p) => p.id_producto === idOrigen) ?? null,
    [listaGranel, idOrigen]
  );

  const productoDestino = useMemo(
    () => listaVacio.find((p) => p.id_producto === idDestino) ?? null,
    [listaVacio, idDestino]
  );

  const kilosOrigen = useMemo(
    () => parseDecimalInput(kilosOrigenRaw),
    [kilosOrigenRaw]
  );
  const kilosDestino = useMemo(
    () => parseDecimalInput(kilosDestinoRaw),
    [kilosDestinoRaw]
  );

  const auditoria = useMemo(() => {
    const stockActualGranel = Number(productoOrigen?.stock_fisico_kilos ?? 0);
    const stockActualVacio = Number(productoDestino?.stock_fisico_kilos ?? 0);

    const saldoResultanteGranel = Math.max(0, stockActualGranel - kilosOrigen);
    const saldoResultanteVacio = stockActualVacio + kilosDestino;

    const mermaKilos =
      kilosOrigen > 0 && kilosDestino <= kilosOrigen
        ? Number((kilosOrigen - kilosDestino).toFixed(3))
        : 0;

    const porcentajeMerma =
      kilosOrigen > 0 && kilosDestino <= kilosOrigen
        ? Number(((mermaKilos / kilosOrigen) * 100).toFixed(2))
        : 0;

    const excedeStockOrigen =
      productoOrigen !== null && kilosOrigen > stockActualGranel;

    const destinoSuperaOrigen = kilosOrigen > 0 && kilosDestino > kilosOrigen;

    const excedeToleranciaMerma =
      kilosOrigen > 0 &&
      !destinoSuperaOrigen &&
      porcentajeMerma > perfilProduccion.tolerancia_merma_max_pct;

    const enDeficitDestino =
      productoDestino !== null &&
      Number(productoDestino.stock_disponible_kilos) <= 0;

    const deficitPreventaDestino = productoDestino
      ? Math.abs(Number(productoDestino.stock_disponible_kilos))
      : 0;

    const formularioValido =
      productoOrigen !== null &&
      productoDestino !== null &&
      kilosOrigen > 0 &&
      kilosDestino > 0 &&
      !excedeStockOrigen &&
      !destinoSuperaOrigen;

    return {
      stockActualGranel,
      stockActualVacio,
      saldoResultanteGranel,
      saldoResultanteVacio,
      mermaKilos,
      porcentajeMerma,
      excedeStockOrigen,
      destinoSuperaOrigen,
      excedeToleranciaMerma,
      enDeficitDestino,
      deficitPreventaDestino,
      formularioValido,
    };
  }, [
    productoOrigen,
    productoDestino,
    kilosOrigen,
    kilosDestino,
    perfilProduccion.tolerancia_merma_max_pct,
  ]);

  const handleSumarKilosOrigen = (incremento: number) => {
    const nuevoValor = Number((kilosOrigen + incremento).toFixed(3));
    setKilosOrigenRaw(nuevoValor.toFixed(3));
    setFeedbackBanner(null);
  };

  const handleEstimarMermaSugerida = () => {
    if (kilosOrigen <= 0) return;
    const estimado = Number((kilosOrigen * 0.985).toFixed(3));
    setKilosDestinoRaw(estimado.toFixed(3));
    setFeedbackBanner(null);
  };

  const handleConfirmarTransformacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditoria.formularioValido || !productoOrigen || !productoDestino) {
      return;
    }

    setIsSubmitting(true);
    setFeedbackBanner(null);

    try {
      const resultado = await registrarTransformacionInventarioAction({
        id_producto_origen: productoOrigen.id_producto,
        id_producto_destino: productoDestino.id_producto,
        kilos_origen_usados: kilosOrigen,
        kilos_destino_obtenidos: kilosDestino,
        observacion: observacion.trim() || undefined,
      });

      if (!resultado.ok) {
        setFeedbackBanner({
          tipo: 'error',
          mensaje: resultado.error,
        });
        return;
      }

      const saldoNuevoOrigen = Number(
        (
          resultado.data.saldo_origen_nuevo ??
          Math.max(0, Number(productoOrigen.stock_fisico_kilos) - kilosOrigen)
        ).toFixed(3)
      );
      const saldoNuevoDestino = Number(
        (
          resultado.data.saldo_destino_nuevo ??
          Number(productoDestino.stock_fisico_kilos) + kilosDestino
        ).toFixed(3)
      );
      const saldoDispOrigen = Number(
        (
          resultado.data.saldo_disponible_origen ??
          saldoNuevoOrigen - Number(productoOrigen.stock_comprometido_kilos)
        ).toFixed(3)
      );
      const saldoDispDestino = Number(
        (
          resultado.data.saldo_disponible_destino ??
          saldoNuevoDestino - Number(productoDestino.stock_comprometido_kilos)
        ).toFixed(3)
      );
      const mermaReal = Number(resultado.data.merma_kilos.toFixed(3));

      setListaGranel((prev) =>
        prev.map((item) =>
          item.id_producto === productoOrigen.id_producto
            ? {
              ...item,
              stock_fisico_kilos: saldoNuevoOrigen,
              stock_disponible_kilos: saldoDispOrigen,
            }
            : item
        )
      );

      setListaVacio((prev) =>
        prev.map((item) =>
          item.id_producto === productoDestino.id_producto
            ? {
              ...item,
              stock_fisico_kilos: saldoNuevoDestino,
              stock_disponible_kilos: saldoDispDestino,
            }
            : item
        )
      );

      setFeedbackBanner({
        tipo: 'exito',
        mensaje: `Transformación #${resultado.data.id_transformacion} registrada en Kardex: -${formatKg(kilosOrigen)} kg Granel → +${formatKg(kilosDestino)} kg Vacío`,
        detalle: `Merma por escurrido auditada: ${formatKg(mermaReal)} kg (${formatPct(auditoria.porcentajeMerma)}%) • Nuevo saldo origen: ${formatKg(saldoNuevoOrigen)} kg`,
      });

      setKilosOrigenRaw('');
      setKilosDestinoRaw('');
      setObservacion('');
      router.refresh();
    } catch {
      setFeedbackBanner({
        tipo: 'error',
        mensaje:
          'No se pudo registrar el movimiento en Kardex. Verifique su conexión e intente nuevamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-6 text-slate-900">
      {/* ====================================================================
          1. BARRA DE CONTEXTO COMPACTA (SIN DUPLICAR HEADER GLOBAL)
         ==================================================================== */}
      <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#C8102E] text-white">
                <ArrowLeftRight className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <h1 className="truncate text-base font-black tracking-tight text-slate-900 sm:text-lg">
                Transformación Granel → Vacío
              </h1>
            </div>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              Empaque al vacío y control automático de merma por escurrido
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800">
              <Clock className="h-3.5 w-3.5 text-[#C8102E]" strokeWidth={2.2} />
              <span>Turno:</span>
              <span className="font-mono font-extrabold text-slate-900">
                {perfilProduccion.turno_planta}
              </span>
            </span>

            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${perfilProduccion.responsable_camara_frio
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-slate-200 bg-slate-100 text-slate-700'
                }`}
            >
              <ThermometerSnowflake
                className="h-3.5 w-3.5 text-emerald-700"
                strokeWidth={2.2}
              />
              <span>Cámara:</span>
              <span className="font-mono font-extrabold">
                {perfilProduccion.responsable_camara_frio
                  ? 'ACTIVA'
                  : 'INACTIVA'}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFCD00] bg-[#FFCD00]/25 px-2.5 py-1 text-xs font-bold text-slate-900">
              <Scale className="h-3.5 w-3.5 text-slate-900" strokeWidth={2.2} />
              <span>Tol. Máx:</span>
              <span className="font-mono font-black tabular-nums">
                {formatPct(perfilProduccion.tolerancia_merma_max_pct)}%
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* Banner de Confirmación o Error */}
      {feedbackBanner && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-2xl border-2 p-4 shadow-sm ${feedbackBanner.tipo === 'exito'
            ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
            : 'border-[#C8102E] bg-red-50 text-red-950'
            }`}
        >
          <div className="flex min-w-0 items-start gap-3">
            {feedbackBanner.tipo === 'exito' ? (
              <CheckCircle2
                className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700"
                strokeWidth={2.2}
              />
            ) : (
              <ShieldAlert
                className="mt-0.5 h-6 w-6 shrink-0 text-[#C8102E]"
                strokeWidth={2.2}
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-extrabold leading-snug">
                {feedbackBanner.mensaje}
              </p>
              {feedbackBanner.detalle && (
                <p className="mt-1 font-mono text-xs font-semibold tabular-nums opacity-90">
                  {feedbackBanner.detalle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-lg hover:bg-black/5"
            aria-label="Cerrar notificación"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
      )}

      {/* ====================================================================
          2. FLUJO DE CONVERSIÓN GRANEL -> VACÍO Y AUDITORÍA DE MERMA
         ==================================================================== */}
      <form
        onSubmit={handleConfirmarTransformacion}
        className="grid grid-cols-1 gap-5 lg:grid-cols-12"
        noValidate
      >
        {/* TARJETA 1 — PRODUCTO ORIGEN (GRANEL) */}
        <article className="flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-slate-200/90 border-t-4 border-t-[#C8102E] bg-white shadow-xs lg:col-span-6">
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#C8102E] font-mono text-xs font-black text-white">
                  1
                </span>
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-900 sm:text-base">
                  Producto Origen (Granel)
                </h2>
              </div>
              <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[11px] font-bold text-[#9E0B22]">
                SALIDA CÁMARA
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Seleccionar Lote Granel
              </label>
              <button
                type="button"
                disabled={listaGranel.length === 0}
                onClick={() => setSheetOrigenOpen(true)}
                className="touch-manipulation flex min-h-[54px] w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-left transition hover:border-[#C8102E] hover:bg-white focus:border-[#C8102E] focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none disabled:opacity-60"
              >
                {productoOrigen ? (
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-xs font-extrabold text-white">
                        {productoOrigen.codigo_sku}
                      </span>
                      <span className="text-xs font-bold text-[#9E0B22]">
                        GRANEL
                      </span>
                      {String(productoOrigen.unidad_medida).toUpperCase() ===
                        'UNIDAD' && (
                          <span className="inline-flex items-center gap-1 rounded border border-purple-300 bg-purple-50 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-purple-900">
                            <Package className="h-3 w-3" />
                            UNIDAD (
                            {Math.round(
                              (productoOrigen.peso_unidad_kilos || 0.5) * 1000
                            )}
                            g)
                          </span>
                        )}
                    </div>
                    <p className="mt-1 break-words text-sm font-bold leading-snug text-slate-900">
                      {productoOrigen.nombre_producto}
                    </p>
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-slate-500">
                    {listaGranel.length === 0
                      ? 'Sin productos GRANEL activos'
                      : 'Toque para elegir producto a granel...'}
                  </span>
                )}
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-slate-500"
                  strokeWidth={2.2}
                />
              </button>
            </div>

            {productoOrigen && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <PackageOpen
                    className="h-4 w-4 shrink-0 text-[#C8102E]"
                    strokeWidth={2.2}
                  />
                  <span>Stock Físico en Cámara:</span>
                </div>
                <span className="font-mono text-sm font-black tabular-nums text-slate-900 sm:text-base">
                  {formatKg(Number(productoOrigen.stock_fisico_kilos))} kg
                </span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="input-kilos-origen"
                  className="text-xs font-extrabold uppercase tracking-wider text-slate-700"
                >
                  Kilos Origen Usados (kg)
                </label>
                {kilosOrigen > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setKilosOrigenRaw('');
                      setFeedbackBanner(null);
                    }}
                    className="text-xs font-bold text-slate-500 underline hover:text-[#C8102E]"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  id="input-kilos-origen"
                  type="number"
                  step="0.001"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.000"
                  value={kilosOrigenRaw}
                  onChange={(e) => {
                    setKilosOrigenRaw(e.target.value);
                    setFeedbackBanner(null);
                  }}
                  className={`min-h-[56px] w-full rounded-xl border-2 pr-14 pl-4 font-mono text-2xl font-black tabular-nums transition focus:outline-none ${auditoria.excedeStockOrigen
                    ? 'border-red-600 bg-red-50/60 text-red-900 focus:ring-4 focus:ring-red-500/25'
                    : 'border-slate-200 bg-slate-50/60 text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30'
                    }`}
                />
                <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-mono text-sm font-extrabold text-slate-500">
                  KG
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[10, 25, 50].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => handleSumarKilosOrigen(inc)}
                    className="touch-manipulation min-h-[48px] rounded-xl border-2 border-slate-200 bg-white font-mono text-sm font-extrabold tabular-nums text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 active:translate-y-[1px]"
                  >
                    +{inc} kg
                  </button>
                ))}
              </div>
            </div>

            {auditoria.excedeStockOrigen && productoOrigen && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border-2 border-red-600 bg-red-50 p-3 text-red-900"
              >
                <ShieldAlert
                  className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
                  strokeWidth={2.2}
                />
                <p className="text-xs font-extrabold leading-snug">
                  Stock insuficiente en cámara: intenta retirar{' '}
                  <span className="font-mono underline tabular-nums">
                    {formatKg(kilosOrigen)} kg
                  </span>
                  , pero solo hay{' '}
                  <span className="font-mono underline tabular-nums">
                    {formatKg(Number(productoOrigen.stock_fisico_kilos))} kg
                  </span>{' '}
                  físicos disponibles.
                </p>
              </div>
            )}
          </div>
        </article>

        {/* TARJETA 2 — PRODUCTO DESTINO (VACÍO) */}
        <article className="flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-slate-200/90 border-t-4 border-t-[#FFCD00] bg-white shadow-xs lg:col-span-6">
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#FFCD00] font-mono text-xs font-black text-slate-950">
                  2
                </span>
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-900 sm:text-base">
                  Producto Destino (Al Vacío)
                </h2>
              </div>
              <span className="rounded border border-amber-300 bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-950">
                ENTRADA EMPAQUE
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Seleccionar SKU Empacado al Vacío
              </label>
              <button
                type="button"
                disabled={listaVacio.length === 0}
                onClick={() => setSheetDestinoOpen(true)}
                className="touch-manipulation flex min-h-[54px] w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-left transition hover:border-[#FFCD00] hover:bg-white focus:border-[#C8102E] focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none disabled:opacity-60"
              >
                {productoDestino ? (
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-xs font-extrabold text-white">
                        {productoDestino.codigo_sku}
                      </span>
                      <span className="text-xs font-extrabold text-amber-800">
                        VACIO
                      </span>
                      {String(productoDestino.unidad_medida).toUpperCase() ===
                        'UNIDAD' && (
                          <span className="inline-flex items-center gap-1 rounded border border-purple-300 bg-purple-50 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-purple-900">
                            <Package className="h-3 w-3" />
                            UNIDAD (
                            {Math.round(
                              (productoDestino.peso_unidad_kilos || 0.5) * 1000
                            )}
                            g)
                          </span>
                        )}
                    </div>
                    <p className="mt-1 break-words text-sm font-bold leading-snug text-slate-900">
                      {productoDestino.nombre_producto}
                    </p>
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-slate-500">
                    {listaVacio.length === 0
                      ? 'Sin productos VACIO activos'
                      : 'Toque para elegir producto al vacío...'}
                  </span>
                )}
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-slate-500"
                  strokeWidth={2.2}
                />
              </button>
            </div>

            {productoDestino && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <PackageCheck
                    className="h-4 w-4 shrink-0 text-amber-700"
                    strokeWidth={2.2}
                  />
                  <span>
                    Stock Físico:{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {formatKg(Number(productoDestino.stock_fisico_kilos))} kg
                    </strong>
                  </span>
                </div>

                {auditoria.enDeficitDestino ? (
                  <span className="rounded-md bg-rose-600 px-2.5 py-0.5 font-mono text-xs font-extrabold tabular-nums text-white">
                    {auditoria.deficitPreventaDestino > 0
                      ? `Faltan ${formatKg(auditoria.deficitPreventaDestino)} kg`
                      : 'Sin stock disponible'}
                  </span>
                ) : (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-xs font-bold text-emerald-900">
                    Preventa cubierta
                  </span>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="input-kilos-destino"
                  className="text-xs font-extrabold uppercase tracking-wider text-slate-700"
                >
                  Kilos Destino Obtenidos (kg)
                </label>
                {kilosDestino > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setKilosDestinoRaw('');
                      setFeedbackBanner(null);
                    }}
                    className="text-xs font-bold text-slate-500 underline hover:text-[#C8102E]"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  id="input-kilos-destino"
                  type="number"
                  step="0.001"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.000"
                  value={kilosDestinoRaw}
                  onChange={(e) => {
                    setKilosDestinoRaw(e.target.value);
                    setFeedbackBanner(null);
                  }}
                  className={`min-h-[56px] w-full rounded-xl border-2 pr-14 pl-4 font-mono text-2xl font-black tabular-nums transition focus:outline-none ${auditoria.destinoSuperaOrigen
                    ? 'border-red-600 bg-red-50/60 text-red-900 focus:ring-4 focus:ring-red-500/25'
                    : 'border-slate-200 bg-slate-50/60 text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30'
                    }`}
                />
                <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-mono text-sm font-extrabold text-slate-500">
                  KG
                </span>
              </div>

              {productoDestino &&
                String(productoDestino.unidad_medida).toUpperCase() ===
                'UNIDAD' &&
                kilosDestino > 0 &&
                productoDestino.peso_unidad_kilos > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/70 px-3 py-2 font-mono text-xs">
                    <span className="font-bold text-purple-900">
                      Paquetes empacados (
                      {Math.round(productoDestino.peso_unidad_kilos * 1000)}g):
                    </span>
                    <span className="font-black tabular-nums text-slate-900">
                      {(
                        kilosDestino / productoDestino.peso_unidad_kilos
                      ).toFixed(1)}{' '}
                      unid.
                    </span>
                  </div>
                )}

              <div className="pt-1">
                <button
                  type="button"
                  disabled={kilosOrigen <= 0}
                  onClick={handleEstimarMermaSugerida}
                  className="touch-manipulation flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-300 bg-[#FFCD00]/20 px-3.5 text-xs font-extrabold text-slate-900 transition hover:bg-[#FFCD00]/35 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm"
                >
                  <Sparkles
                    className="h-4 w-4 shrink-0 text-amber-700"
                    strokeWidth={2.2}
                  />
                  <span>Estimar -1.5% merma</span>
                  {kilosOrigen > 0 && (
                    <span className="font-mono font-black tabular-nums text-slate-800">
                      ({formatKg(kilosOrigen * 0.985)} kg)
                    </span>
                  )}
                </button>
              </div>
            </div>

            {auditoria.destinoSuperaOrigen && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border-2 border-red-600 bg-red-50 p-3 text-red-900"
              >
                <ShieldAlert
                  className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
                  strokeWidth={2.2}
                />
                <p className="text-xs font-extrabold leading-snug">
                  Los kilos obtenidos al vacío no pueden superar los kilos
                  retirados de granel.
                </p>
              </div>
            )}
          </div>
        </article>

        {/* TARJETA 3 — AUDITORÍA EN VIVO DE MERMA E IMPACTO EN KARDEX */}
        <article className="overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-xs lg:col-span-12">
          <div className="flex h-1.5 w-full">
            <div className="w-2/3 bg-[#C8102E]" />
            <div className="w-1/3 bg-[#FFCD00]" />
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 font-mono text-xs font-black text-[#FFCD00]">
                  3
                </span>
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-900 sm:text-base">
                  Auditoría en Vivo de Merma e Impacto en Kardex
                </h2>
              </div>

              <span className="font-mono text-xs font-bold text-slate-500">
                RF-12 • CU-P02
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 tabular-nums sm:grid-cols-4">
              <div className="flex flex-col justify-between rounded-xl border-2 border-slate-200 bg-slate-50 p-3.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  1. Salida Granel
                </span>
                <p className="mt-1 font-mono text-lg font-black text-[#C8102E] sm:text-xl">
                  -{formatKg(kilosOrigen)} kg
                </p>
                <p className="mt-1.5 border-t border-slate-200 pt-1.5 font-mono text-[11px] font-semibold text-slate-600">
                  {formatKg(auditoria.stockActualGranel)} →{' '}
                  <strong className="text-slate-900">
                    {formatKg(auditoria.saldoResultanteGranel)} kg
                  </strong>
                </p>
              </div>

              <div className="flex flex-col justify-between rounded-xl border-2 border-slate-200 bg-slate-50 p-3.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  2. Entrada Vacío
                </span>
                <p className="mt-1 font-mono text-lg font-black text-emerald-700 sm:text-xl">
                  +{formatKg(kilosDestino)} kg
                </p>
                <p className="mt-1.5 border-t border-slate-200 pt-1.5 font-mono text-[11px] font-semibold text-slate-600">
                  {formatKg(auditoria.stockActualVacio)} →{' '}
                  <strong className="text-slate-900">
                    {formatKg(auditoria.saldoResultanteVacio)} kg
                  </strong>
                </p>
              </div>

              <div className="flex flex-col justify-between rounded-xl border-2 border-slate-200 bg-slate-50 p-3.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  3. Merma por Escurrido
                </span>
                <p className="mt-1 font-mono text-lg font-black text-slate-900 sm:text-xl">
                  {formatKg(auditoria.mermaKilos)} kg
                </p>
                <p className="mt-1.5 border-t border-slate-200 pt-1.5 text-[11px] font-semibold text-slate-500">
                  Diferencia (origen − destino)
                </p>
              </div>

              <div
                className={`flex flex-col justify-between rounded-xl border-2 p-3.5 transition ${auditoria.excedeToleranciaMerma
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-slate-200 bg-slate-50'
                  }`}
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  4. % Merma
                </span>
                <p
                  className={`mt-1 font-mono text-lg font-black sm:text-xl ${auditoria.excedeToleranciaMerma
                    ? 'text-amber-800'
                    : 'text-slate-900'
                    }`}
                >
                  {formatPct(auditoria.porcentajeMerma)}%
                </p>
                <div className="mt-1.5 border-t border-slate-200/80 pt-1.5">
                  {auditoria.excedeToleranciaMerma ? (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Excede tolerancia de{' '}
                      {formatPct(perfilProduccion.tolerancia_merma_max_pct)}%
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-900">
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      Dentro de tolerancia ≤{' '}
                      {formatPct(perfilProduccion.tolerancia_merma_max_pct)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {auditoria.excedeToleranciaMerma && (
              <div className="flex items-start gap-3 rounded-xl border-l-4 border-amber-500 bg-amber-50 p-3.5 text-amber-950">
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                  strokeWidth={2.2}
                />
                <div className="text-xs leading-relaxed">
                  <p className="font-extrabold">
                    Advertencia de Control de Calidad: Merma superior a{' '}
                    {formatPct(perfilProduccion.tolerancia_merma_max_pct)}%
                  </p>
                  <p className="mt-0.5 text-amber-900">
                    Puede registrar la conversión bajo supervisión, pero se
                    recomienda detallar el motivo en la observación de Kardex.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="input-observacion-transformacion"
                className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700"
              >
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>Observación para Kardex (Opcional)</span>
              </label>
              <input
                id="input-observacion-transformacion"
                type="text"
                maxLength={180}
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Ej. Empaque al vacío lote mañana — sellado doble cámara 01"
                className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3.5 text-base text-slate-900 shadow-inner transition focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={!auditoria.formularioValido || isSubmitting}
                className="touch-manipulation flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-5 py-3 text-sm font-extrabold tracking-wide text-white shadow-md transition hover:brightness-105 active:translate-y-[2px] active:border-b-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 disabled:active:border-b-4 sm:text-base"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Registrando movimiento en Kardex...</span>
                  </>
                ) : (
                  <>
                    <ArrowLeftRight
                      className="h-5 w-5 shrink-0"
                      strokeWidth={2.3}
                    />
                    <span>Confirmar Transformación y Actualizar Kardex</span>
                  </>
                )}
              </button>

              {!auditoria.formularioValido && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-slate-500">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Ingrese kilos válidos en origen y destino dentro del stock
                    físico disponible para habilitar el registro.
                  </span>
                </p>
              )}
            </div>
          </div>
        </article>
      </form>

      {sheetOrigenOpen && (
        <ProductoProduccionSelectorModal
          onClose={() => setSheetOrigenOpen(false)}
          title="Seleccionar Producto Origen (GRANEL)"
          subtitle="Productos disponibles en formato granel en cámara de frío"
          accentColor="crimson"
          productos={listaGranel}
          selectedId={idOrigen}
          onSelect={(prod) => {
            setIdOrigen(prod.id_producto);
            setFeedbackBanner(null);
          }}
        />
      )}

      {sheetDestinoOpen && (
        <ProductoProduccionSelectorModal
          onClose={() => setSheetDestinoOpen(false)}
          title="Seleccionar Producto Destino (AL VACÍO)"
          subtitle="Seleccione el SKU empacado al vacío que ingresará a stock"
          accentColor="yellow"
          productos={listaVacio}
          selectedId={idDestino}
          onSelect={(prod) => {
            setIdDestino(prod.id_producto);
            setFeedbackBanner(null);
          }}
        />
      )}
    </div>
  );
}

