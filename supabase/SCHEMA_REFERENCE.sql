-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.usuarios (
  id_usuario integer NOT NULL DEFAULT nextval('usuarios_id_usuario_seq'::regclass),
  nombre_completo character varying NOT NULL,
  username character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  telefono character varying,
  rol USER-DEFINED NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  auth_id uuid UNIQUE,
  requiere_cambio_clave boolean NOT NULL DEFAULT false,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario),
  CONSTRAINT usuarios_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id)
);
CREATE TABLE public.perfil_vendedor (
  id_usuario integer NOT NULL,
  codigo_vendedor character varying NOT NULL UNIQUE,
  porcentaje_comision numeric NOT NULL DEFAULT 0.00,
  meta_diaria_kilos numeric NOT NULL DEFAULT 0.000,
  permite_venta_sin_stock boolean NOT NULL DEFAULT true,
  CONSTRAINT perfil_vendedor_pkey PRIMARY KEY (id_usuario),
  CONSTRAINT perfil_vendedor_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.perfil_despachador (
  id_usuario integer NOT NULL,
  identificador_balanza character varying DEFAULT 'BALANZA-GANCHO-01'::character varying,
  impresora_termica_modelo character varying DEFAULT 'EPSON-TM-T20'::character varying,
  ancho_papel_mm integer NOT NULL DEFAULT 80 CHECK (ancho_papel_mm = ANY (ARRAY[58, 80])),
  autorizado_cortesias boolean NOT NULL DEFAULT true,
  CONSTRAINT perfil_despachador_pkey PRIMARY KEY (id_usuario),
  CONSTRAINT perfil_despachador_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.perfil_produccion (
  id_usuario integer NOT NULL,
  turno_planta character varying NOT NULL DEFAULT 'MAÑANA'::character varying,
  responsable_camara_frio boolean NOT NULL DEFAULT true,
  tolerancia_merma_max_pct numeric NOT NULL DEFAULT 5.00,
  CONSTRAINT perfil_produccion_pkey PRIMARY KEY (id_usuario),
  CONSTRAINT perfil_produccion_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.perfil_administrador (
  id_usuario integer NOT NULL,
  cargo_gerencial character varying NOT NULL DEFAULT 'Administración General'::character varying,
  puede_anular_despachos boolean NOT NULL DEFAULT true,
  puede_exportar_sac boolean NOT NULL DEFAULT true,
  CONSTRAINT perfil_administrador_pkey PRIMARY KEY (id_usuario),
  CONSTRAINT perfil_administrador_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.zonas_mercado (
  id_zona integer NOT NULL DEFAULT nextval('zonas_mercado_id_zona_seq'::regclass),
  nombre_zona character varying NOT NULL UNIQUE,
  ciudad character varying NOT NULL DEFAULT 'Santa Cruz / La Paz'::character varying,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT zonas_mercado_pkey PRIMARY KEY (id_zona)
);
CREATE TABLE public.clientes (
  id_cliente integer NOT NULL DEFAULT nextval('clientes_id_cliente_seq'::regclass),
  codigo_cliente_sac character varying NOT NULL UNIQUE,
  nombre_comercial character varying NOT NULL,
  nit_ci character varying,
  telefono character varying,
  id_zona integer NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clientes_pkey PRIMARY KEY (id_cliente),
  CONSTRAINT clientes_id_zona_fkey FOREIGN KEY (id_zona) REFERENCES public.zonas_mercado(id_zona)
);
CREATE TABLE public.categorias_producto (
  id_categoria integer NOT NULL DEFAULT nextval('categorias_producto_id_categoria_seq'::regclass),
  nombre_categoria character varying NOT NULL UNIQUE,
  descripcion text,
  CONSTRAINT categorias_producto_pkey PRIMARY KEY (id_categoria)
);
CREATE TABLE public.productos (
  id_producto integer NOT NULL DEFAULT nextval('productos_id_producto_seq'::regclass),
  codigo_sku character varying NOT NULL UNIQUE,
  id_categoria integer NOT NULL,
  nombre_producto character varying NOT NULL,
  formato USER-DEFINED NOT NULL,
  precio_kilo_bs numeric NOT NULL CHECK (precio_kilo_bs >= 0::numeric),
  stock_fisico_kilos numeric NOT NULL DEFAULT 0.000,
  stock_comprometido_kilos numeric NOT NULL DEFAULT 0.000,
  stock_disponible_kilos numeric DEFAULT (stock_fisico_kilos - stock_comprometido_kilos),
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT productos_pkey PRIMARY KEY (id_producto),
  CONSTRAINT productos_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categorias_producto(id_categoria)
);
CREATE TABLE public.pedidos (
  id_pedido integer NOT NULL DEFAULT nextval('pedidos_id_pedido_seq'::regclass),
  nro_nota_venta integer UNIQUE,
  id_cliente integer NOT NULL,
  id_vendedor integer NOT NULL,
  id_despachador integer,
  estado USER-DEFINED NOT NULL DEFAULT 'PENDIENTE'::estado_pedido_enum,
  es_pedido_cortesia_pura boolean NOT NULL DEFAULT false,
  observaciones text,
  fecha_preventa timestamp with time zone NOT NULL DEFAULT now(),
  fecha_despacho timestamp with time zone,
  CONSTRAINT pedidos_pkey PRIMARY KEY (id_pedido),
  CONSTRAINT pedidos_id_despachador_fkey FOREIGN KEY (id_despachador) REFERENCES public.usuarios(id_usuario),
  CONSTRAINT pedidos_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente),
  CONSTRAINT pedidos_id_vendedor_fkey FOREIGN KEY (id_vendedor) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.detalle_pedidos (
  id_detalle integer NOT NULL DEFAULT nextval('detalle_pedidos_id_detalle_seq'::regclass),
  id_pedido integer NOT NULL,
  id_producto integer NOT NULL,
  kilos_estimados numeric NOT NULL DEFAULT 0.000 CHECK (kilos_estimados >= 0::numeric),
  kilos_reales numeric CHECK (kilos_reales >= 0::numeric),
  es_cortesia boolean NOT NULL DEFAULT false,
  precio_unitario_congelado numeric NOT NULL CHECK (precio_unitario_congelado >= 0::numeric),
  subtotal_bs numeric DEFAULT 
CASE
    WHEN (es_cortesia = true) THEN 0.00
    WHEN (kilos_reales IS NOT NULL) THEN round((kilos_reales * precio_unitario_congelado), 2)
    ELSE round((kilos_estimados * precio_unitario_congelado), 2)
END,
  CONSTRAINT detalle_pedidos_pkey PRIMARY KEY (id_detalle),
  CONSTRAINT detalle_pedidos_id_pedido_fkey FOREIGN KEY (id_pedido) REFERENCES public.pedidos(id_pedido),
  CONSTRAINT detalle_pedidos_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto)
);
CREATE TABLE public.movimientos_kardex (
  id_movimiento bigint NOT NULL DEFAULT nextval('movimientos_kardex_id_movimiento_seq'::regclass),
  id_producto integer NOT NULL,
  id_usuario integer NOT NULL,
  tipo_movimiento USER-DEFINED NOT NULL,
  cantidad_kilos numeric NOT NULL,
  saldo_anterior_kilos numeric NOT NULL,
  saldo_nuevo_kilos numeric NOT NULL,
  referencia_pedido_id integer,
  observacion text,
  fecha_movimiento timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT movimientos_kardex_pkey PRIMARY KEY (id_movimiento),
  CONSTRAINT movimientos_kardex_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto),
  CONSTRAINT movimientos_kardex_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario),
  CONSTRAINT movimientos_kardex_referencia_pedido_id_fkey FOREIGN KEY (referencia_pedido_id) REFERENCES public.pedidos(id_pedido)
);
CREATE TABLE public.lotes_produccion (
  id_lote integer NOT NULL DEFAULT nextval('lotes_produccion_id_lote_seq'::regclass),
  id_movimiento bigint NOT NULL UNIQUE,
  id_usuario_produccion integer NOT NULL,
  codigo_lote_interno character varying NOT NULL,
  kilos_producidos numeric NOT NULL CHECK (kilos_producidos > 0::numeric),
  fecha_elaboracion date NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT lotes_produccion_pkey PRIMARY KEY (id_lote),
  CONSTRAINT lotes_produccion_id_movimiento_fkey FOREIGN KEY (id_movimiento) REFERENCES public.movimientos_kardex(id_movimiento),
  CONSTRAINT lotes_produccion_id_usuario_produccion_fkey FOREIGN KEY (id_usuario_produccion) REFERENCES public.perfil_produccion(id_usuario)
);
CREATE TABLE public.transformaciones_inventario (
  id_transformacion integer NOT NULL DEFAULT nextval('transformaciones_inventario_id_transformacion_seq'::regclass),
  id_usuario_produccion integer NOT NULL,
  id_producto_origen integer NOT NULL,
  id_producto_destino integer NOT NULL,
  kilos_origen_usados numeric NOT NULL CHECK (kilos_origen_usados > 0::numeric),
  kilos_destino_obtenidos numeric NOT NULL CHECK (kilos_destino_obtenidos > 0::numeric),
  merma_kilos numeric DEFAULT (kilos_origen_usados - kilos_destino_obtenidos),
  id_movimiento_salida bigint UNIQUE,
  id_movimiento_entrada bigint UNIQUE,
  fecha_transformacion timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transformaciones_inventario_pkey PRIMARY KEY (id_transformacion),
  CONSTRAINT transformaciones_inventario_id_movimiento_entrada_fkey FOREIGN KEY (id_movimiento_entrada) REFERENCES public.movimientos_kardex(id_movimiento),
  CONSTRAINT transformaciones_inventario_id_usuario_produccion_fkey FOREIGN KEY (id_usuario_produccion) REFERENCES public.perfil_produccion(id_usuario),
  CONSTRAINT transformaciones_inventario_id_producto_origen_fkey FOREIGN KEY (id_producto_origen) REFERENCES public.productos(id_producto),
  CONSTRAINT transformaciones_inventario_id_producto_destino_fkey FOREIGN KEY (id_producto_destino) REFERENCES public.productos(id_producto),
  CONSTRAINT transformaciones_inventario_id_movimiento_salida_fkey FOREIGN KEY (id_movimiento_salida) REFERENCES public.movimientos_kardex(id_movimiento)
);
CREATE TABLE public.anulaciones_pedido (
  id_anulacion integer NOT NULL DEFAULT nextval('anulaciones_pedido_id_anulacion_seq'::regclass),
  id_pedido integer NOT NULL UNIQUE,
  id_administrador integer NOT NULL,
  motivo_rebote text NOT NULL,
  kilos_reingresados_total numeric NOT NULL,
  id_movimiento_reingreso bigint,
  fecha_anulacion timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT anulaciones_pedido_pkey PRIMARY KEY (id_anulacion),
  CONSTRAINT anulaciones_pedido_id_pedido_fkey FOREIGN KEY (id_pedido) REFERENCES public.pedidos(id_pedido),
  CONSTRAINT anulaciones_pedido_id_administrador_fkey FOREIGN KEY (id_administrador) REFERENCES public.perfil_administrador(id_usuario),
  CONSTRAINT anulaciones_pedido_id_movimiento_reingreso_fkey FOREIGN KEY (id_movimiento_reingreso) REFERENCES public.movimientos_kardex(id_movimiento)
);