-- ══════════════════════════════════════════════════════════════════
-- FIX DEFINITIVO: SINCRONIZAR CLIENTES DESDE CITAS COMPLETADAS
-- ══════════════════════════════════════════════════════════════════

-- PASO 1: Ver qué teléfonos tienen citas COMPLETADAS (quiénes son)
SELECT 
    client_name,
    client_phone,
    COUNT(*) AS citas_completadas
FROM public.appointments
WHERE status = 'completada'
GROUP BY client_name, client_phone
ORDER BY citas_completadas DESC;

-- ══════════════════════════════════════════════════════════════════

-- PASO 2: Insertar en clients a todos los que tengan citas completadas y no estén
INSERT INTO public.clients (tenant_id, name, phone, notes, tags)
SELECT DISTINCT ON (a.tenant_id, a.client_phone)
    a.tenant_id,
    a.client_name,
    a.client_phone,
    '',
    '{}'::text[]
FROM public.appointments a
WHERE a.status = 'completada'
  AND NOT EXISTS (
    SELECT 1 FROM public.clients c2
    WHERE RIGHT(REGEXP_REPLACE(c2.phone, '[^0-9]', '', 'g'), 10) 
        = RIGHT(REGEXP_REPLACE(a.client_phone, '[^0-9]', '', 'g'), 10)
      AND c2.tenant_id = a.tenant_id
  )
ON CONFLICT (tenant_id, phone) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════

-- PASO 3: Recrear vista con JOIN tolerante a formatos (usa [^0-9] en lugar de \D)
DROP VIEW IF EXISTS public.client_summaries CASCADE;

CREATE VIEW public.client_summaries AS
WITH
normalized_appts AS (
    SELECT
        a.*,
        RIGHT(REGEXP_REPLACE(a.client_phone, '[^0-9]', '', 'g'), 10) AS phone_norm
    FROM public.appointments a
),
service_counts AS (
    SELECT phone_norm, tenant_id, service_id, COUNT(*) AS cnt
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
    COALESCE(st.total_visits, 0)::bigint    AS total_visits,
    COALESCE(st.total_spent,  0)::numeric   AS total_spent,
    COALESCE(st.last_visit_date, (
        SELECT MAX(na2.date) FROM normalized_appts na2
        WHERE RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 10) = na2.phone_norm
          AND c.tenant_id = na2.tenant_id
    ))                                      AS last_visit,
    (SELECT name FROM public.services WHERE id = ts.top_service_id) AS main_service
FROM public.clients c
LEFT JOIN stats      st ON RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 10) = st.phone_norm
                        AND c.tenant_id = st.tenant_id
LEFT JOIN top_service ts ON RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 10) = ts.phone_norm
                         AND c.tenant_id = ts.tenant_id;

-- Permisos
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO anon;
GRANT SELECT ON public.client_summaries TO service_role;

-- ══════════════════════════════════════════════════════════════════

-- PASO 4: VERIFICACIÓN FINAL
SELECT name, phone, total_visits, total_spent, last_visit, main_service
FROM public.client_summaries
WHERE total_visits > 0
ORDER BY total_visits DESC
LIMIT 20;
