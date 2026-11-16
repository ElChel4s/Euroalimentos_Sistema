-- ============================================================================
-- EUROALIMENTOS SRL — Diagnóstico y Corrección de Políticas RLS (Auth + CTI)
-- Ejecutar en el SQL Editor de Supabase si el login autentica en auth.users
-- pero falla al leer o vincular public.usuarios / perfiles CTI.
-- ============================================================================

-- 1. Políticas SELECT para usuarios autenticados en supertabla y perfiles CTI
ALTER TABLE IF EXISTS public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.perfil_vendedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.perfil_despachador ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.perfil_produccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.perfil_administrador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select_authenticated" ON public.usuarios;
CREATE POLICY "usuarios_select_authenticated"
  ON public.usuarios
  FOR SELECT
  TO authenticated
  USING (true);

-- Permitir autovinculación inicial (cuando auth_id aún es NULL)
DROP POLICY IF EXISTS "usuarios_link_auth_id_initial" ON public.usuarios;
CREATE POLICY "usuarios_link_auth_id_initial"
  ON public.usuarios
  FOR UPDATE
  TO authenticated
  USING (auth_id IS NULL OR auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

DROP POLICY IF EXISTS "perfil_vendedor_select_authenticated" ON public.perfil_vendedor;
CREATE POLICY "perfil_vendedor_select_authenticated"
  ON public.perfil_vendedor
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "perfil_despachador_select_authenticated" ON public.perfil_despachador;
CREATE POLICY "perfil_despachador_select_authenticated"
  ON public.perfil_despachador
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "perfil_produccion_select_authenticated" ON public.perfil_produccion;
CREATE POLICY "perfil_produccion_select_authenticated"
  ON public.perfil_produccion
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "perfil_administrador_select_authenticated" ON public.perfil_administrador;
CREATE POLICY "perfil_administrador_select_authenticated"
  ON public.perfil_administrador
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Verificación rápida: comparar auth.users con public.usuarios
SELECT
  u.id_usuario,
  u.username,
  u.rol,
  u.activo,
  u.auth_id,
  au.email AS auth_email,
  au.email_confirmed_at
FROM public.usuarios u
LEFT JOIN auth.users au
  ON au.id = u.auth_id
  OR lower(au.email) = lower(u.username || '@euroalimentos.com')
ORDER BY u.id_usuario;

