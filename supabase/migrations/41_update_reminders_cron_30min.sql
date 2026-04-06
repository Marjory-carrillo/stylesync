-- ============================================================
-- Migration: Actualizar cron job de recordatorios a cada 30 min
-- Para mayor precisión en las ventanas de envío
-- ============================================================

-- Eliminar el cron job anterior
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-reminders-hourly') THEN
        PERFORM cron.unschedule('process-reminders-hourly');
    END IF;
END $$;

-- Crear el nuevo cron job: cada 30 minutos
SELECT cron.schedule(
    'process-reminders-hourly',
    '*/30 * * * *',
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

-- Verificar
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'process-reminders-hourly';
