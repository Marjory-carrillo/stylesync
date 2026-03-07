-- ══════════════════════════════════════════════════════════════════
-- CitaLink: OPTIMIZACIÓN PURA DE LA VISTA DE CLIENTES
-- Este script reemplaza las subconsultas pesadas por JOINs para
-- evitar el "Timeout" de Supabase, manteniendo la misma estructura
-- de datos para que el Frontend funcione como en la versión matutina.
-- ══════════════════════════════════════════════════════════════════

-- 1. Asegurar que los índices de rendimiento existan
CREATE INDEX IF NOT EXISTS idx_appointments_client_lookup ON public.appointments(client_phone, tenant_id, status);

-- 2. Declarar la vista optimizada usando Common Table Expressions (CTE) eficientes
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
    COALESCE(s.total_visits, 0) as total_visits,
    COALESCE(s.total_spent, 0) as total_spent,
    COALESCE(s.last_visit_date, lv.max_date) as last_visit
FROM public.clients c
LEFT JOIN stats s ON c.phone = s.client_phone AND c.tenant_id = s.tenant_id
LEFT JOIN last_visits lv ON c.phone = lv.client_phone AND c.tenant_id = lv.tenant_id;

-- 3. Habilitar la seguridad RLS original
ALTER VIEW public.client_summaries SET (security_invoker = on);
GRANT SELECT ON public.client_summaries TO authenticated, anon, service_role;
