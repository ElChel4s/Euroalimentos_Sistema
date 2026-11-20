-- ============================================================================
-- EUROALIMENTOS SRL — RPC Transaccional: Ingreso de Lote de Producción (CTI)
-- Requerimientos: RF-11, CU-P01
--Tablas afectadas: productos, movimientos_kardex, lotes_produccion
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_registrar_lote_produccion(INT, INT, VARCHAR, NUMERIC, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_registrar_lote_produccion(
  p_id_producto INT,
  p_id_usuario_produccion INT,
  p_codigo_lote_interno VARCHAR,
  p_kilos_producidos NUMERIC,
  p_fecha_elaboracion DATE,
  p_observacion TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_anterior NUMERIC(12, 3);
  v_saldo_nuevo NUMERIC(12, 3);
  v_kilos NUMERIC(12, 3);
  v_codigo_lote VARCHAR;
  v_id_movimiento BIGINT;
  v_id_lote INT;
  v_tiene_perfil_produccion BOOLEAN;
BEGIN
  -- 1. Validaciones de entrada
  IF p_id_producto IS NULL OR p_id_producto <= 0 THEN
    RAISE EXCEPTION 'Producto inválido para ingreso de lote.';
  END IF;

  IF p_id_usuario_produccion IS NULL OR p_id_usuario_produccion <= 0 THEN
    RAISE EXCEPTION 'Usuario de producción inválido.';
  END IF;

  v_codigo_lote := UPPER(TRIM(COALESCE(p_codigo_lote_interno, '')));
  IF LENGTH(v_codigo_lote) < 3 THEN
    RAISE EXCEPTION 'El código de lote interno debe tener al menos 3 caracteres.';
  END IF;

  IF p_kilos_producidos IS NULL OR p_kilos_producidos <= 0 THEN
    RAISE EXCEPTION 'La cantidad de kilos producidos debe ser mayor a 0.000 kg.';
  END IF;

  v_kilos := ROUND(p_kilos_producidos, 3);
  IF v_kilos <= 0 THEN
    RAISE EXCEPTION 'La cantidad redondeada a 3 decimales debe ser mayor a 0.000 kg.';
  END IF;

  IF p_fecha_elaboracion IS NULL THEN
    RAISE EXCEPTION 'La fecha de elaboración es obligatoria.';
  END IF;

  -- Verificar pertenencia a subtabla CTI perfil_produccion (FK de lotes_produccion)
  SELECT EXISTS (
    SELECT 1
    FROM public.perfil_produccion
    WHERE id_usuario = p_id_usuario_produccion
  )
  INTO v_tiene_perfil_produccion;

  IF NOT v_tiene_perfil_produccion THEN
    RAISE EXCEPTION 'El usuario % no posee un perfil CTI activo en perfil_produccion.', p_id_usuario_produccion;
  END IF;

  -- 2. Bloquear fila del producto en cámara (FOR UPDATE)
  SELECT COALESCE(stock_fisico_kilos, 0)::NUMERIC(12, 3)
  INTO v_saldo_anterior
  FROM public.productos
  WHERE id_producto = p_id_producto
    AND activo = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto % no existe o se encuentra inactivo.', p_id_producto;
  END IF;

  -- 3. Calcular y actualizar stock físico (stock_disponible_kilos es columna generada)
  v_saldo_nuevo := ROUND(v_saldo_anterior + v_kilos, 3);

  UPDATE public.productos
  SET stock_fisico_kilos = v_saldo_nuevo
  WHERE id_producto = p_id_producto;

  -- 4. Registrar asiento supertabla CTI en movimientos_kardex
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
    p_id_producto,
    p_id_usuario_produccion,
    'INGRESO_PRODUCCION',
    v_kilos,
    v_saldo_anterior,
    v_saldo_nuevo,
    NULL,
    COALESCE(
      NULLIF(TRIM(p_observacion), ''),
      'Ingreso de lote ' || v_codigo_lote
    )
  )
  RETURNING id_movimiento INTO v_id_movimiento;

  -- 5. Registrar subtabla hija CTI 1:1 en lotes_produccion
  INSERT INTO public.lotes_produccion (
    id_movimiento,
    id_usuario_produccion,
    codigo_lote_interno,
    kilos_producidos,
    fecha_elaboracion
  )
  VALUES (
    v_id_movimiento,
    p_id_usuario_produccion,
    v_codigo_lote,
    v_kilos,
    p_fecha_elaboracion
  )
  RETURNING id_lote INTO v_id_lote;

  RETURN jsonb_build_object(
    'id_lote', v_id_lote,
    'id_movimiento', v_id_movimiento,
    'saldo_nuevo', v_saldo_nuevo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_registrar_lote_produccion(
  INT,
  INT,
  VARCHAR,
  NUMERIC,
  DATE,
  TEXT
) TO authenticated;

