-- Migration 46: Crear vista para historial mensual de mensajes de WhatsApp

CREATE OR REPLACE VIEW public.whatsapp_metrics_by_month AS
SELECT 
    to_char(created_at, 'YYYY-MM') as month_key,
    to_char(created_at, 'YYYY-MM') as month_label, -- Usamos formato YYYY-MM uniforme por compatibilidad de idioma
    COUNT(*)::integer as count
FROM public.sms_logs
WHERE provider = 'whatsapp'
GROUP BY to_char(created_at, 'YYYY-MM')
ORDER BY month_key DESC;

GRANT SELECT ON public.whatsapp_metrics_by_month TO authenticated, service_role;
