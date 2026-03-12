drop view if exists public.client_summaries cascade;

create view public.client_summaries as
with service_counts as (
    select
        client_phone,
        tenant_id,
        service_id,
        count(*) as cnt
    from public.appointments
    where status = 'completada'
    group by client_phone, tenant_id, service_id
),
top_service as (
    select distinct on (client_phone, tenant_id)
        client_phone,
        tenant_id,
        service_id as top_service_id
    from service_counts
    order by client_phone, tenant_id, cnt desc
),
stats as (
    select
        a.client_phone,
        a.tenant_id,
        count(*) as total_visits,
        sum(coalesce(s.price, 0)) as total_spent,
        max(a.date) as last_visit_date
    from public.appointments a
    left join public.services s on s.id = a.service_id
    where a.status = 'completada'
    group by a.client_phone, a.tenant_id
)
select
    c.id,
    c.phone,
    c.name,
    c.notes,
    c.tags,
    c.tenant_id,
    c.created_at,
    coalesce(s.total_visits, 0)::bigint as total_visits,
    coalesce(s.total_spent, 0)::numeric as total_spent,
    coalesce(s.last_visit_date, (
        select max(date) from public.appointments a2
        where a2.client_phone = c.phone and a2.tenant_id = c.tenant_id
    )) as last_visit,
    (select name from public.services where id = ts.top_service_id) as main_service
from public.clients c
left join stats s on c.phone = s.client_phone and c.tenant_id = s.tenant_id
left join top_service ts on c.phone = ts.client_phone and c.tenant_id = ts.tenant_id;

grant select on public.client_summaries to authenticated;
grant select on public.client_summaries to anon;
grant select on public.client_summaries to service_role;

create or replace function public.upsert_client_on_appointment()
returns trigger as $$
begin
    if new.status = 'confirmada' then
        insert into public.clients (tenant_id, name, phone, notes, tags)
        values (
            new.tenant_id,
            new.client_name,
            new.client_phone,
            coalesce((select notes from public.clients where phone = new.client_phone and tenant_id = new.tenant_id), ''),
            coalesce((select tags from public.clients where phone = new.client_phone and tenant_id = new.tenant_id), '{}')
        )
        on conflict (tenant_id, phone)
        do update set name = excluded.name;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_upsert_client on public.appointments;

create trigger trg_upsert_client
    after insert or update on public.appointments
    for each row
    execute function public.upsert_client_on_appointment();

insert into public.clients (tenant_id, name, phone, notes, tags)
select distinct on (tenant_id, client_phone)
    tenant_id,
    client_name,
    client_phone,
    '',
    '{}'
from public.appointments
where status in ('confirmada', 'completada')
on conflict (tenant_id, phone) do nothing;
