-- ================================================================
-- CORRECCIÓN: permission denied for table tenant_users
-- Al confirmar cita como cliente público (anónimo), Supabase
-- rechaza el acceso a tenant_users porque no tiene política SELECT.
--
-- Solución: La tabla tenant_users debe tener RLS habilitado con
-- una política que permita a usuarios autenticados leer SUS propios
-- registros (para el login de empleados) y bloquee todo lo demás.
--
-- El error en el booking se origina porque la función
-- get_user_tenants() o create_appointment_v3 acceden a tenant_users
-- sin SECURITY DEFINER. La corrección está en dos partes:
--
-- 1. Asegurarnos que RLS está habilitado correctamente en tenant_users
-- 2. Permitir que usuarios autenticados lean sus propios registros
-- ================================================================

-- Habilitar RLS en tenant_users (por si no estaba)
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas antiguas si existen
DROP POLICY IF EXISTS "Tenant members read own record" ON tenant_users;
DROP POLICY IF EXISTS "Authenticated users read their own tenant_user" ON tenant_users;
DROP POLICY IF EXISTS "tenant_users_select_own" ON tenant_users;
DROP POLICY IF EXISTS "Public read tenant_users" ON tenant_users;

-- Política 1: Un usuario autenticado puede leer SOLO su propio registro
-- (necesario para que App.tsx pueda buscar el rol del empleado al iniciar sesión)
CREATE POLICY "tenant_users_select_own"
ON tenant_users
FOR SELECT
USING (
    auth.email() = email
    OR is_super_admin()
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
);

-- Política 2: Solo el owner del tenant o super admin puede insertar/modificar/borrar
CREATE POLICY "tenant_users_manage"
ON tenant_users
FOR ALL
USING (
    is_super_admin()
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
)
WITH CHECK (
    is_super_admin()
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
);

-- ================================================================
-- CORRECCIÓN ADICIONAL: La función get_user_tenants necesita
-- poder acceder a tenant_users aunque se ejecute bajo un usuario
-- anónimo. La ponemos en SECURITY DEFINER para que corra con
-- permisos del propietario de la función (postgres).
-- ================================================================

-- Verificar si la función existe y recrearla con SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_user_tenants()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    -- Devuelve los tenant_ids donde el usuario es dueño
    SELECT id FROM tenants WHERE owner_id = auth.uid()
    UNION
    -- O donde es empleado/admin registrado por email
    SELECT tenant_id FROM tenant_users WHERE email = auth.email()
$$;

-- Verificación: muestra las políticas activas sobre tenant_users
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tenant_users';
