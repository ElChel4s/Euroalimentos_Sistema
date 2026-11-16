import { Loader2 } from 'lucide-react';

interface ModuleLoadingSkeletonProps {
  modulo?: string;
}

/**
 * Esqueleto estructural reutilizable para streaming instantáneo en módulos del Dashboard.
 */
export function ModuleLoadingSkeleton({
  modulo = 'Sincronizando datos con planta...',
}: ModuleLoadingSkeletonProps) {
  return (
    <div
      className="space-y-5"
      aria-busy="true"
      aria-label="Sincronizando datos con planta"
    >
      {/* Indicador discreto inmediato */}
      <div className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-red-700" />
        <span>{modulo}</span>
      </div>

      {/* Skeleton de ModuleHeader */}
      <div className="animate-pulse overflow-hidden rounded-2xl border-2 border-slate-200/80 bg-white">
        <div className="flex h-2 w-full">
          <div className="w-2/3 bg-[#C8102E]/40" />
          <div className="w-1/3 bg-[#FFCD00]/60" />
        </div>
        <div className="p-5 sm:p-6 space-y-3">
          <div className="flex gap-2">
            <div className="h-5 w-28 rounded bg-slate-200" />
            <div className="h-5 w-40 rounded bg-slate-100" />
          </div>
          <div className="h-7 w-64 max-w-full rounded bg-slate-200" />
          <div className="h-4 w-80 max-w-full rounded bg-slate-100" />
        </div>
      </div>

      {/* Tarjetas estructurales */}
      <div className="animate-pulse grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-28 rounded-2xl border-2 border-slate-200/80 bg-white p-4 space-y-3">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-6 w-32 rounded bg-slate-200" />
          <div className="h-3 w-40 rounded bg-slate-100" />
        </div>
        <div className="h-28 rounded-2xl border-2 border-slate-200/80 bg-white p-4 space-y-3">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-6 w-28 rounded bg-slate-200" />
          <div className="h-3 w-36 rounded bg-slate-100" />
        </div>
        <div className="h-28 rounded-2xl border-2 border-slate-200/80 bg-white p-4 space-y-3">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-6 w-36 rounded bg-slate-200" />
          <div className="h-3 w-32 rounded bg-slate-100" />
        </div>
      </div>

      {/* Contenedor principal / tabla */}
      <div className="animate-pulse rounded-2xl border-2 border-slate-200/80 bg-white p-5 space-y-3">
        <div className="h-5 w-48 rounded bg-slate-200" />
        <div className="h-10 w-full rounded-lg bg-slate-100" />
        <div className="h-10 w-full rounded-lg bg-slate-100" />
        <div className="h-10 w-full rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}

