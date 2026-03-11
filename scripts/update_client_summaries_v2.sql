-- ══════════════════════════════════════════════════════════════════
-- CitaLink: FIX VISTA CLIENT_SUMMARIES - JOIN TOLERANTE A FORMATOS
-- ══════════════════════════════════════════════════════════════════
-- Problema: Los teléfonos tienen formatos distintos (+52, sin +52, 9, 10, 11 dígitos)
-- Solución: El JOIN compara los ÚLTIMOS 10 dígitos de cada teléfono
-- ══════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS public.client_summaries CASCADE;

CREATE VIEW public.client_summaries AS
WITH 
-- Normalizamos appointments a los últimos 10 dígitos para el JOIN
normalized_appts AS (
    SELECT
        a.*,
        RIGHT(REGEXP_REPLACE(a.client_phone, '\D', '', 'g'), 10) AS phone_norm
    FROM public.appointments a
),
service_counts AS (
    SELECT phone_norm, tenant_id, service_id, COUNT(*) as cnt
    FROM normalized_appts
    WHERE status = 'completada'
    GROUP BY phone_norm, tenant_id, service_id
),
top_service AS (
    SELECT DISTINCT ON (phone_norm, tenant_id)
        phone_norm, tenant_id, service_id AS top_service_id
    FROM service_counts
    ORDER BY phone_norm, tenant_id, cnt DESC
),
stats AS (
    SELECT
        na.phone_norm,
        na.tenant_id,
        COUNT(*)                          AS total_visits,
        SUM(COALESCE(s.price, 0))         AS total_spent,
        MAX(na.date)                      AS last_visit_date
    FROM normalized_appts na
    LEFT JOIN public.services s ON s.id = na.service_id
    WHERE na.status = 'completada'
    GROUP BY na.phone_norm, na.tenant_id
)
SELECT
    c.id,
    c.phone,
    c.name,
    c.notes,
    c.tags,
    c.tenant_id,
    c.created_at,
    -- JOIN tolerante: usamos los últimos 10 dígitos del teléfono del cliente
    COALESCE(st.total_visits, 0)::bigint                 AS total_visits,
    COALESCE(st.total_spent,  0)::numeric                AS total_spent,
    COALESCE(st.last_visit_date, (
        SELECT MAX(na2.date)
        FROM normalized_appts na2
        WHERE RIGHT(REGEXP_REPLACE(c.phone, '\D', '', 'g'), 10) = na2.phone_norm
          AND c.tenant_id = na2.tenant_id
    ))                                                   AS last_visit,
    (SELECT name FROM public.services WHERE id = ts.top_service_id) AS main_service
FROM public.clients c
-- JOIN por últimos 10 dígitos
LEFT JOIN stats     st ON RIGHT(REGEXP_REPLACE(c.phone, '\D', '', 'g'), 10) = st.phone_norm
                       AND c.tenant_id = st.tenant_id
LEFT JOIN top_service ts ON RIGHT(REGEXP_REPLACE(c.phone, '\D', '', 'g'), 10) = ts.phone_norm
                         AND c.tenant_id = ts.tenant_id;

-- Permisos
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO anon;
GRANT SELECT ON public.client_summaries TO service_role;

-- ══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN: Deberías ver visitas > 0 para los clientes con citas completadas
-- ══════════════════════════════════════════════════════════════════
SELECT name, phone, total_visits, total_spent, last_visit, main_service
FROM public.client_summaries
ORDER BY total_visits DESC
LIMIT 10;
