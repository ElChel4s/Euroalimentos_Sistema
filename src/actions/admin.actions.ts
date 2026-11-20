'use server';

import { revalidatePath } from 'next/cache';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type {
  EstadoPedidoEnum,
  RolUsuarioEnum,
  TipoMovimientoEnum,
  TipoVenta,
  UnidadMedidaEnum,
  VwVentasDesglosadasSac,
} from '@/types/database.types';

export interface AnularPedidoReboteInput {
  id_pedido: number;
  motivo_rebote: string;
}

export interface AnularPedidoReboteData {
  id_anulacion: number;
  kilos_reingresados_total: number;
}

export type AnularPedidoReboteResult =
  | { ok: true; data: AnularPedidoReboteData }
  | { ok: false; error: string };

/**
 * Ejecuta la anulación por rebote (Soft Delete) de un pedido `DESPACHADO`,
 * devolviendo los kilos reales al stock físico de planta vía Kardex (`CU-A02`).
 */
export async function anularPedidoPorReboteAction(
  input: AnularPedidoReboteInput
): Promise<AnularPedidoReboteResult> {
  const usuario = await getUsuarioConPerfilActivo();
  if (!usuario || usuario.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Solo un usuario con rol ADMINISTRADOR puede anular pedidos.',
    };
  }

  if (usuario.perfil_administrador?.puede_anular_despachos !== true) {
    return {
      ok: false,
      error:
        'Tu perfil gerencial no tiene habilitado el permiso de anulación de despachos.',
    };
  }

  if (!Number.isInteger(input.id_pedido) || input.id_pedido <= 0) {
    return {
      ok: false,
      error: 'Identificador de pedido inválido para anulación.',
    };
  }

  const motivoLimpio = (input.motivo_rebote ?? '').trim();
  if (motivoLimpio.length < 10) {
    return {
      ok: false,
      error:
        'El motivo de rebote debe contener al menos 10 caracteres descriptivos.',
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('rpc_anular_pedido_rebote', {
    p_id_pedido: input.id_pedido,
    p_id_administrador: usuario.id_usuario,
    p_motivo_rebote: motivoLimpio,
  });

  if (error) {
    console.error('[ANULAR PEDIDO REBOTE RPC ERROR]:', error.message, {
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
          'El RPC rpc_anular_pedido_rebote aún no está desplegado en Supabase. Ejecute supabase/migrations/rpc_anular_pedido_rebote.sql en el SQL Editor.',
      };
    }

    return {
      ok: false,
      error:
        error.message ||
        'No se pudo ejecutar la anulación por rebote en la base de datos.',
    };
  }

  const raw = (data ?? {}) as Partial<AnularPedidoReboteData>;
  const idAnulacion = Number(raw.id_anulacion ?? 0);
  const kilosReingresadosTotal = Number(raw.kilos_reingresados_total ?? 0);

  revalidatePath('/admin/historial');
  revalidatePath('/admin/reportes');
  revalidatePath('/admin/kardex');
  revalidatePath('/produccion/lotes');
  revalidatePath('/despacho');
  revalidatePath('/despacho/historial');
  revalidatePath('/vendedor/mis-pedidos');

  return {
    ok: true,
    data: {
      id_anulacion: Number.isFinite(idAnulacion) ? idAnulacion : 0,
      kilos_reingresados_total: Number.isFinite(kilosReingresadosTotal)
        ? kilosReingresadosTotal
        : 0,
    },
  };
}

export interface EditarDetalleAdminInput {
  id_detalle: number;
  kilos_estimados: number;
  kilos_reales: number | null;
}

export interface EditarPedidoAdminInput {
  id_pedido: number;
  observaciones: string | null;
  detalles: EditarDetalleAdminInput[];
}

export interface DetalleActualizadoRow {
  id_detalle: number;
  kilos_estimados: number;
  kilos_reales: number | null;
  subtotal_bs: number | null;
}

export type EditarPedidoAdminResult =
  | {
      ok: true;
      observaciones: string | null;
      detalles: DetalleActualizadoRow[];
    }
  | { ok: false; error: string };

/**
 * Permite al ADMINISTRADOR ajustar observaciones o pesos registrados en órdenes
 * no anuladas (`PENDIENTE` o `DESPACHADO`), leyendo de vuelta los subtotales
 * generados en PostgreSQL (`subtotal_bs`).
 */
export async function editarPedidoAdminAction(
  input: EditarPedidoAdminInput
): Promise<EditarPedidoAdminResult> {
  const usuario = await getUsuarioConPerfilActivo();
  if (!usuario || usuario.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Solo un ADMINISTRADOR puede editar órdenes de auditoría.',
    };
  }

  if (!Number.isInteger(input.id_pedido) || input.id_pedido <= 0) {
    return {
      ok: false,
      error: 'Identificador de pedido inválido.',
    };
  }

  const supabase = await createClient();

  const { data: pedidoActual, error: pedidoError } = await supabase
    .from('pedidos')
    .select('id_pedido, estado')
    .eq('id_pedido', input.id_pedido)
    .maybeSingle();

  if (pedidoError || !pedidoActual) {
    return {
      ok: false,
      error: pedidoError?.message || 'No se encontró la orden solicitada.',
    };
  }

  if (pedidoActual.estado === 'ANULADO') {
    return {
      ok: false,
      error: 'No se pueden editar órdenes en estado ANULADO.',
    };
  }

  const obsLimpia = input.observaciones?.trim() || null;

  const { error: updatePedidoErr } = await supabase
    .from('pedidos')
    .update({ observaciones: obsLimpia })
    .eq('id_pedido', input.id_pedido);

  if (updatePedidoErr) {
    return {
      ok: false,
      error:
        updatePedidoErr.message ||
        'No se pudieron guardar las observaciones de la orden.',
    };
  }

  for (const det of input.detalles) {
    if (!Number.isInteger(det.id_detalle) || det.id_detalle <= 0) continue;

    const est = Number(Number(det.kilos_estimados ?? 0).toFixed(3));
    if (!Number.isFinite(est) || est <= 0) {
      return {
        ok: false,
        error: 'Los kilos estimados deben ser mayores a 0.000 kg.',
      };
    }

    const payloadDetalle: { kilos_estimados: number; kilos_reales?: number } = {
      kilos_estimados: est,
    };

    if (pedidoActual.estado === 'DESPACHADO') {
      const real = Number(Number(det.kilos_reales ?? 0).toFixed(3));
      if (!Number.isFinite(real) || real <= 0) {
        return {
          ok: false,
          error:
            'En órdenes despachadas, los kilos reales deben ser mayores a 0.000 kg.',
        };
      }
      payloadDetalle.kilos_reales = real;
    }

    let detallePrevio: { id_producto: number; kilos_estimados: number } | null =
      null;
    if (pedidoActual.estado === 'PENDIENTE') {
      const { data: prevDet } = await supabase
        .from('detalle_pedidos')
        .select('id_producto, kilos_estimados')
        .eq('id_detalle', det.id_detalle)
        .eq('id_pedido', input.id_pedido)
        .maybeSingle();
      if (prevDet) {
        detallePrevio = {
          id_producto: Number(prevDet.id_producto),
          kilos_estimados: Number(prevDet.kilos_estimados ?? 0),
        };
      }
    }

    const { error: detErr } = await supabase
      .from('detalle_pedidos')
      .update(payloadDetalle)
      .eq('id_detalle', det.id_detalle)
      .eq('id_pedido', input.id_pedido);

    if (detErr) {
      return {
        ok: false,
        error:
          detErr.message ||
          `No se pudo actualizar la línea #${det.id_detalle} del pedido.`,
      };
    }

    if (pedidoActual.estado === 'PENDIENTE' && detallePrevio) {
      const deltaComprometido = Number(
        (est - detallePrevio.kilos_estimados).toFixed(3)
      );
      if (Math.abs(deltaComprometido) >= 0.001) {
        const { data: prodRow } = await supabase
          .from('productos')
          .select('stock_comprometido_kilos')
          .eq('id_producto', detallePrevio.id_producto)
          .maybeSingle();

        if (prodRow) {
          const nuevoComprometido = Math.max(
            0,
            Number(
              (
                Number(prodRow.stock_comprometido_kilos ?? 0) +
                deltaComprometido
              ).toFixed(3)
            )
          );
          await supabase
            .from('productos')
            .update({ stock_comprometido_kilos: nuevoComprometido })
            .eq('id_producto', detallePrevio.id_producto);
        }
      }
    }
  }

  const { data: detallesRefrescados, error: fetchDetErr } = await supabase
    .from('detalle_pedidos')
    .select('id_detalle, kilos_estimados, kilos_reales, subtotal_bs')
    .eq('id_pedido', input.id_pedido)
    .order('id_detalle', { ascending: true });

  if (fetchDetErr) {
    return {
      ok: false,
      error: fetchDetErr.message,
    };
  }

  revalidatePath('/admin/historial');
  revalidatePath('/admin/reportes');
  revalidatePath('/admin/kardex');
  revalidatePath('/despacho');
  revalidatePath('/despacho/historial');
  revalidatePath('/vendedor/mis-pedidos');

  return {
    ok: true,
    observaciones: obsLimpia,
    detalles: (detallesRefrescados ?? []).map((row) => ({
      id_detalle: Number(row.id_detalle),
      kilos_estimados: Number(row.kilos_estimados ?? 0),
      kilos_reales:
        row.kilos_reales !== null && row.kilos_reales !== undefined
          ? Number(row.kilos_reales)
          : null,
      subtotal_bs:
        row.subtotal_bs !== null && row.subtotal_bs !== undefined
          ? Number(row.subtotal_bs)
          : null,
    })),
  };
}

// ============================================================================
// GESTIÓN MAESTRA DEL SISTEMA (/admin/catalogo — CU-A04)
// ============================================================================

export type FormatoChorizoInput = 'GRANEL' | 'VACIO';

export interface GuardarProductoInput {
  id_producto?: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoChorizoInput;
  precio_kilo_bs: number;
  unidad_medida?: UnidadMedidaEnum | (string & {});
  peso_unidad_kilos?: number;
  costo_unitario_bs?: number;
  stock_minimo_alerta?: number;
  activo: boolean;
}

export interface ProductoCatalogoAdminRow {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoChorizoInput;
  precio_kilo_bs: number;
  unidad_medida?: UnidadMedidaEnum | (string & {});
  peso_unidad_kilos?: number;
  costo_unitario_bs?: number;
  stock_minimo_alerta?: number;
  stock_fisico_kilos: number;
  stock_disponible_kilos: number;
  activo: boolean;
}

export async function guardarProductoAction(
  input: GuardarProductoInput
): Promise<
  { ok: true; producto: ProductoCatalogoAdminRow } | { ok: false; error: string }
> {
  const usuario = await getUsuarioConPerfilActivo();
  if (!usuario || usuario.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Solo un ADMINISTRADOR puede gestionar el catálogo de chorizos.',
    };
  }

  const codigoSku = (input.codigo_sku ?? '').trim().toUpperCase();
  const nombreProducto = (input.nombre_producto ?? '').trim();
  const precio = Number(Number(input.precio_kilo_bs ?? 0).toFixed(2));

  if (!codigoSku || !nombreProducto) {
    return {
      ok: false,
      error: 'El código SKU y el nombre de la variedad son obligatorios.',
    };
  }

  if (input.formato !== 'GRANEL' && input.formato !== 'VACIO') {
    return {
      ok: false,
      error: 'La presentación debe ser GRANEL o VACIO.',
    };
  }

  if (!Number.isFinite(precio) || precio <= 0) {
    return {
      ok: false,
      error: 'El precio por kilo debe ser mayor a Bs. 0.00.',
    };
  }

  const unidadMedidaNormalizada =
    input.unidad_medida !== undefined
      ? (input.unidad_medida.trim().toUpperCase() || 'KILO')
      : undefined;
  const pesoUnidadNormalizado =
    input.peso_unidad_kilos !== undefined
      ? Number(Number(input.peso_unidad_kilos).toFixed(3))
      : undefined;
  const costoUnitarioNormalizado =
    input.costo_unitario_bs !== undefined
      ? Number(Number(input.costo_unitario_bs).toFixed(5))
      : undefined;
  const stockMinimoNormalizado =
    input.stock_minimo_alerta !== undefined
      ? Number(Number(input.stock_minimo_alerta).toFixed(3))
      : undefined;

  if (
    pesoUnidadNormalizado !== undefined &&
    (!Number.isFinite(pesoUnidadNormalizado) || pesoUnidadNormalizado <= 0)
  ) {
    return {
      ok: false,
      error: 'El peso por unidad en kilos debe ser mayor a 0.000 kg.',
    };
  }

  if (
    costoUnitarioNormalizado !== undefined &&
    (!Number.isFinite(costoUnitarioNormalizado) || costoUnitarioNormalizado < 0)
  ) {
    return {
      ok: false,
      error: 'El costo unitario en Bs. no puede ser negativo.',
    };
  }

  if (
    stockMinimoNormalizado !== undefined &&
    (!Number.isFinite(stockMinimoNormalizado) || stockMinimoNormalizado < 0)
  ) {
    return {
      ok: false,
      error: 'El stock mínimo de alerta no puede ser negativo.',
    };
  }

  const supabase = await createClient();
  const PRODUCTO_SELECT =
    'id_producto, codigo_sku, nombre_producto, formato, unidad_medida, peso_unidad_kilos, precio_kilo_bs, costo_unitario_bs, stock_minimo_alerta, stock_fisico_kilos, stock_disponible_kilos, activo';

  if (input.id_producto && input.id_producto > 0) {
    const updatePayload: {
      codigo_sku: string;
      nombre_producto: string;
      formato: FormatoChorizoInput;
      precio_kilo_bs: number;
      activo: boolean;
      unidad_medida?: string;
      peso_unidad_kilos?: number;
      costo_unitario_bs?: number;
      stock_minimo_alerta?: number;
    } = {
      codigo_sku: codigoSku,
      nombre_producto: nombreProducto,
      formato: input.formato,
      precio_kilo_bs: precio,
      activo: Boolean(input.activo),
    };

    if (unidadMedidaNormalizada !== undefined) {
      updatePayload.unidad_medida = unidadMedidaNormalizada;
    }
    if (pesoUnidadNormalizado !== undefined) {
      updatePayload.peso_unidad_kilos = pesoUnidadNormalizado;
    }
    if (costoUnitarioNormalizado !== undefined) {
      updatePayload.costo_unitario_bs = costoUnitarioNormalizado;
    }
    if (stockMinimoNormalizado !== undefined) {
      updatePayload.stock_minimo_alerta = stockMinimoNormalizado;
    }

    const { data, error } = await supabase
      .from('productos')
      .update(updatePayload)
      .eq('id_producto', input.id_producto)
      .select(PRODUCTO_SELECT)
      .maybeSingle();

    if (error || !data) {
      return {
        ok: false,
        error:
          error?.message || 'No se pudo actualizar la variedad en el catálogo.',
      };
    }

    revalidatePath('/admin/catalogo');
    revalidatePath('/vendedor/nueva-venta');
    revalidatePath('/despacho');
    revalidatePath('/produccion/lotes');
    revalidatePath('/produccion/transformacion');

    return {
      ok: true,
      producto: {
        id_producto: Number(data.id_producto),
        codigo_sku: data.codigo_sku,
        nombre_producto: data.nombre_producto,
        formato: data.formato === 'VACIO' ? 'VACIO' : 'GRANEL',
        precio_kilo_bs: Number(data.precio_kilo_bs ?? 0),
        unidad_medida: data.unidad_medida ?? 'KILO',
        peso_unidad_kilos: Number(data.peso_unidad_kilos ?? 1),
        costo_unitario_bs: Number(data.costo_unitario_bs ?? 0),
        stock_minimo_alerta: Number(data.stock_minimo_alerta ?? 10),
        stock_fisico_kilos: Number(data.stock_fisico_kilos ?? 0),
        stock_disponible_kilos: Number(data.stock_disponible_kilos ?? 0),
        activo: Boolean(data.activo),
      },
    };
  }

  // Creación: obtener primera categoría existente o crear categoría base 'Chorizos'
  let idCategoria = 0;
  const { data: catExistente } = await supabase
    .from('categorias_producto')
    .select('id_categoria')
    .order('id_categoria', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (catExistente?.id_categoria) {
    idCategoria = Number(catExistente.id_categoria);
  } else {
    const { data: nuevaCat, error: catErr } = await supabase
      .from('categorias_producto')
      .insert({
        nombre_categoria: 'Chorizos',
        descripcion: 'Categoría base de chorizos EUROALIMENTOS SRL',
      })
      .select('id_categoria')
      .maybeSingle();

    if (catErr || !nuevaCat?.id_categoria) {
      return {
        ok: false,
        error:
          catErr?.message ||
          'No se pudo asignar una categoría base al nuevo producto.',
      };
    }
    idCategoria = Number(nuevaCat.id_categoria);
  }

  const { data, error } = await supabase
    .from('productos')
    .insert({
      codigo_sku: codigoSku,
      id_categoria: idCategoria,
      nombre_producto: nombreProducto,
      formato: input.formato,
      precio_kilo_bs: precio,
      unidad_medida: unidadMedidaNormalizada ?? 'KILO',
      peso_unidad_kilos: pesoUnidadNormalizado ?? 1.0,
      costo_unitario_bs: costoUnitarioNormalizado ?? 0,
      stock_minimo_alerta: stockMinimoNormalizado ?? 10.0,
      stock_fisico_kilos: 0,
      stock_comprometido_kilos: 0,
      activo: Boolean(input.activo),
    })
    .select(PRODUCTO_SELECT)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message || 'No se pudo crear el chorizo en el catálogo.',
    };
  }

  revalidatePath('/admin/catalogo');
  revalidatePath('/vendedor/nueva-venta');
  revalidatePath('/produccion/lotes');
  revalidatePath('/produccion/transformacion');

  return {
    ok: true,
    producto: {
      id_producto: Number(data.id_producto),
      codigo_sku: data.codigo_sku,
      nombre_producto: data.nombre_producto,
      formato: data.formato === 'VACIO' ? 'VACIO' : 'GRANEL',
      precio_kilo_bs: Number(data.precio_kilo_bs ?? 0),
      unidad_medida: data.unidad_medida ?? 'KILO',
      peso_unidad_kilos: Number(data.peso_unidad_kilos ?? 1),
      costo_unitario_bs: Number(data.costo_unitario_bs ?? 0),
      stock_minimo_alerta: Number(data.stock_minimo_alerta ?? 10),
      stock_fisico_kilos: Number(data.stock_fisico_kilos ?? 0),
      stock_disponible_kilos: Number(data.stock_disponible_kilos ?? 0),
      activo: Boolean(data.activo),
    },
  };
}

export async function toggleProductoActivoAction(
  id_producto: number,
  activo: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const usuario = await getUsuarioConPerfilActivo();
  if (!usuario || usuario.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Solo un ADMINISTRADOR puede cambiar el estado del catálogo.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('productos')
    .update({ activo: Boolean(activo) })
    .eq('id_producto', id_producto);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/catalogo');
  revalidatePath('/vendedor/nueva-venta');
  revalidatePath('/produccion/lotes');
  revalidatePath('/produccion/transformacion');
  return { ok: true };
}

export interface GuardarUsuarioInput {
  id_usuario?: number;
  nombre_completo: string;
  username: string;
  telefono?: string;
  codigo_empleado_sac?: string | null;
  rol: RolUsuarioEnum;
  activo: boolean;
  password?: string;
}

export interface UsuarioSistemaAdminRow {
  id_usuario: number;
  nombre_completo: string;
  username: string;
  telefono: string;
  codigo_empleado_sac?: string | null;
  rol: RolUsuarioEnum;
  activo: boolean;
  requiere_cambio_clave: boolean;
}

async function asegurarPerfilCtiUsuario(
  supabaseClient: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  idUsuario: number,
  rol: RolUsuarioEnum
) {
  if (rol === 'VENDEDOR') {
    await supabaseClient.from('perfil_vendedor').upsert(
      {
        id_usuario: idUsuario,
        codigo_vendedor: `VND-${String(idUsuario).padStart(3, '0')}`,
        porcentaje_comision: 0,
        meta_diaria_kilos: 150,
        permite_venta_sin_stock: true,
      },
      { onConflict: 'id_usuario', ignoreDuplicates: true }
    );
  } else if (rol === 'DESPACHADOR') {
    await supabaseClient.from('perfil_despachador').upsert(
      {
        id_usuario: idUsuario,
        identificador_balanza: 'BALANZA-GANCHO-01',
        impresora_termica_modelo: 'EPSON-TM-T20',
        ancho_papel_mm: 80,
        autorizado_cortesias: true,
      },
      { onConflict: 'id_usuario', ignoreDuplicates: true }
    );
  } else if (rol === 'PRODUCCION') {
    await supabaseClient.from('perfil_produccion').upsert(
      {
        id_usuario: idUsuario,
        turno_planta: 'MAÑANA',
        responsable_camara_frio: true,
        tolerancia_merma_max_pct: 5,
      },
      { onConflict: 'id_usuario', ignoreDuplicates: true }
    );
  } else if (rol === 'ADMINISTRADOR') {
    await supabaseClient.from('perfil_administrador').upsert(
      {
        id_usuario: idUsuario,
        cargo_gerencial: 'Administración General',
        puede_anular_despachos: true,
        puede_exportar_sac: true,
      },
      { onConflict: 'id_usuario', ignoreDuplicates: true }
    );
  }
}

export async function guardarUsuarioAction(
  input: GuardarUsuarioInput
): Promise<
  { ok: true; usuario: UsuarioSistemaAdminRow } | { ok: false; error: string }
> {
  const actor = await getUsuarioConPerfilActivo();
  if (!actor || actor.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Solo un ADMINISTRADOR puede gestionar usuarios del sistema.',
    };
  }

  const nombreCompleto = (input.nombre_completo ?? '').trim();
  const usernameLimpio = (input.username ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const telefonoLimpio = (input.telefono ?? '').trim();
  const codigoEmpleadoSac =
    input.codigo_empleado_sac !== undefined
      ? input.codigo_empleado_sac?.trim().toUpperCase() || null
      : undefined;
  const passwordLimpia = (input.password ?? '').trim();

  if (!nombreCompleto || usernameLimpio.length < 3) {
    return {
      ok: false,
      error:
        'Completa el nombre completo y un username válido (mínimo 3 caracteres).',
    };
  }

  if (!input.id_usuario && passwordLimpia.length < 6) {
    return {
      ok: false,
      error:
        'La contraseña inicial debe tener al menos 6 caracteres al crear un usuario.',
    };
  }

  if (input.id_usuario && passwordLimpia && passwordLimpia.length < 6) {
    return {
      ok: false,
      error: 'La contraseña debe tener al menos 6 caracteres.',
    };
  }

  if (input.id_usuario === actor.id_usuario && !input.activo) {
    return {
      ok: false,
      error: 'No puedes desactivar tu propia cuenta de administrador.',
    };
  }

  // Si está disponible Service Role Key, usar Auth Admin API + CTI 1:1
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const adminClient = createAdminClient();
    const email = `${usernameLimpio}@euroalimentos.com`;

    if (!input.id_usuario) {
      const { data: authCreated, error: authErr } =
        await adminClient.auth.admin.createUser({
          email,
          password: passwordLimpia,
          email_confirm: true,
          user_metadata: {
            nombre_completo: nombreCompleto,
            username: usernameLimpio,
            telefono: telefonoLimpio || null,
            rol: input.rol,
          },
        });

      if (authErr || !authCreated.user) {
        return {
          ok: false,
          error:
            authErr?.message ||
            'No se pudo crear la cuenta en Supabase Auth.',
        };
      }

      // Verificar si un trigger insertó la fila en public.usuarios; sino insertarla
      let { data: userRow } = await adminClient
        .from('usuarios')
        .select(
          'id_usuario, nombre_completo, username, telefono, codigo_empleado_sac, rol, activo, requiere_cambio_clave'
        )
        .eq('auth_id', authCreated.user.id)
        .maybeSingle();

      if (!userRow) {
        const { data: inserted, error: insertErr } = await adminClient
          .from('usuarios')
          .insert({
            nombre_completo: nombreCompleto,
            username: usernameLimpio,
            password_hash: 'SUPABASE_AUTH_MANAGED',
            telefono: telefonoLimpio || null,
            codigo_empleado_sac: codigoEmpleadoSac ?? null,
            rol: input.rol,
            activo: Boolean(input.activo),
            auth_id: authCreated.user.id,
            requiere_cambio_clave: false,
          })
          .select(
            'id_usuario, nombre_completo, username, telefono, codigo_empleado_sac, rol, activo, requiere_cambio_clave'
          )
          .maybeSingle();

        if (insertErr || !inserted) {
          return {
            ok: false,
            error:
              insertErr?.message ||
              'No se pudo registrar el usuario en public.usuarios.',
          };
        }
        userRow = inserted;
      } else if (codigoEmpleadoSac !== undefined) {
        const { data: updatedSac } = await adminClient
          .from('usuarios')
          .update({ codigo_empleado_sac: codigoEmpleadoSac })
          .eq('id_usuario', userRow.id_usuario)
          .select(
            'id_usuario, nombre_completo, username, telefono, codigo_empleado_sac, rol, activo, requiere_cambio_clave'
          )
          .maybeSingle();
        if (updatedSac) {
          userRow = updatedSac;
        }
      }

      await asegurarPerfilCtiUsuario(
        adminClient,
        Number(userRow.id_usuario),
        input.rol
      );

      revalidatePath('/admin/catalogo');
      return {
        ok: true,
        usuario: {
          id_usuario: Number(userRow.id_usuario),
          nombre_completo: userRow.nombre_completo,
          username: userRow.username,
          telefono: userRow.telefono ?? '',
          codigo_empleado_sac: userRow.codigo_empleado_sac ?? null,
          rol: userRow.rol,
          activo: Boolean(userRow.activo),
          requiere_cambio_clave: Boolean(userRow.requiere_cambio_clave),
        },
      };
    } else {
      const { data: updatedRow, error: updErr } = await adminClient
        .from('usuarios')
        .update({
          nombre_completo: nombreCompleto,
          username: usernameLimpio,
          telefono: telefonoLimpio || null,
          ...(codigoEmpleadoSac !== undefined
            ? { codigo_empleado_sac: codigoEmpleadoSac }
            : {}),
          rol: input.rol,
          activo: Boolean(input.activo),
        })
        .eq('id_usuario', input.id_usuario)
        .select(
          'id_usuario, auth_id, nombre_completo, username, telefono, codigo_empleado_sac, rol, activo, requiere_cambio_clave'
        )
        .maybeSingle();

      if (updErr || !updatedRow) {
        return {
          ok: false,
          error: updErr?.message || 'No se pudo actualizar el usuario.',
        };
      }

      if (updatedRow.auth_id) {
        await adminClient.auth.admin.updateUserById(updatedRow.auth_id, {
          ...(passwordLimpia ? { password: passwordLimpia } : {}),
          user_metadata: {
            rol: input.rol,
            id_usuario: updatedRow.id_usuario,
            nombre_completo: nombreCompleto,
            username: usernameLimpio,
          },
        });
      }

      await asegurarPerfilCtiUsuario(
        adminClient,
        Number(updatedRow.id_usuario),
        input.rol
      );

      revalidatePath('/admin/catalogo');
      return {
        ok: true,
        usuario: {
          id_usuario: Number(updatedRow.id_usuario),
          nombre_completo: updatedRow.nombre_completo,
          username: updatedRow.username,
          telefono: updatedRow.telefono ?? '',
          codigo_empleado_sac: updatedRow.codigo_empleado_sac ?? null,
          rol: updatedRow.rol,
          activo: Boolean(updatedRow.activo),
          requiere_cambio_clave: Boolean(updatedRow.requiere_cambio_clave),
        },
      };
    }
  }

  // Sin Service Role Key: usar RPC SECURITY DEFINER
  const supabase = await createClient();
  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    'rpc_admin_guardar_usuario',
    {
      p_admin_id: actor.id_usuario,
      p_id_usuario: input.id_usuario ?? null,
      p_nombre_completo: nombreCompleto,
      p_username: usernameLimpio,
      p_telefono: telefonoLimpio || null,
      p_rol: input.rol,
      p_activo: Boolean(input.activo),
      p_password: passwordLimpia || null,
    }
  );

  if (rpcErr) {
    const msgLower = (rpcErr.message ?? '').toLowerCase();
    if (
      rpcErr.code === 'PGRST202' ||
      msgLower.includes('could not find the function') ||
      msgLower.includes('does not exist')
    ) {
      return {
        ok: false,
        error:
          'Ejecuta supabase/migrations/add_requiere_cambio_clave.sql en el SQL Editor de Supabase para habilitar la creación/edición de usuarios.',
      };
    }
    return {
      ok: false,
      error: rpcErr.message || 'No se pudo guardar el usuario.',
    };
  }

  const parsed = (rpcData ?? {}) as Partial<UsuarioSistemaAdminRow>;
  const idUsuarioFinal = Number(parsed.id_usuario ?? input.id_usuario ?? 0);

  let codigoSacFinal: string | null = parsed.codigo_empleado_sac ?? null;
  if (codigoEmpleadoSac !== undefined && idUsuarioFinal > 0) {
    const { data: sacUpd, error: sacErr } = await supabase
      .from('usuarios')
      .update({ codigo_empleado_sac: codigoEmpleadoSac })
      .eq('id_usuario', idUsuarioFinal)
      .select('codigo_empleado_sac')
      .maybeSingle();

    if (sacErr) {
      return {
        ok: false,
        error: `Usuario guardado, pero no se pudo actualizar el código SAC: ${sacErr.message}`,
      };
    }
    codigoSacFinal = sacUpd?.codigo_empleado_sac ?? codigoEmpleadoSac;
  }

  revalidatePath('/admin/catalogo');

  return {
    ok: true,
    usuario: {
      id_usuario: idUsuarioFinal,
      nombre_completo: parsed.nombre_completo ?? nombreCompleto,
      username: parsed.username ?? usernameLimpio,
      telefono: parsed.telefono ?? telefonoLimpio,
      codigo_empleado_sac: codigoSacFinal,
      rol: parsed.rol ?? input.rol,
      activo: parsed.activo ?? Boolean(input.activo),
      requiere_cambio_clave: Boolean(parsed.requiere_cambio_clave),
    },
  };
}

export async function habilitarCambioClaveUsuarioAction(
  id_usuario: number,
  habilitar: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUsuarioConPerfilActivo();
  if (!actor || actor.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Solo un ADMINISTRADOR puede autorizar cambios de contraseña.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('usuarios')
    .update({ requiere_cambio_clave: Boolean(habilitar) })
    .eq('id_usuario', id_usuario);

  if (error) {
    const msgLower = (error.message ?? '').toLowerCase();
    if (msgLower.includes('requiere_cambio_clave')) {
      return {
        ok: false,
        error:
          'Falta la columna requiere_cambio_clave. Ejecuta supabase/migrations/add_requiere_cambio_clave.sql en Supabase.',
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/catalogo');
  return { ok: true };
}

export async function toggleUsuarioActivoAction(
  id_usuario: number,
  activo: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUsuarioConPerfilActivo();
  if (!actor || actor.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Solo un ADMINISTRADOR puede activar o desactivar cuentas.',
    };
  }

  if (id_usuario === actor.id_usuario && !activo) {
    return {
      ok: false,
      error: 'No puedes desactivar tu propia cuenta de administrador.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('usuarios')
    .update({ activo: Boolean(activo) })
    .eq('id_usuario', id_usuario);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/catalogo');
  return { ok: true };
}

export interface GuardarClienteInput {
  id_cliente?: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  razon_social?: string | null;
  nit_ci?: string;
  telefono?: string;
  direccion?: string | null;
  id_zona: number;
  localidad?: string | null;
  forma_pago_habitual?: TipoVenta;
  plazo_dias?: number;
  limite_credito_bs?: number;
  regla_cortesia_habitual?: string | null;
  observaciones?: string | null;
  activo: boolean;
}

export interface ClienteSacAdminRow {
  id_cliente: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  razon_social?: string | null;
  nit_ci: string;
  telefono: string;
  direccion?: string | null;
  id_zona: number;
  localidad?: string | null;
  forma_pago_habitual?: TipoVenta;
  plazo_dias?: number;
  limite_credito_bs?: number;
  regla_cortesia_habitual?: string | null;
  observaciones?: string | null;
  activo: boolean;
}

export async function guardarClienteAction(
  input: GuardarClienteInput
): Promise<
  { ok: true; cliente: ClienteSacAdminRow } | { ok: false; error: string }
> {
  const actor = await getUsuarioConPerfilActivo();
  if (!actor || actor.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Solo un ADMINISTRADOR puede gestionar clientes SAC.',
    };
  }

  const codigoSac = (input.codigo_cliente_sac ?? '').trim().toUpperCase();
  const nombreComercial = (input.nombre_comercial ?? '').trim();

  if (!codigoSac || !nombreComercial) {
    return {
      ok: false,
      error: 'El Código Cliente SAC y Nombre Comercial son obligatorios.',
    };
  }

  if (!Number.isInteger(input.id_zona) || input.id_zona <= 0) {
    return {
      ok: false,
      error: 'Selecciona una Zona / Mercado válida.',
    };
  }

  const formaPagoInput: TipoVenta | undefined =
    input.forma_pago_habitual !== undefined
      ? input.forma_pago_habitual === 'CREDITO'
        ? 'CREDITO'
        : 'CONTADO'
      : undefined;

  const plazoDiasInput =
    input.plazo_dias !== undefined
      ? Math.trunc(Number(input.plazo_dias))
      : undefined;

  if (
    plazoDiasInput !== undefined &&
    (!Number.isFinite(plazoDiasInput) || plazoDiasInput < 0)
  ) {
    return {
      ok: false,
      error: 'El plazo en días no puede ser negativo.',
    };
  }

  const limiteCreditoInput =
    input.limite_credito_bs !== undefined
      ? Number(Number(input.limite_credito_bs).toFixed(2))
      : undefined;

  if (
    limiteCreditoInput !== undefined &&
    (!Number.isFinite(limiteCreditoInput) || limiteCreditoInput < 0)
  ) {
    return {
      ok: false,
      error: 'El límite de crédito en Bs. no puede ser negativo.',
    };
  }

  const isEdit = Boolean(input.id_cliente && input.id_cliente > 0);
  const CLIENTE_SELECT =
    'id_cliente, codigo_cliente_sac, nombre_comercial, razon_social, nit_ci, telefono, direccion, id_zona, localidad, forma_pago_habitual, plazo_dias, limite_credito_bs, regla_cortesia_habitual, observaciones, activo';

  const supabase = await createClient();
  let query;

  if (isEdit && input.id_cliente) {
    const updatePayload: {
      codigo_cliente_sac: string;
      nombre_comercial: string;
      nit_ci: string | null;
      telefono: string | null;
      id_zona: number;
      activo: boolean;
      razon_social?: string | null;
      direccion?: string | null;
      localidad?: string | null;
      forma_pago_habitual?: TipoVenta;
      plazo_dias?: number;
      limite_credito_bs?: number;
      regla_cortesia_habitual?: string | null;
      observaciones?: string | null;
    } = {
      codigo_cliente_sac: codigoSac,
      nombre_comercial: nombreComercial,
      nit_ci: (input.nit_ci ?? '').trim() || null,
      telefono: (input.telefono ?? '').trim() || null,
      id_zona: input.id_zona,
      activo: Boolean(input.activo),
    };

    if (input.razon_social !== undefined) {
      updatePayload.razon_social = input.razon_social?.trim() || nombreComercial;
    }
    if (input.direccion !== undefined) {
      updatePayload.direccion = input.direccion?.trim() || null;
    }
    if (input.localidad !== undefined) {
      updatePayload.localidad = input.localidad?.trim() || null;
    }
    if (formaPagoInput !== undefined) {
      updatePayload.forma_pago_habitual = formaPagoInput;
      if (formaPagoInput === 'CONTADO') {
        updatePayload.plazo_dias = 0;
      }
    }
    if (plazoDiasInput !== undefined && formaPagoInput !== 'CONTADO') {
      updatePayload.plazo_dias = plazoDiasInput;
    }
    if (limiteCreditoInput !== undefined) {
      updatePayload.limite_credito_bs = limiteCreditoInput;
    }
    if (input.regla_cortesia_habitual !== undefined) {
      updatePayload.regla_cortesia_habitual =
        input.regla_cortesia_habitual?.trim() || null;
    }
    if (input.observaciones !== undefined) {
      updatePayload.observaciones = input.observaciones?.trim() || null;
    }

    query = supabase
      .from('clientes')
      .update(updatePayload)
      .eq('id_cliente', input.id_cliente);
  } else {
    const formaFinal: TipoVenta = formaPagoInput ?? 'CONTADO';
    query = supabase.from('clientes').insert({
      codigo_cliente_sac: codigoSac,
      nombre_comercial: nombreComercial,
      razon_social: input.razon_social?.trim() || nombreComercial,
      nit_ci: (input.nit_ci ?? '').trim() || null,
      telefono: (input.telefono ?? '').trim() || null,
      direccion: input.direccion?.trim() || null,
      id_zona: input.id_zona,
      localidad: input.localidad?.trim() || null,
      forma_pago_habitual: formaFinal,
      plazo_dias: formaFinal === 'CREDITO' ? (plazoDiasInput ?? 0) : 0,
      limite_credito_bs: limiteCreditoInput ?? 0,
      regla_cortesia_habitual:
        input.regla_cortesia_habitual?.trim() || null,
      observaciones: input.observaciones?.trim() || null,
      activo: Boolean(input.activo),
    });
  }

  const { data, error } = await query.select(CLIENTE_SELECT).maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message || 'No se pudo guardar el cliente SAC.',
    };
  }

  revalidatePath('/admin/catalogo');
  revalidatePath('/vendedor/nueva-venta');
  revalidatePath('/admin/historial');
  revalidatePath('/admin/reportes');
  revalidatePath('/admin/kardex');

  return {
    ok: true,
    cliente: {
      id_cliente: Number(data.id_cliente),
      codigo_cliente_sac: data.codigo_cliente_sac,
      nombre_comercial: data.nombre_comercial,
      razon_social: data.razon_social ?? null,
      nit_ci: data.nit_ci ?? '',
      telefono: data.telefono ?? '',
      direccion: data.direccion ?? null,
      id_zona: Number(data.id_zona),
      localidad: data.localidad ?? null,
      forma_pago_habitual:
        data.forma_pago_habitual === 'CREDITO' ? 'CREDITO' : 'CONTADO',
      plazo_dias: Number(data.plazo_dias ?? 0),
      limite_credito_bs: Number(data.limite_credito_bs ?? 0),
      regla_cortesia_habitual: data.regla_cortesia_habitual ?? null,
      observaciones: data.observaciones ?? null,
      activo: Boolean(data.activo),
    },
  };
}

export async function toggleClienteActivoAction(
  id_cliente: number,
  activo: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getUsuarioConPerfilActivo();
  if (!actor || actor.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Solo un ADMINISTRADOR puede modificar clientes SAC.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('clientes')
    .update({ activo: Boolean(activo) })
    .eq('id_cliente', id_cliente);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/catalogo');
  revalidatePath('/vendedor/nueva-venta');
  return { ok: true };
}

export interface GuardarZonaInput {
  id_zona?: number;
  nombre_zona: string;
  ciudad: string;
  activo: boolean;
}

export interface ZonaMercadoAdminRow {
  id_zona: number;
  nombre_zona: string;
  ciudad: string;
  activo: boolean;
}

export async function guardarZonaAction(
  input: GuardarZonaInput
): Promise<
  { ok: true; zona: ZonaMercadoAdminRow } | { ok: false; error: string }
> {
  const actor = await getUsuarioConPerfilActivo();
  if (!actor || actor.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Solo un ADMINISTRADOR puede gestionar zonas de mercado.',
    };
  }

  const nombreZona = (input.nombre_zona ?? '').trim();
  const ciudad = (input.ciudad ?? '').trim() || 'La Paz';

  if (!nombreZona) {
    return {
      ok: false,
      error: 'El nombre de la zona es obligatorio.',
    };
  }

  const supabase = await createClient();
  const query =
    input.id_zona && input.id_zona > 0
      ? supabase
          .from('zonas_mercado')
          .update({
            nombre_zona: nombreZona,
            ciudad,
            activo: Boolean(input.activo),
          })
          .eq('id_zona', input.id_zona)
      : supabase.from('zonas_mercado').insert({
          nombre_zona: nombreZona,
          ciudad,
          activo: Boolean(input.activo),
        });

  const { data, error } = await query
    .select('id_zona, nombre_zona, ciudad, activo')
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message || 'No se pudo guardar la zona de mercado.',
    };
  }

  revalidatePath('/admin/catalogo');
  revalidatePath('/vendedor/nueva-venta');

  return {
    ok: true,
    zona: {
      id_zona: Number(data.id_zona),
      nombre_zona: data.nombre_zona,
      ciudad: data.ciudad,
      activo: Boolean(data.activo),
    },
  };
}

// ============================================================================
// REPORTES SAC DESGLOSADOS Y REPORTE SEMANAL DE INVENTARIO / PRODUCCIÓN
// ============================================================================

export interface VentasDesglosadasFiltros {
  fechaInicio?: string;
  fechaFin?: string;
  estado?: EstadoPedidoEnum;
  tipoVenta?: TipoVenta;
  idZona?: number;
  idVendedor?: number;
  limit?: number;
}

export async function obtenerVentasDesglosadasSacAction(
  filtros: VentasDesglosadasFiltros = {}
): Promise<
  { ok: true; rows: VwVentasDesglosadasSac[] } | { ok: false; error: string }
> {
  const actor = await getUsuarioConPerfilActivo();
  if (!actor || actor.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Solo un ADMINISTRADOR puede consultar ventas desglosadas SAC.',
    };
  }

  const supabase = await createClient();
  let query = supabase
    .from('vw_ventas_desglosadas_sac')
    .select(
      'id_pedido, id_detalle, nro_nota, nro_documento_sac, fecha_venta, fecha_despacho, tipo_venta, plazo_dias, id_cliente, codigo_cliente, cliente, razon_social, nit_ci, id_zona, zona_mercado, localidad, id_vendedor, codigo_empleado_sac, vendedor, id_producto, codigo_sku, nombre_producto, categoria, formato, unidad_medida, peso_unidad_kilos, es_cortesia, kilos_estimados, cantidad_final_kilos, cantidad_facturada_unidad_o_kg, precio_unitario_congelado, subtotal_bs, estado'
    );

  if (filtros.fechaInicio) {
    query = query.gte('fecha_venta', filtros.fechaInicio);
  }
  if (filtros.fechaFin) {
    query = query.lte('fecha_venta', filtros.fechaFin);
  }
  if (filtros.estado) {
    query = query.eq('estado', filtros.estado);
  }
  if (filtros.tipoVenta) {
    query = query.eq('tipo_venta', filtros.tipoVenta);
  }
  if (filtros.idZona && Number.isInteger(filtros.idZona)) {
    query = query.eq('id_zona', filtros.idZona);
  }
  if (filtros.idVendedor && Number.isInteger(filtros.idVendedor)) {
    query = query.eq('id_vendedor', filtros.idVendedor);
  }

  const limit =
    filtros.limit && filtros.limit > 0 && filtros.limit <= 5000
      ? filtros.limit
      : 1000;

  const [{ data, error }, { data: productosData, error: productosError }] =
    await Promise.all([
      query
        .order('fecha_venta', { ascending: false })
        .order('id_pedido', { ascending: false })
        .order('id_detalle', { ascending: true })
        .limit(limit),
      supabase
        .from('productos')
        .select('id_producto, costo_unitario_bs, unidad_medida, peso_unidad_kilos'),
    ]);

  if (error) {
    return {
      ok: false,
      error:
        error.message || 'No se pudo consultar vw_ventas_desglosadas_sac.',
    };
  }

  const productoMap = new Map<
    number,
    {
      costo_unitario_bs: number;
      unidad_medida: string;
      peso_unidad_kilos: number;
    }
  >();

  if (!productosError && Array.isArray(productosData)) {
    for (const p of productosData) {
      const idProd = Number(p.id_producto);
      if (!Number.isFinite(idProd) || idProd <= 0) continue;
      productoMap.set(idProd, {
        costo_unitario_bs: Number(p.costo_unitario_bs ?? 0),
        unidad_medida: String(p.unidad_medida ?? 'KILO'),
        peso_unidad_kilos: Number(p.peso_unidad_kilos ?? 1) || 1,
      });
    }
  }

  const rows: VwVentasDesglosadasSac[] = ((data ?? []) as Record<string, unknown>[]).map(
    (r) => {
      const idProd = Number(r.id_producto ?? 0);
      const prodLookup = productoMap.get(idProd);
      const unidadMedida = String(
        r.unidad_medida ?? prodLookup?.unidad_medida ?? 'KILO'
      ).trim() || 'KILO';
      const pesoUnidad =
        Number(r.peso_unidad_kilos ?? prodLookup?.peso_unidad_kilos ?? 1) || 1;
      const costoUnitario = Number(
        r.costo_unitario_bs ?? prodLookup?.costo_unitario_bs ?? 0
      );

      return {
        id_pedido: Number(r.id_pedido),
        id_detalle: Number(r.id_detalle),
        nro_nota:
          r.nro_nota !== null && r.nro_nota !== undefined
            ? Number(r.nro_nota)
            : null,
        nro_documento_sac:
          r.nro_documento_sac !== null && r.nro_documento_sac !== undefined
            ? Number(r.nro_documento_sac)
            : null,
        fecha_venta: String(r.fecha_venta ?? ''),
        fecha_despacho: r.fecha_despacho ? String(r.fecha_despacho) : null,
        tipo_venta: r.tipo_venta === 'CREDITO' ? 'CREDITO' : 'CONTADO',
        plazo_dias: Number(r.plazo_dias ?? 0),
        id_cliente: Number(r.id_cliente),
        codigo_cliente: String(r.codigo_cliente ?? ''),
        cliente: String(r.cliente ?? ''),
        razon_social: r.razon_social ? String(r.razon_social) : null,
        nit_ci: r.nit_ci ? String(r.nit_ci) : null,
        id_zona: Number(r.id_zona ?? 0),
        zona_mercado: String(r.zona_mercado ?? ''),
        localidad: r.localidad ? String(r.localidad) : null,
        id_vendedor: Number(r.id_vendedor ?? 0),
        codigo_empleado_sac: r.codigo_empleado_sac
          ? String(r.codigo_empleado_sac)
          : null,
        vendedor: String(r.vendedor ?? ''),
        id_producto: idProd,
        codigo_sku: String(r.codigo_sku ?? ''),
        nombre_producto: String(r.nombre_producto ?? ''),
        categoria: String(r.categoria ?? ''),
        formato:
          r.formato === 'VACIO' || r.formato === 'UNIDAD' ? r.formato : 'GRANEL',
        unidad_medida: unidadMedida,
        peso_unidad_kilos: pesoUnidad,
        es_cortesia: Boolean(r.es_cortesia),
        kilos_estimados: Number(r.kilos_estimados ?? 0),
        cantidad_final_kilos: Number(r.cantidad_final_kilos ?? 0),
        cantidad_facturada_unidad_o_kg: Number(
          r.cantidad_facturada_unidad_o_kg ?? 0
        ),
        precio_unitario_congelado: Number(r.precio_unitario_congelado ?? 0),
        costo_unitario_bs: Number.isFinite(costoUnitario) ? costoUnitario : 0,
        subtotal_bs: Number(r.subtotal_bs ?? 0),
        estado:
          r.estado === 'DESPACHADO' || r.estado === 'ANULADO'
            ? r.estado
            : 'PENDIENTE',
      };
    }
  );

  return { ok: true, rows };
}

export interface ReporteSemanalInventarioFila {
  id_producto: number;
  codigo: string;
  descripcion: string;
  formato: string;
  unidad_medida: string;
  saldo_inicial: number;
  ingresos_produccion: number;
  transformacion_granel_a_vacio: number;
  merma_por_escurrido: number;
  total_ventas_despachadas: number;
  total_salidas_por_cortesia: number;
  reingresos_anulacion_rebotes: number;
  ajustes_auditoria: number;
  saldo_final: number;
}

export interface ReporteSemanalInventarioData {
  fecha_inicio: string;
  fecha_fin: string;
  filas: ReporteSemanalInventarioFila[];
  totales: Omit<
    ReporteSemanalInventarioFila,
    'id_producto' | 'codigo' | 'descripcion' | 'formato' | 'unidad_medida'
  >;
}

function obtenerSemanaCierreSabadoBolivia(): {
  fechaInicio: string;
  fechaFin: string;
} {
  const hoyIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [y, m, d] = hoyIso.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = utcDate.getUTCDay(); // 0 = Domingo .. 6 = Sábado
  const offsetLunes = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const lunes = new Date(utcDate);
  lunes.setUTCDate(utcDate.getUTCDate() + offsetLunes);

  const sabado = new Date(lunes);
  sabado.setUTCDate(lunes.getUTCDate() + 5);

  return {
    fechaInicio: lunes.toISOString().slice(0, 10),
    fechaFin: sabado.toISOString().slice(0, 10),
  };
}

function round3(n: number): number {
  return Number(n.toFixed(3));
}

/**
 * Genera el Reporte Semanal único de Inventario y Producción (cierre de sábados)
 * con las 10 columnas contables conciliadas contra Kardex y Transformaciones.
 */
export async function obtenerReporteSemanalInventarioAction(
  filtros: { fechaInicio?: string; fechaFin?: string } = {}
): Promise<
  | { ok: true; data: ReporteSemanalInventarioData }
  | { ok: false; error: string }
> {
  const actor = await getUsuarioConPerfilActivo();
  if (
    !actor ||
    (actor.rol !== 'ADMINISTRADOR' && actor.rol !== 'PRODUCCION')
  ) {
    return {
      ok: false,
      error:
        'Solo ADMINISTRADOR o PRODUCCION pueden generar el reporte semanal de inventario.',
    };
  }

  const semanaDefault = obtenerSemanaCierreSabadoBolivia();
  const fechaInicio =
    filtros.fechaInicio && /^\d{4}-\d{2}-\d{2}$/.test(filtros.fechaInicio)
      ? filtros.fechaInicio
      : semanaDefault.fechaInicio;
  const fechaFin =
    filtros.fechaFin && /^\d{4}-\d{2}-\d{2}$/.test(filtros.fechaFin)
      ? filtros.fechaFin
      : semanaDefault.fechaFin;

  const inicioTs = `${fechaInicio}T00:00:00-04:00`;
  const finTs = `${fechaFin}T23:59:59.999-04:00`;

  const supabase = await createClient();

  const [prodRes, kardexRes, transfRes] = await Promise.all([
    supabase
      .from('productos')
      .select(
        'id_producto, codigo_sku, nombre_producto, formato, unidad_medida, stock_fisico_kilos'
      )
      .eq('activo', true)
      .order('codigo_sku', { ascending: true }),
    supabase
      .from('movimientos_kardex')
      .select(
        'id_movimiento, id_producto, tipo_movimiento, cantidad_kilos, saldo_anterior_kilos, saldo_nuevo_kilos, fecha_movimiento'
      )
      .gte('fecha_movimiento', inicioTs)
      .order('fecha_movimiento', { ascending: true })
      .order('id_movimiento', { ascending: true }),
    supabase
      .from('transformaciones_inventario')
      .select(
        'id_producto_origen, id_producto_destino, kilos_origen_usados, kilos_destino_obtenidos, merma_kilos'
      )
      .gte('fecha_transformacion', inicioTs)
      .lte('fecha_transformacion', finTs),
  ]);

  const queryErr = prodRes.error ?? kardexRes.error ?? transfRes.error;
  if (queryErr) {
    return {
      ok: false,
      error:
        queryErr.message ||
        'No se pudo consolidar el reporte semanal de inventario.',
    };
  }

  const finEpoch = new Date(finTs).getTime();

  interface MovSemanalRaw {
    id_movimiento: number;
    id_producto: number;
    tipo_movimiento: TipoMovimientoEnum;
    cantidad_kilos: number;
    saldo_anterior_kilos: number;
    saldo_nuevo_kilos: number;
    fecha_movimiento: string;
  }

  const movsPorProducto = new Map<number, MovSemanalRaw[]>();
  for (const raw of (kardexRes.data ?? []) as MovSemanalRaw[]) {
    const lista = movsPorProducto.get(raw.id_producto) ?? [];
    lista.push(raw);
    movsPorProducto.set(raw.id_producto, lista);
  }

  const transfSalidaPorOrigen = new Map<
    number,
    { destinoObtenido: number; merma: number }
  >();
  const transfEntradaPorDestino = new Map<number, number>();

  for (const tr of (transfRes.data ?? []) as {
    id_producto_origen: number;
    id_producto_destino: number;
    kilos_origen_usados: number;
    kilos_destino_obtenidos: number;
    merma_kilos: number | null;
  }[]) {
    const usado = Number(tr.kilos_origen_usados ?? 0);
    const obtenido = Number(tr.kilos_destino_obtenidos ?? 0);
    const merma =
      tr.merma_kilos !== null && tr.merma_kilos !== undefined
        ? Number(tr.merma_kilos)
        : Math.max(0, usado - obtenido);

    const prevOrig = transfSalidaPorOrigen.get(tr.id_producto_origen) ?? {
      destinoObtenido: 0,
      merma: 0,
    };
    prevOrig.destinoObtenido += obtenido;
    prevOrig.merma += merma;
    transfSalidaPorOrigen.set(tr.id_producto_origen, prevOrig);

    transfEntradaPorDestino.set(
      tr.id_producto_destino,
      (transfEntradaPorDestino.get(tr.id_producto_destino) ?? 0) + obtenido
    );
  }

  const filas: ReporteSemanalInventarioFila[] = [];

  for (const prod of (prodRes.data ?? []) as {
    id_producto: number;
    codigo_sku: string;
    nombre_producto: string;
    formato: string;
    unidad_medida: string | null;
    stock_fisico_kilos: number;
  }[]) {
    const movsDesdeInicio = movsPorProducto.get(prod.id_producto) ?? [];
    const movsSemana = movsDesdeInicio.filter(
      (m) => new Date(m.fecha_movimiento).getTime() <= finEpoch
    );

    const saldoInicial =
      movsDesdeInicio.length > 0
        ? Number(movsDesdeInicio[0].saldo_anterior_kilos ?? 0)
        : Number(prod.stock_fisico_kilos ?? 0);

    let ingresosProduccion = 0;
    let totalVentasDespachadas = 0;
    let totalSalidasCortesia = 0;
    let reingresosAnulacion = 0;
    let ajustesAuditoria = 0;
    let salidaTransfKardex = 0;
    let entradaTransfKardex = 0;

    for (const m of movsSemana) {
      const cant = Number(m.cantidad_kilos ?? 0);
      switch (m.tipo_movimiento) {
        case 'INGRESO_PRODUCCION':
          ingresosProduccion += Math.abs(cant);
          break;
        case 'SALIDA_VENTA':
          totalVentasDespachadas += Math.abs(cant);
          break;
        case 'SALIDA_CORTESIA':
          totalSalidasCortesia += Math.abs(cant);
          break;
        case 'REINGRESO_ANULACION':
          reingresosAnulacion += Math.abs(cant);
          break;
        case 'SALIDA_TRANSFORMACION':
          salidaTransfKardex += Math.abs(cant);
          break;
        case 'ENTRADA_TRANSFORMACION':
          entradaTransfKardex += Math.abs(cant);
          break;
        case 'AJUSTE_AUDITORIA':
          ajustesAuditoria += cant;
          break;
      }
    }

    const transfOrig = transfSalidaPorOrigen.get(prod.id_producto);
    const transfDest = transfEntradaPorDestino.get(prod.id_producto) ?? 0;

    const salidaTransformadaNeta = transfOrig
      ? transfOrig.destinoObtenido
      : salidaTransfKardex;
    const mermaEscurrido = transfOrig ? transfOrig.merma : 0;
    const entradaTransformada = transfDest > 0 ? transfDest : entradaTransfKardex;

    const transformacionGranelAVacio = round3(
      entradaTransformada - salidaTransformadaNeta
    );

    const saldoFinal =
      movsSemana.length > 0
        ? Number(movsSemana[movsSemana.length - 1].saldo_nuevo_kilos ?? 0)
        : saldoInicial;

    filas.push({
      id_producto: prod.id_producto,
      codigo: prod.codigo_sku,
      descripcion: `${prod.nombre_producto} (${prod.formato})`,
      formato: prod.formato,
      unidad_medida: prod.unidad_medida ?? 'KILO',
      saldo_inicial: round3(saldoInicial),
      ingresos_produccion: round3(ingresosProduccion),
      transformacion_granel_a_vacio: transformacionGranelAVacio,
      merma_por_escurrido: round3(mermaEscurrido),
      total_ventas_despachadas: round3(totalVentasDespachadas),
      total_salidas_por_cortesia: round3(totalSalidasCortesia),
      reingresos_anulacion_rebotes: round3(reingresosAnulacion),
      ajustes_auditoria: round3(ajustesAuditoria),
      saldo_final: round3(saldoFinal),
    });
  }

  const totales = filas.reduce(
    (acc, row) => ({
      saldo_inicial: round3(acc.saldo_inicial + row.saldo_inicial),
      ingresos_produccion: round3(
        acc.ingresos_produccion + row.ingresos_produccion
      ),
      transformacion_granel_a_vacio: round3(
        acc.transformacion_granel_a_vacio + row.transformacion_granel_a_vacio
      ),
      merma_por_escurrido: round3(
        acc.merma_por_escurrido + row.merma_por_escurrido
      ),
      total_ventas_despachadas: round3(
        acc.total_ventas_despachadas + row.total_ventas_despachadas
      ),
      total_salidas_por_cortesia: round3(
        acc.total_salidas_por_cortesia + row.total_salidas_por_cortesia
      ),
      reingresos_anulacion_rebotes: round3(
        acc.reingresos_anulacion_rebotes + row.reingresos_anulacion_rebotes
      ),
      ajustes_auditoria: round3(acc.ajustes_auditoria + row.ajustes_auditoria),
      saldo_final: round3(acc.saldo_final + row.saldo_final),
    }),
    {
      saldo_inicial: 0,
      ingresos_produccion: 0,
      transformacion_granel_a_vacio: 0,
      merma_por_escurrido: 0,
      total_ventas_despachadas: 0,
      total_salidas_por_cortesia: 0,
      reingresos_anulacion_rebotes: 0,
      ajustes_auditoria: 0,
      saldo_final: 0,
    }
  );

  return {
    ok: true,
    data: {
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      filas,
      totales,
    },
  };
}

export interface MovimientoKardexAuditoriaRow {
  id_movimiento: number;
  fecha_movimiento: string;
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: string;
  unidad_medida: string;
  tipo_movimiento: TipoMovimientoEnum;
  variacion_kilos: number;
  saldo_anterior_kilos: number;
  saldo_nuevo_kilos: number;
  referencia_pedido_id: number | null;
  nro_nota_venta: number | null;
  nro_documento_sac: number | null;
  codigo_lote_interno: string | null;
  id_usuario: number;
  responsable: string;
  observacion: string | null;
}

export interface BitacoraKardexFiltros {
  fechaInicio?: string;
  fechaFin?: string;
  idProducto?: number;
  tipoMovimiento?: TipoMovimientoEnum | 'TODOS';
  limit?: number;
}

/**
 * Consulta la bitácora detallada de `public.movimientos_kardex` para auditoría
 * interna en pantalla (sin exportación Excel), enriquecida con producto,
 * responsable, nota de venta y lote interno.
 */
export async function obtenerBitacoraMovimientosKardexAction(
  filtros: BitacoraKardexFiltros = {}
): Promise<
  | { ok: true; rows: MovimientoKardexAuditoriaRow[] }
  | { ok: false; error: string }
> {
  const actor = await getUsuarioConPerfilActivo();
  if (!actor || actor.rol !== 'ADMINISTRADOR') {
    return {
      ok: false,
      error: 'Solo un ADMINISTRADOR puede consultar la auditoría de Kardex.',
    };
  }

  const semanaDefault = obtenerSemanaCierreSabadoBolivia();
  const fechaInicio =
    filtros.fechaInicio && /^\d{4}-\d{2}-\d{2}$/.test(filtros.fechaInicio)
      ? filtros.fechaInicio
      : semanaDefault.fechaInicio;
  const fechaFin =
    filtros.fechaFin && /^\d{4}-\d{2}-\d{2}$/.test(filtros.fechaFin)
      ? filtros.fechaFin
      : semanaDefault.fechaFin;

  const limit =
    filtros.limit && filtros.limit > 0 && filtros.limit <= 3000
      ? filtros.limit
      : 1500;

  const hasServiceRole = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const adminDb = hasServiceRole ? createAdminClient() : await createClient();

  let movQuery = adminDb
    .from('movimientos_kardex')
    .select(
      'id_movimiento, id_producto, id_usuario, tipo_movimiento, cantidad_kilos, saldo_anterior_kilos, saldo_nuevo_kilos, referencia_pedido_id, observacion, fecha_movimiento'
    )
    .gte('fecha_movimiento', `${fechaInicio}T00:00:00-04:00`)
    .lte('fecha_movimiento', `${fechaFin}T23:59:59.999-04:00`);

  if (
    filtros.idProducto &&
    Number.isInteger(filtros.idProducto) &&
    filtros.idProducto > 0
  ) {
    movQuery = movQuery.eq('id_producto', filtros.idProducto);
  }

  if (filtros.tipoMovimiento && filtros.tipoMovimiento !== 'TODOS') {
    movQuery = movQuery.eq('tipo_movimiento', filtros.tipoMovimiento);
  }

  const [movRes, prodRes, usersRes] = await Promise.all([
    movQuery
      .order('fecha_movimiento', { ascending: false })
      .order('id_movimiento', { ascending: false })
      .limit(limit),
    adminDb
      .from('productos')
      .select('id_producto, codigo_sku, nombre_producto, formato, unidad_medida'),
    adminDb.from('usuarios').select('id_usuario, nombre_completo'),
  ]);

  if (movRes.error) {
    return {
      ok: false,
      error:
        movRes.error.message ||
        'No se pudo consultar la bitácora de movimientos_kardex.',
    };
  }

  interface MovRaw {
    id_movimiento: number;
    id_producto: number;
    id_usuario: number;
    tipo_movimiento: TipoMovimientoEnum;
    cantidad_kilos: number;
    saldo_anterior_kilos: number;
    saldo_nuevo_kilos: number;
    referencia_pedido_id: number | null;
    observacion: string | null;
    fecha_movimiento: string;
  }

  const movimientosRaw = (movRes.data ?? []) as MovRaw[];

  const pedidoIds = Array.from(
    new Set(
      movimientosRaw
        .map((m) => m.referencia_pedido_id)
        .filter((id): id is number => id !== null && Number.isInteger(id))
    )
  );
  const movIngresoIds = Array.from(
    new Set(
      movimientosRaw
        .filter((m) => m.tipo_movimiento === 'INGRESO_PRODUCCION')
        .map((m) => Number(m.id_movimiento))
    )
  );

  const [pedidosRes, lotesRes] = await Promise.all([
    pedidoIds.length > 0
      ? adminDb
          .from('pedidos')
          .select('id_pedido, nro_nota_venta, nro_documento_sac')
          .in('id_pedido', pedidoIds)
      : Promise.resolve({ data: [], error: null }),
    movIngresoIds.length > 0
      ? adminDb
          .from('lotes_produccion')
          .select('id_movimiento, codigo_lote_interno')
          .in('id_movimiento', movIngresoIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const prodMap = new Map<
    number,
    {
      codigo_sku: string;
      nombre_producto: string;
      formato: string;
      unidad_medida: string;
    }
  >();
  for (const p of (prodRes.data ?? []) as {
    id_producto: number;
    codigo_sku: string;
    nombre_producto: string;
    formato: string;
    unidad_medida: string | null;
  }[]) {
    prodMap.set(Number(p.id_producto), {
      codigo_sku: String(p.codigo_sku ?? ''),
      nombre_producto: String(p.nombre_producto ?? ''),
      formato: String(p.formato ?? 'GRANEL'),
      unidad_medida: String(p.unidad_medida ?? 'KILO'),
    });
  }

  const userMap = new Map<number, string>();
  for (const u of (usersRes.data ?? []) as {
    id_usuario: number;
    nombre_completo: string;
  }[]) {
    userMap.set(Number(u.id_usuario), String(u.nombre_completo ?? 'Usuario'));
  }

  const pedidoMap = new Map<
    number,
    { nro_nota_venta: number | null; nro_documento_sac: number | null }
  >();
  if (!pedidosRes.error) {
    for (const ped of (pedidosRes.data ?? []) as {
      id_pedido: number;
      nro_nota_venta: number | null;
      nro_documento_sac: number | null;
    }[]) {
      pedidoMap.set(Number(ped.id_pedido), {
        nro_nota_venta:
          ped.nro_nota_venta !== null && ped.nro_nota_venta !== undefined
            ? Number(ped.nro_nota_venta)
            : null,
        nro_documento_sac:
          ped.nro_documento_sac !== null && ped.nro_documento_sac !== undefined
            ? Number(ped.nro_documento_sac)
            : null,
      });
    }
  }

  const loteMap = new Map<number, string>();
  if (!lotesRes.error) {
    for (const l of (lotesRes.data ?? []) as {
      id_movimiento: number;
      codigo_lote_interno: string;
    }[]) {
      loteMap.set(Number(l.id_movimiento), String(l.codigo_lote_interno ?? ''));
    }
  }

  const rows: MovimientoKardexAuditoriaRow[] = movimientosRaw.map((m) => {
    const idProd = Number(m.id_producto);
    const idUser = Number(m.id_usuario);
    const idMov = Number(m.id_movimiento);
    const prod = prodMap.get(idProd);
    const ped =
      m.referencia_pedido_id !== null
        ? pedidoMap.get(Number(m.referencia_pedido_id))
        : undefined;

    const saldoAnt = Number(m.saldo_anterior_kilos ?? 0);
    const saldoNuevo = Number(m.saldo_nuevo_kilos ?? 0);
    const deltaReal = round3(saldoNuevo - saldoAnt);
    const cantAbs = Math.abs(Number(m.cantidad_kilos ?? 0));
    const esSalida =
      m.tipo_movimiento === 'SALIDA_VENTA' ||
      m.tipo_movimiento === 'SALIDA_CORTESIA' ||
      m.tipo_movimiento === 'SALIDA_TRANSFORMACION';
    const variacion =
      deltaReal !== 0 ? deltaReal : round3(esSalida ? -cantAbs : cantAbs);

    return {
      id_movimiento: idMov,
      fecha_movimiento: String(m.fecha_movimiento ?? ''),
      id_producto: idProd,
      codigo_sku: prod?.codigo_sku ?? `SKU-${idProd}`,
      nombre_producto: prod?.nombre_producto ?? 'Producto sin nombre',
      formato: prod?.formato ?? 'GRANEL',
      unidad_medida: prod?.unidad_medida ?? 'KILO',
      tipo_movimiento: m.tipo_movimiento,
      variacion_kilos: variacion,
      saldo_anterior_kilos: round3(saldoAnt),
      saldo_nuevo_kilos: round3(saldoNuevo),
      referencia_pedido_id:
        m.referencia_pedido_id !== null
          ? Number(m.referencia_pedido_id)
          : null,
      nro_nota_venta: ped?.nro_nota_venta ?? null,
      nro_documento_sac: ped?.nro_documento_sac ?? null,
      codigo_lote_interno: loteMap.get(idMov) ?? null,
      id_usuario: idUser,
      responsable: userMap.get(idUser) ?? `Usuario #${idUser}`,
      observacion: m.observacion ? String(m.observacion) : null,
    };
  });

  return { ok: true, rows };
}

