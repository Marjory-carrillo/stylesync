-- ══════════════════════════════════════════════════════════════════
-- CitaLink: CORRECCIÓN de políticas RLS (fix del error auth.users)
-- EJECUTA TODO ESTE SCRIPT en el SQL Editor de Supabase
-- ══════════════════════════════════════════════════════════════════

-- ─── PASO 1: Eliminar la política problemática que hacía subquery a auth.users
DROP POLICY IF EXISTS "Employees can read their own record" ON public.tenant_users;
DROP POLICY IF EXISTS "System can update user_id" ON public.tenant_users;

-- ─── PASO 2: Recrear la política correcta usando auth.email() (built-in de Supabase)
-- auth.email() devuelve el email del usuario autenticado sin necesitar acceso directo a auth.users
CREATE POLICY "Employees can read their own record"
ON public.tenant_users
FOR SELECT
USING (
    user_id = auth.uid()
    OR LOWER(TRIM(email)) = LOWER(TRIM(auth.email()))
);

-- ─── PASO 3: Política de UPDATE solo para el RPC (SECURITY DEFINER ya bypasea RLS,
-- pero la añadimos para que el owner también pueda hacer updates si fuera necesario)
CREATE POLICY "Owners can update their team"
ON public.tenant_users
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = tenant_users.tenant_id
          AND t.owner_id = auth.uid()
    )
);

-- ─── PASO 4: Vinculación de seguridad — asegurarse que todos los usuarios tienen user_id
UPDATE public.tenant_users tu
SET user_id = au.id
FROM auth.users au
WHERE LOWER(TRIM(tu.email)) = LOWER(TRIM(au.email))
  AND tu.user_id IS NULL;

-- ─── PASO 5: Verificación final
SELECT 
    tu.email,
    tu.role,
    CASE WHEN tu.user_id IS NOT NULL THEN '✅ Vinculado' ELSE '❌ Sin vincular' END AS status,
    tu.stylist_id
FROM public.tenant_users tu
ORDER BY tu.created_at DESC;
