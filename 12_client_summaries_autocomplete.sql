-- =========================================================================
-- ACTUALIZACIÓN VISTA CLIENTES: AUTOCOMPLETADO (CitaLink)
-- Instrucciones: Pega todo este código en tu SQL Editor de Supabase y dale a RUN.
-- =========================================================================

-- Recreamos la vista con la nueva regla de "autocompletado"
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
       OR (a.status = 'confirmada' 
           AND (a.date || ' ' || a.time)::timestamp + (COALESCE(s.duration, 0) || ' minutes')::interval < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City'))
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

-- Mantenemos los permisos necesarios de la App
ALTER VIEW public.client_summaries SET (security_invoker = on);
GRANT SELECT ON public.client_summaries TO authenticated, anon, service_role;
