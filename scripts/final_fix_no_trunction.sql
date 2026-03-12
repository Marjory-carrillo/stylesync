-- ══════════════════════════════════════════════════════════════════
-- CitaLink: REPARACIÓN FINAL DE TELÉFONOS Y MÉTRICAS (SIN RECORTES)
-- ══════════════════════════════════════════════════════════════════
-- Problema detectado: Los números se estaban recortando a 10 dígitos, 
-- pero hay citas con 11 dígitos. Esto impedía que se encontraran.
-- ══════════════════════════════════════════════════════════════════

-- 1. REPARAR LA TABLA DE CLIENTES (Poner el número completo de la cita)
-- Borraremos el "+52" y los recortes para que coincida exactamente con la cita.
UPDATE public.clients c
SET phone = a.client_phone
FROM public.appointments a
WHERE REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') = RIGHT(REGEXP_REPLACE(a.client_phone, '[^0-9]', '', 'g'), 10)
  AND c.tenant_id = a.tenant_id;

-- 2. RECREAR LA VISTA CON LÓGICA DE ESTADOS FLEXIBLE (Confirmada + Completada)
DROP VIEW IF EXISTS public.client_summaries CASCADE;

CREATE VIEW public.client_summaries AS
WITH 
normalized_data AS (
    SELECT 
        a.tenant_id,
        a.client_phone,
        a.status,
        a.service_id,
        a.date,
        REGEXP_REPLACE(a.client_phone, '[^0-9]', '', 'g') as digits
    FROM public.appointments a
),
stats AS (
    SELECT 
        nd.tenant_id,
        nd.digits,
        -- Contabilizamos como 'visita' tanto confirmadas como completadas para que no salga en 0
        COUNT(*) FILTER (WHERE LOWER(nd.status) IN ('completada', 'confirmada')) as total_visits,
        SUM(COALESCE(s.price, 0)) FILTER (WHERE LOWER(nd.status) IN ('completada', 'confirmada')) as total_spent,
        MAX(nd.date) as last_visit_date
    FROM normalized_data nd
    LEFT JOIN public.services s ON s.id = nd.service_id
    GROUP BY nd.tenant_id, nd.digits
),
top_service_calc AS (
    SELECT DISTINCT ON (nd2.tenant_id, nd2.digits)
        nd2.tenant_id,
        nd2.digits,
        nd2.service_id
    FROM normalized_data nd2
    WHERE LOWER(nd2.status) IN ('completada', 'confirmada')
    ORDER BY nd2.tenant_id, nd2.digits, 
             (SELECT count(*) FROM normalized_data nd3 
              WHERE nd3.digits = nd2.digits AND nd3.service_id = nd2.service_id) DESC
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
        SELECT MAX(date) FROM public.appointments a2 
        WHERE REGEXP_REPLACE(a2.client_phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')
        AND a2.tenant_id = c.tenant_id
    )) as last_visit,
    (SELECT s.name FROM public.services s WHERE s.id = tsc.service_id) as main_service
FROM public.clients c
LEFT JOIN stats st 
    ON REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') = st.digits 
    AND c.tenant_id = st.tenant_id
LEFT JOIN top_service_calc tsc 
    ON REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') = tsc.digits 
    AND c.tenant_id = tsc.tenant_id;

-- 3. PERMISOS
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO anon;

-- 4. VERIFICACIÓN FINAL (Aquí DEBEN aparecer visitas)
SELECT name, phone, total_visits, total_spent, main_service
FROM public.client_summaries 
WHERE total_visits > 0
ORDER BY total_visits DESC;
