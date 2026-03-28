-- ================================================================
-- CORRECCIÓN RLS — FASE 2
-- Las 4 políticas ALL:true que quedaron pendientes
-- Ejecutar en Supabase SQL Editor
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. ANNOUNCEMENTS
-- "Allow All Announcements" ALL = true → Cualquiera puede crear/borrar anuncios
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow All Announcements" ON announcements;

-- Lectura pública (los clientes ven los anuncios del negocio al reservar)
CREATE POLICY "Public read announcements" ON announcements
    FOR SELECT
    USING (true);

-- Solo miembros autenticados del tenant pueden gestionar anuncios
CREATE POLICY "Tenant members manage announcements" ON announcements
    FOR ALL
    USING (
        is_super_admin() OR
        tenant_id IN (SELECT get_user_tenants() AS get_user_tenants)
    )
    WITH CHECK (
        is_super_admin() OR
        tenant_id IN (SELECT get_user_tenants() AS get_user_tenants)
    );


-- ────────────────────────────────────────────────────────────────
-- 2. BRANDING_THEMES
-- "Admin total temas" ALL = true → Cualquiera puede modificar temas de branding
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin total temas" ON branding_themes;

-- Solo Super Admin puede gestionar los temas de branding
CREATE POLICY "Super admin manages branding themes" ON branding_themes
    FOR ALL
    USING (is_super_admin())
    WITH CHECK (is_super_admin());


-- ────────────────────────────────────────────────────────────────
-- 3. GLOBAL_CONFIGS
-- "Admin total config" ALL = true → Cualquiera puede modificar la config global
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin total config" ON global_configs;

-- Solo Super Admin puede modificar la configuración global del sistema
CREATE POLICY "Super admin manages global config" ON global_configs
    FOR ALL
    USING (is_super_admin())
    WITH CHECK (is_super_admin());


-- ────────────────────────────────────────────────────────────────
-- 4. LEADS
-- "Permitir lectura para admins" SELECT = true → Cualquiera puede ver prospectos
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Permitir lectura para admins" ON leads;

-- Solo Super Admin puede leer los leads/prospectos
CREATE POLICY "Super admin reads leads" ON leads
    FOR SELECT
    USING (is_super_admin());


-- ================================================================
-- VERIFICACIÓN FINAL — Debe mostrar solo SELECT:true (no ALL:true)
-- ================================================================
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'
ORDER BY tablename;
