'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  MapPin,
  Sparkles,
  Tag,
  UserPlus,
  X,
} from 'lucide-react';
import {
  crearClienteRapidoAction,
  type ClientePreventaItem,
  type ZonaPreventaItem,
} from '@/actions/preventa.actions';
import {
  CharcuteriePatternBg,
  PlantCardHeaderStrip,
} from '@/components/forms/PreventaBrandDecor';

export interface ModalNuevoClienteProps {
  open: boolean;
  zonas: ZonaPreventaItem[];
  nombreInicial?: string;
  onClose: () => void;
  onClienteCreado: (
    cliente: ClientePreventaItem,
    zonaCreada?: ZonaPreventaItem
  ) => void;
}

export const ModalNuevoCliente: React.FC<ModalNuevoClienteProps> = ({
  open,
  zonas,
  nombreInicial = '',
  onClose,
  onClienteCreado,
}) => {
  const [nuevoNombre, setNuevoNombre] = useState(nombreInicial);
  const [modoZona, setModoZona] = useState<'existente' | 'nueva'>('existente');
  const [nuevaZonaId, setNuevaZonaId] = useState<string>('');
  const [nuevaZonaTexto, setNuevaZonaTexto] = useState<string>('');
  const [nuevoNitCi, setNuevoNitCi] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoCodigoSac, setNuevoCodigoSac] = useState('');
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (!open) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nombreLimpio = nuevoNombre.trim();
    if (!nombreLimpio) {
      setErrorModal('El nombre comercial del cliente es obligatorio.');
      return;
    }

    const idZonaParsed =
      modoZona === 'existente' && nuevaZonaId
        ? Number.parseInt(nuevaZonaId, 10)
        : null;

    if (
      (modoZona === 'existente' && (!idZonaParsed || idZonaParsed <= 0)) ||
      (modoZona === 'nueva' && !nuevaZonaTexto.trim())
    ) {
      setErrorModal('Debe seleccionar o escribir una zona de mercado.');
      return;
    }

    setErrorModal(null);
    setGuardando(true);

    try {
      const resultado = await crearClienteRapidoAction({
        nombre_comercial: nombreLimpio,
        id_zona:
          idZonaParsed && Number.isInteger(idZonaParsed) ? idZonaParsed : null,
        nueva_zona_nombre:
          modoZona === 'nueva' ? nuevaZonaTexto.trim() || undefined : undefined,
        nit_ci: nuevoNitCi.trim() || undefined,
        telefono: nuevoTelefono.trim() || undefined,
        codigo_cliente_sac: nuevoCodigoSac.trim() || undefined,
      });

      if (!resultado.ok) {
        setErrorModal(resultado.error);
        return;
      }

      onClienteCreado(resultado.cliente, resultado.zonaCreada);
    } catch {
      setErrorModal('No se pudo registrar el cliente. Intente nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-nuevo-cliente-titulo"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-t-2xl border-2 border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <CharcuteriePatternBg variant="card" idSuffix="modal-cliente" />
        <PlantCardHeaderStrip />

        <div className="relative z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8102E] text-[#FFCD00]">
              <UserPlus className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h3
                id="modal-nuevo-cliente-titulo"
                className="text-base font-black text-slate-900"
              >
                Nuevo Cliente Rápido
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Alta inmediata para preventa en ruta
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="touch-manipulation flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative z-10 space-y-3.5 bg-white/95 p-4"
        >
          {errorModal && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-[#C8102E] bg-red-50 p-3 text-xs font-bold text-[#C8102E]"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorModal}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="campo-nombre-comercial"
              className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-700"
            >
              Nombre Comercial <span className="text-[#C8102E]">*</span>
            </label>
            <input
              id="campo-nombre-comercial"
              type="text"
              required
              autoFocus
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Ej. Fiambrería San José"
              className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3.5 text-base font-semibold text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="campo-id-zona"
                className="text-xs font-black uppercase tracking-wider text-slate-700"
              >
                Zona / Mercado <span className="text-[#C8102E]">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setModoZona((prev) =>
                    prev === 'existente' ? 'nueva' : 'existente'
                  );
                  setNuevaZonaId('');
                  setNuevaZonaTexto('');
                }}
                className="touch-manipulation min-h-[36px] rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-[#C8102E] transition hover:bg-red-50"
              >
                {modoZona === 'existente'
                  ? '+ Escribir nuevo mercado/zona'
                  : 'Elegir de la lista'}
              </button>
            </div>

            {modoZona === 'existente' ? (
              <select
                id="campo-id-zona"
                value={nuevaZonaId}
                onChange={(e) => setNuevaZonaId(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3.5 text-base font-semibold text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
              >
                <option value="">-- Seleccione una zona o mercado --</option>
                {zonas.map((z) => (
                  <option key={z.id_zona} value={String(z.id_zona)}>
                    {z.nombre_zona}
                  </option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C8102E]" />
                <input
                  id="campo-id-zona"
                  type="text"
                  value={nuevaZonaTexto}
                  onChange={(e) => setNuevaZonaTexto(e.target.value)}
                  placeholder="Ej. Mercado Villa Dolores / Calle 4..."
                  className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 pl-10 pr-3.5 text-base font-semibold text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="campo-nit-ci"
                className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-700"
              >
                NIT / CI <span className="text-slate-400">(Opcional)</span>
              </label>
              <input
                id="campo-nit-ci"
                type="text"
                inputMode="numeric"
                value={nuevoNitCi}
                onChange={(e) => setNuevoNitCi(e.target.value)}
                placeholder="Ej. 4829104015"
                className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3.5 font-mono text-base font-semibold text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
              />
            </div>

            <div>
              <label
                htmlFor="campo-telefono"
                className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-700"
              >
                Teléfono <span className="text-slate-400">(Opcional)</span>
              </label>
              <input
                id="campo-telefono"
                type="tel"
                inputMode="tel"
                value={nuevoTelefono}
                onChange={(e) => setNuevoTelefono(e.target.value)}
                placeholder="Ej. 71548920"
                className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 px-3.5 font-mono text-base font-semibold text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="campo-codigo-sac"
              className="mb-1 flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700"
            >
              <span>Código Cliente SAC</span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-500">
                <Sparkles className="h-3 w-3 text-[#C8102E]" />
                Autogenerado si vacío
              </span>
            </label>
            <div className="relative">
              <Tag className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="campo-codigo-sac"
                type="text"
                value={nuevoCodigoSac}
                onChange={(e) => setNuevoCodigoSac(e.target.value)}
                placeholder="Ej. CLI-105"
                className="min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-slate-50/70 pl-10 pr-3.5 font-mono text-base font-bold uppercase text-slate-900 shadow-inner focus:border-[#C8102E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FFCD00]/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="touch-manipulation min-h-[48px] rounded-xl border-2 border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="touch-manipulation flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-4 text-sm font-black uppercase text-white shadow-md transition active:translate-y-[2px] active:border-b-2 disabled:opacity-50"
            >
              <Check className="h-5 w-5 text-[#FFCD00]" strokeWidth={2.5} />
              <span>{guardando ? 'Guardando...' : 'Guardar y Usar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

