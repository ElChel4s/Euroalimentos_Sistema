import type {
  EstadoPedidoEnum,
  FormatoProductoEnum,
  RolUsuarioEnum,
  TipoVenta,
  UnidadMedidaEnum,
  UsuarioConPerfil,
} from '@/types/database.types';

export interface PerfilDespachadorResumen {
  id_usuario: number;
  nombre_operador: string;
  rol: RolUsuarioEnum;
  identificador_balanza: string;
  impresora_termica_modelo: string;
  ancho_papel_mm: number;
  autorizado_cortesias: boolean;
}

export interface ZonaDespachoItem {
  id_zona: number;
  nombre_zona: string;
  ciudad: string;
}

export interface ClienteDespachoItem {
  id_cliente: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  razon_social: string | null;
  nit_ci: string | null;
  telefono: string | null;
  direccion: string | null;
  localidad: string | null;
  forma_pago_habitual: TipoVenta;
  plazo_dias: number;
  regla_cortesia_habitual: string | null;
  observaciones: string | null;
  zona: ZonaDespachoItem;
}

export interface VendedorDespachoItem {
  id_usuario: number;
  nombre_completo: string;
  codigo_vendedor: string;
}

export interface ProductoDespachoItem {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  unidad_medida: UnidadMedidaEnum | (string & {});
  peso_unidad_kilos: number;
  stock_fisico_kilos: number;
  stock_comprometido_kilos: number;
}

export interface ProductoCatalogoPesajeItem {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  unidad_medida: UnidadMedidaEnum | (string & {});
  peso_unidad_kilos: number;
  precio_kilo_bs: number;
  stock_fisico_kilos: number;
}

export interface DetallePedidoDespachoItem {
  id_detalle: number;
  id_producto: number;
  kilos_estimados: number;
  kilos_reales: number | null;
  es_cortesia: boolean;
  precio_unitario_congelado: number;
  subtotal_bs: number | null;
  producto: ProductoDespachoItem;
}

export interface PedidoDespachoItem {
  id_pedido: number;
  nro_nota_venta: number | null;
  nro_documento_sac: number | null;
  estado: EstadoPedidoEnum;
  tipo_venta: TipoVenta;
  plazo_dias: number;
  es_pedido_cortesia_pura: boolean;
  observaciones: string | null;
  fecha_preventa: string;
  cliente: ClienteDespachoItem;
  vendedor: VendedorDespachoItem;
  detalle_pedidos: DetallePedidoDespachoItem[];
}

export const PEDIDO_DESPACHO_SELECT = `
  id_pedido,
  nro_nota_venta,
  nro_documento_sac,
  estado,
  tipo_venta,
  plazo_dias,
  es_pedido_cortesia_pura,
  observaciones,
  fecha_preventa,
  clientes!inner (
    id_cliente,
    codigo_cliente_sac,
    nombre_comercial,
    razon_social,
    nit_ci,
    telefono,
    direccion,
    localidad,
    forma_pago_habitual,
    plazo_dias,
    regla_cortesia_habitual,
    observaciones,
    zonas_mercado (
      id_zona,
      nombre_zona,
      ciudad
    )
  ),
  vendedor:usuarios!pedidos_id_vendedor_fkey (
    id_usuario,
    nombre_completo,
    perfil_vendedor (
      codigo_vendedor
    )
  ),
  detalle_pedidos (
    id_detalle,
    id_producto,
    kilos_estimados,
    kilos_reales,
    es_cortesia,
    precio_unitario_congelado,
    subtotal_bs,
    productos (
      id_producto,
      codigo_sku,
      nombre_producto,
      formato,
      unidad_medida,
      peso_unidad_kilos,
      stock_fisico_kilos,
      stock_comprometido_kilos
    )
  )
`;

interface ZonaRelationRaw {
  id_zona: number;
  nombre_zona: string;
  ciudad: string;
}

interface ClienteRelationRaw {
  id_cliente: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  razon_social: string | null;
  nit_ci: string | null;
  telefono: string | null;
  direccion: string | null;
  localidad: string | null;
  forma_pago_habitual: TipoVenta;
  plazo_dias: number;
  regla_cortesia_habitual: string | null;
  observaciones: string | null;
  zonas_mercado: ZonaRelationRaw | ZonaRelationRaw[] | null;
}

interface PerfilVendedorRelationRaw {
  codigo_vendedor: string;
}

interface VendedorRelationRaw {
  id_usuario: number;
  nombre_completo: string;
  perfil_vendedor: PerfilVendedorRelationRaw | PerfilVendedorRelationRaw[] | null;
}

interface ProductoRelationRaw {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  unidad_medida: UnidadMedidaEnum | (string & {});
  peso_unidad_kilos: number;
  stock_fisico_kilos: number;
  stock_comprometido_kilos: number;
}

interface DetallePedidoRowRaw {
  id_detalle: number;
  id_producto: number;
  kilos_estimados: number;
  kilos_reales: number | null;
  es_cortesia: boolean;
  precio_unitario_congelado: number;
  subtotal_bs: number | null;
  productos: ProductoRelationRaw | ProductoRelationRaw[] | null;
}

export interface PedidoDespachoRowRaw {
  id_pedido: number;
  nro_nota_venta: number | null;
  nro_documento_sac: number | null;
  estado: EstadoPedidoEnum;
  tipo_venta: TipoVenta;
  plazo_dias: number;
  es_pedido_cortesia_pura: boolean;
  observaciones: string | null;
  fecha_preventa: string;
  clientes: ClienteRelationRaw | ClienteRelationRaw[] | null;
  vendedor: VendedorRelationRaw | VendedorRelationRaw[] | null;
  detalle_pedidos: DetallePedidoRowRaw[] | null;
}

export interface ProductoCatalogoRowRaw {
  id_producto: number;
  codigo_sku: string;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  unidad_medida: UnidadMedidaEnum | (string & {});
  peso_unidad_kilos: number;
  precio_kilo_bs: number;
  stock_fisico_kilos: number;
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function mapPedidoDespachoRow(
  row: PedidoDespachoRowRaw
): PedidoDespachoItem {
  const cli = normalizeRelation(row.clientes);
  const zona = normalizeRelation(cli?.zonas_mercado);
  const vend = normalizeRelation(row.vendedor);
  const perfilVend = normalizeRelation(vend?.perfil_vendedor);

  const detalles: DetallePedidoDespachoItem[] = (row.detalle_pedidos ?? []).map(
    (det) => {
      const prod = normalizeRelation(det.productos);
      return {
        id_detalle: Number(det.id_detalle),
        id_producto: Number(det.id_producto),
        kilos_estimados: Number(det.kilos_estimados ?? 0),
        kilos_reales:
          det.kilos_reales !== null && det.kilos_reales !== undefined
            ? Number(det.kilos_reales)
            : null,
        es_cortesia: Boolean(det.es_cortesia),
        precio_unitario_congelado: Number(det.precio_unitario_congelado ?? 0),
        subtotal_bs:
          det.subtotal_bs !== null && det.subtotal_bs !== undefined
            ? Number(det.subtotal_bs)
            : null,
        producto: {
          id_producto: Number(prod?.id_producto ?? det.id_producto),
          codigo_sku: prod?.codigo_sku ?? `SKU-${det.id_producto}`,
          nombre_producto:
            prod?.nombre_producto ?? `Producto #${det.id_producto}`,
          formato: prod?.formato ?? 'GRANEL',
          unidad_medida: prod?.unidad_medida ?? 'KILO',
          peso_unidad_kilos: Number(prod?.peso_unidad_kilos ?? 1),
          stock_fisico_kilos: Number(prod?.stock_fisico_kilos ?? 0),
          stock_comprometido_kilos: Number(prod?.stock_comprometido_kilos ?? 0),
        },
      };
    }
  );

  return {
    id_pedido: Number(row.id_pedido),
    nro_nota_venta:
      row.nro_nota_venta !== null && row.nro_nota_venta !== undefined
        ? Number(row.nro_nota_venta)
        : null,
    nro_documento_sac:
      row.nro_documento_sac !== null && row.nro_documento_sac !== undefined
        ? Number(row.nro_documento_sac)
        : null,
    estado: row.estado,
    tipo_venta: row.tipo_venta === 'CREDITO' ? 'CREDITO' : 'CONTADO',
    plazo_dias: Number(row.plazo_dias ?? 0),
    es_pedido_cortesia_pura: Boolean(row.es_pedido_cortesia_pura),
    observaciones: row.observaciones ?? null,
    fecha_preventa: row.fecha_preventa,
    cliente: {
      id_cliente: Number(cli?.id_cliente ?? 0),
      codigo_cliente_sac: cli?.codigo_cliente_sac ?? 'SIN-SAC',
      nombre_comercial: cli?.nombre_comercial ?? 'Cliente sin nombre',
      razon_social: cli?.razon_social ?? null,
      nit_ci: cli?.nit_ci ?? null,
      telefono: cli?.telefono ?? null,
      direccion: cli?.direccion ?? null,
      localidad: cli?.localidad ?? null,
      forma_pago_habitual:
        cli?.forma_pago_habitual === 'CREDITO' ? 'CREDITO' : 'CONTADO',
      plazo_dias: Number(cli?.plazo_dias ?? 0),
      regla_cortesia_habitual: cli?.regla_cortesia_habitual ?? null,
      observaciones: cli?.observaciones ?? null,
      zona: {
        id_zona: Number(zona?.id_zona ?? 0),
        nombre_zona: zona?.nombre_zona ?? 'Sin zona asignada',
        ciudad: zona?.ciudad ?? '',
      },
    },
    vendedor: {
      id_usuario: Number(vend?.id_usuario ?? 0),
      nombre_completo: vend?.nombre_completo ?? 'Vendedor sin asignar',
      codigo_vendedor:
        perfilVend?.codigo_vendedor ??
        (vend?.id_usuario ? `VND-${vend.id_usuario}` : 'SIN-COD'),
    },
    detalle_pedidos: detalles,
  };
}

export function mapProductosCatalogoPesaje(
  rows: ProductoCatalogoRowRaw[]
): ProductoCatalogoPesajeItem[] {
  return rows.map((p) => ({
    id_producto: Number(p.id_producto),
    codigo_sku: p.codigo_sku,
    nombre_producto: p.nombre_producto,
    formato: p.formato,
    unidad_medida: p.unidad_medida ?? 'KILO',
    peso_unidad_kilos: Number(p.peso_unidad_kilos ?? 1),
    precio_kilo_bs: Number(p.precio_kilo_bs ?? 0),
    stock_fisico_kilos: Number(p.stock_fisico_kilos ?? 0),
  }));
}

export function buildPerfilDespachadorResumen(
  usuario: UsuarioConPerfil
): PerfilDespachadorResumen {
  return {
    id_usuario: usuario.id_usuario,
    nombre_operador: usuario.nombre_completo,
    rol: usuario.rol,
    identificador_balanza:
      usuario.perfil_despachador?.identificador_balanza ?? 'BALANZA-GANCHO-01',
    impresora_termica_modelo:
      usuario.perfil_despachador?.impresora_termica_modelo ?? 'EPSON-TM-T20',
    ancho_papel_mm: usuario.perfil_despachador?.ancho_papel_mm ?? 80,
    autorizado_cortesias:
      usuario.perfil_despachador?.autorizado_cortesias ??
      usuario.rol === 'ADMINISTRADOR',
  };
}

