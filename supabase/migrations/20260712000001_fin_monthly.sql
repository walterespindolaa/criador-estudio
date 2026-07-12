-- Mensalidade como INSTÂNCIA do mês (modelo absorvido do Atlas: template + instância).
-- Resolve: desfazer o "marcar recebido" e pular mensalidade sem perder o histórico.
-- Antes, a mensalidade era materializada direto como lançamento pago — não havia o que desfazer.

create table if not exists public.fin_monthly (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  crm_client_id uuid references public.crm_clients(id) on delete cascade,
  month_ref date not null,                 -- 1º dia do mês (ex.: 2026-07-01)
  due_date date not null,                  -- vencimento real (payment_day do cliente)
  amount numeric not null default 0,
  status text not null default 'pendente', -- pendente | pago | pulado
  skip_reason text,
  fin_record_id uuid references public.fin_records(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (crm_client_id, month_ref)
);

alter table public.fin_monthly
  drop constraint if exists fin_monthly_status_check;
alter table public.fin_monthly
  add constraint fin_monthly_status_check check (status in ('pendente','pago','pulado'));

alter table public.fin_monthly enable row level security;

drop policy if exists "fin_monthly_owner" on public.fin_monthly;
create policy "fin_monthly_owner" on public.fin_monthly
  for all to authenticated using (manager_id = auth.uid()) with check (manager_id = auth.uid());

drop policy if exists "fin_monthly_team" on public.fin_monthly;
create policy "fin_monthly_team" on public.fin_monthly
  for all to authenticated using (public.acts_for(manager_id)) with check (public.acts_for(manager_id));

create index if not exists idx_fin_monthly_mgr_month on public.fin_monthly(manager_id, month_ref);
