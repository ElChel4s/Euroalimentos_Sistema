-- ============================================================================
-- EUROALIMENTOS SRL — Migración: Cambio de Contraseña Autorizado + Gestión Usuarios
-- Incluye columna `requiere_cambio_clave` y RPCs SECURITY DEFINER para que
-- el flujo de Login en 2 Pasos y CRUD de Usuarios funcionen con o sin Service Role Key.
-- ============================================================================

-- 1. Columna contractual en supertabla `public.usuarios`
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS requiere_cambio_clave BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- 2. RPC Paso 1 del Login: Verifica usuario sin requerir sesión previa
-- ============================================================================
DROP FUNCTION IF EXISTS public.rpc_verificar_usuario_login(TEXT);

CREATE OR REPLACE FUNCTION public.rpc_verificar_usuario_login(
  p_username TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identificador TEXT;
  v_user RECORD;
BEGIN
  v_identificador := LOWER(TRIM(COALESCE(p_username, '')));
  IF POSITION('@' IN v_identificador) > 0 THEN
    v_identificador := SPLIT_PART(v_identificador, '@', 1);
  END IF;

  IF v_identificador = '' THEN
    RETURN jsonb_build_object(
      'encontrado', FALSE,
      'error', 'Ingrese su nombre de usuario.'
    );
  END IF;

  SELECT
    id_usuario,
    username,
    nombre_completo,
    rol,
    activo,
    COALESCE(requiere_cambio_clave, FALSE) AS requiere_cambio_clave
  INTO v_user
  FROM public.usuarios
  WHERE LOWER(username) = v_identificador
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'encontrado', FALSE,
      'error', 'El usuario ingresado no existe en el sistema.'
    );
  END IF;

  RETURN jsonb_build_object(
    'encontrado', TRUE,
    'id_usuario', v_user.id_usuario,
    'username', v_user.username,
    'nombre_completo', v_user.nombre_completo,
    'rol', v_user.rol,
    'activo', v_user.activo,
    'requiere_cambio_clave', v_user.requiere_cambio_clave
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_verificar_usuario_login(TEXT) TO anon, authenticated;

-- ============================================================================
-- 3. RPC Paso 2B del Login: Completa cambio de clave autorizado antes de entrar
-- ============================================================================
DROP FUNCTION IF EXISTS public.rpc_completar_cambio_clave_login(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_completar_cambio_clave_login(
  p_username TEXT,
  p_nueva_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_identificador TEXT;
  v_user RECORD;
  v_hash TEXT;
  v_email TEXT;
  v_new_auth_id UUID;
BEGIN
  v_identificador := LOWER(TRIM(COALESCE(p_username, '')));
  IF POSITION('@' IN v_identificador) > 0 THEN
    v_identificador := SPLIT_PART(v_identificador, '@', 1);
  END IF;

  IF LENGTH(COALESCE(p_nueva_password, '')) < 6 THEN
    RAISE EXCEPTION 'La nueva contraseña debe tener al menos 6 caracteres.';
  END IF;

  SELECT
    id_usuario,
    auth_id,
    username,
    rol,
    activo,
    COALESCE(requiere_cambio_clave, FALSE) AS requiere_cambio_clave
  INTO v_user
  FROM public.usuarios
  WHERE LOWER(username) = v_identificador
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario ingresado no existe en el sistema.';
  END IF;

  IF v_user.activo IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Esta cuenta se encuentra desactivada. Contacte a Gerencia.';
  END IF;

  IF v_user.requiere_cambio_clave IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Esta cuenta no tiene habilitado un cambio de contraseña pendiente.';
  END IF;

  v_hash := crypt(p_nueva_password, gen_salt('bf'));
  v_email := LOWER(v_user.username) || '@euroalimentos.com';

  -- Actualizar clave en Supabase Auth (auth.users)
  IF v_user.auth_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      encrypted_password = v_hash,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE id = v_user.auth_id;
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = v_hash,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE LOWER(email) = v_email
    RETURNING id INTO v_new_auth_id;

    IF v_new_auth_id IS NOT NULL THEN
      UPDATE public.usuarios
      SET auth_id = v_new_auth_id
      WHERE id_usuario = v_user.id_usuario;
    END IF;
  END IF;

  UPDATE public.usuarios
  SET
    password_hash = v_hash,
    requiere_cambio_clave = FALSE
  WHERE id_usuario = v_user.id_usuario;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'id_usuario', v_user.id_usuario,
    'username', v_user.username,
    'rol', v_user.rol
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_completar_cambio_clave_login(TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- 4. RPC Administrativo: Crear o Editar Usuario + Perfil CTI 1:1
-- ============================================================================
DROP FUNCTION IF EXISTS public.rpc_admin_guardar_usuario(INT, INT, TEXT, TEXT, TEXT, rol_usuario_enum, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_admin_guardar_usuario(
  p_admin_id INT,
  p_id_usuario INT,
  p_nombre_completo TEXT,
  p_username TEXT,
  p_telefono TEXT,
  p_rol rol_usuario_enum,
  p_activo BOOLEAN,
  p_password TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_es_admin BOOLEAN;
  v_username TEXT;
  v_nombre TEXT;
  v_telefono TEXT;
  v_email TEXT;
  v_hash TEXT;
  v_id_usuario INT;
  v_auth_id UUID;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE id_usuario = p_admin_id
      AND rol = 'ADMINISTRADOR'
      AND activo = TRUE
  )
  INTO v_es_admin;

  IF NOT v_es_admin THEN
    RAISE EXCEPTION 'Solo un ADMINISTRADOR activo puede gestionar usuarios.';
  END IF;

  v_username := LOWER(REGEXP_REPLACE(TRIM(COALESCE(p_username, '')), '\s+', '', 'g'));
  v_nombre := TRIM(COALESCE(p_nombre_completo, ''));
  v_telefono := NULLIF(TRIM(COALESCE(p_telefono, '')), '');

  IF v_nombre = '' OR LENGTH(v_username) < 3 THEN
    RAISE EXCEPTION 'El nombre completo y un username válido (mín. 3 caracteres) son obligatorios.';
  END IF;

  v_email := v_username || '@euroalimentos.com';

  IF p_id_usuario IS NULL THEN
    -- Creación de usuario nuevo
    IF LENGTH(COALESCE(p_password, '')) < 6 THEN
      RAISE EXCEPTION 'La contraseña inicial debe tener al menos 6 caracteres.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.usuarios WHERE LOWER(username) = v_username) THEN
      RAISE EXCEPTION 'Ya existe un usuario registrado con el username "%".', v_username;
    END IF;

    v_hash := crypt(p_password, gen_salt('bf'));

    -- Buscar o crear cuenta en auth.users para que pueda iniciar sesión
    SELECT id INTO v_auth_id
    FROM auth.users
    WHERE LOWER(email) = v_email
    LIMIT 1;

    IF v_auth_id IS NULL THEN
      v_auth_id := gen_random_uuid();

      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_auth_id,
        'authenticated',
        'authenticated',
        v_email,
        v_hash,
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
          'rol', p_rol,
          'nombre_completo', v_nombre,
          'username', v_username
        ),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
      );

      INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        v_auth_id,
        v_auth_id::TEXT,
        jsonb_build_object('sub', v_auth_id::TEXT, 'email', v_email),
        'email',
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING;
    ELSE
      UPDATE auth.users
      SET
        encrypted_password = v_hash,
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
          jsonb_build_object('rol', p_rol, 'nombre_completo', v_nombre, 'username', v_username),
        updated_at = NOW()
      WHERE id = v_auth_id;
    END IF;

    -- Si un trigger on_auth_user_created ya insertó en public.usuarios, actualizarlo; si no, insertar
    SELECT id_usuario INTO v_id_usuario
    FROM public.usuarios
    WHERE auth_id = v_auth_id OR LOWER(username) = v_username
    LIMIT 1;

    IF v_id_usuario IS NULL THEN
      INSERT INTO public.usuarios (
        nombre_completo,
        username,
        password_hash,
        telefono,
        rol,
        activo,
        auth_id,
        requiere_cambio_clave
      )
      VALUES (
        v_nombre,
        v_username,
        v_hash,
        v_telefono,
        p_rol,
        p_activo,
        v_auth_id,
        FALSE
      )
      RETURNING id_usuario INTO v_id_usuario;
    ELSE
      UPDATE public.usuarios
      SET
        nombre_completo = v_nombre,
        telefono = v_telefono,
        rol = p_rol,
        activo = p_activo,
        password_hash = v_hash,
        auth_id = COALESCE(auth_id, v_auth_id)
      WHERE id_usuario = v_id_usuario;
    END IF;
  ELSE
    -- Edición de usuario existente
    IF p_id_usuario = p_admin_id AND p_activo IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'No puedes desactivar tu propia cuenta de administrador.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE LOWER(username) = v_username AND id_usuario <> p_id_usuario
    ) THEN
      RAISE EXCEPTION 'Otro usuario ya utiliza el username "%".', v_username;
    END IF;

    UPDATE public.usuarios
    SET
      nombre_completo = v_nombre,
      username = v_username,
      telefono = v_telefono,
      rol = p_rol,
      activo = p_activo
    WHERE id_usuario = p_id_usuario
    RETURNING id_usuario, auth_id INTO v_id_usuario, v_auth_id;

    IF v_id_usuario IS NULL THEN
      RAISE EXCEPTION 'No se encontró el usuario #% para actualizar.', p_id_usuario;
    END IF;

    IF TRIM(COALESCE(p_password, '')) <> '' THEN
      IF LENGTH(p_password) < 6 THEN
        RAISE EXCEPTION 'Si cambias la contraseña, debe tener al menos 6 caracteres.';
      END IF;
      v_hash := crypt(p_password, gen_salt('bf'));

      UPDATE public.usuarios
      SET password_hash = v_hash, requiere_cambio_clave = FALSE
      WHERE id_usuario = v_id_usuario;

      IF v_auth_id IS NOT NULL THEN
        UPDATE auth.users
        SET encrypted_password = v_hash, updated_at = NOW()
        WHERE id = v_auth_id;
      END IF;
    END IF;

    IF v_auth_id IS NOT NULL THEN
      UPDATE auth.users
      SET
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
          jsonb_build_object('rol', p_rol, 'id_usuario', v_id_usuario, 'nombre_completo', v_nombre, 'username', v_username),
        updated_at = NOW()
      WHERE id = v_auth_id;
    END IF;
  END IF;

  -- Asegurar subtabla CTI 1:1 correspondiente al rol
  IF p_rol = 'VENDEDOR' THEN
    INSERT INTO public.perfil_vendedor (id_usuario, codigo_vendedor, porcentaje_comision, meta_diaria_kilos, permite_venta_sin_stock)
    VALUES (v_id_usuario, 'VND-' || LPAD(v_id_usuario::TEXT, 3, '0'), 0.00, 150.000, TRUE)
    ON CONFLICT (id_usuario) DO NOTHING;
  ELSIF p_rol = 'DESPACHADOR' THEN
    INSERT INTO public.perfil_despachador (id_usuario, identificador_balanza, impresora_termica_modelo, ancho_papel_mm, autorizado_cortesias)
    VALUES (v_id_usuario, 'BALANZA-GANCHO-01', 'EPSON-TM-T20', 80, TRUE)
    ON CONFLICT (id_usuario) DO NOTHING;
  ELSIF p_rol = 'PRODUCCION' THEN
    INSERT INTO public.perfil_produccion (id_usuario, turno_planta, responsable_camara_frio, tolerancia_merma_max_pct)
    VALUES (v_id_usuario, 'MAÑANA', TRUE, 5.00)
    ON CONFLICT (id_usuario) DO NOTHING;
  ELSIF p_rol = 'ADMINISTRADOR' THEN
    INSERT INTO public.perfil_administrador (id_usuario, cargo_gerencial, puede_anular_despachos, puede_exportar_sac)
    VALUES (v_id_usuario, 'Administración General', TRUE, TRUE)
    ON CONFLICT (id_usuario) DO NOTHING;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'id_usuario', u.id_usuario,
      'nombre_completo', u.nombre_completo,
      'username', u.username,
      'telefono', u.telefono,
      'rol', u.rol,
      'activo', u.activo,
      'requiere_cambio_clave', COALESCE(u.requiere_cambio_clave, FALSE)
    )
    FROM public.usuarios u
    WHERE u.id_usuario = v_id_usuario
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_guardar_usuario(
  INT, INT, TEXT, TEXT, TEXT, rol_usuario_enum, BOOLEAN, TEXT
) TO authenticated;

