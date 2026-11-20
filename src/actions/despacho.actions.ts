'use server';

import { revalidatePath } from 'next/cache';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export interface ConfirmarDespachoDetalleInput {
  id_detalle: number;
  kilos_reales: number;
}

export interface ConfirmarDespachoCortesiaInput {
  id_producto: number;
  kilos_reales: number;
}

export interface ConfirmarDespachoInput {
  id_pedido: number;
  detalles_pesados: ConfirmarDespachoDetalleInput[];
  cortesias: ConfirmarDespachoCortesiaInput[];
  nro_documento_sac?: number | null;
}

export type ConfirmarDespachoResult =
  | {
      ok: true;
      nro_nota_venta: number;
      nro_documento_sac: number | null;
      id_pedido: number;
    }
  | { ok: false; error: string };

function redondearKilos3Decimales(valor: number): number {
  return Number(valor.toFixed(3));
}

/**
 * Confirma de forma atómica el pesaje real en gancho, cortesías autorizadas,
 * asignación de correlativo `nro_nota_venta` y descarga en Kardex (CU-D04).
 */
export async function confirmarDespachoAction(
  input: ConfirmarDespachoInput
): Promise<ConfirmarDespachoResult> {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'DESPACHADOR' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    return {
      ok: false,
      error: 'Sesión no autorizada para confirmar despachos en cámara.',
    };
  }

  if (!Number.isInteger(input.id_pedido) || input.id_pedido <= 0) {
    return {
      ok: false,
      error: 'Identificador de pedido inválido.',
    };
  }

  if (
    !Array.isArray(input.detalles_pesados) ||
    input.detalles_pesados.length === 0
  ) {
    return {
      ok: false,
      error: 'Debe pesar al menos una línea del pedido antes de confirmar.',
    };
  }

  const detallesNormalizados: ConfirmarDespachoDetalleInput[] = [];
  for (const det of input.detalles_pesados) {
    if (
      !Number.isInteger(det.id_detalle) ||
      det.id_detalle <= 0 ||
      typeof det.kilos_reales !== 'number' ||
      !Number.isFinite(det.kilos_reales)
    ) {
      return {
        ok: false,
        error: 'Existen líneas de detalle con peso o identificador inválido.',
      };
    }
    const kilosRedondeados = redondearKilos3Decimales(det.kilos_reales);
    if (kilosRedondeados <= 0) {
      return {
        ok: false,
        error:
          'Todos los productos facturados deben tener un peso real mayor a 0.000 kg.',
      };
    }
    detallesNormalizados.push({
      id_detalle: det.id_detalle,
      kilos_reales: kilosRedondeados,
    });
  }

  const cortesiasInput = Array.isArray(input.cortesias) ? input.cortesias : [];
  if (cortesiasInput.length > 0) {
    const autorizadoCortesias =
      usuario.rol === 'ADMINISTRADOR' ||
      usuario.perfil_despachador?.autorizado_cortesias === true;

    if (!autorizadoCortesias) {
      return {
        ok: false,
        error:
          'Su perfil de despachador no cuenta con autorización para emitir cortesías.',
      };
    }
  }

  const cortesiasNormalizadas: ConfirmarDespachoCortesiaInput[] = [];
  for (const cort of cortesiasInput) {
    if (
      !Number.isInteger(cort.id_producto) ||
      cort.id_producto <= 0 ||
      typeof cort.kilos_reales !== 'number' ||
      !Number.isFinite(cort.kilos_reales)
    ) {
      return {
        ok: false,
        error:
          'Existen líneas de cortesía con producto o peso real inválido.',
      };
    }
    const kilosRedondeados = redondearKilos3Decimales(cort.kilos_reales);
    if (kilosRedondeados <= 0) {
      return {
        ok: false,
        error:
          'Todas las líneas de cortesía deben tener un peso real mayor a 0.000 kg.',
      };
    }
    cortesiasNormalizadas.push({
      id_producto: cort.id_producto,
      kilos_reales: kilosRedondeados,
    });
  }

  let nroDocumentoSac: number | null = null;
  if (
    input.nro_documento_sac !== undefined &&
    input.nro_documento_sac !== null
  ) {
    if (
      !Number.isInteger(input.nro_documento_sac) ||
      input.nro_documento_sac <= 0
    ) {
      return {
        ok: false,
        error:
          'El número de documento SAC debe ser un entero positivo mayor a 0.',
      };
    }
    nroDocumentoSac = input.nro_documento_sac;
  }

  const supabase = await createClient();

  if (nroDocumentoSac !== null) {
    const { data: docExistente } = await supabase
      .from('pedidos')
      .select('id_pedido')
      .eq('nro_documento_sac', nroDocumentoSac)
      .neq('id_pedido', input.id_pedido)
      .maybeSingle();

    if (docExistente) {
      return {
        ok: false,
        error: `El N° Documento SAC ${nroDocumentoSac} ya está asignado a otro pedido (#${docExistente.id_pedido}).`,
      };
    }
  }

  const { data, error } = await supabase.rpc('rpc_confirmar_despacho', {
    p_id_pedido: input.id_pedido,
    p_id_despachador: usuario.id_usuario,
    p_detalles_pesados: detallesNormalizados,
    p_cortesias: cortesiasNormalizadas,
  });

  if (error) {
    console.error('[CONFIRMAR DESPACHO RPC ERROR]:', error.message, {
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return {
      ok: false,
      error:
        error.message ||
        'No se pudo confirmar el despacho atómico en la base de datos.',
    };
  }

  if (nroDocumentoSac !== null) {
    const { error: sacErr } = await supabase
      .from('pedidos')
      .update({ nro_documento_sac: nroDocumentoSac })
      .eq('id_pedido', input.id_pedido);

    if (sacErr) {
      console.error('[DESPACHO NRO_DOC_SAC UPDATE ERROR]:', sacErr.message);
      return {
        ok: false,
        error: `El despacho se confirmó, pero no se pudo guardar el N° Documento SAC ${nroDocumentoSac}: ${sacErr.message}`,
      };
    }
  }

  const rawData = data as unknown;
  const nroNotaVenta =
    typeof rawData === 'number'
      ? rawData
      : typeof rawData === 'object' &&
          rawData !== null &&
          'nro_nota_venta' in rawData
        ? Number((rawData as { nro_nota_venta: unknown }).nro_nota_venta)
        : Number(rawData ?? 0);

  revalidatePath('/despacho');
  revalidatePath(`/despacho/${input.id_pedido}`);
  revalidatePath(`/despacho/imprimir/${input.id_pedido}`);
  revalidatePath('/vendedor/mis-pedidos');
  revalidatePath('/produccion/lotes');
  revalidatePath('/admin/historial');
  revalidatePath('/admin/reportes');
  revalidatePath('/admin/kardex');

  return {
    ok: true,
    nro_nota_venta: Number.isFinite(nroNotaVenta) ? nroNotaVenta : 0,
    nro_documento_sac: nroDocumentoSac,
    id_pedido: input.id_pedido,
  };
}

