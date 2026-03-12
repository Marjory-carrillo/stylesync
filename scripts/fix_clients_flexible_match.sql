-- ══════════════════════════════════════════════════════════════════
-- CitaLink: FIX UNIVERSAL (CORREGIDO) - EMPAREJAMIENTO FLEXIBLE
-- ══════════════════════════════════════════════════════════════════
-- Error previo: Ambigüedad en tenant_id. Corregido especificando alias.
-- ══════════════════════════════════════════════════════════════════

-- 1. RECREAR LA VISTA CON EMPAREJAMIENTO "LIBRE"
DROP VIEW IF EXISTS public.client_summaries CASCADE;

CREATE VIEW public.client_summaries AS
WITH 
normalized_data AS (
    SELECT 
        a.*, -- Incluye tenant_id de appointments
        REGEXP_REPLACE(a.client_phone, '[^0-9]', '', 'g') as digits_only
    FROM public.appointments a
),
stats AS (
    SELECT 
        nd.tenant_id,
        nd.digits_only,
        COUNT(*) FILTER (WHERE nd.status = 'completada') as total_visits,
        SUM(COALESCE(s.price, 0)) FILTER (WHERE nd.status = 'completada') as total_spent,
        MAX(nd.date) as last_visit_date
    FROM normalized_data nd
    LEFT JOIN public.services s ON s.id = nd.service_id
    GROUP BY nd.tenant_id, nd.digits_only
),
top_service AS (
    SELECT DISTINCT ON (nd2.tenant_id, nd2.digits_only)
        nd2.tenant_id,
        nd2.digits_only,
        nd2.service_id
    FROM normalized_data nd2
    WHERE nd2.status = 'completada'
    GROUP BY nd2.tenant_id, nd2.digits_only, nd2.service_id
    ORDER BY nd2.tenant_id, nd2.digits_only, COUNT(*) DESC
)
SELECT
    c.id, 
    c.phone, 
    c.name, 
    c.notes, 
    c.tags, 
    c.tenant_id, 
    c.created_at,
    COALESCE(st.total_visits, 0)::bigint AS total_visits,
    COALESCE(st.total_spent, 0)::numeric AS total_spent,
    COALESCE(st.last_visit_date, (
        SELECT MAX(a2.date) 
        FROM public.appointments a2 
        WHERE REGEXP_REPLACE(a2.client_phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')
        AND a2.tenant_id = c.tenant_id
    )) as last_visit,
    (SELECT s_name.name FROM public.services s_name WHERE s_name.id = ts.top_service_id) as main_service
FROM public.clients c
LEFT JOIN stats st 
    ON REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') = st.digits_only 
    AND c.tenant_id = st.tenant_id
LEFT JOIN (
    -- Subquery para evitar ambigüedad en el JOIN final
    SELECT tenant_id, digits_only, top_service_id FROM (
        SELECT DISTINCT ON (tenant_id, digits_only)
            tenant_id,
            digits_only,
            service_id as top_service_id
        FROM normalized_data
        WHERE status = 'completada'
        ORDER BY tenant_id, digits_only, (SELECT count(*) from normalized_data n3 where n3.digits_only = normalized_data.digits_only and n3.service_id = normalized_data.service_id) DESC
    ) sub
) ts ON REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') = ts.digits_only 
    AND c.tenant_id = ts.tenant_id;

-- 2. ASEGURAR PERMISOS
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO anon;

-- 3. VERIFICACIÓN DIRECTA
SELECT name, phone, total_visits, total_spent 
FROM public.client_summaries 
ORDER BY total_visits DESC 
LIMIT 10;
