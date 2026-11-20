'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  FileText,
  Hash,
  MapPin,
  Printer,
  Receipt,
  Ruler,
  Scale,
  UserCheck,
} from 'lucide-react';
import {
  CharcuteriePatternBg,
  PlantCardHeaderStrip,
} from '@/components/forms/PreventaBrandDecor';
import type {
  EstadoPedidoEnum,
  FormatoProductoEnum,
  TipoVenta,
  UnidadMedidaEnum,
} from '@/types/database.types';

// ============================================================================
// 1. TIPOS ALINEADOS A SCHEMA_REFERENCE.sql
// ============================================================================

export type AnchoPapelTermico = 58 | 80;

export interface DetallePedidoTicketItem {
  id_detalle: number;
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  unidad_medida?: UnidadMedidaEnum | (string & {});
  peso_unidad_kilos?: number;
  kilos_estimados: number;
  kilos_reales: number | null;
  precio_unitario_congelado: number;
  es_cortesia: boolean;
  subtotal_bs: number | null;
}

export interface PedidoTicketTermico {
  id_pedido: number;
  nro_nota_venta: number | null;
  nro_documento_sac?: number | null;
  estado: EstadoPedidoEnum;
  tipo_venta?: TipoVenta;
  plazo_dias?: number;
  es_pedido_cortesia_pura: boolean;
  fecha_preventa: string;
  fecha_despacho: string | null;
  observaciones: string | null;
  cliente: {
    codigo_cliente_sac: string;
    nombre_comercial: string;
    nit_ci: string | null;
    telefono: string | null;
  };
  zona: {
    nombre_zona: string;
    ciudad: string;
  };
  vendedor: {
    codigo_vendedor: string;
    nombre_completo: string;
  };
  despachador: {
    nombre_completo: string;
    identificador_balanza: string;
  };
  detalles: DetallePedidoTicketItem[];
}

export interface TicketTermicoEpsonProps {
  pedido: PedidoTicketTermico;
  anchoPapelMm: AnchoPapelTermico;
  autoPrint?: boolean;
  esVistaPrevia?: boolean;
  soloTicket?: boolean;
}

// ============================================================================
// 2. UTILIDADES DE FORMATEO CONTABLE Y OPERATIVO (BOLIVIA)
// ============================================================================

function formatearCorrelativo(nro: number): string {
  return String(nro).padStart(6, '0');
}

function formatearKilos(kg: number): string {
  return kg.toFixed(3);
}

function formatearBolivianos(bs: number): string {
  return bs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatearFechaHoraBolivia(isoString: string): string {
  const fecha = new Date(isoString);
  if (Number.isNaN(fecha.getTime())) return isoString;
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(fecha);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === type)?.value ?? '';

  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

/**
 * Imprime el HTML interno de #ticket-termico-print dentro de un <iframe> oculto
 * dedicado con dimensiones exactas de rollo térmico (58mm / 80mm).
 */
function ejecutarImpresionIframe(anchoPapelMm: AnchoPapelTermico): boolean {
  if (typeof document === 'undefined') return false;

  const ticketEl = document.getElementById('ticket-termico-print');
  if (!ticketEl) return false;

  const clon = ticketEl.cloneNode(true) as HTMLElement;
  clon.querySelectorAll('.no-print').forEach((el) => el.remove());

  const es58 = anchoPapelMm === 58;
  const cssTermico = `
    @page {
      size: ${anchoPapelMm}mm auto;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: ${anchoPapelMm}mm;
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, monospace;
      font-size: ${es58 ? '11px' : '12px'};
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .ticket-wrapper {
      width: ${anchoPapelMm}mm;
      padding: 3mm 2.5mm;
    }
    .ticket-header, .ticket-footer, .text-center {
      text-align: center;
    }
    .ticket-preview-box {
      margin-bottom: 6px;
      border: 1px dashed #000000;
      padding: 3px 4px;
      text-align: center;
      font-weight: 900;
      text-transform: uppercase;
      font-size: ${es58 ? '9px' : '10.5px'};
    }
    .ticket-brand {
      font-size: ${es58 ? '14px' : '17px'};
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.01em;
    }
    .ticket-subbrand {
      margin-top: 2px;
      font-size: ${es58 ? '10px' : '11.5px'};
      font-weight: 600;
    }
    .ticket-doc-title {
      font-size: ${es58 ? '12.5px' : '15px'};
      font-weight: 900;
      text-transform: uppercase;
    }
    .ticket-meta {
      margin-top: 3px;
      font-size: ${es58 ? '9.5px' : '11px'};
      font-weight: 600;
    }
    .ticket-divider {
      margin: 6px 0;
      border-bottom: 1px dashed #000000;
    }
    .ticket-info-line {
      margin-bottom: 2px;
      word-break: break-word;
    }
    .ticket-cols-header {
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      padding-bottom: 3px;
      font-size: ${es58 ? '9.5px' : '10.5px'};
    }
    .ticket-item-row {
      margin-bottom: 6px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ticket-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 4px;
    }
    .ticket-total-line {
      margin-bottom: 3px;
    }
    .ticket-total-box {
      margin: 6px 0;
      border-top: 2px solid #000000;
      border-bottom: 2px solid #000000;
      padding: 5px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 800;
    }
    .ticket-total-label {
      font-size: ${es58 ? '11.5px' : '13.5px'};
      font-weight: 900;
    }
    .ticket-total-amount {
      font-size: ${es58 ? '14.5px' : '16.5px'};
      font-weight: 900;
      font-variant-numeric: tabular-nums;
    }
    .ticket-obs {
      font-size: ${es58 ? '9.5px' : '10.5px'};
      word-break: break-word;
    }
    .ticket-legend {
      margin-top: 3px;
      font-size: ${es58 ? '8.5px' : '10px'};
      font-weight: 900;
      text-transform: uppercase;
    }
    .font-bold { font-weight: 700; }
    .font-extrabold { font-weight: 800; }
    .font-semibold { font-weight: 600; }
    .font-black { font-weight: 900; }
    .uppercase { text-transform: uppercase; }
    .tabular-nums { font-variant-numeric: tabular-nums; }
  `;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const iframeWin = iframe.contentWindow;
  const iframeDoc = iframeWin?.document;
  if (!iframeWin || !iframeDoc) {
    iframe.remove();
    return false;
  }

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Ticket Térmico ${anchoPapelMm}mm</title>
    <style>${cssTermico}</style>
  </head>
  <body>
    <div class="ticket-wrapper">${clon.innerHTML}</div>
  </body>
</html>`);
  iframeDoc.close();

  const limpiarIframe = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  const onAfterPrint = () => {
    iframeWin.removeEventListener('afterprint', onAfterPrint);
    if (fallbackTimer) clearTimeout(fallbackTimer);
    limpiarIframe();
  };

  iframeWin.addEventListener('afterprint', onAfterPrint);

  setTimeout(() => {
    try {
      iframeWin.focus();
      iframeWin.print();
    } finally {
      fallbackTimer = setTimeout(limpiarIframe, 3000);
    }
  }, 150);

  return true;
}

// ============================================================================
// 3. COMPONENTE PRINCIPAL: VISTA DE TICKET TÉRMICO EPSON (58mm / 80mm)
// ============================================================================

export const TicketTermicoEpson: React.FC<TicketTermicoEpsonProps> = ({
  pedido,
  anchoPapelMm,
  autoPrint = false,
  esVistaPrevia = false,
  soloTicket = false,
}) => {
  const [anchoSeleccionado, setAnchoSeleccionado] =
    useState<AnchoPapelTermico>(anchoPapelMm);
  const [ultimoImpresoAt, setUltimoImpresoAt] = useState<string | null>(null);
  const yaAutoImprimioRef = useRef(false);

  const handleImprimirTermico = useCallback(() => {
    const impreso = ejecutarImpresionIframe(anchoSeleccionado);
    if (impreso) {
      setUltimoImpresoAt(
        new Date().toLocaleTimeString('es-BO', {
          timeZone: 'America/La_Paz',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    }
  }, [anchoSeleccionado]);

  // Auto-impresión una única vez cuando ?autoprint=1
  useEffect(() => {
    if (!autoPrint || yaAutoImprimioRef.current) return;
    yaAutoImprimioRef.current = true;
    const timer = setTimeout(() => {
      ejecutarImpresionIframe(anchoPapelMm);
    }, 450);
    return () => clearTimeout(timer);
  }, [autoPrint, anchoPapelMm]);

  const es58mm = anchoSeleccionado === 58;
  const nroNotaMostrar = formatearCorrelativo(
    pedido.nro_nota_venta ?? pedido.id_pedido
  );
  const fechaTicket = pedido.fecha_despacho ?? pedido.fecha_preventa;

  // Cálculos exactos de kilos pesados (con fallback a kilos_estimados si aún está PENDIENTE)
  const detallesCalculados = pedido.detalles.map((d) => {
    const kilos = Number(d.kilos_reales ?? d.kilos_estimados ?? 0);
    const esCortesia = Boolean(d.es_cortesia || pedido.es_pedido_cortesia_pura);
    const subtotalBs = esCortesia
      ? 0
      : Number(
          d.subtotal_bs ??
            Number((kilos * Number(d.precio_unitario_congelado ?? 0)).toFixed(2))
        );
    return {
      ...d,
      kilosEfectivos: kilos,
      esCortesiaEfectiva: esCortesia,
      subtotalEfectivoBs: subtotalBs,
    };
  });

  const pesoFacturadoKg = detallesCalculados
    .filter((d) => !d.esCortesiaEfectiva)
    .reduce((acc, item) => acc + item.kilosEfectivos, 0);

  const pesoCortesiaKg = detallesCalculados
    .filter((d) => d.esCortesiaEfectiva)
    .reduce((acc, item) => acc + item.kilosEfectivos, 0);

  const pesoTotalEntregadoKg = pesoFacturadoKg + pesoCortesiaKg;

  const totalPagarBs = detallesCalculados.reduce(
    (acc, item) => acc + item.subtotalEfectivoBs,
    0
  );

  const ticketPreviewSection = (
    <section
      aria-label="Vista Previa de Ticket Térmico"
      className={soloTicket ? 'w-full' : 'lg:col-span-7'}
    >
      <div className="relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-200/75 p-4 sm:p-8">
        <div className="no-print">
          <CharcuteriePatternBg
            variant="canvas"
            idSuffix="ticket-preview-bg"
          />
        </div>

        <div className="no-print relative z-10 mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-slate-700 shadow-xs">
            <FileText className="h-3.5 w-3.5 text-[#C8102E]" />
            Rollo Térmico {anchoSeleccionado}mm (
            {es58mm ? '32' : '48'} cols)
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {esVistaPrevia ? (
              <span className="rounded-md border border-amber-400 bg-amber-100 px-2.5 py-1 font-mono text-[11px] font-black uppercase text-amber-950">
                [BORRADOR / VISTA PREVIA]
              </span>
            ) : (
              <span className="font-mono text-[11px] font-semibold text-slate-500">
                ESC/POS MONOSPACE
              </span>
            )}

            {soloTicket && (
              <button
                type="button"
                onClick={handleImprimirTermico}
                className="touch-manipulation inline-flex min-h-[40px] items-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:brightness-105 active:translate-y-[1px]"
              >
                <Printer className="h-4 w-4 text-[#FFCD00]" strokeWidth={2.2} />
                <span>Imprimir Ticket</span>
              </button>
            )}
          </div>
        </div>

        {/* ==============================================================
            CONTENEDOR FÍSICO IMPRIMIBLE (#ticket-termico-print)
           ============================================================== */}
        <div className="relative z-10 flex justify-center overflow-x-auto py-2">
          <article
            id="ticket-termico-print"
            aria-label={`Nota de Despacho N° ${nroNotaMostrar}`}
            style={{ width: anchoSeleccionado === 58 ? '58mm' : '80mm' }}
            className={`mx-auto bg-white font-mono tabular-nums text-black shadow-2xl ring-1 ring-slate-300 transition-all duration-200 ${
              es58mm
                ? 'ticket-58mm px-2.5 py-4 text-[10.5px] leading-[1.3]'
                : 'ticket-80mm px-4 py-5 text-[12px] leading-[1.35]'
            }`}
          >
            <div className="no-print -mx-2.5 -mt-4 mb-3 h-1.5 border-b border-dashed border-slate-300 bg-slate-100" />

            {/* 1. CABECERA DEL COMPROBANTE INTERNO */}
            <header className="ticket-header text-center">
              {esVistaPrevia && (
                <div className="ticket-preview-box mb-2 border border-dashed border-black bg-amber-50 px-1.5 py-1 text-center font-black uppercase text-black">
                  <p className={es58mm ? 'text-[9px]' : 'text-[10.5px]'}>
                    *** VISTA PREVIA - PENDIENTE DE CIERRE ***
                  </p>
                  <p className={es58mm ? 'text-[8.5px]' : 'text-[9.5px]'}>
                    [BORRADOR / VISTA PREVIA]
                  </p>
                </div>
              )}

              <h2
                className={`ticket-brand font-bold uppercase tracking-tight text-black ${
                  es58mm ? 'text-[14px]' : 'text-[17px]'
                }`}
              >
                EUROALIMENTOS S.R.L.
              </h2>
              <p
                className={`ticket-subbrand mt-0.5 text-center font-semibold text-black ${
                  es58mm ? 'text-[10px]' : 'text-[11.5px]'
                }`}
              >
                Planta Procesadora de Embutidos
              </p>

              <div className="ticket-divider my-2 border-b border-dashed border-black" />

              <p
                className={`ticket-doc-title font-bold uppercase tracking-tight text-black ${
                  es58mm ? 'text-[12.5px]' : 'text-[15px]'
                }`}
              >
                NOTA DE VENTA N° {nroNotaMostrar}
              </p>

              {pedido.nro_documento_sac && (
                <p
                  className={`ticket-meta mt-0.5 font-bold text-black ${
                    es58mm ? 'text-[9.5px]' : 'text-[11px]'
                  }`}
                >
                  Doc. SAC N° {pedido.nro_documento_sac}
                </p>
              )}

              <p
                className={`ticket-meta mt-1 font-semibold text-black ${
                  es58mm ? 'text-[9px]' : 'text-[10.5px]'
                }`}
              >
                Ref. #PED-{String(pedido.id_pedido).padStart(3, '0')} |{' '}
                {formatearFechaHoraBolivia(fechaTicket)}
              </p>

              <p
                className={`ticket-meta mt-0.5 font-bold uppercase text-black ${
                  es58mm ? 'text-[9.5px]' : 'text-[11px]'
                }`}
              >
                Condición:{' '}
                {pedido.tipo_venta === 'CREDITO'
                  ? `CRÉDITO ${pedido.plazo_dias ?? 0} DÍAS`
                  : 'CONTADO'}
              </p>
            </header>

            <div className="ticket-divider my-2 border-b border-dashed border-black" />

            {/* 2. TRAZABILIDAD DEL COMPROBANTE */}
            <section aria-label="Datos Operativos" className="space-y-0.5">
              <div className="ticket-info-line">
                <span>Cliente: </span>
                <strong className="font-bold">
                  {pedido.cliente.codigo_cliente_sac} -{' '}
                  {pedido.cliente.nombre_comercial}
                </strong>
              </div>

              <div className="ticket-info-line">
                <span>Zona: </span>
                <strong className="font-bold">{pedido.zona.nombre_zona}</strong>
              </div>

              <div className="ticket-info-line">
                <span>Vendedor: </span>
                <strong className="font-bold">
                  {pedido.vendedor.nombre_completo}
                </strong>
              </div>

              <div className="ticket-info-line">
                <span>Despacho: </span>
                <strong className="font-bold">
                  {pedido.despachador.nombre_completo}
                </strong>
              </div>
            </section>

            <div className="ticket-divider my-2 border-b border-dashed border-black" />

            {/* 3. DETALLE DE PESAJE REAL */}
            <section aria-label="Detalle de Pesaje Real">
              <div className="ticket-cols-header flex justify-between pb-1 text-[10px] font-bold">
                <span>PRODUCTO / PESO X P.U.</span>
                <span>SUBTOTAL</span>
              </div>

              <div className="ticket-divider mb-2 border-b border-dashed border-black" />

              <div className="space-y-2">
                {detallesCalculados.map((item) => {
                  const esUnidad =
                    String(item.unidad_medida ?? 'KILO').toUpperCase() ===
                    'UNIDAD';
                  const pesoUnid =
                    item.peso_unidad_kilos && item.peso_unidad_kilos > 0
                      ? item.peso_unidad_kilos
                      : 1;
                  const cantUnid = esUnidad
                    ? Number((item.kilosEfectivos / pesoUnid).toFixed(2))
                    : 0;
                  const unidLabel = Number.isInteger(cantUnid)
                    ? `${cantUnid} unid.`
                    : `${cantUnid.toFixed(1)} unid.`;

                  return (
                    <div
                      key={item.id_detalle}
                      className="ticket-item-row leading-snug"
                    >
                      <div className="font-bold">
                        {item.esCortesiaEfectiva ? '[CORTESIA] ' : ''}
                        {item.nombre_producto} [{item.formato}]
                      </div>

                      {!item.esCortesiaEfectiva ? (
                        <div className="ticket-row flex items-baseline justify-between gap-1 tabular-nums">
                          <span>
                            {esUnidad
                              ? `${unidLabel} (${Number(item.kilosEfectivos).toFixed(3)} kg) x Bs ${(Number(item.precio_unitario_congelado) * pesoUnid).toFixed(2)}`
                              : `${Number(item.kilosEfectivos).toFixed(3)} kg x Bs ${Number(item.precio_unitario_congelado).toFixed(2)}`}
                          </span>
                          <strong className="font-bold tabular-nums">
                            {Number(item.subtotalEfectivoBs).toFixed(2)} Bs
                          </strong>
                        </div>
                      ) : (
                        <div className="ticket-row flex items-baseline justify-between gap-1 tabular-nums">
                          <span>
                            {Number(item.kilosEfectivos).toFixed(3)} kg
                            [CORTESIA]
                          </span>
                          <strong className="font-bold tabular-nums">
                            0.00 Bs
                          </strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="ticket-divider my-2 border-b border-dashed border-black" />

            {/* 4. TOTALES */}
            <section
              aria-label="Totales de Pesaje y Cobro"
              className="space-y-1"
            >
              <div className="ticket-row ticket-total-line flex justify-between">
                <span>Peso Facturado:</span>
                <span className="font-semibold tabular-nums">
                  {formatearKilos(pesoFacturadoKg)} kg
                </span>
              </div>

              {pesoCortesiaKg > 0 && (
                <div className="ticket-row ticket-total-line flex justify-between">
                  <span>Peso Cortesía:</span>
                  <span className="font-semibold tabular-nums">
                    {formatearKilos(pesoCortesiaKg)} kg
                  </span>
                </div>
              )}

              <div className="ticket-row ticket-total-line flex justify-between font-bold">
                <strong className="font-bold">Total Kilos Entregados:</strong>
                <strong className="font-bold tabular-nums">
                  {formatearKilos(pesoTotalEntregadoKg)} kg
                </strong>
              </div>

              <div className="ticket-total-box my-1.5 flex items-center justify-between gap-1 border-y-2 border-black py-1.5 font-extrabold">
                <span
                  className={`ticket-total-label ${
                    es58mm ? 'text-[11.5px]' : 'text-[13.5px]'
                  }`}
                >
                  TOTAL A PAGAR (Bs.):
                </span>
                <span
                  className={`ticket-total-amount tracking-tight tabular-nums ${
                    es58mm ? 'text-[14.5px]' : 'text-[16.5px]'
                  }`}
                >
                  {formatearBolivianos(totalPagarBs)}
                </span>
              </div>
            </section>

            {pedido.observaciones && pedido.observaciones.trim() !== '' && (
              <>
                <div className="ticket-obs text-[10.5px]">
                  <span className="font-bold">Obs.: </span>
                  <span>{pedido.observaciones}</span>
                </div>
                <div className="ticket-divider my-2 border-b border-dashed border-black" />
              </>
            )}

            {/* 5. PIE DEL COMPROBANTE INTERNO */}
            <footer className="ticket-footer mt-1 space-y-1 text-center">
              <p className="font-bold">Gracias por su preferencia</p>
              <p
                className={`ticket-legend font-bold uppercase tracking-tight ${
                  es58mm ? 'text-[8.5px]' : 'text-[10px]'
                }`}
              >
                COMPROBANTE INTERNO DE DESPACHO — NO VÁLIDO COMO FACTURA
              </p>
            </footer>

            <div className="no-print -mx-2.5 -mb-4 mt-4 h-2 border-t border-dashed border-slate-300 bg-slate-100" />
          </article>
        </div>
      </div>
    </section>
  );

  if (soloTicket) {
    return (
      <div className="w-full text-slate-900">
        {ticketPreviewSection}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 text-slate-900 md:pb-8">

      {/* ====================================================================
          BARRA DE CONTEXTO COMPACTA EN PANTALLA (NO SE IMPRIME)
         ==================================================================== */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/despacho"
            className="touch-manipulation inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-800 transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4 text-[#C8102E]" strokeWidth={2.2} />
            <span>Bandeja</span>
          </Link>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">
              Nota de Venta N° {nroNotaMostrar}
            </h1>
            <p className="font-mono text-[11px] font-semibold text-slate-500">
              {pedido.nro_documento_sac
                ? `Doc. SAC N° ${pedido.nro_documento_sac} • `
                : ''}
              {pedido.tipo_venta === 'CREDITO'
                ? `CRÉDITO ${pedido.plazo_dias ?? 0}d`
                : 'CONTADO'}
            </p>
          </div>
        </div>

        <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-700">
          {pedido.despachador.identificador_balanza}
        </span>
      </div>

      {/* ====================================================================
          BARRA SUPERIOR DE CONTROLES RÁPIDOS (NO SE IMPRIME)
         ==================================================================== */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-slate-500 sm:inline-flex">
            <Ruler className="h-4 w-4 text-[#C8102E]" strokeWidth={2.2} />
            Papel:
          </span>
          <div className="inline-flex rounded-xl border-2 border-slate-200 bg-slate-100 p-1">
            {([58, 80] as AnchoPapelTermico[]).map((mm) => {
              const activo = anchoSeleccionado === mm;
              return (
                <button
                  key={mm}
                  type="button"
                  onClick={() => setAnchoSeleccionado(mm)}
                  className={`touch-manipulation min-h-[40px] rounded-lg px-3 py-1.5 font-mono text-xs font-extrabold transition ${
                    activo
                      ? 'bg-[#C8102E] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  {mm}mm ({mm === 58 ? '32 cols' : '48 cols'})
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/despacho"
            className="touch-manipulation inline-flex min-h-[48px] items-center gap-2 rounded-xl border-2 border-slate-300 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-100 md:hidden"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
            <span>Volver a Bandeja</span>
          </Link>

          <button
            type="button"
            onClick={handleImprimirTermico}
            className="touch-manipulation hidden min-h-[48px] items-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-5 py-2 text-sm font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:brightness-105 active:translate-y-[2px] active:border-b-2 md:inline-flex"
          >
            <Printer className="h-5 w-5 text-[#FFCD00]" strokeWidth={2.2} />
            <span>Imprimir Ticket</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          CONTENIDO PRINCIPAL: RESUMEN + VISTA PREVIA TÉRMICA
         ==================================================================== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* PANEL IZQUIERDO DE CONTROL Y VERIFICACIÓN (NO SE IMPRIME) */}
        <aside className="no-print space-y-5 lg:col-span-5">
          <div className="overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-sm">
            <PlantCardHeaderStrip />

            <div className="p-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`h-5 w-5 ${
                      pedido.estado === 'DESPACHADO'
                        ? 'text-emerald-600'
                        : 'text-amber-500'
                    }`}
                    strokeWidth={2.2}
                  />
                  <span className="text-sm font-extrabold uppercase tracking-tight text-slate-900">
                    {pedido.estado === 'DESPACHADO'
                      ? 'Pesaje Confirmado'
                      : `Estado: ${pedido.estado}`}
                  </span>
                </div>
                <span className="rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-slate-700">
                  #PED-{pedido.id_pedido}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500">
                    <Scale className="h-4 w-4 text-[#C8102E]" strokeWidth={2} />
                    <span>Peso Total</span>
                  </div>
                  <div className="mt-1 inline-block rounded bg-[#FFCD00] px-2 py-0.5 font-mono text-base font-black tabular-nums text-slate-950">
                    {formatearKilos(pesoTotalEntregadoKg)} Kg
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500">
                    <Receipt
                      className="h-4 w-4 text-[#C8102E]"
                      strokeWidth={2}
                    />
                    <span>Total Cobro</span>
                  </div>
                  <div className="mt-1 font-mono text-lg font-black tabular-nums text-slate-900">
                    Bs. {formatearBolivianos(totalPagarBs)}
                  </div>
                </div>
              </div>

              <dl className="mt-4 space-y-2.5 border-t border-slate-200 pt-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1.5 font-semibold text-slate-500">
                    <UserCheck className="h-4 w-4 text-slate-400" />
                    Cliente:
                  </dt>
                  <dd className="text-right font-bold text-slate-900">
                    {pedido.cliente.nombre_comercial} (
                    {pedido.cliente.codigo_cliente_sac})
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1.5 font-semibold text-slate-500">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    Zona:
                  </dt>
                  <dd className="text-right font-medium text-slate-800">
                    {pedido.zona.nombre_zona}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1.5 font-semibold text-slate-500">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    Fecha:
                  </dt>
                  <dd className="text-right font-mono text-xs font-bold tabular-nums text-slate-800">
                    {formatearFechaHoraBolivia(fechaTicket)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1.5 font-semibold text-slate-500">
                    <Hash className="h-4 w-4 text-slate-400" />
                    Despacho:
                  </dt>
                  <dd className="text-right font-bold text-slate-800">
                    {pedido.despachador.nombre_completo} (
                    {pedido.despachador.identificador_balanza})
                  </dd>
                </div>
              </dl>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <label className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  <Ruler className="h-4 w-4 text-[#C8102E]" strokeWidth={2.2} />
                  <span>Formato de Rollo Epson</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {([58, 80] as AnchoPapelTermico[]).map((mm) => {
                    const activo = anchoSeleccionado === mm;
                    return (
                      <button
                        key={mm}
                        type="button"
                        onClick={() => setAnchoSeleccionado(mm)}
                        className={`touch-manipulation flex min-h-[48px] flex-col items-center justify-center rounded-xl border-2 px-3 py-2 font-mono transition ${
                          activo
                            ? 'border-[#C8102E] bg-[#FFCD00]/20 text-slate-950 ring-4 ring-[#FFCD00]/30'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <span className="text-base font-black tabular-nums">
                          {mm}mm
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {mm === 58 ? '32 columnas' : '48 columnas'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 hidden space-y-3 md:block">
                <button
                  type="button"
                  onClick={handleImprimirTermico}
                  className="touch-manipulation flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-6 py-3.5 text-base font-extrabold uppercase tracking-wide text-white shadow-md transition hover:brightness-105 active:translate-y-[2px] active:border-b-2"
                >
                  <Printer
                    className="h-6 w-6 text-[#FFCD00]"
                    strokeWidth={2.2}
                  />
                  <span>Imprimir Ticket</span>
                </button>

                {ultimoImpresoAt && (
                  <p className="flex items-center justify-center gap-1.5 font-mono text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Orden enviada a impresora a las {ultimoImpresoAt}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-300 bg-white p-3.5 text-xs text-slate-600">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-[#C8102E]"
              strokeWidth={2.2}
            />
            <p className="leading-relaxed">
              <strong className="font-bold text-slate-900">
                Comprobante Interno de Pesaje:
              </strong>{' '}
              Este ticket respalda la entrega física en kilos desde planta. La
              facturación fiscal SIAT/SIN se consolida posteriormente en el
              sistema SAC.
            </p>
          </div>
        </aside>

        {/* ÁREA DE PREVISUALIZACIÓN CENTRADA DEL TICKET TÉRMICO */}
        {ticketPreviewSection}
      </div>

      {/* ====================================================================
          BARRA INFERIOR MÓVIL SOBRE BottomNav (NO SE IMPRIME)
         ==================================================================== */}
      <div className="no-print fixed inset-x-0 bottom-[74px] z-30 border-t-2 border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-2.5">
          <Link
            href="/despacho"
            aria-label="Volver a Bandeja de Despacho"
            className="touch-manipulation flex min-h-[52px] shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-slate-300 bg-slate-100 px-3.5 text-sm font-extrabold text-slate-800 transition active:translate-y-[1px]"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
            <span>Bandeja</span>
          </Link>

          <button
            type="button"
            onClick={handleImprimirTermico}
            className="touch-manipulation flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-b-4 border-red-950 bg-gradient-to-b from-[#C8102E] to-[#9E0B22] px-4 text-base font-extrabold uppercase tracking-wide text-white shadow-md transition active:translate-y-[2px] active:border-b-2"
          >
            <Printer className="h-5 w-5 text-[#FFCD00]" strokeWidth={2.2} />
            <span>Imprimir Ticket</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketTermicoEpson;

