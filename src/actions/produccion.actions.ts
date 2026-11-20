'use server';

import { revalidatePath } from 'next/cache';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export interface RegistrarLoteProduccionInput {
  id_producto: number;
  codigo_lote_interno: string;
  kilos_producidos: number;
  fecha_elaboracion: string;
  observacion?: string;
}

export interface RegistrarLoteProduccionData {
  id_lote: number;
  id_movimiento: number;
  saldo_nuevo: number;
  saldo_nuevo_kilos: number;
  saldo_disponible_kilos: number;
}

export type RegistrarLoteProduccionResult =
  | { ok: true; data: RegistrarLoteProduccionData }
  | { ok: false; error: string };

function redondearKilos3Decimales(valor: number): number {
  return Number(valor.toFixed(3));
}

function esFechaIsoValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/**
 * Registra de manera transaccional (via RPC CTI) un nuevo lote de producción
 * en `movimientos_kardex` + `lotes_produccion` incrementando `stock_fisico_kilos`.
 */
export async function registrarLoteProduccionAction(
  input: RegistrarLoteProduccionInput
): Promise<RegistrarLoteProduccionResult> {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'PRODUCCION' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    return {
      ok: false,
      error: 'Sesión no autorizada para registrar lotes de producción.',
    };
  }

  if (!Number.isInteger(input.id_producto) || input.id_producto <= 0) {
    return {
      ok: false,
      error: 'Seleccione un producto válido antes de registrar el lote.',
    };
  }

  const codigoLote = (input.codigo_lote_interno ?? '').trim().toUpperCase();
  if (codigoLote.length < 3) {
    return {
      ok: false,
      error: 'El código de lote interno debe tener al menos 3 caracteres.',
    };
  }

  if (
    typeof input.kilos_producidos !== 'number' ||
    !Number.isFinite(input.kilos_producidos)
  ) {
    return {
      ok: false,
      error: 'El peso producido ingresado no es numérico válido.',
    };
  }

  const kilosRedondeados = redondearKilos3Decimales(input.kilos_producidos);
  if (kilosRedondeados <= 0) {
    return {
      ok: false,
      error: 'La cantidad producida debe ser mayor a 0.000 kg.',
    };
  }

  const fechaElaboracion = (input.fecha_elaboracion ?? '').trim();
  if (!esFechaIsoValida(fechaElaboracion)) {
    return {
      ok: false,
      error: 'La fecha de elaboración no tiene un formato válido (YYYY-MM-DD).',
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('rpc_registrar_lote_produccion', {
    p_id_producto: input.id_producto,
    p_id_usuario_produccion: usuario.id_usuario,
    p_codigo_lote_interno: codigoLote,
    p_kilos_producidos: kilosRedondeados,
    p_fecha_elaboracion: fechaElaboracion,
    p_observacion: input.observacion?.trim() || null,
  });

  if (error) {
    console.error('[RPC PRODUCCION ERROR]:', error);
    return {
      ok: false,
      error:
        error.message ||
        'No se pudo registrar el lote de producción en la base de datos.',
    };
  }

  const raw = (Array.isArray(data) ? data[0] : (data ?? {})) as Record<
    string,
    unknown
  >;
  const idLote = Number(raw.id_lote ?? 0);
  const idMovimiento = Number(raw.id_movimiento ?? 0);

  // Consultar el stock actualizado real en `productos` para evitar desfase por nombre de clave del RPC
  const { data: prodActualizado } = await supabase
    .from('productos')
    .select(
      'stock_fisico_kilos, stock_comprometido_kilos, stock_disponible_kilos'
    )
    .eq('id_producto', input.id_producto)
    .maybeSingle();

  const saldoRpcRaw =
    raw.saldo_nuevo_kilos ?? raw.saldo_nuevo ?? prodActualizado?.stock_fisico_kilos;
  const saldoNuevo = Number(
    prodActualizado?.stock_fisico_kilos ?? saldoRpcRaw ?? 0
  );
  const saldoDisponible = Number(
    prodActualizado?.stock_disponible_kilos ??
      saldoNuevo - Number(prodActualizado?.stock_comprometido_kilos ?? 0)
  );

  revalidatePath('/produccion/lotes');
  revalidatePath('/produccion/transformacion');
  revalidatePath('/produccion/historial');
  revalidatePath('/despacho');
  revalidatePath('/vendedor/nueva-venta');

  const saldoFisicoFinal = Number.isFinite(saldoNuevo)
    ? Number(saldoNuevo.toFixed(3))
    : 0;
  const saldoDisponibleFinal = Number.isFinite(saldoDisponible)
    ? Number(saldoDisponible.toFixed(3))
    : saldoFisicoFinal;

  return {
    ok: true,
    data: {
      id_lote: Number.isFinite(idLote) ? idLote : 0,
      id_movimiento: Number.isFinite(idMovimiento) ? idMovimiento : 0,
      saldo_nuevo: saldoFisicoFinal,
      saldo_nuevo_kilos: saldoFisicoFinal,
      saldo_disponible_kilos: saldoDisponibleFinal,
    },
  };
}

export interface RegistrarTransformacionInventarioInput {
  id_producto_origen: number;
  id_producto_destino: number;
  kilos_origen_usados: number;
  kilos_destino_obtenidos: number;
  observacion?: string;
}

export interface RegistrarTransformacionInventarioData {
  id_transformacion: number;
  merma_kilos: number;
  saldo_nuevo_origen: number;
  saldo_nuevo_destino: number;
  saldo_origen_nuevo: number;
  saldo_destino_nuevo: number;
  saldo_disponible_origen: number;
  saldo_disponible_destino: number;
}

export type RegistrarTransformacionInventarioResult =
  | { ok: true; data: RegistrarTransformacionInventarioData }
  | { ok: false; error: string };

/**
 * Registra de forma atómica la conversión de stock `GRANEL` -> `VACIO`,
 * generando los asientos duales en `movimientos_kardex` y la merma en
 * `transformaciones_inventario` (CU-P02 / RF-12).
 */
export async function registrarTransformacionInventarioAction(
  input: RegistrarTransformacionInventarioInput
): Promise<RegistrarTransformacionInventarioResult> {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'PRODUCCION' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    return {
      ok: false,
      error: 'Sesión no autorizada para registrar transformaciones en planta.',
    };
  }

  if (
    !Number.isInteger(input.id_producto_origen) ||
    input.id_producto_origen <= 0 ||
    !Number.isInteger(input.id_producto_destino) ||
    input.id_producto_destino <= 0
  ) {
    return {
      ok: false,
      error: 'Seleccione productos válidos para origen granel y destino vacío.',
    };
  }

  if (input.id_producto_origen === input.id_producto_destino) {
    return {
      ok: false,
      error: 'El producto origen y destino deben ser distintos.',
    };
  }

  if (
    typeof input.kilos_origen_usados !== 'number' ||
    !Number.isFinite(input.kilos_origen_usados) ||
    typeof input.kilos_destino_obtenidos !== 'number' ||
    !Number.isFinite(input.kilos_destino_obtenidos)
  ) {
    return {
      ok: false,
      error: 'Los pesos ingresados deben ser valores numéricos válidos.',
    };
  }

  const kilosOrigen = redondearKilos3Decimales(input.kilos_origen_usados);
  const kilosDestino = redondearKilos3Decimales(input.kilos_destino_obtenidos);

  if (kilosOrigen <= 0 || kilosDestino <= 0) {
    return {
      ok: false,
      error:
        'Tanto los kilos de origen usados como los obtenidos al vacío deben ser mayores a 0.000 kg.',
    };
  }

  if (kilosDestino > kilosOrigen) {
    return {
      ok: false,
      error:
        'Los kilos obtenidos al vacío no pueden superar los kilos retirados de granel.',
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('rpc_transformar_granel_a_vacio', {
    p_id_usuario_produccion: usuario.id_usuario,
    p_id_producto_origen: input.id_producto_origen,
    p_id_producto_destino: input.id_producto_destino,
    p_kilos_origen_usados: kilosOrigen,
    p_kilos_destino_obtenidos: kilosDestino,
    p_observacion: input.observacion?.trim() || null,
  });

  if (error) {
    console.error('[RPC PRODUCCION ERROR]:', error);
    return {
      ok: false,
      error:
        error.message ||
        'No se pudo registrar la transformación de inventario en la base de datos.',
    };
  }

  const raw = (Array.isArray(data) ? data[0] : (data ?? {})) as Record<
    string,
    unknown
  >;
  const idTransformacion = Number(raw.id_transformacion ?? 0);
  const mermaKilos = Number(
    raw.merma_kilos ?? Number((kilosOrigen - kilosDestino).toFixed(3))
  );

  // Consultar stock actualizado real de origen y destino para sincronización inmediata
  const { data: prodsActualizados } = await supabase
    .from('productos')
    .select(
      'id_producto, stock_fisico_kilos, stock_comprometido_kilos, stock_disponible_kilos'
    )
    .in('id_producto', [input.id_producto_origen, input.id_producto_destino]);

  const rowOrigen = (prodsActualizados ?? []).find(
    (p) => Number(p.id_producto) === input.id_producto_origen
  );
  const rowDestino = (prodsActualizados ?? []).find(
    (p) => Number(p.id_producto) === input.id_producto_destino
  );

  const saldoOrigenNum = Number(
    rowOrigen?.stock_fisico_kilos ??
      raw.saldo_origen_nuevo ??
      raw.saldo_nuevo_origen ??
      0
  );
  const saldoDestinoNum = Number(
    rowDestino?.stock_fisico_kilos ??
      raw.saldo_destino_nuevo ??
      raw.saldo_nuevo_destino ??
      0
  );

  const saldoDispOrigen = Number(
    rowOrigen?.stock_disponible_kilos ??
      saldoOrigenNum - Number(rowOrigen?.stock_comprometido_kilos ?? 0)
  );
  const saldoDispDestino = Number(
    rowDestino?.stock_disponible_kilos ??
      saldoDestinoNum - Number(rowDestino?.stock_comprometido_kilos ?? 0)
  );

  revalidatePath('/produccion/transformacion');
  revalidatePath('/produccion/lotes');
  revalidatePath('/produccion/historial');
  revalidatePath('/despacho');
  revalidatePath('/vendedor/nueva-venta');

  const origenFinal = Number.isFinite(saldoOrigenNum)
    ? Number(saldoOrigenNum.toFixed(3))
    : 0;
  const destinoFinal = Number.isFinite(saldoDestinoNum)
    ? Number(saldoDestinoNum.toFixed(3))
    : 0;

  return {
    ok: true,
    data: {
      id_transformacion: Number.isFinite(idTransformacion)
        ? idTransformacion
        : 0,
      merma_kilos: Number.isFinite(mermaKilos)
        ? Number(mermaKilos.toFixed(3))
        : 0,
      saldo_nuevo_origen: origenFinal,
      saldo_nuevo_destino: destinoFinal,
      saldo_origen_nuevo: origenFinal,
      saldo_destino_nuevo: destinoFinal,
      saldo_disponible_origen: Number.isFinite(saldoDispOrigen)
        ? Number(saldoDispOrigen.toFixed(3))
        : origenFinal,
      saldo_disponible_destino: Number.isFinite(saldoDispDestino)
        ? Number(saldoDispDestino.toFixed(3))
        : destinoFinal,
    },
  };
}

