-- CRM: campos de empresa/contrato do cliente, status fixo e etiquetas personalizadas.

-- ── Cliente: informações gerais + contrato ──
alter table public.crm_clients
  add column if not exists company_name text,        -- razão social
  add column if not exists cnpj text,
  add column if not exists owner_name text,          -- responsável principal
  add column if not exists whatsapp text,
  add column if not exists address text,
  add column if not exists plan_name text,           -- plano contratado
  add column if not exists payment_day int,          -- dia do mês em que recebe (ex.: 15)
  add column if not exists birthday date,            -- aniversário (lembrete do social mídia)
  add column if not exists status text not null default 'ativo',  -- ativo | inativo | pausado (FIXOS)
  add column if not exists tags text[] not null default '{}';     -- etiquetas (VARIÁVEIS)

alter table public.crm_clients
  drop constraint if exists crm_clients_status_check;
alter table public.crm_clients
  add constraint crm_clients_status_check check (status in ('ativo','inativo','pausado'));

-- Migra o booleano antigo pro novo status (só onde ainda não foi definido).
update public.crm_clients set status = case when active is false then 'inativo' else 'ativo' end
where status is null or status = 'ativo';

-- ── Catálogo de etiquetas da agência (nome + cor), reutilizável entre clientes ──
create table if not exists public.crm_tags (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'slate',   -- slate|emerald|amber|rose|violet|sky|orange|green
  created_at timestamptz default now(),
  unique (manager_id, name)
);

alter table public.crm_tags enable row level security;

drop policy if exists "crm_tags_owner" on public.crm_tags;
create policy "crm_tags_owner" on public.crm_tags
  for all to authenticated using (manager_id = auth.uid()) with check (manager_id = auth.uid());

-- Colaborador do time também acessa (mesmo helper do acesso de colaborador).
drop policy if exists "crm_tags_team" on public.crm_tags;
create policy "crm_tags_team" on public.crm_tags
  for all to authenticated using (public.acts_for(manager_id)) with check (public.acts_for(manager_id));

create index if not exists idx_crm_tags_manager on public.crm_tags(manager_id);
create index if not exists idx_crm_clients_status on public.crm_clients(manager_id, status);
