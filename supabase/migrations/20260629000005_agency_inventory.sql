-- Inventário de clientes da agência: pausa (libera assento, congela), exclui após o prazo.
alter table public.profiles add column if not exists parked_at timestamptz;
alter table public.profiles add column if not exists parked_until timestamptz;

-- Assentos usados NÃO contam clientes pausados (em inventário).
create or replace function public.agency_seats_used()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.profiles
  where agency_owner_id = auth.uid() and parked_at is null;
$$;

-- Lista os clientes da agência (auth.uid()), com e-mail e estado de inventário.
create or replace function public.agency_clients()
returns table (id uuid, name text, email text, parked_until timestamptz, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, u.email, p.parked_until, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.agency_owner_id = auth.uid()
  order by (p.parked_at is not null), p.created_at desc;
$$;

grant execute on function public.agency_seats_used() to authenticated;
grant execute on function public.agency_clients() to authenticated;

-- Exclusão automática das contas em inventário vencidas (todo dia às 04h).
do $$ begin
  perform cron.unschedule('agency-inventory-cleanup');
exception when others then null; end $$;

select cron.schedule('agency-inventory-cleanup', '0 4 * * *', $cron$
  delete from auth.users u
  using public.profiles p
  where p.id = u.id
    and p.agency_owner_id is not null
    and p.parked_until is not null
    and p.parked_until < now();
$cron$);
