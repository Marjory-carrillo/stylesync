-- OPTIMIZACIONES DE RENDIMIENTO CITALINK - FASE 3
-- Ejecuta este script en el SQL Editor de Supabase para acelerar el Dashboard y el Módulo de Clientes.

-- 1. Índices para la tabla APPOINTMENTS (Citas)
-- Acelera el filtrado por tenant y por fecha (Dashboard/Agenda)
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_date 
ON public.appointments (tenant_id, date DESC);

-- Acelera el cálculo de estadísticas de la vista client_summaries
CREATE INDEX IF NOT EXISTS idx_appointments_client_stats 
ON public.appointments (client_phone, tenant_id, status);

-- 2. Índices para la tabla CLIENTS (Clientes)
-- Acelera la búsqueda y el listado de clientes por tenant
CREATE INDEX IF NOT EXISTS idx_clients_tenant_phone 
ON public.clients (tenant_id, phone);

-- 3. Índices para la tabla SERVICES (Servicios)
-- Acelera la búsqueda de servicios por tenant
CREATE INDEX IF NOT EXISTS idx_services_tenant_id 
ON public.services (tenant_id);

-- 4. Verificación de permisos para la vista (por si acaso)
-- Asegura que el Super Admin y usuarios autenticados puedan ver la vista agregada
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.client_summaries TO service_role;

-- Nota: Si la vista client_summaries no existe aún, asegúrate de haber ejecutado 
-- el script create_client_summaries.sql primero.
