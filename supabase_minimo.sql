drop view if exists public.client_summaries cascade;

create view public.client_summaries as
with service_counts as (
    select client_phone, tenant_id, service_id, count(*) as cnt
    from public.appointments where status = 'completada'
    group by client_phone, tenant_id, service_id
),
top_service as (
    select distinct on (client_phone, tenant_id) client_phone, tenant_id, service_id as top_service_id
    from service_counts order by client_phone, tenant_id, cnt desc
),
stats as (
    select a.client_phone, a.tenant_id, count(*) as total_visits,
    sum(coalesce(s.price, 0)) as total_spent, max(a.date) as last_visit_date
    from public.appointments a left join public.services s on s.id = a.service_id
    where a.status = 'completada' group by a.client_phone, a.tenant_id
)
select c.id, c.phone, c.name, c.notes, c.tags, c.tenant_id, c.created_at,
coalesce(s.total_visits, 0)::bigint as total_visits,
coalesce(s.total_spent, 0)::numeric as total_spent,
coalesce(s.last_visit_date, (select max(date) from public.appointments a2 where a2.client_phone = c.phone and a2.tenant_id = c.tenant_id)) as last_visit,
(select name from public.services where id = ts.top_service_id) as main_service
from public.clients c
left join stats s on c.phone = s.client_phone and c.tenant_id = s.tenant_id
left join top_service ts on c.phone = ts.client_phone and c.tenant_id = ts.tenant_id;

grant select on public.client_summaries to authenticated;
grant select on public.client_summaries to anon;
grant select on public.client_summaries to service_role;
