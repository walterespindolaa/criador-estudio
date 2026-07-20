-- Crons que faltavam agendar + heartbeat de execução.
-- GO-LIVE Fase A: "Cros agendados e rodando" estava aberto. story-notifications
-- (~15 min) e trash-purge (diário) não tinham cron.schedule versionado.
-- Além de agendar, gravamos em cron_runs quando cada job DISPARA, pra dar
-- visibilidade (se um cron morrer, a última execução para de avançar).
-- Idempotente.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Heartbeat: última vez que cada job disparou ──
create table if not exists public.cron_runs (
  job text primary key,
  last_fired_at timestamptz not null default now(),
  request_id bigint
);

alter table public.cron_runs enable row level security;
-- Só admin lê (dado operacional interno).
drop policy if exists "cron_runs_admin_read" on public.cron_runs;
create policy "cron_runs_admin_read" on public.cron_runs
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── Helper: registra o disparo e chama a edge function ──
-- SECURITY DEFINER: roda como dono (postgres), que pode net.http_post e escrever.
create or replace function public.cron_fire(_job text, _url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare rid bigint;
begin
  select net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', '57892381207d35096c8b2eca38a0bca7f286040322401a2c'
    ),
    body := '{}'::jsonb
  ) into rid;

  insert into public.cron_runs (job, last_fired_at, request_id)
  values (_job, now(), rid)
  on conflict (job) do update set last_fired_at = now(), request_id = excluded.request_id;
end $$;

-- ── Agenda story-notifications (a cada 15 min) ──
do $$ begin perform cron.unschedule('cria-story-notif'); exception when others then null; end $$;
select cron.schedule('cria-story-notif', '*/15 * * * *', $cron$
  select public.cron_fire('cria-story-notif',
    'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/story-notifications');
$cron$);

-- ── Agenda trash-purge (1x/dia, 04:30 UTC ~ 01:30 BRT) ──
do $$ begin perform cron.unschedule('cria-trash-purge'); exception when others then null; end $$;
select cron.schedule('cria-trash-purge', '30 4 * * *', $cron$
  select public.cron_fire('cria-trash-purge',
    'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/trash-purge');
$cron$);
