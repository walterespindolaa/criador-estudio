-- P1 de segurança do pente fino.

-- 1) Travar access_expires_at no profiles (acesso é controlado pelo servidor, igual trial).
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = (select role from public.profiles where id = auth.uid())
  and plan is not distinct from (select plan from public.profiles where id = auth.uid())
  and subscription_status is not distinct from (select subscription_status from public.profiles where id = auth.uid())
  and stripe_customer_id is not distinct from (select stripe_customer_id from public.profiles where id = auth.uid())
  and stripe_subscription_id is not distinct from (select stripe_subscription_id from public.profiles where id = auth.uid())
  and trial_started_at is not distinct from (select trial_started_at from public.profiles where id = auth.uid())
  and trial_ends_at is not distinct from (select trial_ends_at from public.profiles where id = auth.uid())
  and access_expires_at is not distinct from (select access_expires_at from public.profiles where id = auth.uid())
);

-- 2) Garantir RLS + policy de dono nas tabelas de CRM/financeiro (foram criadas via dashboard;
--    isto é cinto-e-suspensório: se já existir policy correta, esta apenas reforça).
alter table public.crm_clients      enable row level security;
alter table public.crm_leads        enable row level security;
alter table public.crm_contracts    enable row level security;
alter table public.crm_client_refs  enable row level security;
alter table public.fin_records      enable row level security;
alter table public.fin_recurring    enable row level security;

drop policy if exists "owner_all_crm_clients"     on public.crm_clients;
drop policy if exists "owner_all_crm_leads"       on public.crm_leads;
drop policy if exists "owner_all_crm_contracts"   on public.crm_contracts;
drop policy if exists "owner_all_crm_client_refs" on public.crm_client_refs;
drop policy if exists "owner_all_fin_records"     on public.fin_records;
drop policy if exists "owner_all_fin_recurring"   on public.fin_recurring;

create policy "owner_all_crm_clients"     on public.crm_clients     for all using (manager_id = auth.uid()) with check (manager_id = auth.uid());
create policy "owner_all_crm_leads"       on public.crm_leads       for all using (manager_id = auth.uid()) with check (manager_id = auth.uid());
create policy "owner_all_crm_contracts"   on public.crm_contracts   for all using (manager_id = auth.uid()) with check (manager_id = auth.uid());
create policy "owner_all_crm_client_refs" on public.crm_client_refs for all using (manager_id = auth.uid()) with check (manager_id = auth.uid());
create policy "owner_all_fin_records"     on public.fin_records     for all using (manager_id = auth.uid()) with check (manager_id = auth.uid());
create policy "owner_all_fin_recurring"   on public.fin_recurring   for all using (manager_id = auth.uid()) with check (manager_id = auth.uid());
