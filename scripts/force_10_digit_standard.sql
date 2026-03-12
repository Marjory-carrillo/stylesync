-- ══════════════════════════════════════════════════════════════════
-- CitaLink: LIMPIEZA Y ESTANDARIZACIÓN TOTAL DE TELÉFONOS (MÉXICO)
-- ══════════════════════════════════════════════════════════════════
-- Este script normaliza TODOS los teléfonos a: +52XXXXXXXXXX (10 dígitos)
-- ══════════════════════════════════════════════════════════════════

-- 1. Limpiar tabla de Clientes
UPDATE public.clients
SET phone = '+52' || RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10)
WHERE phone IS NOT NULL;

-- 2. Limpiar tabla de Citas
UPDATE public.appointments
SET client_phone = '+52' || RIGHT(REGEXP_REPLACE(client_phone, '[^0-9]', '', 'g'), 10)
WHERE client_phone IS NOT NULL;

-- 3. Limpiar tabla de Estilistas (por si acaso)
UPDATE public.stylists
SET phone = '+52' || RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10)
WHERE phone IS NOT NULL;

-- 4. Recrear la vista con JOIN de comparación EXACTA (ahora que todo está limpio)
DROP VIEW IF EXISTS public.client_summaries CASCADE;

CREATE VIEW public.client_summaries AS
WITH 
service_counts AS (
    SELECT client_phone, tenant_id, service_id, COUNT(*) as cnt
    FROM public.appointments
    WHERE status = 'completada'
    GROUP BY client_phone, tenant_id, service_id
),
top_service AS (
    SELECT DISTINCT ON (client_phone, tenant_id)
        client_phone, tenant_id, service_id as top_service_id
    FROM service_counts
    ORDER BY client_phone, tenant_id, cnt DESC
),
stats AS (
    SELECT 
        a.client_phone, a.tenant_id,
        COUNT(*) as total_visits,
        SUM(COALESCE(s.price, 0)) as total_spent,
        MAX(a.date) as last_visit_date
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.status = 'completada'
    GROUP BY a.client_phone, a.tenant_id
)
SELECT
    c.id, c.phone, c.name, c.notes, c.tags, c.tenant_id, c.created_at,
    COALESCE(st.total_visits, 0)::bigint         AS total_visits,
    COALESCE(st.total_spent, 0)::numeric          AS total_spent,
    COALESCE(st.last_visit_date,
        (SELECT MAX(date) FROM public.appointments a2 
         WHERE a2.client_phone = c.phone AND a2.tenant_id = c.tenant_id)
    )                                             AS last_visit,
    (SELECT name FROM public.services WHERE id = ts.top_service_id) AS main_service
FROM public.clients c
LEFT JOIN stats    st ON c.phone = st.client_phone AND c.tenant_id = st.tenant_id
LEFT JOIN top_service ts ON c.phone = ts.client_phone AND c.tenant_id = ts.tenant_id;

-- Permisos
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO anon;
GRANT SELECT ON public.client_summaries TO service_role;

-- 5. VERIFICACIÓN FINAL
SELECT name, phone, total_visits, total_spent FROM public.client_summaries WHERE total_visits > 0 LIMIT 10;
