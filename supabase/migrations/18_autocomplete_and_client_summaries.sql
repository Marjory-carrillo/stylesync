-- ================================================================
-- MIGRACIÓN 18: AUTO-COMPLETAR CITAS + VISTA DE RESUMEN DE CLIENTES
-- Ejecutar en Supabase SQL Editor
--
-- QUÉ HACE:
-- 1. Función auto_complete_past_appointments() → marca como 'completada'
--    las citas que ya pasaron y siguen en estado 'confirmada'
-- 2. Cron job (pg_cron) para ejecutarla cada hora automáticamente
-- 3. Vista 'client_summaries' → calcula totalVisits, totalSpent,
--    lastVisit y mainService por cliente en tiempo real
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- PARTE 1: FUNCIÓN PARA AUTO-COMPLETAR CITAS PASADAS
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_complete_past_appointments()
RETURNS integer AS $$
DECLARE
    v_updated integer;
BEGIN
    -- Marca como 'completada' toda cita que:
    -- 1. Sigue en estado 'confirmada'
    -- 2. La fecha es anterior a hoy, O
    --    la fecha es hoy pero la hora + duración del servicio ya pasó
    UPDATE appointments
    SET status = 'completada'
    WHERE status = 'confirmada'
      AND (
          -- Citas de días anteriores
          date < CURRENT_DATE
          OR
          -- Citas de hoy cuyo horario de fin ya pasó
          (
            date = CURRENT_DATE AND
            (time + (
                COALESCE(
                    (SELECT duration FROM services WHERE id = appointments.service_id),
                    30
                ) * interval '1 minute'
            )) < NOW()::time
          )
      );

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ────────────────────────────────────────────────────────────────
-- PARTE 2: EJECUTAR UNA VEZ AHORA para corregir el historial
-- ────────────────────────────────────────────────────────────────

SELECT auto_complete_past_appointments() AS citas_completadas_ahora;


-- ────────────────────────────────────────────────────────────────
-- PARTE 3: CRON JOB — Ejecutar cada hora automáticamente
-- Requiere que pg_cron esté habilitado en Supabase
-- (En Supabase: Database → Extensions → buscar "pg_cron" → Enable)
-- ────────────────────────────────────────────────────────────────

-- Primero habilita la extensión si no está activa:
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Eliminar el job si ya existe (para evitar duplicados)
SELECT cron.unschedule('auto-complete-appointments') 
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-complete-appointments'
);

-- Crear el job: cada hora en punto
SELECT cron.schedule(
    'auto-complete-appointments',  -- nombre del job
    '0 * * * *',                   -- cada hora en punto (cron expression)
    'SELECT auto_complete_past_appointments()'
);


-- ────────────────────────────────────────────────────────────────
-- PARTE 4: VISTA client_summaries
-- Calcula estadísticas de clientes en tiempo real desde appointments
-- Esto alimenta los campos totalVisits, totalSpent, lastVisit, mainService
-- que muestra la página de Clientes en el dashboard
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW client_summaries AS
SELECT
    c.id,
    c.tenant_id,
    c.name,
    c.phone,
    c.notes,
    c.tags,
    c.created_at,

    -- Total de visitas completadas
    COUNT(a.id) FILTER (WHERE a.status = 'completada') AS total_visits,

    -- Total gastado (suma de precios de servicios de citas completadas)
    COALESCE(SUM(s.price) FILTER (WHERE a.status = 'completada'), 0) AS total_spent,

    -- Fecha de la última visita completada
    MAX(a.date) FILTER (WHERE a.status = 'completada') AS last_visit,

    -- Servicio más frecuente (el que más veces ha pedido)
    (
        SELECT s2.name
        FROM appointments a2
        JOIN services s2 ON a2.service_id = s2.id
        WHERE a2.client_phone = c.phone
          AND a2.tenant_id = c.tenant_id
          AND a2.status = 'completada'
        GROUP BY s2.name
        ORDER BY COUNT(*) DESC
        LIMIT 1
    ) AS main_service

FROM clients c
LEFT JOIN appointments a 
    ON a.client_phone = c.phone 
    AND a.tenant_id = c.tenant_id
LEFT JOIN services s 
    ON a.service_id = s.id
GROUP BY c.id, c.tenant_id, c.name, c.phone, c.notes, c.tags, c.created_at;


-- ────────────────────────────────────────────────────────────────
-- PARTE 5: RLS para la vista client_summaries
-- ────────────────────────────────────────────────────────────────

-- Las vistas en Supabase heredan RLS de las tablas subyacentes,
-- pero es buena práctica restringir acceso explícitamente
GRANT SELECT ON client_summaries TO authenticated;
GRANT SELECT ON client_summaries TO anon;


-- ────────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ────────────────────────────────────────────────────────────────

-- Ver cuántas citas siguen como 'confirmada' siendo del pasado (debe ser 0)
SELECT COUNT(*) AS confirmadas_pasadas_pendientes
FROM appointments
WHERE status = 'confirmada'
  AND date < CURRENT_DATE;

-- Ver los cron jobs activos
SELECT jobname, schedule, command, active 
FROM cron.job
WHERE jobname = 'auto-complete-appointments';
