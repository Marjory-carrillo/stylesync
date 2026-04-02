-- ============================================================
-- Migration 29: Configurar cron job para recordatorios de citas
-- Llama a process-reminders cada hora via pg_cron + pg_net
-- ============================================================

-- Habilitar las extensiones necesarias (ya vienen en Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Eliminar el cron job anterior si ya existiera
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-reminders-hourly') THEN
        PERFORM cron.unschedule('process-reminders-hourly');
    END IF;
END $$;

-- Crear el cron job: ejecutar process-reminders cada hora en punto
-- Usa supabase_functions.http_request que maneja auth automáticamente
SELECT cron.schedule(
    'process-reminders-hourly',
    '0 * * * *',
    $$
    SELECT
        net.http_post(
            url     := 'https://mcvcuymiyfondasvqskv.supabase.co/functions/v1/process-reminders',
            headers := jsonb_build_object(
                'Content-Type',  'application/json',
                'Authorization', concat('Bearer ', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1))
            ),
            body    := '{}'::jsonb
        ) AS request_id;
    $$
);

-- Verificar que quedó registrado
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'process-reminders-hourly';

