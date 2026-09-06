-- Migración 65: Tabla de Errores y Monitoreo del Sistema (Sentry -> SuperAdmin)
CREATE TABLE IF NOT EXISTS public.system_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    event_id VARCHAR(100),
    error_name VARCHAR(255),
    error_message TEXT,
    stack_trace TEXT,
    url TEXT,
    user_device TEXT,
    user_browser TEXT,
    user_os TEXT,
    breadcrumbs JSONB DEFAULT '[]'::jsonb,
    sentry_url TEXT,
    resolved BOOLEAN DEFAULT false
);

-- Permisos para roles de Supabase (anon, authenticated, service_role)
GRANT ALL ON TABLE public.system_errors TO postgres, service_role, authenticated, anon;

-- Habilitar RLS
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

-- Política de acceso total para lectura y escritura
DROP POLICY IF EXISTS "Acceso total a errores del sistema" ON public.system_errors;
CREATE POLICY "Acceso total a errores del sistema" ON public.system_errors FOR ALL USING (true) WITH CHECK (true);

-- Índice para consultas por estado y fecha
CREATE INDEX IF NOT EXISTS idx_system_errors_resolved_created ON public.system_errors(resolved, created_at DESC);
