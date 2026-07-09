-- Acesso de colaborador (Fase 1). Opção A: o colaborador atua DENTRO do tenant do gestor.
-- Fundação: uma função só decide a tenancy (acts_for) e as tabelas da agência
-- ganham policy ADITIVA de time. Nada é removido → gestor atual não quebra.
-- Escopo por cliente é controlado na UI nesta fase; isolamento entre contas é RLS.

-- Guarda a assinatura de assentos de colaborador (sync pelo stripe-webhook).
alter table public.profiles
  add column if not exists collab_seats_subscription_id text;

-- ── Helpers (security definer p/ ler manager_members sem recursão de RLS) ──
create or replace function public.is_team_member(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.manager_members m
    where m.manager_id = target
      and m.member_id = auth.uid()
      and m.status = 'ativo'
  );
$$;

-- true se o usuário logado É o dono do tenant OU é colaborador ativo dele.
create or replace function public.acts_for(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid() or public.is_team_member(target);
$$;

grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.acts_for(uuid) to authenticated;

-- ── RLS aditiva por time nas tabelas da agência (manager_id-keyed) ──
do $$
declare t text;
begin
  foreach t in array array[
    'crm_clients','crm_leads','crm_contracts','crm_tasks','crm_client_refs',
    'external_clients','competitor_scrapes','creative_ideas',
    'agenda_creations','agenda_captures'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_team', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.acts_for(manager_id)) with check (public.acts_for(manager_id));',
      t||'_team', t
    );
  end loop;
end $$;

-- posts serve dupla função (pessoal do criador + Cria Post de cliente externo).
-- O colaborador só pode tocar nos posts de CLIENTE EXTERNO do gestor — nunca os pessoais.
drop policy if exists "posts_team_external" on public.posts;
create policy "posts_team_external" on public.posts for all to authenticated
  using (external_client_id is not null and public.is_team_member(user_id))
  with check (external_client_id is not null and public.is_team_member(user_id));

-- Comentários de aprovação seguem o post (via is_team_member do dono do post).
drop policy if exists "approval_tokens_team" on public.approval_tokens;
create policy "approval_tokens_team" on public.approval_tokens for all to authenticated
  using (public.acts_for(manager_id)) with check (public.acts_for(manager_id));

-- Colaborador lê (só leitura) os entitlements de módulo do gestor pra ver o que está liberado.
alter table public.module_entitlements enable row level security;
drop policy if exists "module_entitlements_team_read" on public.module_entitlements;
create policy "module_entitlements_team_read" on public.module_entitlements for select to authenticated
  using (public.is_team_member(manager_id));

-- ── RPC: managers que o usuário logado atende como colaborador ativo ──
-- Formato espelha my_managed_accounts (owner_id = manager) p/ reusar o switcher de conta.
create or replace function public.my_team_accounts()
returns table (owner_id uuid, name text, avatar_url text, niche text, instagram_handle text)
language sql stable security definer set search_path = public as $$
  select p.id as owner_id,
         coalesce(p.name, 'Agência') as name,
         p.avatar_url,
         null::text as niche,
         null::text as instagram_handle
  from public.manager_members m
  join public.profiles p on p.id = m.manager_id
  where m.member_id = auth.uid() and m.status = 'ativo';
$$;
grant execute on function public.my_team_accounts() to authenticated;

-- ── RPC: permissões do colaborador logado sob um gestor (p/ gate de módulo na UI) ──
create or replace function public.my_member_permissions(target uuid)
returns table (module_code text, all_clients boolean, client_ids uuid[])
language sql stable security definer set search_path = public as $$
  select perm.module_code, perm.all_clients, perm.client_ids
  from public.manager_members m
  join public.manager_member_permissions perm on perm.member_row_id = m.id
  where m.manager_id = target and m.member_id = auth.uid() and m.status = 'ativo';
$$;
grant execute on function public.my_member_permissions(uuid) to authenticated;
