-- ══════════════════════════════════════════════════════════════════
-- CitaLink: SCRIPT DEFINITIVO - DIAGNÓSTICO Y REPARACIÓN COMPLETA
-- EJECUTAR SECCIÓN POR SECCIÓN EN EL EDITOR SQL DE SUPABASE
-- ══════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
-- SECCIÓN 1: DIAGNÓSTICO
-- Ejecuta esto primero para ver qué está pasando
-- ══════════════════════════════════════════════════════════════════

-- 1A: ¿Hay clientes en la tabla?
SELECT 'Clientes en tabla clients' AS check, COUNT(*) AS valor FROM public.clients;

-- 1B: ¿Hay citas completadas?
SELECT 'Citas completadas' AS check, COUNT(*) AS valor 
FROM public.appointments WHERE status = 'completada';

-- 1C: ¿Qué devuelve la vista actualmente?
SELECT 'Registros en client_summaries' AS check, COUNT(*) AS valor 
FROM public.client_summaries;

-- 1D: ¿Coinciden los teléfonos entre las dos tablas?
SELECT 
  'Coincidencias de teléfono en citas completadas' AS check,
  COUNT(*) AS valor
FROM public.clients c
JOIN public.appointments a ON a.client_phone = c.phone AND a.tenant_id = c.tenant_id
WHERE a.status = 'completada';

-- 1E: Muestra de teléfonos (para ver si hay diferencias de formato)
SELECT 'CLIENTES' as origen, phone, tenant_id FROM public.clients LIMIT 5;
SELECT 'CITAS' as origen, client_phone as phone, tenant_id FROM public.appointments WHERE status = 'completada' LIMIT 5;

-- ══════════════════════════════════════════════════════════════════
-- SECCIÓN 2: REPARACIÓN - Solo ejecutar si la Sección 1 muestra problemas
-- ══════════════════════════════════════════════════════════════════

-- 2A: Insertar clientes faltantes desde las citas (sincronización masiva)
INSERT INTO public.clients (tenant_id, name, phone, notes, tags)
SELECT DISTINCT ON (a.tenant_id, a.client_phone)
    a.tenant_id,
    a.client_name,
    a.client_phone,
    '',
    '{}'
FROM public.appointments a
WHERE a.status IN ('confirmada', 'completada')
  AND NOT EXISTS (
    SELECT 1 FROM public.clients c 
    WHERE c.phone = a.client_phone AND c.tenant_id = a.tenant_id
  )
ON CONFLICT (tenant_id, phone) DO NOTHING;

-- 2B: Recrear la vista con permisos correctos
DROP VIEW IF EXISTS public.client_summaries CASCADE;

CREATE VIEW public.client_summaries AS
WITH service_counts AS (
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

-- 2C: Permisos
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO anon;
GRANT SELECT ON public.client_summaries TO service_role;

-- ══════════════════════════════════════════════════════════════════
-- SECCIÓN 3: VERIFICACIÓN FINAL
-- ══════════════════════════════════════════════════════════════════

SELECT name, phone, total_visits, total_spent, last_visit, main_service, tenant_id
FROM public.client_summaries
ORDER BY total_visits DESC
LIMIT 10;
