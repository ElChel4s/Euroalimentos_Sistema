-- ============================================================================
-- EUROALIMENTOS SRL — RPC Transaccional: Anulación de Pedido por Rebote (CTI)
-- Requerimientos: RF-15, CU-A02, RNF-03
-- Tablas afectadas: pedidos, detalle_pedidos, productos, movimientos_kardex,
--                   anulaciones_pedido
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_anular_pedido_rebote(INT, INT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_anular_pedido_rebote(
  p_id_pedido INT,
  p_id_administrador INT,
  p_motivo_rebote TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_motivo_limpio TEXT;
  v_puede_anular BOOLEAN;
  v_pedido RECORD;
  v_det RECORD;
  v_kilos NUMERIC(12, 3);
  v_saldo_anterior NUMERIC(12, 3);
  v_saldo_nuevo NUMERIC(12, 3);
  v_total_reingresado NUMERIC(12, 3) := 0;
  v_id_movimiento_ultimo BIGINT := NULL;
  v_id_anulacion INT;
  v_obs_kardex TEXT;
BEGIN
  -- 1. Validaciones iniciales
  IF p_id_pedido IS NULL OR p_id_pedido <= 0 THEN
    RAISE EXCEPTION 'Identificador de pedido inválido.';
  END IF;

  IF p_id_administrador IS NULL OR p_id_administrador <= 0 THEN
    RAISE EXCEPTION 'Identificador de administrador inválido.';
  END IF;

  v_motivo_limpio := TRIM(COALESCE(p_motivo_rebote, ''));
  IF LENGTH(v_motivo_limpio) < 5 THEN
    RAISE EXCEPTION 'El motivo de rebote debe tener al menos 5 caracteres.';
  END IF;

  SELECT puede_anular_despachos
  INTO v_puede_anular
  FROM public.perfil_administrador
  WHERE id_usuario = p_id_administrador;

  IF NOT FOUND OR v_puede_anular IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'El usuario % no tiene autorización para anular despachos por rebote.', p_id_administrador;
  END IF;

  -- 2. Bloquear pedido y validar estado DESPACHADO
  SELECT id_pedido, nro_nota_venta, estado
  INTO v_pedido
  FROM public.pedidos
  WHERE id_pedido = p_id_pedido
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido % no existe.', p_id_pedido;
  END IF;

  IF v_pedido.estado <> 'DESPACHADO' THEN
    RAISE EXCEPTION 'Solo se pueden anular pedidos en estado DESPACHADO (estado actual: %).', v_pedido.estado;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.anulaciones_pedido
    WHERE id_pedido = p_id_pedido
  ) THEN
    RAISE EXCEPTION 'El pedido % ya cuenta con una anulación registrada.', p_id_pedido;
  END IF;

  v_obs_kardex := 'Rebote Nota N° ' || COALESCE(v_pedido.nro_nota_venta::TEXT, p_id_pedido::TEXT) || ': ' || v_motivo_limpio;

  -- 3. Recorrer líneas ordenadas determinísticamente por id_producto para evitar deadlocks
  FOR v_det IN
    SELECT id_detalle, id_producto, kilos_reales, kilos_estimados
    FROM public.detalle_pedidos
    WHERE id_pedido = p_id_pedido
    ORDER BY id_producto ASC, id_detalle ASC
  LOOP
    v_kilos := ROUND(COALESCE(v_det.kilos_reales, v_det.kilos_estimados, 0)::NUMERIC, 3);

    IF v_kilos > 0 THEN
      SELECT COALESCE(stock_fisico_kilos, 0)::NUMERIC(12, 3)
      INTO v_saldo_anterior
      FROM public.productos
      WHERE id_producto = v_det.id_producto
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % asociado al detalle % no encontrado.', v_det.id_producto, v_det.id_detalle;
      END IF;

      v_saldo_nuevo := ROUND(v_saldo_anterior + v_kilos, 3);

      UPDATE public.productos
      SET stock_fisico_kilos = v_saldo_nuevo
      WHERE id_producto = v_det.id_producto;

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
        v_det.id_producto,
        p_id_administrador,
        'REINGRESO_ANULACION',
        v_kilos,
        v_saldo_anterior,
        v_saldo_nuevo,
        p_id_pedido,
        v_obs_kardex
      )
      RETURNING id_movimiento INTO v_id_movimiento_ultimo;

      v_total_reingresado := ROUND(v_total_reingresado + v_kilos, 3);
    END IF;
  END LOOP;

  -- 4. Soft Delete en pedidos + registro en subtabla CTI anulaciones_pedido
  UPDATE public.pedidos
  SET estado = 'ANULADO'
  WHERE id_pedido = p_id_pedido;

  INSERT INTO public.anulaciones_pedido (
    id_pedido,
    id_administrador,
    motivo_rebote,
    kilos_reingresados_total,
    id_movimiento_reingreso
  )
  VALUES (
    p_id_pedido,
    p_id_administrador,
    v_motivo_limpio,
    v_total_reingresado,
    v_id_movimiento_ultimo
  )
  RETURNING id_anulacion INTO v_id_anulacion;

  RETURN jsonb_build_object(
    'id_anulacion', v_id_anulacion,
    'kilos_reingresados_total', v_total_reingresado
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_anular_pedido_rebote(
  INT,
  INT,
  TEXT
) TO authenticated;

