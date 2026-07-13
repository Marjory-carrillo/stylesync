-- ══════════════════════════════════════════════════════════════════
-- CitaLink: Catálogo de Diseños / Galería por Servicio
-- EJECUTA ESTE SCRIPT en el SQL Editor de Supabase (una sola vez)
-- ══════════════════════════════════════════════════════════════════

-- 1. Crear la tabla de ítems del catálogo
CREATE TABLE IF NOT EXISTS public.catalog_items (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    service_id  INT  REFERENCES services(id) ON DELETE SET NULL,  -- NULL = catálogo general
    stylist_id  INT  REFERENCES stylists(id) ON DELETE CASCADE,   -- NULL = catálogo del negocio
    title       TEXT,
    description TEXT,
    image_url   TEXT NOT NULL,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar Row Level Security
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas previas si existen
DROP POLICY IF EXISTS "Catálogo por Tenant (Admin)" ON public.catalog_items;
DROP POLICY IF EXISTS "Catálogo lectura pública" ON public.catalog_items;

-- 4. Política: Administradores del negocio pueden hacer todo (INSERT/UPDATE/DELETE)
CREATE POLICY "Catálogo por Tenant (Admin)"
ON public.catalog_items
FOR ALL
USING (
    tenant_id IN (SELECT get_user_tenants())
)
WITH CHECK (
    tenant_id IN (SELECT get_user_tenants())
);

-- 5. Política: Las clientas (anónimos) solo pueden leer
CREATE POLICY "Catálogo lectura pública"
ON public.catalog_items
FOR SELECT
USING (true);

-- 6. Permisos de roles de Supabase
GRANT SELECT ON public.catalog_items TO anon;
GRANT ALL ON public.catalog_items TO authenticated;
GRANT ALL ON public.catalog_items TO service_role;

-- 7. Índices para mejorar rendimiento de consultas por tenant y servicio
CREATE INDEX IF NOT EXISTS idx_catalog_items_tenant ON public.catalog_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_service ON public.catalog_items(tenant_id, service_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_stylist ON public.catalog_items(tenant_id, stylist_id);
