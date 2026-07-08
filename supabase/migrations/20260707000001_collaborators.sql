-- Colaboradores da agência (social mídia). 1 grátis; extras pagos via Stripe (paid_collab_seats).
-- Espelha o modelo do Atlas Negócios (companies.paid_seats + business-member-invite/seats-checkout).

alter table public.profiles
  add column if not exists paid_collab_seats int not null default 0;

-- Vínculo dona (social mídia) → colaborador.
create table if not exists public.manager_members (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  name text,
  email text,
  status text default 'ativo',            -- ativo | pausado
  created_at timestamptz default now(),
  unique (manager_id, member_id)
);

-- Permissões do colaborador: por módulo + escopo (todos os clientes ou uma lista).
create table if not exists public.manager_member_permissions (
  id uuid primary key default gen_random_uuid(),
  member_row_id uuid not null references public.manager_members(id) on delete cascade,
  module_code text not null,              -- cria_post | cria_gestao | hub_cria | agenda
  all_clients boolean default false,
  client_ids uuid[] default '{}',         -- crm_clients quando não é all_clients
  created_at timestamptz default now(),
  unique (member_row_id, module_code)
);

alter table public.manager_members enable row level security;
alter table public.manager_member_permissions enable row level security;

-- A dona gerencia seus próprios membros; o colaborador lê o vínculo dele.
drop policy if exists "manager_members owner" on public.manager_members;
create policy "manager_members owner" on public.manager_members
  for all using (auth.uid() = manager_id) with check (auth.uid() = manager_id);
drop policy if exists "manager_members self read" on public.manager_members;
create policy "manager_members self read" on public.manager_members
  for select using (auth.uid() = member_id);

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
