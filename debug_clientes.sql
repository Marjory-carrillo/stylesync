-- DEBUG: Verificar datos de clientes paso a paso

-- 1. Verificar si hay clientes en la tabla base
select 'clientes en tabla clients' as paso, count(*) as total from public.clients;

-- 2. Verificar citas completadas
select 'citas completadas' as paso, count(*) as total from public.appointments where status = 'completada';

-- 3. Ver si hay relación entre clientes y citas
select
    'clientes con citas completadas' as paso,
    count(distinct c.id) as total
from public.clients c
join public.appointments a on c.phone = a.client_phone and c.tenant_id = a.tenant_id
where a.status = 'completada';

-- 4. Muestra de la vista para un tenant específico (reemplaza el uuid con tu tenant_id real)
-- Descomenta y ejecuta: select * from public.client_summaries where tenant_id = 'tu-tenant-id' limit 5;

-- 5. Verificar columnas de la vista
select column_name from information_schema.columns where table_name = 'client_summaries' order by ordinal_position;

-- 6. Muestra de datos crudos de la vista
select name, phone, total_visits, total_spent, main_service, tenant_id
from public.client_summaries
limit 5;
