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
    p_id_usuario: usuario.id_usuario,
    p_codigo_lote_interno: codigoLote,
    p_kilos_producidos: kilosRedondeados,
    p_fecha_elaboracion: fechaElaboracion,
    p_observacion: input.observacion?.trim() || null,
  });

  if (error) {
    console.error('[REGISTRAR LOTE PRODUCCION RPC ERROR]:', error.message, {
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    const msgLower = (error.message ?? '').toLowerCase();
    if (
      error.code === 'PGRST202' ||
      msgLower.includes('could not find the function') ||
      msgLower.includes('does not exist')
    ) {
      return {
        ok: false,
        error:
          'El RPC rpc_registrar_lote_produccion aún no está desplegado en Supabase. Ejecute supabase/migrations/rpc_registrar_lote_produccion.sql en el SQL Editor.',
      };
    }

    return {
      ok: false,
      error:
        error.message ||
        'No se pudo registrar el lote de producción en la base de datos.',
    };
  }

  const raw = (data ?? {}) as Partial<RegistrarLoteProduccionData>;
  const idLote = Number(raw.id_lote ?? 0);
  const idMovimiento = Number(raw.id_movimiento ?? 0);
  const saldoNuevo = Number(raw.saldo_nuevo ?? 0);

  revalidatePath('/produccion/lotes');
  revalidatePath('/produccion/transformacion');
  revalidatePath('/despacho');
  revalidatePath('/vendedor/nueva-venta');

  return {
    ok: true,
    data: {
      id_lote: Number.isFinite(idLote) ? idLote : 0,
      id_movimiento: Number.isFinite(idMovimiento) ? idMovimiento : 0,
      saldo_nuevo: Number.isFinite(saldoNuevo) ? saldoNuevo : 0,
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

  const { data, error } = await supabase.rpc(
    'rpc_registrar_transformacion_inventario',
    {
      p_id_usuario: usuario.id_usuario,
      p_id_producto_origen: input.id_producto_origen,
      p_id_producto_destino: input.id_producto_destino,
      p_kilos_origen_usados: kilosOrigen,
      p_kilos_destino_obtenidos: kilosDestino,
      p_observacion: input.observacion?.trim() || null,
    }
  );

  if (error) {
    console.error('[TRANSFORMACION INVENTARIO RPC ERROR]:', error.message, {
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    const msgLower = (error.message ?? '').toLowerCase();
    if (
      error.code === 'PGRST202' ||
      msgLower.includes('could not find the function') ||
      msgLower.includes('does not exist')
    ) {
      return {
        ok: false,
        error:
          'El RPC rpc_registrar_transformacion_inventario aún no está desplegado en Supabase. Ejecute supabase/migrations/rpc_registrar_transformacion_inventario.sql en el SQL Editor.',
      };
    }

    return {
      ok: false,
      error:
        error.message ||
        'No se pudo registrar la transformación de inventario en la base de datos.',
    };
  }

  const raw = (data ?? {}) as Partial<RegistrarTransformacionInventarioData>;
  const idTransformacion = Number(raw.id_transformacion ?? 0);
  const mermaKilos = Number(raw.merma_kilos ?? 0);
  const saldoNuevoOrigen = Number(raw.saldo_nuevo_origen ?? 0);
  const saldoNuevoDestino = Number(raw.saldo_nuevo_destino ?? 0);

  revalidatePath('/produccion/transformacion');
  revalidatePath('/produccion/lotes');
  revalidatePath('/despacho');
  revalidatePath('/vendedor/nueva-venta');

  return {
    ok: true,
    data: {
      id_transformacion: Number.isFinite(idTransformacion)
        ? idTransformacion
        : 0,
      merma_kilos: Number.isFinite(mermaKilos) ? mermaKilos : 0,
      saldo_nuevo_origen: Number.isFinite(saldoNuevoOrigen)
        ? saldoNuevoOrigen
        : 0,
      saldo_nuevo_destino: Number.isFinite(saldoNuevoDestino)
        ? saldoNuevoDestino
        : 0,
    },
  };
}

