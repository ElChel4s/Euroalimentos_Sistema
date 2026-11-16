'use client';

import { Printer } from 'lucide-react';

interface PrintTicketButtonProps {
  label?: string;
}

/**
 * Botón táctil de impresión térmica que invoca `window.print()`.
 * Marcado con `.no-print` para quedar oculto en el ticket físico.
 */
export function PrintTicketButton({
  label = 'Imprimir Ticket Térmico',
}: PrintTicketButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print touch-manipulation inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#D91636] to-[#B00D27] px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition-all hover:from-[#C8102E] hover:to-[#990B21] active:translate-y-[2px] active:border-b-2 focus:ring-4 focus:ring-[#FFCD00]/50 focus:outline-none"
    >
      <Printer className="h-4 w-4 text-[#FFCD00]" strokeWidth={2.2} />
      <span>{label}</span>
    </button>
  );
}

