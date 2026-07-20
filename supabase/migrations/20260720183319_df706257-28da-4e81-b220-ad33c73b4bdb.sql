create table if not exists public.cron_runs (
  job text primary key,
  last_run_at timestamptz not null default now(),
  ok boolean not null default true,
  detail text
);

alter table public.cron_runs enable row level security;

drop policy if exists "cron_runs_admin_read" on public.cron_runs;
create policy "cron_runs_admin_read" on public.cron_runs
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));