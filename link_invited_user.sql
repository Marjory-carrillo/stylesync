-- ══════════════════════════════════════════════════════════════════
-- CitaLink: RPC link_invited_user
-- Pega este SQL en el SQL Editor de Supabase y presiona RUN
-- ══════════════════════════════════════════════════════════════════

-- 1. Crear la función que enlaza automáticamente el email del empleado
--    con su user_id de Supabase Auth cuando hace login por primera vez.
CREATE OR REPLACE FUNCTION public.link_invited_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id  uuid;
    v_email    text;
BEGIN
    -- Obtener el ID del usuario autenticado actual
    v_user_id := auth.uid();

    -- Obtener su email desde auth.users
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = v_user_id;

    -- Vincular el user_id en tenant_users donde el email coincida
    -- y aún no tenga un user_id asignado
    UPDATE public.tenant_users
    SET user_id = v_user_id
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email))
      AND user_id IS NULL;
END;
$$;

-- 2. Dar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.link_invited_user() TO authenticated;

-- 3. Asegurarse de que la columna user_id existe (por si no estuviera)
ALTER TABLE public.tenant_users
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Verifica que todo quedó bien
SELECT id, email, role, stylist_id, user_id
FROM public.tenant_users
LIMIT 10;
