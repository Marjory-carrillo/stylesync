-- ============================================================
-- Migration 30: Asegurar buckets de Storage y políticas RLS
-- ============================================================

-- Crear buckets públicos si no existen
INSERT INTO storage.buckets (id, name, public)
VALUES
    ('services', 'services', true),
    ('stylists', 'stylists', true),
    ('logos',    'logos',    true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ── Políticas para bucket "services" ──────────────────────
-- Cualquier usuario autenticado puede subir
DROP POLICY IF EXISTS "services_upload" ON storage.objects;
CREATE POLICY "services_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'services');

-- Actualizar (upsert)
DROP POLICY IF EXISTS "services_update" ON storage.objects;
CREATE POLICY "services_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'services');

-- Lectura pública
DROP POLICY IF EXISTS "services_read" ON storage.objects;
CREATE POLICY "services_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'services');

-- ── Políticas para bucket "stylists" ──────────────────────
DROP POLICY IF EXISTS "stylists_upload" ON storage.objects;
CREATE POLICY "stylists_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'stylists');

DROP POLICY IF EXISTS "stylists_update" ON storage.objects;
CREATE POLICY "stylists_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'stylists');

DROP POLICY IF EXISTS "stylists_read" ON storage.objects;
CREATE POLICY "stylists_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'stylists');

-- ── Políticas para bucket "logos" ─────────────────────────
DROP POLICY IF EXISTS "logos_upload" ON storage.objects;
CREATE POLICY "logos_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_update" ON storage.objects;
CREATE POLICY "logos_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_read" ON storage.objects;
CREATE POLICY "logos_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'logos');
