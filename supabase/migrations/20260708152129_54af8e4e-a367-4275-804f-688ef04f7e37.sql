-- Agenda de criação + captações
create table if not exists public.agenda_creations (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  crm_client_id uuid references public.crm_clients(id) on delete cascade,
  client_name text,
  team text,
  note text,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.agenda_creations to authenticated;
grant all on public.agenda_creations to service_role;
alter table public.agenda_creations enable row level security;
drop policy if exists "agenda_creations owner" on public.agenda_creations;
create policy "agenda_creations owner" on public.agenda_creations
  for all using (auth.uid() = manager_id) with check (auth.uid() = manager_id);

create table if not exists public.agenda_captures (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  capture_date date not null,
  capture_time text,
  location text,
  crm_client_id uuid references public.crm_clients(id) on delete set null,
  client_name text,
  team text,
  status text default 'agendada',
  note text,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.agenda_captures to authenticated;
grant all on public.agenda_captures to service_role;
alter table public.agenda_captures enable row level security;
drop policy if exists "agenda_captures owner" on public.agenda_captures;
create policy "agenda_captures owner" on public.agenda_captures
  for all using (auth.uid() = manager_id) with check (auth.uid() = manager_id);

create index if not exists idx_agenda_creations on public.agenda_creations(manager_id, day);
create index if not exists idx_agenda_captures on public.agenda_captures(manager_id, capture_date);

-- Colaboradores da agência
alter table public.profiles
  add column if not exists paid_collab_seats int not null default 0;

create table if not exists public.manager_members (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  name text,
  email text,
  status text default 'ativo',
  created_at timestamptz default now(),
  unique (manager_id, member_id)
);
grant select, insert, update, delete on public.manager_members to authenticated;
grant all on public.manager_members to service_role;
alter table public.manager_members enable row level security;
drop policy if exists "manager_members owner" on public.manager_members;
create policy "manager_members owner" on public.manager_members
  for all using (auth.uid() = manager_id) with check (auth.uid() = manager_id);
drop policy if exists "manager_members self read" on public.manager_members;
create policy "manager_members self read" on public.manager_members
  for select using (auth.uid() = member_id);

create table if not exists public.manager_member_permissions (
  id uuid primary key default gen_random_uuid(),
  member_row_id uuid not null references public.manager_members(id) on delete cascade,
  module_code text not null,
  all_clients boolean default false,
  client_ids uuid[] default '{}',
  created_at timestamptz default now(),
  unique (member_row_id, module_code)
);
grant select, insert, update, delete on public.manager_member_permissions to authenticated;
grant all on public.manager_member_permissions to service_role;
alter table public.manager_member_permissions enable row level security;
drop policy if exists "member_perms owner" on public.manager_member_permissions;
create policy "member_perms owner" on public.manager_member_permissions
  for all using (exists (select 1 from public.manager_members m where m.id = member_row_id and m.manager_id = auth.uid()))
  with check (exists (select 1 from public.manager_members m where m.id = member_row_id and m.manager_id = auth.uid()));
drop policy if exists "member_perms self read" on public.manager_member_permissions;
create policy "member_perms self read" on public.manager_member_permissions
  for select using (exists (select 1 from public.manager_members m where m.id = member_row_id and m.member_id = auth.uid()));

create index if not exists idx_manager_members_manager on public.manager_members(manager_id);
create index if not exists idx_manager_members_member on public.manager_members(member_id);
create index if not exists idx_member_perms_row on public.manager_member_permissions(member_row_id);

-- get_external_handle_by_token
create or replace function public.get_external_handle_by_token(_token text)
returns text
language sql
security definer
set search_path = public
as $$
  select ec.instagram_handle
  from approval_tokens at
  join external_clients ec on ec.id = at.external_client_id
  where at.token = _token
    and at.active = true
    and (at.expires_at is null or at.expires_at > now())
  limit 1;
$$;
grant execute on function public.get_external_handle_by_token(text) to anon, authenticated;