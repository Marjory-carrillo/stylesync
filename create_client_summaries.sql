-- ══════════════════════════════════════════════════════════════════
-- CitaLink: VISTA AGREGADA DE CLIENTES PARA RENDIMIENTO
-- ══════════════════════════════════════════════════════════════════

-- Esta vista pre-calcula las estadísticas pesadas en el servidor
-- para evitar que el frontend descargue miles de citas.

CREATE OR REPLACE VIEW public.client_summaries AS
WITH stats AS (
    SELECT 
        client_phone,
        tenant_id,
        COUNT(*) as total_visits,
        SUM(COALESCE((SELECT price FROM public.services s WHERE s.id = a.service_id), 0)) as total_spent,
        MAX(date) as last_visit_date
    FROM public.appointments a
    WHERE status = 'completada'
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
    COALESCE(s.last_visit_date, (
        -- Si no hay citas completadas, buscar la última de cualquier tipo
        SELECT MAX(date) FROM public.appointments a2 
        WHERE a2.client_phone = c.phone AND a2.tenant_id = c.tenant_id
    )) as last_visit
FROM public.clients c
LEFT JOIN stats s ON c.phone = s.client_phone AND c.tenant_id = s.tenant_id;

-- Habilitar RLS en la vista (hereda de las tablas base, pero por seguridad)
ALTER VIEW public.client_summaries SET (security_invoker = on);

-- Otorgar permisos
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO anon;
GRANT SELECT ON public.client_summaries TO service_role;
