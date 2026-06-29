-- Plano de Agência: a social mídia compra N assentos e adiciona clientes cobertos por ela.
-- seat_limit: provisionado pelo webhook do Stripe (plan=agency, quantidade = assentos).
alter table public.profiles add column if not exists seat_limit int default 0;
-- agency_owner_id: marca uma conta de criadora como "coberta" por uma agência (a social mídia que paga).
alter table public.profiles add column if not exists agency_owner_id uuid references auth.users(id) on delete set null;

create index if not exists idx_profiles_agency_owner on public.profiles (agency_owner_id);

-- Quantos assentos a agência (auth.uid()) já usa.
create or replace function public.agency_seats_used()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.profiles where agency_owner_id = auth.uid();
$$;

grant execute on function public.agency_seats_used() to authenticated;
