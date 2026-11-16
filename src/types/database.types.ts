/**
 * Definición estricta de tipos TypeScript para el esquema relacional en
 * Tercera Forma Normal (3FN) + Herencia CTI (Class Table Inheritance)
 * del sistema EUROALIMENTOS SRL.
 *
 * ÚNICA FUENTE DE VERDAD: `supabase/SCHEMA_REFERENCE.sql`
 */

// ============================================================================
// ENUMS DE BASE DE DATOS (PostgreSQL)
// ============================================================================

export type RolUsuarioEnum =
  | 'VENDEDOR'
  | 'DESPACHADOR'
  | 'PRODUCCION'
  | 'ADMINISTRADOR';

export type FormatoProductoEnum = 'GRANEL' | 'VACIO' | 'UNIDAD';

export type EstadoPedidoEnum = 'PENDIENTE' | 'DESPACHADO' | 'ANULADO';

export type TipoMovimientoEnum =
  | 'INGRESO_PRODUCCION'
  | 'SALIDA_TRANSFORMACION'
  | 'ENTRADA_TRANSFORMACION'
  | 'SALIDA_VENTA'
  | 'SALIDA_CORTESIA'
  | 'REINGRESO_ANULACION'
  | 'AJUSTE_AUDITORIA';

// ============================================================================
// SUPERTABLA DE USUARIOS Y SUBTABLAS CTI (1:1)
// ============================================================================

/** Supertabla de identidad y rol del sistema (`public.usuarios`) */
export interface Usuario {
  id_usuario: number;
  nombre_completo: string;
  username: string;
  password_hash: string;
  telefono: string | null;
  rol: RolUsuarioEnum;
  activo: boolean;
  creado_en: string;
  auth_id: string | null;
  requiere_cambio_clave?: boolean;
}

/** Proyección pública/sesión de Usuario sin `password_hash` */
export type UsuarioSeguro = Omit<Usuario, 'password_hash'>;

/** Subtabla CTI 1:1 para el rol VENDEDOR (`public.perfil_vendedor`) */
export interface PerfilVendedor {
  id_usuario: number;
  codigo_vendedor: string;
  porcentaje_comision: number;
  meta_diaria_kilos: number;
  permite_venta_sin_stock: boolean;
}

/** Subtabla CTI 1:1 para el rol DESPACHADOR (`public.perfil_despachador`) */
export interface PerfilDespachador {
  id_usuario: number;
  identificador_balanza: string | null;
  impresora_termica_modelo: string | null;
  ancho_papel_mm: number;
  autorizado_cortesias: boolean;
}

/** Subtabla CTI 1:1 para el rol PRODUCCION (`public.perfil_produccion`) */
export interface PerfilProduccion {
  id_usuario: number;
  turno_planta: string;
  responsable_camara_frio: boolean;
  tolerancia_merma_max_pct: number;
}

/** Subtabla CTI 1:1 para el rol ADMINISTRADOR (`public.perfil_administrador`) */
export interface PerfilAdministrador {
  id_usuario: number;
  cargo_gerencial: string;
  puede_anular_despachos: boolean;
  puede_exportar_sac: boolean;
}

/** Supertabla Usuario (sin hash) combinada con sus perfiles CTI 1:1 */
export interface UsuarioConPerfil extends UsuarioSeguro {
  perfil_vendedor?: PerfilVendedor | null;
  perfil_despachador?: PerfilDespachador | null;
  perfil_produccion?: PerfilProduccion | null;
  perfil_administrador?: PerfilAdministrador | null;
}

// ============================================================================
// TABLAS MAESTRAS (3FN)
// ============================================================================

/** `public.zonas_mercado` */
export interface ZonaMercado {
  id_zona: number;
  nombre_zona: string;
  ciudad: string;
  activo: boolean;
}

/** `public.clientes` */
export interface Cliente {
  id_cliente: number;
  codigo_cliente_sac: string;
  nombre_comercial: string;
  nit_ci: string | null;
  telefono: string | null;
  id_zona: number;
  activo: boolean;
  creado_en: string;
}

/** `public.categorias_producto` */
export interface CategoriaProducto {
  id_categoria: number;
  nombre_categoria: string;
  descripcion: string | null;
}

/**
 * Catálogo maestro de productos (`public.productos`).
 * NOTA: `stock_disponible_kilos` es columna generada en PostgreSQL;
 * PROHIBIDO enviarla en INSERT o UPDATE.
 */
export interface Producto {
  id_producto: number;
  codigo_sku: string;
  id_categoria: number;
  nombre_producto: string;
  formato: FormatoProductoEnum;
  precio_kilo_bs: number;
  stock_fisico_kilos: number;
  stock_comprometido_kilos: number;
  readonly stock_disponible_kilos: number | null;
  activo: boolean;
}

export type ProductoInsert = Omit<
  Producto,
  'id_producto' | 'stock_disponible_kilos'
>;

export type ProductoUpdate = Partial<
  Omit<Producto, 'id_producto' | 'stock_disponible_kilos'>
>;

// ============================================================================
// OPERACIONES DE PREVENTA Y DESPACHO
// ============================================================================

/** `public.pedidos` */
export interface Pedido {
  id_pedido: number;
  nro_nota_venta: number | null;
  id_cliente: number;
  id_vendedor: number;
  id_despachador: number | null;
  estado: EstadoPedidoEnum;
  es_pedido_cortesia_pura: boolean;
  observaciones: string | null;
  fecha_preventa: string;
  fecha_despacho: string | null;
}

/**
 * Ítems de pedido (`public.detalle_pedidos`).
 * NOTA: `subtotal_bs` es columna generada en PostgreSQL;
 * PROHIBIDO enviarla en INSERT o UPDATE.
 */
export interface DetallePedido {
  id_detalle: number;
  id_pedido: number;
  id_producto: number;
  kilos_estimados: number;
  kilos_reales: number | null;
  es_cortesia: boolean;
  precio_unitario_congelado: number;
  readonly subtotal_bs: number | null;
}

export type DetallePedidoInsert = Omit<
  DetallePedido,
  'id_detalle' | 'subtotal_bs'
>;

export type DetallePedidoUpdate = Partial<
  Omit<DetallePedido, 'id_detalle' | 'id_pedido' | 'subtotal_bs'>
>;

/** Pedido con cliente y detalle (sin exponer stock físico de productos) */
export interface PedidoConDetalleCliente extends Pedido {
  clientes: Pick<
    Cliente,
    'id_cliente' | 'codigo_cliente_sac' | 'nombre_comercial' | 'nit_ci' | 'telefono'
  > | null;
  vendedor?: Pick<Usuario, 'id_usuario' | 'nombre_completo'> | null;
  despachador?: Pick<Usuario, 'id_usuario' | 'nombre_completo'> | null;
  detalle_pedidos: DetallePedido[];
}

/** Detalle de pedido con nombre/formato de producto para impresión en Despacho */
export interface DetallePedidoConProducto extends DetallePedido {
  productos: Pick<
    Producto,
    'id_producto' | 'codigo_sku' | 'nombre_producto' | 'formato'
  > | null;
}

export interface PedidoParaImpresion extends Pedido {
  clientes:
    | (Pick<
        Cliente,
        'id_cliente' | 'codigo_cliente_sac' | 'nombre_comercial' | 'nit_ci' | 'telefono'
      > & {
        zonas_mercado?: Pick<ZonaMercado, 'nombre_zona'> | null;
      })
    | null;
  vendedor?: Pick<Usuario, 'id_usuario' | 'nombre_completo'> | null;
  despachador?: Pick<Usuario, 'id_usuario' | 'nombre_completo'> | null;
  detalle_pedidos: DetallePedidoConProducto[];
}

// ============================================================================
// KARDEX E INVENTARIO CTI
// ============================================================================

/** `public.movimientos_kardex` */
export interface MovimientoKardex {
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

/** `public.lotes_produccion` */
export interface LoteProduccion {
  id_lote: number;
  id_movimiento: number;
  id_usuario_produccion: number;
  codigo_lote_interno: string;
  kilos_producidos: number;
  fecha_elaboracion: string;
}

/**
 * Transformación de inventario GRANEL -> VACIO (`public.transformaciones_inventario`).
 * NOTA: `merma_kilos` es columna generada en PostgreSQL;
 * PROHIBIDO enviarla en INSERT o UPDATE.
 */
export interface TransformacionInventario {
  id_transformacion: number;
  id_usuario_produccion: number;
  id_producto_origen: number;
  id_producto_destino: number;
  kilos_origen_usados: number;
  kilos_destino_obtenidos: number;
  readonly merma_kilos: number | null;
  id_movimiento_salida: number | null;
  id_movimiento_entrada: number | null;
  fecha_transformacion: string;
}

export type TransformacionInventarioInsert = Omit<
  TransformacionInventario,
  'id_transformacion' | 'merma_kilos'
>;

/** `public.anulaciones_pedido` */
export interface AnulacionPedido {
  id_anulacion: number;
  id_pedido: number;
  id_administrador: number;
  motivo_rebote: string;
  kilos_reingresados_total: number;
  id_movimiento_reingreso: number | null;
  fecha_anulacion: string;
}

// ============================================================================
// VISTA CONTABLE SAC
// ============================================================================

/** `public.vw_reporte_ventas_diario_sac` */
export interface VwReporteVentasDiarioSac {
  nro_nota: number | null;
  fecha_venta: string;
  codigo_cliente: string;
  cliente: string;
  zona_mercado: string;
  vendedor: string;
  total_kilos_vendidos: number;
  total_kilos_cortesia: number;
  monto_total_bs: number;
  estado: EstadoPedidoEnum;
}
