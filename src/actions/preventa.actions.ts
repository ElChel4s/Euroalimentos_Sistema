'use server';

import { revalidatePath } from 'next/cache';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { FormatoProductoEnum } from '@/types/database.types';

/**
 * Ítem de catálogo seguro para el rol VENDEDOR.
 * Por regla de negocio RF-05 nunca expone `stock_fisico_kilos`
 * ni `stock_comprometido_kilos`, únicamente el booleano `requiere_produccion`.
 */
export interface ProductoPreventaItem {
  id_producto: number;
  codigo_sku: string;
  id_categoria: number;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  precio_kilo_bs: number;
  requiere_produccion: boolean;
  categorias_producto?: { nombre_categoria: string };
}

export interface ZonaPreventaItem {
  id_zona: number;
  nombre_zona: string;
}

export interface CategoriaPreventaItem {
  id_categoria: number;
  nombre_categoria: string;
}

export interface ClientePreventaItem {
  id_cliente: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  id_zona: number;
  zona: string;
  nit_ci: string | null;
  telefono: string | null;
  zonas_mercado?: { id_zona: number; nombre_zona: string } | null;
}

export interface RegistrarPreventaInput {
  id_cliente: number;
  observaciones: string;
  items: { id_producto: number; kilos_estimados: number }[];
}

export type RegistrarPreventaResult =
  | { ok: true; id_pedido: number }
  | { ok: false; error: string };

export interface CrearClienteRapidoInput {
  nombre_comercial: string;
  id_zona?: number | null;
  nueva_zona_nombre?: string;
  nit_ci?: string;
  telefono?: string;
  codigo_cliente_sac?: string;
}

export type CrearClienteRapidoResult =
  | {
      ok: true;
      cliente: ClientePreventaItem;
      zonaCreada?: ZonaPreventaItem;
    }
  | { ok: false; error: string };

interface ZonaRelationRaw {
  id_zona: number;
  nombre_zona: string;
}

interface ClienteInsertRowRaw {
  id_cliente: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  id_zona: number;
  nit_ci: string | null;
  telefono: string | null;
  zonas_mercado: ZonaRelationRaw | ZonaRelationRaw[] | null;
}

function normalizeZonaRelation(
  value: ZonaRelationRaw | ZonaRelationRaw[] | null | undefined
): ZonaRelationRaw | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Registra una preventa de forma transaccional en PostgreSQL mediante `rpc_registrar_preventa`,
 * congelando precios unitarios y reservando `stock_comprometido_kilos`.
 */
export async function registrarPreventaAction(
  input: RegistrarPreventaInput
): Promise<RegistrarPreventaResult> {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'VENDEDOR' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    return {
      ok: false,
      error: 'Sesión no autorizada para registrar preventas.',
    };
  }

  if (!Number.isInteger(input.id_cliente) || input.id_cliente <= 0) {
    return {
      ok: false,
      error: 'Seleccione un cliente válido antes de confirmar la preventa.',
    };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return {
      ok: false,
      error: 'Debe agregar al menos un producto con kilos estimados.',
    };
  }

  const itemsInvalidos = input.items.some(
    (item) =>
      !Number.isInteger(item.id_producto) ||
      item.id_producto <= 0 ||
      !Number.isInteger(item.kilos_estimados) ||
      item.kilos_estimados < 1
  );

  if (itemsInvalidos) {
    return {
      ok: false,
      error:
        'Todos los productos deben tener una cantidad entera positiva de kilos (>= 1 kg).',
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('rpc_registrar_preventa', {
    p_id_cliente: input.id_cliente,
    p_id_vendedor: usuario.id_usuario,
    p_observaciones: input.observaciones.trim() || null,
    p_items: input.items,
  });

  if (error) {
    console.error('[PREVENTA RPC ERROR]:', error.message, {
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return {
      ok: false,
      error:
        error.message ||
        'No se pudo registrar la preventa en la base de datos.',
    };
  }

  const rawData = data as unknown;
  const idPedido =
    typeof rawData === 'number'
      ? rawData
      : typeof rawData === 'object' &&
          rawData !== null &&
          'id_pedido' in rawData
        ? Number((rawData as { id_pedido: unknown }).id_pedido)
        : Number(rawData ?? 0);

  revalidatePath('/vendedor/nueva-venta');
  revalidatePath('/vendedor/mis-pedidos');
  revalidatePath('/despacho');

  return {
    ok: true,
    id_pedido: Number.isFinite(idPedido) ? idPedido : 0,
  };
}

/**
 * Registra rápidamente un cliente nuevo desde la ruta de preventa móvil (CU-V01).
 */
export async function crearClienteRapidoAction(
  input: CrearClienteRapidoInput
): Promise<CrearClienteRapidoResult> {
  const usuario = await getUsuarioConPerfilActivo();
  if (
    !usuario ||
    (usuario.rol !== 'VENDEDOR' && usuario.rol !== 'ADMINISTRADOR')
  ) {
    return {
      ok: false,
      error: 'Sesión no autorizada para crear clientes.',
    };
  }

  const nombreComercial = input.nombre_comercial.trim();
  if (!nombreComercial) {
    return {
      ok: false,
      error: 'El nombre comercial del cliente es obligatorio.',
    };
  }

  const supabase = await createClient();

  let idZonaFinal: number | null =
    typeof input.id_zona === 'number' &&
    Number.isInteger(input.id_zona) &&
    input.id_zona > 0
      ? input.id_zona
      : null;
  let zonaCreada: ZonaPreventaItem | undefined;
  const nuevaZonaTexto = input.nueva_zona_nombre?.trim() ?? '';

  if (!idZonaFinal && nuevaZonaTexto) {
    const { data: zonaExistente } = await supabase
      .from('zonas_mercado')
      .select('id_zona, nombre_zona')
      .ilike('nombre_zona', nuevaZonaTexto)
      .maybeSingle<ZonaRelationRaw>();

    if (zonaExistente) {
      idZonaFinal = zonaExistente.id_zona;
    } else {
      const { data: zonaNueva, error: zonaError } = await supabase
        .from('zonas_mercado')
        .insert({
          nombre_zona: nuevaZonaTexto,
          activo: true,
        })
        .select('id_zona, nombre_zona')
        .maybeSingle<ZonaRelationRaw>();

      if (zonaError || !zonaNueva) {
        return {
          ok: false,
          error:
            zonaError?.message ||
            'No se pudo registrar la nueva zona de mercado.',
        };
      }

      idZonaFinal = zonaNueva.id_zona;
      zonaCreada = {
        id_zona: zonaNueva.id_zona,
        nombre_zona: zonaNueva.nombre_zona,
      };
    }
  }

  if (!idZonaFinal) {
    return {
      ok: false,
      error: 'Debe seleccionar o escribir una zona de mercado.',
    };
  }

  const codigoClienteSac =
    input.codigo_cliente_sac?.trim().toUpperCase() ||
    `CLI-${Date.now().toString().slice(-6)}`;

  const { data, error } = await supabase
    .from('clientes')
    .insert({
      nombre_comercial: nombreComercial,
      id_zona: idZonaFinal,
      nit_ci: input.nit_ci?.trim() || null,
      telefono: input.telefono?.trim() || null,
      codigo_cliente_sac: codigoClienteSac,
      activo: true,
    })
    .select(
      'id_cliente, codigo_cliente_sac, nombre_comercial, id_zona, nit_ci, telefono, zonas_mercado(id_zona, nombre_zona)'
    )
    .single<ClienteInsertRowRaw>();

  if (error || !data) {
    console.error('[CREAR CLIENTE RAPIDO ERROR]:', error?.message, {
      code: error?.code,
      details: error?.details,
    });
    return {
      ok: false,
      error:
        error?.message || 'No se pudo registrar el cliente. Intente nuevamente.',
    };
  }

  const zonaRelacion = normalizeZonaRelation(data.zonas_mercado);

  revalidatePath('/vendedor/nueva-venta');

  return {
    ok: true,
    zonaCreada,
    cliente: {
      id_cliente: data.id_cliente,
      codigo_cliente_sac: data.codigo_cliente_sac,
      nombre_comercial: data.nombre_comercial,
      id_zona: data.id_zona,
      zona: zonaRelacion?.nombre_zona ?? (nuevaZonaTexto || 'Sin zona'),
      nit_ci: data.nit_ci,
      telefono: data.telefono,
      zonas_mercado: zonaRelacion,
    },
  };
}
