'use server';

import { revalidatePath } from 'next/cache';
import { getUsuarioConPerfilActivo } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { RolUsuarioEnum } from '@/types/database.types';

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
  activo: boolean;
}

export interface ProductoCatalogoAdminRow {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoChorizoInput;
  precio_kilo_bs: number;
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

  const supabase = await createClient();

  if (input.id_producto && input.id_producto > 0) {
    const { data, error } = await supabase
      .from('productos')
      .update({
        codigo_sku: codigoSku,
        nombre_producto: nombreProducto,
        formato: input.formato,
        precio_kilo_bs: precio,
        activo: Boolean(input.activo),
      })
      .eq('id_producto', input.id_producto)
      .select(
        'id_producto, codigo_sku, nombre_producto, formato, precio_kilo_bs, stock_fisico_kilos, stock_disponible_kilos, activo'
      )
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
      stock_fisico_kilos: 0,
      stock_comprometido_kilos: 0,
      activo: Boolean(input.activo),
    })
    .select(
      'id_producto, codigo_sku, nombre_producto, formato, precio_kilo_bs, stock_fisico_kilos, stock_disponible_kilos, activo'
    )
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
  rol: RolUsuarioEnum;
  activo: boolean;
  password?: string;
}

export interface UsuarioSistemaAdminRow {
  id_usuario: number;
  nombre_completo: string;
  username: string;
  telefono: string;
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
          'id_usuario, nombre_completo, username, telefono, rol, activo, requiere_cambio_clave'
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
            rol: input.rol,
            activo: Boolean(input.activo),
            auth_id: authCreated.user.id,
            requiere_cambio_clave: false,
          })
          .select(
            'id_usuario, nombre_completo, username, telefono, rol, activo, requiere_cambio_clave'
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
          rol: input.rol,
          activo: Boolean(input.activo),
        })
        .eq('id_usuario', input.id_usuario)
        .select(
          'id_usuario, auth_id, nombre_completo, username, telefono, rol, activo, requiere_cambio_clave'
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
  revalidatePath('/admin/catalogo');

  return {
    ok: true,
    usuario: {
      id_usuario: Number(parsed.id_usuario ?? input.id_usuario ?? 0),
      nombre_completo: parsed.nombre_completo ?? nombreCompleto,
      username: parsed.username ?? usernameLimpio,
      telefono: parsed.telefono ?? telefonoLimpio,
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
  nit_ci?: string;
  telefono?: string;
  id_zona: number;
  activo: boolean;
}

export interface ClienteSacAdminRow {
  id_cliente: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  nit_ci: string;
  telefono: string;
  id_zona: number;
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

  const payload = {
    codigo_cliente_sac: codigoSac,
    nombre_comercial: nombreComercial,
    nit_ci: (input.nit_ci ?? '').trim() || null,
    telefono: (input.telefono ?? '').trim() || null,
    id_zona: input.id_zona,
    activo: Boolean(input.activo),
  };

  const supabase = await createClient();
  const query =
    input.id_cliente && input.id_cliente > 0
      ? supabase
          .from('clientes')
          .update(payload)
          .eq('id_cliente', input.id_cliente)
      : supabase.from('clientes').insert(payload);

  const { data, error } = await query
    .select(
      'id_cliente, codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo'
    )
    .maybeSingle();

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

  return {
    ok: true,
    cliente: {
      id_cliente: Number(data.id_cliente),
      codigo_cliente_sac: data.codigo_cliente_sac,
      nombre_comercial: data.nombre_comercial,
      nit_ci: data.nit_ci ?? '',
      telefono: data.telefono ?? '',
      id_zona: Number(data.id_zona),
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

