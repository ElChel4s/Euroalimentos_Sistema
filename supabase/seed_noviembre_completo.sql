-- ============================================================================
-- EUROALIMENTOS SRL — RESET COMPLETO + SEED DE SIMULACIÓN (NOVIEMBRE 2026)
-- ============================================================================
-- Ejecutar en Supabase SQL Editor.
--
-- ¿Qué incluye este script?
-- 1. Asegura la columna `requiere_cambio_clave` en `public.usuarios`.
-- 2. Borra TODOS los datos operativos y maestros actuales en orden seguro de FK,
--    incluyendo los usuarios vinculados en `auth.identities` y `auth.users`.
-- 3. Reinicia TODAS las secuencias (`SERIAL` / `IDENTITY`) de `public` a 1.
-- 4. Crea 6 usuarios operativos fáciles (TODOS con contraseña `123456`):
--      - `vendedor1`   (Carlos Mamani Quispe — VENDEDOR)
--      - `vendedor2`   (Sofía Rojas Fernández — VENDEDOR)
--      - `despacho1`   (Roberto Condori Flores — DESPACHADOR)
--      - `despacho2`   (Miguel Ángel Torrez Pérez — DESPACHADOR)
--      - `produccion1` (Elena Vargas Apaza — PRODUCCION)
--      - `admin1`      (Marcelo Villarroel Gutiérrez — ADMINISTRADOR)
-- 5. Inserta Zonas de Mercado (5), Clientes SAC (11), Categoría Chorizos y
--    Productos Chorizos GRANEL/VACIO (8 SKUs).
-- 6. Simula cronológicamente TODO noviembre del 2026-11-01 al 2026-11-15 (hoy):
--      - Lotes de producción (`INGRESO_PRODUCCION` + `lotes_produccion`)
--      - Transformaciones Granel -> Vacío (`transformaciones_inventario` + Kardex)
--      - Ajuste de auditoría (`AJUSTE_AUDITORIA`)
--      - Pedidos DESPACHADOS (normales, con ítems de cortesía y cortesía pura)
--      - Pedidos ANULADOS / Rebotes (`anulaciones_pedido` + `REINGRESO_ANULACION`)
--      - 5 pedidos PENDIENTES hoy (2026-11-15) con stock comprometido y déficit
--        en `CHR-CHU-VA` para probar Monitor de Producción y Bandeja de Despacho.
-- 7. Sincroniza todas las secuencias al final y devuelve resumen de verificación.
-- ============================================================================

ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS requiere_cambio_clave BOOLEAN NOT NULL DEFAULT FALSE;

-- Funciones temporales de sesión (`pg_temp`) para garantizar consistencia matemática
-- 100% exacta entre `productos`, `movimientos_kardex`, `lotes_produccion`,
-- `transformaciones_inventario`, `pedidos`, `detalle_pedidos` y `anulaciones_pedido`.

CREATE OR REPLACE FUNCTION pg_temp.sim_lote(
  p_id_producto INT,
  p_id_usuario INT,
  p_codigo_lote VARCHAR,
  p_kilos NUMERIC,
  p_fecha TIMESTAMPTZ,
  p_obs TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_ant NUMERIC(12, 3);
  v_nue NUMERIC(12, 3);
  v_mov BIGINT;
BEGIN
  SELECT COALESCE(stock_fisico_kilos, 0)::NUMERIC(12, 3)
  INTO v_ant
  FROM public.productos
  WHERE id_producto = p_id_producto;

  v_nue := ROUND(v_ant + ROUND(p_kilos, 3), 3);

  UPDATE public.productos
  SET stock_fisico_kilos = v_nue
  WHERE id_producto = p_id_producto;

  INSERT INTO public.movimientos_kardex (
    id_producto, id_usuario, tipo_movimiento, cantidad_kilos,
    saldo_anterior_kilos, saldo_nuevo_kilos, referencia_pedido_id,
    observacion, fecha_movimiento
  )
  VALUES (
    p_id_producto, p_id_usuario, 'INGRESO_PRODUCCION', ROUND(p_kilos, 3),
    v_ant, v_nue, NULL, p_obs, p_fecha
  )
  RETURNING id_movimiento INTO v_mov;

  INSERT INTO public.lotes_produccion (
    id_movimiento, id_usuario_produccion, codigo_lote_interno,
    kilos_producidos, fecha_elaboracion
  )
  VALUES (
    v_mov, p_id_usuario, p_codigo_lote, ROUND(p_kilos, 3),
    (p_fecha AT TIME ZONE 'America/La_Paz')::DATE
  );

  RETURN v_mov;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.sim_transf(
  p_id_usuario INT,
  p_orig INT,
  p_dest INT,
  p_kilos_orig NUMERIC,
  p_kilos_dest NUMERIC,
  p_fecha TIMESTAMPTZ,
  p_obs TEXT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_ant_o NUMERIC(12, 3);
  v_nue_o NUMERIC(12, 3);
  v_ant_d NUMERIC(12, 3);
  v_nue_d NUMERIC(12, 3);
  v_mov_sal BIGINT;
  v_mov_ent BIGINT;
  v_transf INT;
BEGIN
  SELECT COALESCE(stock_fisico_kilos, 0)::NUMERIC(12, 3)
  INTO v_ant_o FROM public.productos WHERE id_producto = p_orig;

  v_nue_o := ROUND(v_ant_o - ROUND(p_kilos_orig, 3), 3);
  IF v_nue_o < 0 THEN
    RAISE EXCEPTION 'Stock origen negativo en sim_transf para producto % (disponible %, usado %)', p_orig, v_ant_o, p_kilos_orig;
  END IF;

  UPDATE public.productos SET stock_fisico_kilos = v_nue_o WHERE id_producto = p_orig;

  INSERT INTO public.movimientos_kardex (
    id_producto, id_usuario, tipo_movimiento, cantidad_kilos,
    saldo_anterior_kilos, saldo_nuevo_kilos, referencia_pedido_id,
    observacion, fecha_movimiento
  )
  VALUES (
    p_orig, p_id_usuario, 'SALIDA_TRANSFORMACION', -ROUND(p_kilos_orig, 3),
    v_ant_o, v_nue_o, NULL, p_obs, p_fecha
  )
  RETURNING id_movimiento INTO v_mov_sal;

  SELECT COALESCE(stock_fisico_kilos, 0)::NUMERIC(12, 3)
  INTO v_ant_d FROM public.productos WHERE id_producto = p_dest;

  v_nue_d := ROUND(v_ant_d + ROUND(p_kilos_dest, 3), 3);
  UPDATE public.productos SET stock_fisico_kilos = v_nue_d WHERE id_producto = p_dest;

  INSERT INTO public.movimientos_kardex (
    id_producto, id_usuario, tipo_movimiento, cantidad_kilos,
    saldo_anterior_kilos, saldo_nuevo_kilos, referencia_pedido_id,
    observacion, fecha_movimiento
  )
  VALUES (
    p_dest, p_id_usuario, 'ENTRADA_TRANSFORMACION', ROUND(p_kilos_dest, 3),
    v_ant_d, v_nue_d, NULL, p_obs, p_fecha
  )
  RETURNING id_movimiento INTO v_mov_ent;

  INSERT INTO public.transformaciones_inventario (
    id_usuario_produccion, id_producto_origen, id_producto_destino,
    kilos_origen_usados, kilos_destino_obtenidos,
    id_movimiento_salida, id_movimiento_entrada, fecha_transformacion
  )
  VALUES (
    p_id_usuario, p_orig, p_dest,
    ROUND(p_kilos_orig, 3), ROUND(p_kilos_dest, 3),
    v_mov_sal, v_mov_ent, p_fecha
  )
  RETURNING id_transformacion INTO v_transf;

  RETURN v_transf;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.sim_ajuste(
  p_id_producto INT,
  p_id_admin INT,
  p_delta NUMERIC,
  p_fecha TIMESTAMPTZ,
  p_obs TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_ant NUMERIC(12, 3);
  v_nue NUMERIC(12, 3);
BEGIN
  SELECT COALESCE(stock_fisico_kilos, 0)::NUMERIC(12, 3)
  INTO v_ant FROM public.productos WHERE id_producto = p_id_producto;

  v_nue := ROUND(v_ant + ROUND(p_delta, 3), 3);
  UPDATE public.productos SET stock_fisico_kilos = v_nue WHERE id_producto = p_id_producto;

  INSERT INTO public.movimientos_kardex (
    id_producto, id_usuario, tipo_movimiento, cantidad_kilos,
    saldo_anterior_kilos, saldo_nuevo_kilos, referencia_pedido_id,
    observacion, fecha_movimiento
  )
  VALUES (
    p_id_producto, p_id_admin, 'AJUSTE_AUDITORIA', ROUND(p_delta, 3),
    v_ant, v_nue, NULL, p_obs, p_fecha
  );
END;
$$;

-- Helper para simular pedido DESPACHADO o ANULADO (si p_admin_anula IS NOT NULL).
-- Formato p_items JSONB: [{"id_producto":1,"est":20,"real":19.85,"cortesia":false}, ...]
CREATE OR REPLACE FUNCTION pg_temp.sim_pedido_completo(
  p_nro_nota INT,
  p_id_cliente INT,
  p_id_vendedor INT,
  p_id_despachador INT,
  p_cortesia_pura BOOLEAN,
  p_obs TEXT,
  p_fecha_preventa TIMESTAMPTZ,
  p_fecha_despacho TIMESTAMPTZ,
  p_items JSONB,
  p_id_admin_anula INT DEFAULT NULL,
  p_motivo_rebote TEXT DEFAULT NULL,
  p_fecha_anulacion TIMESTAMPTZ DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_pedido INT;
  v_item JSONB;
  v_prod_id INT;
  v_est NUMERIC(12, 3);
  v_real NUMERIC(12, 3);
  v_cort BOOLEAN;
  v_precio NUMERIC(10, 2);
  v_ant NUMERIC(12, 3);
  v_nue NUMERIC(12, 3);
  v_tipo tipo_movimiento_enum;
  v_mov_reing BIGINT := NULL;
  v_total_reing NUMERIC(12, 3) := 0;
BEGIN
  INSERT INTO public.pedidos (
    nro_nota_venta, id_cliente, id_vendedor, id_despachador,
    estado, es_pedido_cortesia_pura, observaciones,
    fecha_preventa, fecha_despacho
  )
  VALUES (
    p_nro_nota, p_id_cliente, p_id_vendedor, p_id_despachador,
    CASE WHEN p_id_admin_anula IS NOT NULL THEN 'ANULADO'::estado_pedido_enum ELSE 'DESPACHADO'::estado_pedido_enum END,
    p_cortesia_pura, p_obs, p_fecha_preventa, p_fecha_despacho
  )
  RETURNING id_pedido INTO v_id_pedido;

  -- 1. Detalles y salidas de despacho en Kardex
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'id_producto')::INT;
    v_est := ROUND((v_item->>'est')::NUMERIC, 3);
    v_real := ROUND((v_item->>'real')::NUMERIC, 3);
    v_cort := COALESCE((v_item->>'cortesia')::BOOLEAN, p_cortesia_pura);

    SELECT precio_kilo_bs, COALESCE(stock_fisico_kilos, 0)::NUMERIC(12, 3)
    INTO v_precio, v_ant
    FROM public.productos
    WHERE id_producto = v_prod_id;

    INSERT INTO public.detalle_pedidos (
      id_pedido, id_producto, kilos_estimados, kilos_reales,
      es_cortesia, precio_unitario_congelado
    )
    VALUES (
      v_id_pedido, v_prod_id, v_est, v_real,
      v_cort, CASE WHEN v_cort THEN 0.00 ELSE v_precio END
    );

    v_nue := ROUND(v_ant - v_real, 3);
    IF v_nue < 0 THEN
      RAISE EXCEPTION 'Stock insuficiente al simular nota % para producto % (habia %, salio %)', p_nro_nota, v_prod_id, v_ant, v_real;
    END IF;

    UPDATE public.productos SET stock_fisico_kilos = v_nue WHERE id_producto = v_prod_id;

    v_tipo := CASE WHEN v_cort THEN 'SALIDA_CORTESIA'::tipo_movimiento_enum ELSE 'SALIDA_VENTA'::tipo_movimiento_enum END;

    INSERT INTO public.movimientos_kardex (
      id_producto, id_usuario, tipo_movimiento, cantidad_kilos,
      saldo_anterior_kilos, saldo_nuevo_kilos, referencia_pedido_id,
      observacion, fecha_movimiento
    )
    VALUES (
      v_prod_id, p_id_despachador, v_tipo, -v_real,
      v_ant, v_nue, v_id_pedido,
      CASE WHEN v_cort THEN 'Despacho cortesía Nota N° ' || p_nro_nota ELSE 'Despacho venta Nota N° ' || p_nro_nota END,
      p_fecha_despacho
    );
  END LOOP;

  -- 2. Si fue rebote/anulación, registrar reingreso en Kardex y fila en anulaciones_pedido
  IF p_id_admin_anula IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_prod_id := (v_item->>'id_producto')::INT;
      v_real := ROUND((v_item->>'real')::NUMERIC, 3);

      SELECT COALESCE(stock_fisico_kilos, 0)::NUMERIC(12, 3)
      INTO v_ant FROM public.productos WHERE id_producto = v_prod_id;

      v_nue := ROUND(v_ant + v_real, 3);
      UPDATE public.productos SET stock_fisico_kilos = v_nue WHERE id_producto = v_prod_id;

      INSERT INTO public.movimientos_kardex (
        id_producto, id_usuario, tipo_movimiento, cantidad_kilos,
        saldo_anterior_kilos, saldo_nuevo_kilos, referencia_pedido_id,
        observacion, fecha_movimiento
      )
      VALUES (
        v_prod_id, p_id_admin_anula, 'REINGRESO_ANULACION', v_real,
        v_ant, v_nue, v_id_pedido,
        'Rebote Nota N° ' || p_nro_nota || ': ' || p_motivo_rebote,
        p_fecha_anulacion
      )
      RETURNING id_movimiento INTO v_mov_reing;

      v_total_reing := ROUND(v_total_reing + v_real, 3);
    END LOOP;

    INSERT INTO public.anulaciones_pedido (
      id_pedido, id_administrador, motivo_rebote,
      kilos_reingresados_total, id_movimiento_reingreso, fecha_anulacion
    )
    VALUES (
      v_id_pedido, p_id_admin_anula, p_motivo_rebote,
      v_total_reing, v_mov_reing, p_fecha_anulacion
    );
  END IF;

  RETURN v_id_pedido;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.sim_pedido_pendiente(
  p_id_cliente INT,
  p_id_vendedor INT,
  p_obs TEXT,
  p_fecha_preventa TIMESTAMPTZ,
  p_items JSONB
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_pedido INT;
  v_item JSONB;
  v_prod_id INT;
  v_est NUMERIC(12, 3);
  v_precio NUMERIC(10, 2);
BEGIN
  INSERT INTO public.pedidos (
    nro_nota_venta, id_cliente, id_vendedor, id_despachador,
    estado, es_pedido_cortesia_pura, observaciones,
    fecha_preventa, fecha_despacho
  )
  VALUES (
    NULL, p_id_cliente, p_id_vendedor, NULL,
    'PENDIENTE', FALSE, p_obs, p_fecha_preventa, NULL
  )
  RETURNING id_pedido INTO v_id_pedido;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'id_producto')::INT;
    v_est := ROUND((v_item->>'est')::NUMERIC, 3);

    SELECT precio_kilo_bs INTO v_precio FROM public.productos WHERE id_producto = v_prod_id;

    INSERT INTO public.detalle_pedidos (
      id_pedido, id_producto, kilos_estimados, kilos_reales,
      es_cortesia, precio_unitario_congelado
    )
    VALUES (
      v_id_pedido, v_prod_id, v_est, NULL, FALSE, v_precio
    );

    UPDATE public.productos
    SET stock_comprometido_kilos = ROUND(COALESCE(stock_comprometido_kilos, 0) + v_est, 3)
    WHERE id_producto = v_prod_id;
  END LOOP;

  RETURN v_id_pedido;
END;
$$;

-- ============================================================================
-- BLOQUE PRINCIPAL ATÓMICO DE RESET + CARGA COMPLETA
-- ============================================================================
DO $$
DECLARE
  v_old_auth_ids UUID[];
  v_seq_rec RECORD;
  v_u RECORD;
  v_hash TEXT;
  v_auth_id UUID;
  v_email TEXT;
  v_id_usuario INT;

  -- IDs dinámicos de los 6 usuarios
  v_vend1 INT;
  v_vend2 INT;
  v_desp1 INT;
  v_desp2 INT;
  v_prod1 INT;
  v_admin1 INT;

  -- Zonas y categoría
  v_z1 INT; v_z2 INT; v_z3 INT; v_z4 INT; v_z5 INT;
  v_cat_chorizos INT;

  -- 10 clientes activos + 1 inactivo
  v_c1 INT; v_c2 INT; v_c3 INT; v_c4 INT; v_c5 INT;
  v_c6 INT; v_c7 INT; v_c8 INT; v_c9 INT; v_c10 INT; v_c11 INT;

  -- 8 productos (4 GRANEL + 4 VACIO)
  v_p_par_gr INT; v_p_par_va INT;
  v_p_pic_gr INT; v_p_pic_va INT;
  v_p_chu_gr INT; v_p_chu_va INT;
  v_p_ahu_gr INT; v_p_ahu_va INT;

  v_max_pk BIGINT;
BEGIN
  PERFORM set_config('search_path', 'public, extensions, auth', true);

  -- --------------------------------------------------------------------------
  -- 1. LIMPIEZA COMPLETA EN ORDEN DE DEPENDENCIAS (HIJOS -> PADRES)
  -- --------------------------------------------------------------------------
  SELECT ARRAY_AGG(auth_id) INTO v_old_auth_ids
  FROM public.usuarios
  WHERE auth_id IS NOT NULL;

  DELETE FROM public.anulaciones_pedido;
  DELETE FROM public.lotes_produccion;
  DELETE FROM public.transformaciones_inventario;
  DELETE FROM public.movimientos_kardex;
  DELETE FROM public.detalle_pedidos;
  DELETE FROM public.pedidos;
  DELETE FROM public.productos;
  DELETE FROM public.categorias_producto;
  DELETE FROM public.clientes;
  DELETE FROM public.zonas_mercado;
  DELETE FROM public.perfil_vendedor;
  DELETE FROM public.perfil_despachador;
  DELETE FROM public.perfil_produccion;
  DELETE FROM public.perfil_administrador;
  DELETE FROM public.usuarios;

  DELETE FROM auth.identities
  WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email LIKE '%@euroalimentos.com'
       OR (v_old_auth_ids IS NOT NULL AND id = ANY(v_old_auth_ids))
  );

  DELETE FROM auth.users
  WHERE email LIKE '%@euroalimentos.com'
     OR (v_old_auth_ids IS NOT NULL AND id = ANY(v_old_auth_ids));

  -- Reiniciar todas las secuencias de `public` a 1
  FOR v_seq_rec IN
    SELECT
      pg_get_serial_sequence(format('public.%I', c.relname), a.attname) AS seq_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
  LOOP
    IF v_seq_rec.seq_name IS NOT NULL THEN
      EXECUTE format('SELECT setval(%L, 1, false)', v_seq_rec.seq_name);
    END IF;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- 2. USUARIOS (2 VENDEDORES, 2 DESPACHADORES, 1 PRODUCCIÓN, 1 ADMIN)
  --    Contraseña para TODOS: 123456
  -- --------------------------------------------------------------------------
  v_hash := crypt('123456', gen_salt('bf'));

  FOR v_u IN
    SELECT *
    FROM (VALUES
      ('vendedor1',   'Carlos Mamani Quispe',        '70111111', 'VENDEDOR'::rol_usuario_enum,      'VND-001', NULL::TEXT,          NULL::TEXT,     0),
      ('vendedor2',   'Sofía Rojas Fernández',       '70122222', 'VENDEDOR'::rol_usuario_enum,      'VND-002', NULL::TEXT,          NULL::TEXT,     0),
      ('despacho1',   'Roberto Condori Flores',      '70222222', 'DESPACHADOR'::rol_usuario_enum,   NULL,      'BALANZA-GANCHO-01', 'EPSON-TM-T20', 80),
      ('despacho2',   'Miguel Ángel Torrez Pérez',   '70233333', 'DESPACHADOR'::rol_usuario_enum,   NULL,      'BALANZA-GANCHO-02', 'EPSON-TM-T88', 80),
      ('produccion1', 'Elena Vargas Apaza',          '70333333', 'PRODUCCION'::rol_usuario_enum,    NULL,      NULL,                NULL,           0),
      ('admin1',      'Marcelo Villarroel Gutiérrez','70444444', 'ADMINISTRADOR'::rol_usuario_enum, NULL,      NULL,                NULL,           0)
    ) AS t(username, nombre, telefono, rol, cod_vend, balanza, impresora, ancho_mm)
  LOOP
    v_email := v_u.username || '@euroalimentos.com';
    v_auth_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000', v_auth_id, 'authenticated', 'authenticated',
      v_email, v_hash, NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'rol', v_u.rol,
        'nombre_completo', v_u.nombre,
        'username', v_u.username
      ),
      NOW(), NOW(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), v_auth_id, v_auth_id::TEXT,
      jsonb_build_object('sub', v_auth_id::TEXT, 'email', v_email),
      'email', NOW(), NOW(), NOW()
    );

    -- Respetar si existe trigger on_auth_user_created en auth.users
    SELECT id_usuario INTO v_id_usuario
    FROM public.usuarios
    WHERE auth_id = v_auth_id OR LOWER(username) = v_u.username
    LIMIT 1;

    IF v_id_usuario IS NULL THEN
      INSERT INTO public.usuarios (
        nombre_completo, username, password_hash, telefono,
        rol, activo, creado_en, auth_id, requiere_cambio_clave
      )
      VALUES (
        v_u.nombre, v_u.username, v_hash, v_u.telefono,
        v_u.rol, TRUE, '2026-11-01 06:00:00-04'::TIMESTAMPTZ, v_auth_id, FALSE
      )
      RETURNING id_usuario INTO v_id_usuario;
    ELSE
      UPDATE public.usuarios
      SET
        nombre_completo = v_u.nombre,
        username = v_u.username,
        password_hash = v_hash,
        telefono = v_u.telefono,
        rol = v_u.rol,
        activo = TRUE,
        auth_id = v_auth_id,
        requiere_cambio_clave = FALSE
      WHERE id_usuario = v_id_usuario;
    END IF;

    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'id_usuario', v_id_usuario,
      'rol', v_u.rol,
      'nombre_completo', v_u.nombre,
      'username', v_u.username
    )
    WHERE id = v_auth_id;

    IF v_u.rol = 'VENDEDOR' THEN
      INSERT INTO public.perfil_vendedor (
        id_usuario, codigo_vendedor, porcentaje_comision, meta_diaria_kilos, permite_venta_sin_stock
      )
      VALUES (v_id_usuario, v_u.cod_vend, 2.50, CASE WHEN v_u.username = 'vendedor1' THEN 180.000 ELSE 160.000 END, TRUE)
      ON CONFLICT (id_usuario) DO UPDATE SET codigo_vendedor = EXCLUDED.codigo_vendedor;
    ELSIF v_u.rol = 'DESPACHADOR' THEN
      INSERT INTO public.perfil_despachador (
        id_usuario, identificador_balanza, impresora_termica_modelo, ancho_papel_mm, autorizado_cortesias
      )
      VALUES (v_id_usuario, v_u.balanza, v_u.impresora, v_u.ancho_mm, TRUE)
      ON CONFLICT (id_usuario) DO UPDATE SET identificador_balanza = EXCLUDED.identificador_balanza;
    ELSIF v_u.rol = 'PRODUCCION' THEN
      INSERT INTO public.perfil_produccion (
        id_usuario, turno_planta, responsable_camara_frio, tolerancia_merma_max_pct
      )
      VALUES (v_id_usuario, 'MAÑANA', TRUE, 5.00)
      ON CONFLICT (id_usuario) DO NOTHING;
    ELSIF v_u.rol = 'ADMINISTRADOR' THEN
      INSERT INTO public.perfil_administrador (
        id_usuario, cargo_gerencial, puede_anular_despachos, puede_exportar_sac
      )
      VALUES (v_id_usuario, 'Gerencia General y Sistemas', TRUE, TRUE)
      ON CONFLICT (id_usuario) DO NOTHING;
    END IF;

    CASE v_u.username
      WHEN 'vendedor1'   THEN v_vend1  := v_id_usuario;
      WHEN 'vendedor2'   THEN v_vend2  := v_id_usuario;
      WHEN 'despacho1'   THEN v_desp1  := v_id_usuario;
      WHEN 'despacho2'   THEN v_desp2  := v_id_usuario;
      WHEN 'produccion1' THEN v_prod1  := v_id_usuario;
      WHEN 'admin1'      THEN v_admin1 := v_id_usuario;
    END CASE;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- 3. ZONAS DE MERCADO Y CLIENTES SAC
  -- --------------------------------------------------------------------------
  INSERT INTO public.zonas_mercado (nombre_zona, ciudad, activo)
  VALUES ('Mercado Abasto', 'Santa Cruz', TRUE) RETURNING id_zona INTO v_z1;
  INSERT INTO public.zonas_mercado (nombre_zona, ciudad, activo)
  VALUES ('Mercado Mutualista', 'Santa Cruz', TRUE) RETURNING id_zona INTO v_z2;
  INSERT INTO public.zonas_mercado (nombre_zona, ciudad, activo)
  VALUES ('Supermercados e Hipermercados', 'Santa Cruz', TRUE) RETURNING id_zona INTO v_z3;
  INSERT INTO public.zonas_mercado (nombre_zona, ciudad, activo)
  VALUES ('Zona Sur / Equipetrol', 'Santa Cruz', TRUE) RETURNING id_zona INTO v_z4;
  INSERT INTO public.zonas_mercado (nombre_zona, ciudad, activo)
  VALUES ('Distribuidores El Alto', 'La Paz', TRUE) RETURNING id_zona INTO v_z5;

  INSERT INTO public.clientes (codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo, creado_en)
  VALUES ('SAC-1001', 'Friales Don Pepe SRL', '1028491021', '71022101', v_z1, TRUE, '2026-11-01 07:00:00-04') RETURNING id_cliente INTO v_c1;
  INSERT INTO public.clientes (codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo, creado_en)
  VALUES ('SAC-1002', 'Carnicería El Gaucho', '4589123015', '71022102', v_z1, TRUE, '2026-11-01 07:00:00-04') RETURNING id_cliente INTO v_c2;
  INSERT INTO public.clientes (codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo, creado_en)
  VALUES ('SAC-1003', 'Churrasquería La Estancia', '1020334029', '72145601', v_z4, TRUE, '2026-11-01 07:00:00-04') RETURNING id_cliente INTO v_c3;
  INSERT INTO public.clientes (codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo, creado_en)
  VALUES ('SAC-1004', 'Supermercado Norte Express', '3891023011', '75011220', v_z3, TRUE, '2026-11-01 07:00:00-04') RETURNING id_cliente INTO v_c4;
  INSERT INTO public.clientes (codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo, creado_en)
  VALUES ('SAC-1005', 'Distribuidora Los Andes', '5120394014', '76098711', v_z2, TRUE, '2026-11-01 07:00:00-04') RETURNING id_cliente INTO v_c5;
  INSERT INTO public.clientes (codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo, creado_en)
  VALUES ('SAC-1006', 'Restaurante Brasa Roja', '2983741018', '77033445', v_z4, TRUE, '2026-11-01 07:00:00-04') RETURNING id_cliente INTO v_c6;
  INSERT INTO public.clientes (codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo, creado_en)
  VALUES ('SAC-1007', 'Tienda La Económica', '6341892012', '70944551', v_z2, TRUE, '2026-11-01 07:00:00-04') RETURNING id_cliente INTO v_c7;
  INSERT INTO public.clientes (codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo, creado_en)
  VALUES ('SAC-1008', 'Hipermaxi Equipetrol', '1015482027', '33448800', v_z3, TRUE, '2026-11-01 07:00:00-04') RETURNING id_cliente INTO v_c8;
  INSERT INTO public.clientes (codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo, creado_en)
  VALUES ('SAC-1009', 'Mayorista El Alteño', '4891204016', '71599882', v_z5, TRUE, '2026-11-01 07:00:00-04') RETURNING id_cliente INTO v_c9;
  INSERT INTO public.clientes (codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo, creado_en)
  VALUES ('SAC-1010', 'Parrillada Los Tajibos', '1029987023', '78011993', v_z4, TRUE, '2026-11-01 07:00:00-04') RETURNING id_cliente INTO v_c10;
  INSERT INTO public.clientes (codigo_cliente_sac, nombre_comercial, nit_ci, telefono, id_zona, activo, creado_en)
  VALUES ('SAC-1099', 'Friales Cerrado Prueba', '9999999010', '70000099', v_z2, FALSE, '2026-11-01 07:00:00-04') RETURNING id_cliente INTO v_c11;

  -- --------------------------------------------------------------------------
  -- 4. CATEGORÍA Y CATÁLOGO DE CHORIZOS (GRANEL y VACIO)
  -- --------------------------------------------------------------------------
  INSERT INTO public.categorias_producto (nombre_categoria, descripcion)
  VALUES ('Chorizos', 'Embutidos frescos y ahumados en presentación Granel y Vacío')
  RETURNING id_categoria INTO v_cat_chorizos;

  INSERT INTO public.productos (codigo_sku, id_categoria, nombre_producto, formato, precio_kilo_bs, stock_fisico_kilos, stock_comprometido_kilos, activo)
  VALUES ('CHR-PAR-GR', v_cat_chorizos, 'Chorizo Parrillero Tradicional', 'GRANEL', 38.50, 0.000, 0.000, TRUE) RETURNING id_producto INTO v_p_par_gr;
  INSERT INTO public.productos (codigo_sku, id_categoria, nombre_producto, formato, precio_kilo_bs, stock_fisico_kilos, stock_comprometido_kilos, activo)
  VALUES ('CHR-PAR-VA', v_cat_chorizos, 'Chorizo Parrillero Tradicional (Vacío)', 'VACIO', 42.00, 0.000, 0.000, TRUE) RETURNING id_producto INTO v_p_par_va;

  INSERT INTO public.productos (codigo_sku, id_categoria, nombre_producto, formato, precio_kilo_bs, stock_fisico_kilos, stock_comprometido_kilos, activo)
  VALUES ('CHR-PIC-GR', v_cat_chorizos, 'Chorizo Especial Picante', 'GRANEL', 41.00, 0.000, 0.000, TRUE) RETURNING id_producto INTO v_p_pic_gr;
  INSERT INTO public.productos (codigo_sku, id_categoria, nombre_producto, formato, precio_kilo_bs, stock_fisico_kilos, stock_comprometido_kilos, activo)
  VALUES ('CHR-PIC-VA', v_cat_chorizos, 'Chorizo Especial Picante (Vacío)', 'VACIO', 44.50, 0.000, 0.000, TRUE) RETURNING id_producto INTO v_p_pic_va;

  INSERT INTO public.productos (codigo_sku, id_categoria, nombre_producto, formato, precio_kilo_bs, stock_fisico_kilos, stock_comprometido_kilos, activo)
  VALUES ('CHR-CHU-GR', v_cat_chorizos, 'Chorizo Chuquisaqueño Artesanal', 'GRANEL', 45.00, 0.000, 0.000, TRUE) RETURNING id_producto INTO v_p_chu_gr;
  INSERT INTO public.productos (codigo_sku, id_categoria, nombre_producto, formato, precio_kilo_bs, stock_fisico_kilos, stock_comprometido_kilos, activo)
  VALUES ('CHR-CHU-VA', v_cat_chorizos, 'Chorizo Chuquisaqueño Artesanal (Vacío)', 'VACIO', 48.50, 0.000, 0.000, TRUE) RETURNING id_producto INTO v_p_chu_va;

  INSERT INTO public.productos (codigo_sku, id_categoria, nombre_producto, formato, precio_kilo_bs, stock_fisico_kilos, stock_comprometido_kilos, activo)
  VALUES ('CHR-AHU-GR', v_cat_chorizos, 'Chorizo Ahumado Tipo Vienés', 'GRANEL', 43.00, 0.000, 0.000, TRUE) RETURNING id_producto INTO v_p_ahu_gr;
  INSERT INTO public.productos (codigo_sku, id_categoria, nombre_producto, formato, precio_kilo_bs, stock_fisico_kilos, stock_comprometido_kilos, activo)
  VALUES ('CHR-AHU-VA', v_cat_chorizos, 'Chorizo Ahumado Tipo Vienés (Vacío)', 'VACIO', 46.50, 0.000, 0.000, TRUE) RETURNING id_producto INTO v_p_ahu_va;

  -- --------------------------------------------------------------------------
  -- 5. SIMULACIÓN CRONOLÓGICA: 01 NOV 2026 -> 15 NOV 2026 (HOY)
  -- --------------------------------------------------------------------------

  -- === 01 NOVIEMBRE 2026: Lotes iniciales de apertura de mes + 1ª transformación ===
  PERFORM pg_temp.sim_lote(v_p_par_gr, v_prod1, 'LOT-20261101-01', 350.000, '2026-11-01 06:30:00-04', 'Lote apertura noviembre Parrillero Granel');
  PERFORM pg_temp.sim_lote(v_p_pic_gr, v_prod1, 'LOT-20261101-02', 220.000, '2026-11-01 06:50:00-04', 'Lote apertura noviembre Picante Granel');
  PERFORM pg_temp.sim_lote(v_p_chu_gr, v_prod1, 'LOT-20261101-03', 180.000, '2026-11-01 07:10:00-04', 'Lote apertura noviembre Chuquisaqueño Granel');
  PERFORM pg_temp.sim_lote(v_p_ahu_gr, v_prod1, 'LOT-20261101-04', 190.000, '2026-11-01 07:30:00-04', 'Lote apertura noviembre Ahumado Granel');
  PERFORM pg_temp.sim_lote(v_p_par_va, v_prod1, 'LOT-20261101-05',  90.000, '2026-11-01 08:00:00-04', 'Empaque directo línea vacío Parrillero');
  PERFORM pg_temp.sim_lote(v_p_pic_va, v_prod1, 'LOT-20261101-06',  60.000, '2026-11-01 08:20:00-04', 'Empaque directo línea vacío Picante');
  PERFORM pg_temp.sim_lote(v_p_chu_va, v_prod1, 'LOT-20261101-07',  50.000, '2026-11-01 08:35:00-04', 'Empaque directo línea vacío Chuquisaqueño');
  PERFORM pg_temp.sim_lote(v_p_ahu_va, v_prod1, 'LOT-20261101-08',  60.000, '2026-11-01 08:50:00-04', 'Empaque directo línea vacío Ahumado');

  PERFORM pg_temp.sim_transf(v_prod1, v_p_par_gr, v_p_par_va, 80.000, 77.600, '2026-11-01 10:15:00-04', 'Transformación turno mañana: Parrillero Granel -> Vacío (merma 3.0%)');

  -- === 02 NOVIEMBRE 2026 ===
  PERFORM pg_temp.sim_pedido_completo(1001, v_c1, v_vend1, v_desp1, FALSE, 'Entrega primera hora Abasto', '2026-11-02 08:15:00-04', '2026-11-02 10:05:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 35, 'real', 34.850, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_pic_gr, 'est', 20, 'real', 20.320, 'cortesia', false)
    ));
  PERFORM pg_temp.sim_pedido_completo(1002, v_c4, v_vend2, v_desp2, FALSE, 'Reposición góndola frío', '2026-11-02 09:40:00-04', '2026-11-02 14:20:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_va, 'est', 25, 'real', 24.910, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_ahu_va, 'est', 18, 'real', 18.140, 'cortesia', false)
    ));

  -- === 03 NOVIEMBRE 2026 (incluye pedido mixto con cortesía) ===
  PERFORM pg_temp.sim_pedido_completo(1003, v_c3, v_vend1, v_desp1, FALSE, 'Pedido parrillada + 2kg cortesía degustación', '2026-11-03 08:50:00-04', '2026-11-03 11:30:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_chu_gr, 'est', 30, 'real', 30.450, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 25, 'real', 24.780, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_pic_va, 'est',  2, 'real',  2.050, 'cortesia', true)
    ));
  PERFORM pg_temp.sim_pedido_completo(1004, v_c5, v_vend2, v_desp2, FALSE, NULL, '2026-11-03 11:10:00-04', '2026-11-03 15:40:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_pic_gr, 'est', 28, 'real', 27.640, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_ahu_gr, 'est', 22, 'real', 22.180, 'cortesia', false)
    ));

  -- === 04 NOVIEMBRE 2026: Transformación Picante Granel -> Vacío + Ventas ===
  PERFORM pg_temp.sim_transf(v_prod1, v_p_pic_gr, v_p_pic_va, 60.000, 58.200, '2026-11-04 07:45:00-04', 'Empaque al vacío lote especial picante');
  PERFORM pg_temp.sim_pedido_completo(1005, v_c8, v_vend2, v_desp1, FALSE, 'Despacho cadena Hipermaxi', '2026-11-04 09:20:00-04', '2026-11-04 13:15:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_va, 'est', 40, 'real', 39.820, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_pic_va, 'est', 25, 'real', 25.190, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_chu_va, 'est', 15, 'real', 14.950, 'cortesia', false)
    ));

  -- === 05 NOVIEMBRE 2026: Lotes reposición + REBOTE #1 (Nota 1006) ===
  PERFORM pg_temp.sim_lote(v_p_par_gr, v_prod1, 'LOT-20261105-01', 240.000, '2026-11-05 06:40:00-04', 'Producción reposición media semana Parrillero');
  PERFORM pg_temp.sim_lote(v_p_pic_gr, v_prod1, 'LOT-20261105-02', 140.000, '2026-11-05 07:05:00-04', 'Producción reposición media semana Picante');

  PERFORM pg_temp.sim_pedido_completo(1006, v_c2, v_vend1, v_desp1, FALSE, 'Despacho tarde Abasto', '2026-11-05 10:15:00-04', '2026-11-05 14:10:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 30, 'real', 29.900, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_ahu_gr, 'est', 15, 'real', 15.120, 'cortesia', false)
    ),
    v_admin1, 'Cliente cerró local antes de la entrega por corte de energía en la zona', '2026-11-05 17:45:00-04');

  PERFORM pg_temp.sim_pedido_completo(1007, v_c9, v_vend2, v_desp2, FALSE, 'Despacho flota terminal El Alto', '2026-11-05 12:00:00-04', '2026-11-05 16:30:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 50, 'real', 50.620, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_chu_gr, 'est', 25, 'real', 24.840, 'cortesia', false)
    ));

  -- === 06 NOVIEMBRE 2026 (incluye cortesía pura Bs 0.00) ===
  PERFORM pg_temp.sim_pedido_completo(1008, v_c10, v_vend1, v_desp2, TRUE, 'Cortesía pura evento inauguración sucursal Los Tajibos', '2026-11-06 09:00:00-04', '2026-11-06 11:15:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_va, 'est', 8, 'real', 8.120, 'cortesia', true),
      jsonb_build_object('id_producto', v_p_chu_va, 'est', 5, 'real', 4.980, 'cortesia', true)
    ));
  PERFORM pg_temp.sim_pedido_completo(1009, v_c6, v_vend1, v_desp1, FALSE, 'Pedido fin de semana restaurante', '2026-11-06 11:30:00-04', '2026-11-06 15:20:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_chu_gr, 'est', 28, 'real', 28.340, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_ahu_gr, 'est', 20, 'real', 19.760, 'cortesia', false)
    ));

  -- === 07 NOVIEMBRE 2026 (Sábado fuerte) ===
  PERFORM pg_temp.sim_pedido_completo(1010, v_c1, v_vend1, v_desp1, FALSE, 'Refuerzo sábado Friales Don Pepe', '2026-11-07 07:45:00-04', '2026-11-07 10:30:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 45, 'real', 45.280, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_pic_gr, 'est', 25, 'real', 24.890, 'cortesia', false)
    ));
  PERFORM pg_temp.sim_pedido_completo(1011, v_c7, v_vend2, v_desp2, FALSE, NULL, '2026-11-07 09:15:00-04', '2026-11-07 12:10:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_va, 'est', 20, 'real', 20.110, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_ahu_va, 'est', 14, 'real', 13.940, 'cortesia', false)
    ));

  -- === 08 NOVIEMBRE 2026: Transformación Chuquisaqueño Granel -> Vacío ===
  PERFORM pg_temp.sim_transf(v_prod1, v_p_chu_gr, v_p_chu_va, 55.000, 53.350, '2026-11-08 09:00:00-04', 'Empaque al vacío Chuquisaqueño para demanda semanal');
  PERFORM pg_temp.sim_pedido_completo(1012, v_c3, v_vend1, v_desp1, FALSE, 'Parrillada domingo', '2026-11-08 10:20:00-04', '2026-11-08 12:50:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 38, 'real', 37.920, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_chu_va, 'est', 18, 'real', 18.210, 'cortesia', false)
    ));

  -- === 09 NOVIEMBRE 2026: Lotes semana 2 + ventas mixtas ===
  PERFORM pg_temp.sim_lote(v_p_par_gr, v_prod1, 'LOT-20261109-01', 220.000, '2026-11-09 06:30:00-04', 'Producción semana 2 Parrillero');
  PERFORM pg_temp.sim_lote(v_p_chu_gr, v_prod1, 'LOT-20261109-02', 130.000, '2026-11-09 07:00:00-04', 'Producción semana 2 Chuquisaqueño');
  PERFORM pg_temp.sim_lote(v_p_ahu_gr, v_prod1, 'LOT-20261109-03', 120.000, '2026-11-09 07:25:00-04', 'Producción semana 2 Ahumado');

  PERFORM pg_temp.sim_pedido_completo(1013, v_c4, v_vend2, v_desp2, FALSE, 'Pedido con bonificación 1kg vacío', '2026-11-09 09:10:00-04', '2026-11-09 13:45:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_va, 'est', 30, 'real', 30.220, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_pic_va, 'est', 22, 'real', 21.880, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_ahu_va, 'est',  1, 'real',  1.020, 'cortesia', true)
    ));

  -- === 10 NOVIEMBRE 2026 ===
  PERFORM pg_temp.sim_pedido_completo(1014, v_c5, v_vend2, v_desp1, FALSE, NULL, '2026-11-10 08:40:00-04', '2026-11-10 11:55:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 42, 'real', 41.780, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_ahu_gr, 'est', 26, 'real', 26.310, 'cortesia', false)
    ));
  PERFORM pg_temp.sim_pedido_completo(1015, v_c2, v_vend1, v_desp2, FALSE, 'Entrega Mercado Abasto puesto 14', '2026-11-10 10:30:00-04', '2026-11-10 14:40:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_pic_gr, 'est', 32, 'real', 32.150, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_chu_gr, 'est', 20, 'real', 19.860, 'cortesia', false)
    ));

  -- === 11 NOVIEMBRE 2026: Venta + REBOTE #2 (Nota 1017) ===
  PERFORM pg_temp.sim_pedido_completo(1016, v_c9, v_vend2, v_desp1, FALSE, 'Despacho interdepartamental La Paz', '2026-11-11 08:20:00-04', '2026-11-11 11:40:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 55, 'real', 55.410, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_pic_gr, 'est', 30, 'real', 29.750, 'cortesia', false)
    ));
  PERFORM pg_temp.sim_pedido_completo(1017, v_c6, v_vend2, v_desp2, FALSE, 'Entrega horario almuerzo', '2026-11-11 09:50:00-04', '2026-11-11 12:15:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_chu_va, 'est', 22, 'real', 22.140, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_par_va, 'est', 18, 'real', 17.890, 'cortesia', false)
    ),
    v_admin1, 'Rechazo total en recepción por retraso de ruta fuera de ventana horaria', '2026-11-11 16:20:00-04');

  -- === 12 NOVIEMBRE 2026: Transformación Ahumado + Ajuste Auditoría ===
  PERFORM pg_temp.sim_transf(v_prod1, v_p_ahu_gr, v_p_ahu_va, 65.000, 63.050, '2026-11-12 08:00:00-04', 'Empaque al vacío Ahumado Vienés');
  PERFORM pg_temp.sim_ajuste(v_p_ahu_gr, v_admin1, -1.250, '2026-11-12 18:10:00-04', 'Ajuste auditoría semanal cámara fría #1 (merma natural por oreo)');

  PERFORM pg_temp.sim_pedido_completo(1018, v_c8, v_vend1, v_desp1, FALSE, 'Reposición cadena Hipermaxi', '2026-11-12 09:30:00-04', '2026-11-12 13:20:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_ahu_va, 'est', 30, 'real', 30.180, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_pic_va, 'est', 24, 'real', 23.920, 'cortesia', false)
    ));

  -- === 13 NOVIEMBRE 2026: Lotes vacío + Cortesía pura + Ventas ===
  PERFORM pg_temp.sim_lote(v_p_par_va, v_prod1, 'LOT-20261113-01', 80.000, '2026-11-13 06:45:00-04', 'Refuerzo empaque vacío fin de semana Parrillero');
  PERFORM pg_temp.sim_lote(v_p_pic_va, v_prod1, 'LOT-20261113-02', 70.000, '2026-11-13 07:10:00-04', 'Refuerzo empaque vacío fin de semana Picante');
  PERFORM pg_temp.sim_lote(v_p_ahu_va, v_prod1, 'LOT-20261113-03', 60.000, '2026-11-13 07:35:00-04', 'Refuerzo empaque vacío fin de semana Ahumado');

  PERFORM pg_temp.sim_pedido_completo(1019, v_c8, v_vend2, v_desp2, TRUE, 'Cortesía pura activación degustación Hipermaxi', '2026-11-13 09:00:00-04', '2026-11-13 11:30:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_ahu_va, 'est', 6, 'real', 6.080, 'cortesia', true),
      jsonb_build_object('id_producto', v_p_pic_va, 'est', 4, 'real', 3.960, 'cortesia', true)
    ));
  PERFORM pg_temp.sim_pedido_completo(1020, v_c10, v_vend1, v_desp1, FALSE, NULL, '2026-11-13 11:20:00-04', '2026-11-13 15:10:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_chu_gr, 'est', 35, 'real', 35.340, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 40, 'real', 39.850, 'cortesia', false)
    ));

  -- === 14 NOVIEMBRE 2026 (Ayer) ===
  PERFORM pg_temp.sim_pedido_completo(1021, v_c1, v_vend1, v_desp1, FALSE, 'Pedido fuerte sábado', '2026-11-14 08:10:00-04', '2026-11-14 10:45:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 48, 'real', 48.420, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_chu_va, 'est', 16, 'real', 15.920, 'cortesia', false)
    ));
  PERFORM pg_temp.sim_pedido_completo(1022, v_c3, v_vend2, v_desp2, FALSE, 'Parrillada sábado noche', '2026-11-14 10:05:00-04', '2026-11-14 13:30:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_chu_gr, 'est', 30, 'real', 29.780, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_pic_gr, 'est', 22, 'real', 22.140, 'cortesia', false)
    ));

  -- === 15 NOVIEMBRE 2026 (HOY): Producción + Despachos de hoy + Rebote de hoy + 5 Pendientes ===
  PERFORM pg_temp.sim_lote(v_p_par_gr, v_prod1, 'LOT-20261115-01', 180.000, '2026-11-15 06:45:00-04', 'Lote matutino hoy Parrillero Granel');
  PERFORM pg_temp.sim_lote(v_p_pic_gr, v_prod1, 'LOT-20261115-02',  90.000, '2026-11-15 07:10:00-04', 'Lote matutino hoy Picante Granel');
  PERFORM pg_temp.sim_lote(v_p_ahu_gr, v_prod1, 'LOT-20261115-03',  80.000, '2026-11-15 07:30:00-04', 'Lote matutino hoy Ahumado Granel');

  PERFORM pg_temp.sim_transf(v_prod1, v_p_par_gr, v_p_par_va, 50.000, 48.500, '2026-11-15 08:30:00-04', 'Empaque al vacío matutino hoy Parrillero');

  -- Despachos de HOY (Notas 1023..1026)
  PERFORM pg_temp.sim_pedido_completo(1023, v_c4, v_vend1, v_desp1, FALSE, 'Entrega domingo Supermercado Norte', '2026-11-15 09:05:00-04', '2026-11-15 10:25:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_va, 'est', 32, 'real', 32.160, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_ahu_va, 'est', 20, 'real', 19.880, 'cortesia', false)
    ));

  PERFORM pg_temp.sim_pedido_completo(1024, v_c7, v_vend2, v_desp2, FALSE, 'Pedido con cortesía promocional 2kg', '2026-11-15 09:45:00-04', '2026-11-15 11:40:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 30, 'real', 30.410, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_pic_gr, 'est', 18, 'real', 17.920, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_par_va, 'est',  2, 'real',  2.040, 'cortesia', true)
    ));

  PERFORM pg_temp.sim_pedido_completo(1025, v_c9, v_vend2, v_desp1, FALSE, 'Despacho mayorista tarde', '2026-11-15 11:15:00-04', '2026-11-15 13:10:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 45, 'real', 44.850, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_ahu_gr, 'est', 25, 'real', 25.190, 'cortesia', false)
    ));

  -- Rebote de HOY (Nota 1026) para verificar reingresos del día en Auditoría Admin y Reportes SAC
  PERFORM pg_temp.sim_pedido_completo(1026, v_c2, v_vend1, v_desp2, FALSE, 'Pedido con cambio de presentación solicitado', '2026-11-15 12:10:00-04', '2026-11-15 13:50:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_pic_gr, 'est', 25, 'real', 24.900, 'cortesia', false),
      jsonb_build_object('id_producto', v_p_chu_gr, 'est', 15, 'real', 15.100, 'cortesia', false)
    ),
    v_admin1, 'Cliente solicitó cambiar presentación Granel por empaque al Vacío', '2026-11-15 14:30:00-04');

  -- 5 Pedidos PENDIENTES de HOY listos en Bandeja de Despacho (/despacho)
  -- Incluye demanda alta en CHR-CHU-VA (95 kg) para activar alerta de DÉFICIT en /produccion/lotes
  PERFORM pg_temp.sim_pedido_pendiente(v_c1, v_vend1, 'Pasar a recoger a las 17:00 — pesar por caja', '2026-11-15 16:10:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 35),
      jsonb_build_object('id_producto', v_p_par_va, 'est', 20)
    ));

  PERFORM pg_temp.sim_pedido_pendiente(v_c3, v_vend2, 'Evento corporativo noche — urgente Chuquisaqueño Vacío', '2026-11-15 17:20:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_chu_va, 'est', 95)
    ));

  PERFORM pg_temp.sim_pedido_pendiente(v_c8, v_vend1, 'Reposición cadena Hipermaxi lunes primera hora', '2026-11-15 18:45:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_pic_va, 'est', 28),
      jsonb_build_object('id_producto', v_p_ahu_va, 'est', 22)
    ));

  PERFORM pg_temp.sim_pedido_pendiente(v_c5, v_vend2, 'Ruta norte distribuidora — cargar en furgón 2', '2026-11-15 20:15:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_par_gr, 'est', 45),
      jsonb_build_object('id_producto', v_p_pic_gr, 'est', 30)
    ));

  PERFORM pg_temp.sim_pedido_pendiente(v_c10, v_vend1, 'Parrillada reserva lunes — verificar temperatura', '2026-11-15 21:40:00-04',
    jsonb_build_array(
      jsonb_build_object('id_producto', v_p_chu_gr, 'est', 25),
      jsonb_build_object('id_producto', v_p_ahu_gr, 'est', 18)
    ));

  -- --------------------------------------------------------------------------
  -- 6. SINCRONIZAR TODAS LAS SECUENCIAS PARA QUE LOS PRÓXIMOS INSERTS NO FALLEN
  -- --------------------------------------------------------------------------
  FOR v_seq_rec IN
    SELECT
      c.relname AS tbl,
      a.attname AS col,
      pg_get_serial_sequence(format('public.%I', c.relname), a.attname) AS seq_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
  LOOP
    IF v_seq_rec.seq_name IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM public.%I', v_seq_rec.col, v_seq_rec.tbl)
      INTO v_max_pk;
      IF v_max_pk > 0 THEN
        EXECUTE format('SELECT setval(%L, %s, true)', v_seq_rec.seq_name, v_max_pk);
      ELSE
        EXECUTE format('SELECT setval(%L, 1, false)', v_seq_rec.seq_name);
      END IF;
    END IF;
  END LOOP;

  -- Si existe una secuencia independiente para nro_nota_venta (ej. seq_nro_nota_venta)
  FOR v_seq_rec IN
    SELECT n.nspname || '.' || c.relname AS full_seq
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND c.relname ILIKE '%nota%'
  LOOP
    SELECT COALESCE(MAX(nro_nota_venta), 1000) INTO v_max_pk FROM public.pedidos;
    EXECUTE format('SELECT setval(%L, %s, true)', v_seq_rec.full_seq, v_max_pk);
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICACIÓN RÁPIDA POST-EJECUCIÓN
-- ============================================================================
SELECT
  id_usuario,
  username,
  nombre_completo,
  rol,
  activo,
  COALESCE(requiere_cambio_clave, FALSE) AS requiere_cambio_clave
FROM public.usuarios
ORDER BY id_usuario;

SELECT
  codigo_sku,
  nombre_producto,
  formato,
  precio_kilo_bs,
  stock_fisico_kilos,
  stock_comprometido_kilos,
  stock_disponible_kilos
FROM public.productos
ORDER BY id_producto;

SELECT
  estado,
  COUNT(*) AS total_pedidos
FROM public.pedidos
GROUP BY estado
ORDER BY estado;

