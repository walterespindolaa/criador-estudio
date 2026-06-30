-- Versiona em código a RLS das tabelas multi-tenant que foram criadas pelo painel.
-- Idempotente: garante RLS ligada e re-declara as políticas conhecidas (mesma definição já em produção).

-- ── account_members (vínculo criadora ↔ gestora) ──
alter table public.account_members enable row level security;

drop policy if exists "View own membership rows" on public.account_members;
create policy "View own membership rows" on public.account_members
  for select using (auth.uid() = owner_id or auth.uid() = member_id);

drop policy if exists "Owner inserts membership" on public.account_members;
create policy "Owner inserts membership" on public.account_members
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Owner updates membership" on public.account_members;
create policy "Owner updates membership" on public.account_members
  for update using (auth.uid() = owner_id);

drop policy if exists "Owner deletes membership" on public.account_members;
create policy "Owner deletes membership" on public.account_members
  for delete using (auth.uid() = owner_id);

-- ── crm_clients (clientes da social mídia) ──
alter table public.crm_clients enable row level security;

drop policy if exists "owner_all_crm_clients" on public.crm_clients;
drop policy if exists "crm_clients_owner" on public.crm_clients;
create policy "crm_clients_owner" on public.crm_clients
  for all using (manager_id = auth.uid()) with check (manager_id = auth.uid());

-- ── external_clients (clientes externos vinculados) ──
alter table public.external_clients enable row level security;

drop policy if exists "ec_select_own" on public.external_clients;
create policy "ec_select_own" on public.external_clients for select using (manager_id = auth.uid());
drop policy if exists "ec_insert_own" on public.external_clients;
create policy "ec_insert_own" on public.external_clients for insert with check (manager_id = auth.uid());
drop policy if exists "ec_update_own" on public.external_clients;
create policy "ec_update_own" on public.external_clients for update using (manager_id = auth.uid());
drop policy if exists "ec_delete_own" on public.external_clients;
create policy "ec_delete_own" on public.external_clients for delete using (manager_id = auth.uid());
