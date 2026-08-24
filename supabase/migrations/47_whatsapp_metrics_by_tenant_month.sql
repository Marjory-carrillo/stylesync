-- Migration 47: Unificar vistas de métricas mensuales y por tenant para Super Admin
-- Garantiza que los conteos de 'Este Mes', 'Mes Anterior' e 'Histórico Total' coincidan 100% con los logs reales

CREATE OR REPLACE VIEW public.whatsapp_metrics_by_tenant AS
SELECT 
    tenant_id,
    COUNT(*)::integer as total,
    COUNT(*) FILTER (WHERE to_char(created_at, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM'))::integer as this_month,
    COUNT(*) FILTER (WHERE to_char(created_at, 'YYYY-MM') = to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM'))::integer as last_month,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::integer as month,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::integer as week
FROM public.sms_logs
WHERE provider = 'whatsapp' OR provider IS NULL OR provider = 'demo'
GROUP BY tenant_id;

CREATE OR REPLACE VIEW public.whatsapp_metrics_by_tenant_month AS
SELECT 
    tenant_id,
    to_char(created_at, 'YYYY-MM') as month_key,
    COUNT(*)::integer as count,
    COUNT(*) FILTER (WHERE message_type = 'reminder' OR message_type = 'automatic' OR message_type = 'confirmation')::integer as auto_count
FROM public.sms_logs
WHERE provider = 'whatsapp' OR provider IS NULL OR provider = 'demo'
GROUP BY tenant_id, to_char(created_at, 'YYYY-MM')
ORDER BY month_key DESC;

GRANT SELECT ON public.whatsapp_metrics_by_tenant TO authenticated, service_role, anon;
GRANT SELECT ON public.whatsapp_metrics_by_tenant_month TO authenticated, service_role, anon;
