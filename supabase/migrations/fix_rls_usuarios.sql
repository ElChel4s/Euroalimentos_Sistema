-- ============================================================================
-- EUROALIMENTOS S.R.L. — Política RLS segura para public.usuarios y perfiles CTI
-- Permite a cada usuario autenticado leer su propia fila (`auth.uid() = auth_id`)
-- y su perfil especializado 1:1 tras resiembras o cambios de sesión.
-- ============================================================================

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select_propio" ON public.usuarios;
CREATE POLICY "usuarios_select_propio"
ON public.usuarios
FOR SELECT
TO authenticated
USING (auth.uid() = auth_id);

-- Políticas SELECT propias para subtablas CTI 1:1
ALTER TABLE IF EXISTS public.perfil_vendedor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perfil_vendedor_select_propio" ON public.perfil_vendedor;
CREATE POLICY "perfil_vendedor_select_propio"
ON public.perfil_vendedor
FOR SELECT
TO authenticated
USING (
  id_usuario IN (
    SELECT u.id_usuario
    FROM public.usuarios u
    WHERE u.auth_id = auth.uid()
  )
);

ALTER TABLE IF EXISTS public.perfil_despachador ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perfil_despachador_select_propio" ON public.perfil_despachador;
CREATE POLICY "perfil_despachador_select_propio"
ON public.perfil_despachador
FOR SELECT
TO authenticated
USING (
  id_usuario IN (
    SELECT u.id_usuario
    FROM public.usuarios u
    WHERE u.auth_id = auth.uid()
  )
);

ALTER TABLE IF EXISTS public.perfil_produccion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perfil_produccion_select_propio" ON public.perfil_produccion;
CREATE POLICY "perfil_produccion_select_propio"
ON public.perfil_produccion
FOR SELECT
TO authenticated
USING (
  id_usuario IN (
    SELECT u.id_usuario
    FROM public.usuarios u
    WHERE u.auth_id = auth.uid()
  )
);

ALTER TABLE IF EXISTS public.perfil_administrador ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perfil_administrador_select_propio" ON public.perfil_administrador;
CREATE POLICY "perfil_administrador_select_propio"
ON public.perfil_administrador
FOR SELECT
TO authenticated
USING (
  id_usuario IN (
    SELECT u.id_usuario
    FROM public.usuarios u
    WHERE u.auth_id = auth.uid()
  )
);
