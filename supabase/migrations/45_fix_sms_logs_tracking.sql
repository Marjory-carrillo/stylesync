-- Migration 45: Unificar sms_logs y crear vistas de métricas para Super Admin

-- 1. Asegurar todas las columnas en la tabla sms_logs para evitar fallos de inserción silenciosos
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS phone_to TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS twilio_sid TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS provider_sid TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS message_type TEXT;

-- 2. Sincronizar datos históricos por compatibilidad
UPDATE public.sms_logs SET phone = phone_to WHERE phone IS NULL AND phone_to IS NOT NULL;
UPDATE public.sms_logs SET phone_to = phone WHERE phone_to IS NULL AND phone IS NOT NULL;
UPDATE public.sms_logs SET error = error_message WHERE error IS NULL AND error_message IS NOT NULL;
UPDATE public.sms_logs SET error_message = error WHERE error_message IS NULL AND error IS NOT NULL;
UPDATE public.sms_logs SET twilio_sid = provider_sid WHERE twilio_sid IS NULL AND provider_sid IS NOT NULL;
UPDATE public.sms_logs SET provider_sid = twilio_sid WHERE provider_sid IS NULL AND twilio_sid IS NOT NULL;

-- 3. Crear vistas agregadas para evitar el límite de 1000 filas de PostgREST y optimizar el Super Admin
CREATE OR REPLACE VIEW public.whatsapp_metrics_by_tenant AS
SELECT 
    tenant_id,
    COUNT(*)::integer as total,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::integer as week,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::integer as month
FROM public.sms_logs
WHERE provider = 'whatsapp'
GROUP BY tenant_id;

-- Corrección infalible: castear date a text para comparar con to_char sin importar si la columna es DATE, TIMESTAMP o TEXT
CREATE OR REPLACE VIEW public.global_platform_metrics AS
SELECT
    (SELECT COUNT(DISTINCT client_phone) FROM public.appointments)::integer as unique_clients,
    (SELECT COUNT(*) FROM public.appointments WHERE date::text >= to_char(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD'))::integer as appointments_last_30d;

CREATE OR REPLACE VIEW public.appointments_last_30d_by_tenant AS
SELECT 
    tenant_id,
    COUNT(*)::integer as count
FROM public.appointments
WHERE date::text >= to_char(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
GROUP BY tenant_id;

-- 4. Asignar permisos sobre las nuevas vistas
GRANT SELECT ON public.whatsapp_metrics_by_tenant TO authenticated, service_role;
GRANT SELECT ON public.global_platform_metrics TO authenticated, service_role;
GRANT SELECT ON public.appointments_last_30d_by_tenant TO authenticated, service_role;
