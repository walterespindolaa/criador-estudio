-- Métricas de uso do produto + crescimento (só admin).
create or replace function public.get_admin_usage()
returns jsonb language plpgsql security definer set search_path = public as $$
declare _r jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return null;
  end if;

  select jsonb_build_object(
    'posts',            (select count(*) from public.posts),
    'published_posts',  (select count(*) from public.posts where status = 'publicado'),
    'ideas',            (select count(*) from public.ideas),
    'cronogramas',      (select count(*) from public.cronogramas),
    'collabs',          (select count(*) from public.collabs),
    'tasks',            (select count(*) from public.tasks),
    'new_7d',           (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'new_30d',          (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'active_7d',        (select count(*) from public.profiles where last_seen_at >= now() - interval '7 days')
  ) into _r;

  return _r;
end; $$;

grant execute on function public.get_admin_usage() to authenticated;
