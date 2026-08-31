-- ══════════════════════════════════════════════════════════════════
-- CitaLink: Tabla, Permisos y RLS para Historial de Cotizaciones (quotes)
-- EJECUTA ESTE SCRIPT en el SQL Editor de Supabase
-- ══════════════════════════════════════════════════════════════════

-- 1. Crear tabla de cotizaciones si no existe
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    service_id BIGINT REFERENCES public.services(id) ON DELETE SET NULL,
    stylist_id BIGINT REFERENCES public.stylists(id) ON DELETE SET NULL,
    client_name TEXT,
    client_phone TEXT,
    size_id TEXT,
    size_name TEXT,
    styles JSONB DEFAULT '[]'::jsonb,
    extras JSONB DEFAULT '[]'::jsonb,
    reference_image_url TEXT,
    total_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_duration INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'agendada', 'cancelada')),
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de optimización
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_id ON public.quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON public.quotes(created_at DESC);

-- 2. Otorgar permisos a los roles de PostgreSQL / Supabase
GRANT ALL ON TABLE public.quotes TO authenticated;
GRANT ALL ON TABLE public.quotes TO anon;
GRANT ALL ON TABLE public.quotes TO service_role;

-- 3. Habilitar RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar políticas anteriores para evitar conflictos
DROP POLICY IF EXISTS "quotes_tenant_isolation" ON public.quotes;
DROP POLICY IF EXISTS "quotes_public_read" ON public.quotes;
DROP POLICY IF EXISTS "quotes_public_update_booked" ON public.quotes;
DROP POLICY IF EXISTS "quotes_tenant_select" ON public.quotes;
DROP POLICY IF EXISTS "quotes_tenant_insert" ON public.quotes;
DROP POLICY IF EXISTS "quotes_tenant_update" ON public.quotes;
DROP POLICY IF EXISTS "quotes_tenant_delete" ON public.quotes;
DROP POLICY IF EXISTS "quotes_public_select" ON public.quotes;

-- 5. Política para miembros autenticados del negocio (CRUD completo)
CREATE POLICY "quotes_tenant_isolation"
ON public.quotes
FOR ALL
TO authenticated
USING (
    tenant_id IN (SELECT get_user_tenants())
)
WITH CHECK (
    tenant_id IN (SELECT get_user_tenants())
);

-- 6. Política pública para que clientas puedan leer la cotización por link
CREATE POLICY "quotes_public_read"
ON public.quotes
FOR SELECT
USING (true);

-- 7. Política pública para marcar la cotización como agendada
CREATE POLICY "quotes_public_update_booked"
ON public.quotes
FOR UPDATE
USING (status = 'pendiente')
WITH CHECK (status = 'agendada');
