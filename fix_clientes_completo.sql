-- ══════════════════════════════════════════════════════════════════
-- CITA-LINK: FIX COMPLETO DEL MÓDULO DE CLIENTES
-- Ejecutar todo esto en el SQL Editor de Supabase
-- ══════════════════════════════════════════════════════════════════

-- =========================================================================
-- PASO 1: RECREAR LA VISTA CON main_service CORREGIDO
-- =========================================================================

DROP VIEW IF EXISTS public.client_summaries CASCADE;

CREATE VIEW public.client_summaries AS
WITH service_counts AS (
    -- Contamos servicios por cliente (solo citas completadas)
    SELECT
        client_phone,
        tenant_id,
        service_id,
        COUNT(*) as cnt
    FROM public.appointments
    WHERE status = 'completada'
    GROUP BY client_phone, tenant_id, service_id
),
top_service AS (
    -- Obtenemos el servicio más frecuente
    SELECT DISTINCT ON (client_phone, tenant_id)
        client_phone,
        tenant_id,
        service_id as top_service_id
    FROM service_counts
    ORDER BY client_phone, tenant_id, cnt DESC
),
stats AS (
    -- Estadísticas agregadas
    SELECT
        a.client_phone,
        a.tenant_id,
        COUNT(*) as total_visits,
        SUM(COALESCE(s.price, 0)) as total_spent,
        MAX(a.date) as last_visit_date
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
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
    -- Métricas calculadas
    COALESCE(s.total_visits, 0)::bigint as total_visits,
    COALESCE(s.total_spent, 0)::numeric as total_spent,
    COALESCE(s.last_visit_date, (
        -- Fallback: última cita de cualquier estado
        SELECT MAX(date) FROM public.appointments a2
        WHERE a2.client_phone = c.phone AND a2.tenant_id = c.tenant_id
    )) as last_visit,
    -- Servicio principal (nombre del servicio más frecuente)
    (SELECT name FROM public.services WHERE id = ts.top_service_id) as main_service
FROM public.clients c
LEFT JOIN stats s ON c.phone = s.client_phone AND c.tenant_id = s.tenant_id
LEFT JOIN top_service ts ON c.phone = ts.client_phone AND c.tenant_id = ts.tenant_id;

-- =========================================================================
-- PASO 2: PERMISOS CORRECTOS (RLS + GRANTS)
-- =========================================================================

-- Asegurar permisos de SELECT
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO anon;
GRANT SELECT ON public.client_summaries TO service_role;

-- Asegurar que el trigger puede leer la vista
GRANT SELECT ON public.client_summaries TO postgres;

-- =========================================================================
-- PASO 3: RECREAR EL TRIGGER DE UPSERT (más robusto)
-- =========================================================================

-- Función mejorada para manejar inserción/actualización de clientes
CREATE OR REPLACE FUNCTION public.upsert_client_on_appointment()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo procesar citas confirmadas
    IF NEW.status = 'confirmada' THEN
        -- Insertar o actualizar cliente
        INSERT INTO public.clients (tenant_id, name, phone, notes, tags)
        VALUES (
            NEW.tenant_id,
            NEW.client_name,
            NEW.client_phone,
            COALESCE((SELECT notes FROM public.clients WHERE phone = NEW.client_phone AND tenant_id = NEW.tenant_id), ''),
            COALESCE((SELECT tags FROM public.clients WHERE phone = NEW.client_phone AND tenant_id = NEW.tenant_id), '{}')
        )
        ON CONFLICT (tenant_id, phone)
        DO UPDATE SET
            name = EXCLUDED.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS trg_upsert_client ON public.appointments;

-- Crear trigger nuevo
CREATE TRIGGER trg_upsert_client
    AFTER INSERT OR UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.upsert_client_on_appointment();

-- =========================================================================
-- PASO 4: MIGRACIÓN - SINCRONIZAR CLIENTES EXISTENTES
-- =========================================================================

-- Insertar clientes desde citas existentes que no están en la tabla clients
INSERT INTO public.clients (tenant_id, name, phone, notes, tags)
SELECT DISTINCT ON (tenant_id, client_phone)
    tenant_id,
    client_name,
    client_phone,
    '',
    '{}'
FROM public.appointments
WHERE status IN ('confirmada', 'completada')
ON CONFLICT (tenant_id, phone) DO NOTHING;

-- =========================================================================
-- PASO 5: VERIFICACIÓN - Diagnosticar si hay problemas
-- =========================================================================

-- Contar clientes totales
SELECT 'Total clientes en tabla' as metric, COUNT(*)::text as value FROM public.clients
UNION ALL
SELECT 'Total en vista client_summaries', COUNT(*)::text FROM public.client_summaries
UNION ALL
SELECT 'Clientes con visitas (>0)', COUNT(*)::text FROM public.client_summaries WHERE total_visits > 0
UNION ALL
SELECT 'Clientes con main_service', COUNT(*)::text FROM public.client_summaries WHERE main_service IS NOT NULL;

-- =========================================================================
-- PASO 6: VERIFICAR COLUMNAS DE LA VISTA
-- =========================================================================

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'client_summaries'
ORDER BY ordinal_position;

-- =========================================================================
-- PASO 7: MUESTRA DE DATOS (para verificar que funciona)
-- =========================================================================

SELECT
    name,
    phone,
    total_visits,
    total_spent,
    last_visit,
    main_service,
    tenant_id
FROM public.client_summaries
WHERE total_visits > 0
ORDER BY total_visits DESC
LIMIT 10;

-- ══════════════════════════════════════════════════════════════════
-- FIN DEL SCRIPT - Si todo sale bien, deberías ver:
-- 1. Las métricas de conteo
-- 2. Las columnas de la vista (incluyendo main_service)
-- 3. Una muestra de datos con main_service populado
-- ══════════════════════════════════════════════════════════════════
