-- =========================================================================
-- RECONSTRUCCIÓN TOTAL DEL MÓDULO DE CLIENTES (CitaLink)
-- Instrucciones: Pega todo este código en tu SQL Editor de Supabase y dale a RUN.
-- =========================================================================

-- 1. Aseguramos que la tabla base tiene todo lo necesario
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL,
    name TEXT NOT NULL,
    notes TEXT,
    tags TEXT[] DEFAULT '{}',
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Asegurarse de que el teléfono más tenant_id sea único
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_phone_tenant_key;
ALTER TABLE public.clients ADD CONSTRAINT clients_phone_tenant_key UNIQUE (phone, tenant_id);

-- 2. Eliminamos cualquier versión defectuosa de la vista previa
DROP VIEW IF EXISTS public.client_summaries CASCADE;

-- 3. Creamos la vista súper optimizada con la estructura EXACTA que espera el Frontend
CREATE OR REPLACE VIEW public.client_summaries AS
WITH stats AS (
    SELECT 
        a.client_phone,
        a.tenant_id,
        COUNT(a.id) as total_visits,
        SUM(COALESCE(s.price, 0)) as total_spent,
        MAX(a.date) as last_visit_date
    FROM public.appointments a
    LEFT JOIN public.services s ON a.service_id = s.id
    WHERE a.status = 'completada'
    GROUP BY a.client_phone, a.tenant_id
),
last_visits AS (
    SELECT 
        client_phone,
        tenant_id,
        MAX(date) as max_date
    FROM public.appointments
    GROUP BY client_phone, tenant_id
)
SELECT 
    c.id,
    c.phone,
    c.name,
    c.notes,
    c.tags,
    c.tenant_id,
    c.created_at,
    COALESCE(s.total_visits, 0)::numeric as total_visits,
    COALESCE(s.total_spent, 0)::numeric as total_spent,
    COALESCE(s.last_visit_date, lv.max_date) as last_visit
FROM public.clients c
LEFT JOIN stats s ON c.phone = s.client_phone AND c.tenant_id = s.tenant_id
LEFT JOIN last_visits lv ON c.phone = lv.client_phone AND c.tenant_id = lv.tenant_id;

-- 4. Activamos la seguridad nativa a la vista
ALTER VIEW public.client_summaries SET (security_invoker = on);

-- 5. REASIGNAMOS LOS PERMISOS (Esto es lo que causa que devuelva 0 clientes)
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO anon;
GRANT SELECT ON public.client_summaries TO service_role;

-- 6. Verificamos los permisos de la tabla base 'clients'
GRANT ALL ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
