-- ══════════════════════════════════════════════════════════════════
-- CitaLink: Módulo de Días de Promoción y Precios Especiales
-- EJECUTA ESTE SCRIPT en el SQL Editor de Supabase
-- Cumple con todas las normas de seguridad RLS e InitPlan Caching
-- ══════════════════════════════════════════════════════════════════

-- 1. Recrear la tabla de promociones de forma limpia
DROP TABLE IF EXISTS public.promotions CASCADE;

CREATE TABLE public.promotions (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id           UUID NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    discount_type       TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_discount', 'fixed_price')),
    discount_value      NUMERIC NOT NULL CHECK (discount_value >= 0),
    days_of_week        TEXT[] NOT NULL DEFAULT '{}', -- ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    service_ids         BIGINT[] NOT NULL DEFAULT '{}', -- IDs de servicios a los que aplica (vacío = aplica a todos)
    commission_policy   TEXT NOT NULL DEFAULT 'charged_price' CHECK (commission_policy IN ('charged_price', 'regular_price')),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Añadir columna final_price_charged a la tabla appointments (si no existe)
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS final_price_charged NUMERIC DEFAULT NULL;

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar políticas previas para garantizar idempotencia
DROP POLICY IF EXISTS promotions_select_public ON public.promotions;
DROP POLICY IF EXISTS promotions_insert_tenant ON public.promotions;
DROP POLICY IF EXISTS promotions_update_tenant ON public.promotions;
DROP POLICY IF EXISTS promotions_delete_tenant ON public.promotions;
DROP POLICY IF EXISTS "Promociones lectura publica" ON public.promotions;
DROP POLICY IF EXISTS "Promociones insercion tenant" ON public.promotions;
DROP POLICY IF EXISTS "Promociones actualizacion tenant" ON public.promotions;
DROP POLICY IF EXISTS "Promociones eliminacion tenant" ON public.promotions;

-- 5. Crear políticas RLS desacopladas con InitPlan Caching
-- Lectura pública (para clientes en el flujo de reserva y catálogo)
CREATE POLICY promotions_select_public
ON public.promotions
FOR SELECT
USING (true);

-- Inserción exclusiva para administradores autenticados del tenant o superadmin
CREATE POLICY promotions_insert_tenant
ON public.promotions
FOR INSERT
TO authenticated
WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenants()) 
    OR public.is_super_admin()
);

-- Actualización exclusiva para administradores autenticados del tenant o superadmin
CREATE POLICY promotions_update_tenant
ON public.promotions
FOR UPDATE
TO authenticated
USING (
    tenant_id IN (SELECT public.get_user_tenants()) 
    OR public.is_super_admin()
)
WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenants()) 
    OR public.is_super_admin()
);

-- Eliminación exclusiva para administradores autenticados del tenant o superadmin
CREATE POLICY promotions_delete_tenant
ON public.promotions
FOR DELETE
TO authenticated
USING (
    tenant_id IN (SELECT public.get_user_tenants()) 
    OR public.is_super_admin()
);

-- 6. Permisos de roles de Supabase
GRANT SELECT ON public.promotions TO anon;
GRANT ALL ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;

-- 7. Índices para acelerar el rendimiento por tenant y estado activo
CREATE INDEX IF NOT EXISTS idx_promotions_tenant ON public.promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(tenant_id, is_active);

-- 8. Notificar a PostgREST para refrescar inmediatamente la caché de esquema
NOTIFY pgrst, 'reload schema';
