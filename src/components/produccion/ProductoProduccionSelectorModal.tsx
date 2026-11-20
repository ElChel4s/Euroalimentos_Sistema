'use client';

import React, { useMemo, useState } from 'react';
import { Check, Package, Search, X } from 'lucide-react';
import type { FormatoProductoEnum } from '@/types/database.types';

export interface ProductoProduccionItem {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  unidad_medida: string;
  peso_unidad_kilos: number;
  stock_fisico_kilos: number;
  stock_comprometido_kilos: number;
  stock_disponible_kilos: number;
}

export interface ProductoProduccionSelectorModalProps {
  onClose: () => void;
  title: string;
  subtitle: string;
  accentColor?: 'crimson' | 'yellow';
  productos: ProductoProduccionItem[];
  selectedId: number;
  onSelect: (producto: ProductoProduccionItem) => void;
}

function formatKg(valor: number): string {
  if (Number.isNaN(valor) || !Number.isFinite(valor)) return '0.000';
  return valor.toFixed(3);
}

export function ProductoProduccionSelectorModal({
  onClose,
  title,
  subtitle,
  accentColor = 'crimson',
  productos,
  selectedId,
  onSelect,
}: ProductoProduccionSelectorModalProps) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return productos;
    return productos.filter(
      (p) =>
        p.nombre_producto.toLowerCase().includes(q) ||
        p.codigo_sku.toLowerCase().includes(q)
    );
  }, [productos, busqueda]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="selector-produccion-title"
    >
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border-2 border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex h-1.5 w-full shrink-0">
          <div
            className={`w-2/3 ${
              accentColor === 'crimson' ? 'bg-[#C8102E]' : 'bg-[#FFCD00]'
            }`}
          />
          <div
            className={`w-1/3 ${
              accentColor === 'crimson' ? 'bg-[#FFCD00]' : 'bg-[#C8102E]'
            }`}
          />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3.5">
          <div className="min-w-0">
            <h3
              id="selector-produccion-title"
              className="text-base font-extrabold tracking-tight text-slate-900"
            >
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 active:scale-95"
            aria-label="Cerrar selector de producto"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-white p-3.5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400"
              strokeWidth={2}
            />
            <input
              type="text"
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por SKU o nombre de producto..."
              className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 pr-9 pl-11 text-base text-slate-900 shadow-inner transition focus:border-[#C8102E] focus:bg-white focus:ring-4 focus:ring-[#FFCD00]/30 focus:outline-none"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                aria-label="Limpiar búsqueda"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
          {filtrados.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <p className="text-sm font-semibold">
                No se encontraron productos con &ldquo;{busqueda}&rdquo;
              </p>
              <p className="mt-1 text-xs">
                Verifique el código SKU o nombre del embutido.
              </p>
            </div>
          ) : (
            filtrados.map((prod) => {
              const isSelected = prod.id_producto === selectedId;
              const enDeficit = Number(prod.stock_disponible_kilos) <= 0;
              const deficitPreventa = Math.abs(
                Number(prod.stock_disponible_kilos)
              );
              const esUnidad =
                String(prod.unidad_medida ?? 'KILO').toUpperCase() === 'UNIDAD';
              const pesoUnidadGr = Math.round(
                Number(prod.peso_unidad_kilos || 0.5) * 1000
              );

              return (
                <button
                  key={prod.id_producto}
                  type="button"
                  onClick={() => {
                    onSelect(prod);
                    onClose();
                  }}
                  className={`flex min-h-[72px] w-full items-start justify-between gap-3 rounded-xl border-2 p-3.5 text-left transition ${
                    isSelected
                      ? 'border-[#C8102E] bg-red-50/40 ring-2 ring-[#FFCD00]/50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Línea 1: Badges técnicos */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-white">
                        {prod.codigo_sku}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wide ${
                          prod.formato === 'GRANEL'
                            ? 'border-amber-300 bg-amber-50 text-amber-900'
                            : 'border-sky-300 bg-sky-50 text-sky-900'
                        }`}
                      >
                        {prod.formato}
                      </span>
                      {esUnidad && (
                        <span className="inline-flex items-center gap-1 rounded border border-purple-300 bg-purple-50 px-2 py-0.5 font-mono text-[10px] font-extrabold text-purple-900">
                          <Package className="h-3 w-3" />
                          UNIDAD ({pesoUnidadGr}g)
                        </span>
                      )}
                    </div>

                    {/* Línea 2: Nombre completo + Stock y Déficit */}
                    <p className="break-words text-sm font-bold leading-snug text-slate-900">
                      {prod.nombre_producto}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="font-semibold text-slate-600 tabular-nums">
                        Stock físico:{' '}
                        <strong className="text-slate-900">
                          {formatKg(Number(prod.stock_fisico_kilos))} kg
                        </strong>
                      </span>
                      {enDeficit && (
                        <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white tabular-nums">
                          {deficitPreventa > 0
                            ? `Déficit: ${formatKg(deficitPreventa)} kg`
                            : 'Sin disponible'}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C8102E] text-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
