-- CRIA CAPTAÇÃO v2: biblioteca de roteiros por cliente, cliente avulso e
-- tomadas padrão POR CLIENTE.
--
-- 1) capture_scripts: VÁRIOS roteiros salvos por cliente e por mês (antes o
--    roteiro morava só dentro da captação agendada, 1 por captação). O roteiro
--    pode nascer manual ou importado de um reels aprovado do Cria Post.
-- 2) capture_extra_clients: cliente AVULSO da captação (pasta sem cadastro no
--    CRM), pra gravar pra alguém fora da carteira.
-- 3) crm_clients.capture_shots: a lista de tomadas padrão daquele cliente
--    (sobrepõe a lista geral quando existir).

create table if not exists public.capture_scripts (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null,
  crm_client_id uuid references public.crm_clients(id) on delete cascade,
  client_name text,
  month text not null,
  title text not null default '',
  content text not null default '',
  source text not null default 'manual',
  source_post_id uuid,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.capture_scripts enable row level security;
drop policy if exists "capture_scripts tenant" on public.capture_scripts;
create policy "capture_scripts tenant" on public.capture_scripts
  for all to authenticated
  using (public.acts_for(manager_id)) with check (public.acts_for(manager_id));
create index if not exists idx_capture_scripts on public.capture_scripts(manager_id, month);

create table if not exists public.capture_extra_clients (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null,
  name text not null,
  city text,
  created_at timestamptz not null default now()
);
alter table public.capture_extra_clients enable row level security;
drop policy if exists "capture_extra_clients tenant" on public.capture_extra_clients;
create policy "capture_extra_clients tenant" on public.capture_extra_clients
  for all to authenticated
  using (public.acts_for(manager_id)) with check (public.acts_for(manager_id));
create index if not exists idx_capture_extra_clients on public.capture_extra_clients(manager_id);

alter table public.crm_clients add column if not exists capture_shots text[];
