-- Heartbeat de crons. Os crons JÁ estão agendados em produção (à mão):
-- story-notifications-15min, trash-purge-daily, cria-daily-notif, cria-ig-refresh,
-- storage-cleanup-daily, criapost-media-cleanup-daily, agency-inventory-cleanup,
-- rl-buckets-cleanup, trend-bank-weekly. Aqui só damos VISIBILIDADE: cada edge
-- function de cron grava sua execução nesta tabela (via service_role). Se um cron
-- morrer, o last_run_at para de avançar e dá pra perceber.
-- NÃO agenda nada aqui pra não duplicar os jobs existentes.

create table if not exists public.cron_runs (
  job text primary key,
  last_run_at timestamptz not null default now(),
  ok boolean not null default true,
  detail text
);

alter table public.cron_runs enable row level security;
-- Só admin lê (operacional interno). O service_role das edge functions ignora RLS.
drop policy if exists "cron_runs_admin_read" on public.cron_runs;
create policy "cron_runs_admin_read" on public.cron_runs
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
