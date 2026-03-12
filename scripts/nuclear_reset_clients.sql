-- ══════════════════════════════════════════════════════════════════
-- CitaLink: REINICIO TOTAL (FACTORY RESET) MÓDULO DE CLIENTES
-- ══════════════════════════════════════════════════════════════════
-- ADVERTENCIA: Este script borra la tabla de clientes y todas sus notas.
-- Luego recrea todo desde las citas usando un formato de 10 dígitos limpio.
-- ══════════════════════════════════════════════════════════════════

-- 1. LIMPIEZA TOTAL (BORRAR TODO LO VIEJO)
DROP VIEW IF EXISTS public.client_summaries CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;

-- 2. CREACIÓN DE TABLA LIMPIA
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    notes TEXT DEFAULT '',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, phone) -- Evita duplicados por negocio
);

-- Habilitar RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICA DE SEGURIDAD (Acceso limitado a tu negocio)
CREATE POLICY "Users can only access their tenant clients"
ON public.clients
FOR ALL
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
);

-- 4. RE-POBLAR DESDE CITAS (Normalizando a 10 dígitos +52)
-- Esto toma a todos tus clientes reales de las citas y los pone en la tabla limpia
INSERT INTO public.clients (tenant_id, name, phone)
SELECT DISTINCT ON (tenant_id, phone_clean)
    tenant_id,
    client_name,
    '+52' || RIGHT(REGEXP_REPLACE(client_phone, '[^0-9]', '', 'g'), 10) as phone_clean
FROM public.appointments
WHERE client_phone IS NOT NULL AND client_name IS NOT NULL
ON CONFLICT (tenant_id, phone) DO NOTHING;

-- 5. CREAR VISTA DE RESÚMENES (Métricas automáticas)
CREATE VIEW public.client_summaries AS
WITH stats AS (
    SELECT 
        a.tenant_id,
        '+52' || RIGHT(REGEXP_REPLACE(a.client_phone, '[^0-9]', '', 'g'), 10) as phone_norm,
        COUNT(*) FILTER (WHERE a.status = 'completada') as total_visits,
        SUM(COALESCE(s.price, 0)) FILTER (WHERE a.status = 'completada') as total_spent,
        MAX(a.date) as last_visit_date
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    GROUP BY a.tenant_id, phone_norm
),
top_service AS (
    SELECT DISTINCT ON (tenant_id, phone_norm)
        tenant_id,
        '+52' || RIGHT(REGEXP_REPLACE(client_phone, '[^0-9]', '', 'g'), 10) as phone_norm,
        service_id
    FROM public.appointments
    WHERE status = 'completada'
    GROUP BY tenant_id, phone_norm, service_id
    ORDER BY tenant_id, phone_norm, COUNT(*) DESC
)
SELECT
    c.id, c.phone, c.name, c.notes, c.tags, c.tenant_id, c.created_at,
    COALESCE(st.total_visits, 0)::bigint as total_visits,
    COALESCE(st.total_spent, 0)::numeric as total_spent,
    COALESCE(st.last_visit_date, (
        SELECT MAX(date) FROM public.appointments a2 
        WHERE ('+52' || RIGHT(REGEXP_REPLACE(a2.client_phone, '[^0-9]', '', 'g'), 10)) = c.phone 
        AND a2.tenant_id = c.tenant_id
    )) as last_visit,
    (SELECT name FROM public.services WHERE id = ts.service_id) as main_service
FROM public.clients c
LEFT JOIN stats st ON c.phone = st.phone_norm AND c.tenant_id = st.tenant_id
LEFT JOIN top_service ts ON c.phone = ts.phone_norm AND c.tenant_id = ts.tenant_id;

-- 6. PERMISOS
GRANT ALL ON public.clients TO authenticated;
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO anon;

-- VERIFICACIÓN
SELECT name, phone, total_visits, total_spent FROM public.client_summaries LIMIT 10;
