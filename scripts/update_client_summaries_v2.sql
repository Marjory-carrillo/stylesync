-- ══════════════════════════════════════════════════════════════════
-- CitaLink: ACTUALIZACIÓN DE VISTA CLIENT_SUMMARIES (V2 - FIX)
-- ══════════════════════════════════════════════════════════════════
-- Objetivo: Añadir el servicio más frecuente por cliente.
-- Nota: Usamos DROP VIEW porque Postgres no permite cambiar tipos de datos con OR REPLACE.

DROP VIEW IF EXISTS public.client_summaries CASCADE;

CREATE VIEW public.client_summaries AS
WITH service_counts AS (
    -- Contamos cada servicio por cliente
    SELECT 
        client_phone,
        tenant_id,
        service_id,
        COUNT(*) as cnt
    FROM public.appointments
    WHERE status = 'completada'
    GROUP BY client_phone, tenant_id, service_id
),
top_service_ids AS (
    -- Obtenemos el ID del servicio con más citas para cada cliente
    SELECT DISTINCT ON (client_phone, tenant_id)
        client_phone,
        tenant_id,
        service_id
    FROM service_counts
    ORDER BY client_phone, tenant_id, cnt DESC
),
stats AS (
    -- Calculamos estadísticas generales de visitas y gasto total
    -- Nota: Usamos solo 'completada' ya que el sistema autocompleta citas pasadas.
    SELECT 
        a.client_phone,
        a.tenant_id,
        COUNT(*) as total_visits,
        SUM(COALESCE(svc.price, 0)) as total_spent,
        MAX(a.date) as last_visit_date
    FROM public.appointments a
    LEFT JOIN public.services svc ON svc.id = a.service_id
    WHERE a.status = 'completada'
    GROUP BY a.client_phone, a.tenant_id
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
    COALESCE(s.last_visit_date, (
        -- Fallback si no hay citas completadas
        SELECT MAX(date) FROM public.appointments a2 
        WHERE a2.client_phone = c.phone AND a2.tenant_id = c.tenant_id
    )) as last_visit,
    (SELECT name FROM public.services WHERE id = ts.service_id) as main_service
FROM public.clients c
LEFT JOIN stats s ON c.phone = s.client_phone AND c.tenant_id = s.tenant_id
LEFT JOIN top_service_ids ts ON c.phone = ts.client_phone AND c.tenant_id = ts.tenant_id;

-- Asegurar permisos
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO anon;
GRANT SELECT ON public.client_summaries TO service_role;
