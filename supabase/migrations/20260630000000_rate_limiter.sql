-- Rate limiter genérico por chave (IP, IP+slug, etc.) — atômico via INSERT ... ON CONFLICT.
-- Usado por edge functions públicas (meta-capi, bio-track).
create table if not exists public.rl_buckets (
  key text not null,
  window_start timestamptz not null default date_trunc('minute', now()),
  count int not null default 0,
  primary key (key, window_start)
);

create or replace function public.rate_touch(_key text, _limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := date_trunc('minute', now());
  c int;
begin
  insert into public.rl_buckets(key, window_start, count)
  values (_key, w, 1)
  on conflict (key, window_start) do update set count = public.rl_buckets.count + 1
  returning count into c;
  return c <= _limit;
end $$;

revoke all on function public.rate_touch(text, int) from public, anon, authenticated;
grant execute on function public.rate_touch(text, int) to service_role;

-- Os bumps de métrica da bio só podem ser chamados pela edge bio-track (service_role),
-- nunca direto pelo anon — assim o throttle por IP não tem como ser pulado.
revoke execute on function public.increment_bio_view(text) from anon, authenticated;
grant execute on function public.increment_bio_view(text) to service_role;
do $$ begin
  revoke execute on function public.increment_bio_link_click(uuid) from anon, authenticated;
  grant execute on function public.increment_bio_link_click(uuid) to service_role;
exception when undefined_function then null; end $$;

-- Limpeza diária dos buckets antigos.
do $$ begin perform cron.unschedule('rl-buckets-cleanup'); exception when others then null; end $$;
select cron.schedule('rl-buckets-cleanup', '15 4 * * *', $cron$
  delete from public.rl_buckets where window_start < now() - interval '2 hours';
$cron$);
