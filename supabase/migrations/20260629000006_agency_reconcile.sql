-- Reconcilia assentos: quando o limite cai abaixo do uso, pausa (inventário) os clientes excedentes.
-- Mantém ativos os mais antigos; pausa os mais novos além do limite.
create or replace function public.reconcile_agency_seats(_manager uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  lim int;
  parked_count int;
begin
  select coalesce(seat_limit, 0) into lim from public.profiles where id = _manager;

  update public.profiles
  set parked_at = now(),
      parked_until = now() + interval '60 days',
      subscription_status = 'parked'
  where id in (
    select id from public.profiles
    where agency_owner_id = _manager and parked_at is null
    order by created_at asc
    offset lim
  );
  get diagnostics parked_count = row_count;
  return parked_count;
end $$;

grant execute on function public.reconcile_agency_seats(uuid) to service_role;
