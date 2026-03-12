-- ══════════════════════════════════════════════════════════════════
-- CitaLink: DIAGNÓSTICO PROFUNDO DE RLS Y VISTAS
-- ══════════════════════════════════════════════════════════════════

-- 1. Verificar si RLS está habilitado en las tablas base
SELECT 
    relname as tabla, 
    relrowsecurity as rls_habilitado
FROM pg_class 
WHERE relname IN ('clients', 'appointments', 'services') 
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Ver las políticas actuales de CLIENTES
SELECT * FROM pg_policies WHERE tablename = 'clients';

-- 3. Ver las políticas actuales de CITAS
SELECT * FROM pg_policies WHERE tablename = 'appointments';

-- 4. Verificar qué ve la vista para el rol PUBLIC/AUTHENTICATED
-- (Simulamos una consulta sin filtros para ver si devuelve algo)
SELECT COUNT(*) FROM public.client_summaries;

-- 5. Detectar discrepancias de TenantID
-- Ver qué IDs de negocio existen realmente en la tabla de clientes
SELECT DISTINCT tenant_id FROM public.clients LIMIT 10;
