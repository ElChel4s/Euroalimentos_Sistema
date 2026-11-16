import React from 'react';

interface ModuleHeaderProps {
  badge: string;
  titulo: string;
  subtitulo: string;
  ctiLabel: string;
  ctiValor: string;
  accentColor?: 'red' | 'amber' | 'emerald' | 'slate';
  actions?: React.ReactNode;
}

const ACCENT_MAP = {
  red: 'bg-[#FFCD00] text-slate-950 border-amber-500',
  amber: 'bg-sky-400 text-slate-950 border-sky-500',
  emerald: 'bg-emerald-400 text-slate-950 border-emerald-500',
  slate: 'bg-slate-900 text-[#FFCD00] border-slate-700',
};

/**
 * Encabezado corporativo reutilizable para todos los módulos del Dashboard.
 */
export function ModuleHeader({
  badge,
  titulo,
  subtitulo,
  ctiLabel,
  ctiValor,
  accentColor = 'red',
  actions,
}: ModuleHeaderProps) {
  return (
    <section className="no-print overflow-hidden rounded-2xl border-2 border-slate-200/95 bg-white shadow-[0_6px_24px_-6px_rgba(15,23,42,0.10)]">
      <div className="flex h-2 w-full">
        <div className="w-2/3 bg-gradient-to-r from-[#C8102E] to-[#9E0B22]" />
        <div className="w-1/3 bg-[#FFCD00]" />
      </div>

      <div className="p-4 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-md border px-2.5 py-0.5 font-mono text-[11px] font-black tracking-wider uppercase ${ACCENT_MAP[accentColor]}`}
            >
              {badge}
            </span>
            <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-700">
              {ctiLabel}: {ctiValor}
            </span>
          </div>

          <h1 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            {titulo}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-600">{subtitulo}</p>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}

