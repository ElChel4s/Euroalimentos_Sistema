-- ============================================================================
-- EUROALIMENTOS SRL — RPC Transaccional: Transformación Granel -> Vacío (CTI)
-- Requerimientos: RF-12, CU-P02, RNF-03
-- Tablas afectadas: productos, movimientos_kardex, transformaciones_inventario
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_registrar_transformacion_inventario(INT, INT, INT, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_registrar_transformacion_inventario(
  p_id_usuario INT,
  p_id_producto_origen INT,
  p_id_producto_destino INT,
  p_kilos_origen_usados NUMERIC,
  p_kilos_destino_obtenidos NUMERIC,
  p_observacion TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kilos_origen NUMERIC(12, 3);
  v_kilos_destino NUMERIC(12, 3);
  v_lock_first INT;
  v_lock_second INT;
  v_origen RECORD;
  v_destino RECORD;
  v_saldo_anterior_origen NUMERIC(12, 3);
  v_saldo_nuevo_origen NUMERIC(12, 3);
  v_saldo_anterior_destino NUMERIC(12, 3);
  v_saldo_nuevo_destino NUMERIC(12, 3);
  v_id_mov_salida BIGINT;
  v_id_mov_entrada BIGINT;
  v_id_transformacion INT;
  v_merma_kilos NUMERIC(12, 3);
  v_tiene_perfil_produccion BOOLEAN;
  v_obs_limpia TEXT;
BEGIN
  -- 1. Validaciones de parámetros
  IF p_id_usuario IS NULL OR p_id_usuario <= 0 THEN
    RAISE EXCEPTION 'Usuario de producción inválido.';
  END IF;

  IF p_id_producto_origen IS NULL OR p_id_producto_origen <= 0
     OR p_id_producto_destino IS NULL OR p_id_producto_destino <= 0 THEN
    RAISE EXCEPTION 'Debe seleccionar productos válidos para origen y destino.';
  END IF;

  IF p_id_producto_origen = p_id_producto_destino THEN
    RAISE EXCEPTION 'El producto origen y el producto destino no pueden ser el mismo.';
  END IF;

  IF p_kilos_origen_usados IS NULL OR p_kilos_origen_usados <= 0 THEN
    RAISE EXCEPTION 'Los kilos de origen usados deben ser mayores a 0.000 kg.';
  END IF;

  IF p_kilos_destino_obtenidos IS NULL OR p_kilos_destino_obtenidos <= 0 THEN
    RAISE EXCEPTION 'Los kilos obtenidos al vacío deben ser mayores a 0.000 kg.';
  END IF;

  v_kilos_origen := ROUND(p_kilos_origen_usados, 3);
  v_kilos_destino := ROUND(p_kilos_destino_obtenidos, 3);

  IF v_kilos_origen <= 0 OR v_kilos_destino <= 0 THEN
    RAISE EXCEPTION 'Las cantidades redondeadas a 3 decimales deben ser mayores a 0.000 kg.';
  END IF;

  -- Restricción chk_merma_no_negativa
  IF v_kilos_destino > v_kilos_origen THEN
    RAISE EXCEPTION 'Los kilos obtenidos al vacío (%) no pueden superar los kilos retirados de granel (%).',
      v_kilos_destino, v_kilos_origen;
  END IF;

  -- Verificar pertenencia CTI en perfil_produccion
  SELECT EXISTS (
    SELECT 1
    FROM public.perfil_produccion
    WHERE id_usuario = p_id_usuario
  )
  INTO v_tiene_perfil_produccion;

  IF NOT v_tiene_perfil_produccion THEN
    RAISE EXCEPTION 'El usuario % no posee perfil CTI en perfil_produccion.', p_id_usuario;
  END IF;

  -- 2. Bloqueo determinístico (FOR UPDATE) por id_producto ASC para evitar deadlocks
  v_lock_first := LEAST(p_id_producto_origen, p_id_producto_destino);
  v_lock_second := GREATEST(p_id_producto_origen, p_id_producto_destino);

  PERFORM id_producto
  FROM public.productos
  WHERE id_producto IN (v_lock_first, v_lock_second)
  ORDER BY id_producto ASC
  FOR UPDATE;

  -- Validar origen GRANEL
  SELECT id_producto, codigo_sku, formato, activo, COALESCE(stock_fisico_kilos, 0)::NUMERIC(12, 3) AS stock_fisico_kilos
  INTO v_origen
  FROM public.productos
  WHERE id_producto = p_id_producto_origen;

  IF NOT FOUND OR v_origen.activo IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'El producto origen (%) no existe o está inactivo.', p_id_producto_origen;
  END IF;

  IF v_origen.formato <> 'GRANEL' THEN
    RAISE EXCEPTION 'El producto origen (%) debe tener formato GRANEL.', v_origen.codigo_sku;
  END IF;

  IF v_origen.stock_fisico_kilos < v_kilos_origen THEN
    RAISE EXCEPTION 'Stock físico insuficiente en origen (%): disponible % kg, solicitado % kg.',
      v_origen.codigo_sku, v_origen.stock_fisico_kilos, v_kilos_origen;
  END IF;

  -- Validar destino VACIO
  SELECT id_producto, codigo_sku, formato, activo, COALESCE(stock_fisico_kilos, 0)::NUMERIC(12, 3) AS stock_fisico_kilos
  INTO v_destino
  FROM public.productos
  WHERE id_producto = p_id_producto_destino;

  IF NOT FOUND OR v_destino.activo IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'El producto destino (%) no existe o está inactivo.', p_id_producto_destino;
  END IF;

  IF v_destino.formato <> 'VACIO' THEN
    RAISE EXCEPTION 'El producto destino (%) debe tener formato VACIO.', v_destino.codigo_sku;
  END IF;

  v_obs_limpia := NULLIF(TRIM(COALESCE(p_observacion, '')), '');

  -- 3. Descarga de producto origen GRANEL + Kardex SALIDA_TRANSFORMACION
  v_saldo_anterior_origen := v_origen.stock_fisico_kilos;
  v_saldo_nuevo_origen := ROUND(v_saldo_anterior_origen - v_kilos_origen, 3);

  UPDATE public.productos
  SET stock_fisico_kilos = v_saldo_nuevo_origen
  WHERE id_producto = p_id_producto_origen;

  INSERT INTO public.movimientos_kardex (
    id_producto,
    id_usuario,
    tipo_movimiento,
    cantidad_kilos,
    saldo_anterior_kilos,
    saldo_nuevo_kilos,
    referencia_pedido_id,
    observacion
  )
  VALUES (
    p_id_producto_origen,
    p_id_usuario,
    'SALIDA_TRANSFORMACION',
    -v_kilos_origen,
    v_saldo_anterior_origen,
    v_saldo_nuevo_origen,
    NULL,
    COALESCE(
      v_obs_limpia,
      'Transformación Granel -> Vacío hacia ' || v_destino.codigo_sku
    )
  )
  RETURNING id_movimiento INTO v_id_mov_salida;

  -- 4. Ingreso a producto destino VACIO + Kardex ENTRADA_TRANSFORMACION
  v_saldo_anterior_destino := v_destino.stock_fisico_kilos;
  v_saldo_nuevo_destino := ROUND(v_saldo_anterior_destino + v_kilos_destino, 3);

  UPDATE public.productos
  SET stock_fisico_kilos = v_saldo_nuevo_destino
  WHERE id_producto = p_id_producto_destino;

  INSERT INTO public.movimientos_kardex (
    id_producto,
    id_usuario,
    tipo_movimiento,
    cantidad_kilos,
    saldo_anterior_kilos,
    saldo_nuevo_kilos,
    referencia_pedido_id,
    observacion
  )
  VALUES (
    p_id_producto_destino,
    p_id_usuario,
    'ENTRADA_TRANSFORMACION',
    v_kilos_destino,
    v_saldo_anterior_destino,
    v_saldo_nuevo_destino,
    NULL,
    COALESCE(
      v_obs_limpia,
      'Empaque al vacío desde ' || v_origen.codigo_sku
    )
  )
  RETURNING id_movimiento INTO v_id_mov_entrada;

  -- 5. Subtabla hija CTI transformaciones_inventario (merma_kilos es GENERATED ALWAYS)
  INSERT INTO public.transformaciones_inventario (
    id_usuario_produccion,
    id_producto_origen,
    id_producto_destino,
    kilos_origen_usados,
    kilos_destino_obtenidos,
    id_movimiento_salida,
    id_movimiento_entrada
  )
  VALUES (
    p_id_usuario,
    p_id_producto_origen,
    p_id_producto_destino,
    v_kilos_origen,
    v_kilos_destino,
    v_id_mov_salida,
    v_id_mov_entrada
  )
  RETURNING id_transformacion, merma_kilos
  INTO v_id_transformacion, v_merma_kilos;

  RETURN jsonb_build_object(
    'id_transformacion', v_id_transformacion,
    'merma_kilos', COALESCE(v_merma_kilos, ROUND(v_kilos_origen - v_kilos_destino, 3)),
    'saldo_nuevo_origen', v_saldo_nuevo_origen,
    'saldo_nuevo_destino', v_saldo_nuevo_destino
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_registrar_transformacion_inventario(
  INT,
  INT,
  INT,
  NUMERIC,
  NUMERIC,
  TEXT
) TO authenticated;

