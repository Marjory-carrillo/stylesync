-- ============================================================
-- DIAGNÓSTICO Y FIX: Nova Salon
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- PASO 1: Ver el estado actual del tenant Nova Salon
SELECT 
    t.id as tenant_id,
    t.name,
    t.slug,
    t.owner_id,
    t.created_at
FROM tenants t
WHERE LOWER(t.name) LIKE '%nova%salon%' OR LOWER(t.name) LIKE '%nova salon%';

-- PASO 2: Ver qué hay en tenant_users relacionado a Nova Salon
SELECT 
    tu.id,
    tu.tenant_id,
    tu.email,
    tu.role,
    tu.user_id,
    t.name as business_name
FROM tenant_users tu
JOIN tenants t ON t.id = tu.tenant_id
WHERE LOWER(t.name) LIKE '%nova%' OR LOWER(t.name) LIKE '%nova salon%';

-- PASO 3: Ver el usuario Auth que tiene el correo CORRECTO
-- (Reemplaza 'correo_correcto@ejemplo.com' con el email real)
-- Esta consulta se debe ejecutar en auth.users (requiere service role)
-- En su lugar, busca por todos los usuarios recientes:
SELECT 
    au.id as auth_user_id,
    au.email,
    au.created_at,
    au.user_metadata
FROM auth.users au
WHERE au.created_at > NOW() - INTERVAL '7 days'
ORDER BY au.created_at DESC;

-- PASO 4: FIX - Actualizar el owner_id del tenant para apuntar al usuario correcto
-- DESCOMENTA y ejecuta SOLO después de identificar los IDs correctos en los pasos anteriores:
--
-- UPDATE tenants 
-- SET owner_id = '<AUTH_USER_ID_DEL_CORREO_CORRECTO>'
-- WHERE id = '<TENANT_ID_DE_NOVA_SALON>';
--
-- UPDATE tenant_users
-- SET user_id = '<AUTH_USER_ID_DEL_CORREO_CORRECTO>'
-- WHERE tenant_id = '<TENANT_ID_DE_NOVA_SALON>'
--   AND role = 'owner';
