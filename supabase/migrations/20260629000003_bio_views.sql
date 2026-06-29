-- Analytics do Link na bio: contador de visitas da página pública.
alter table public.profiles add column if not exists bio_views bigint default 0;

-- Incrementa visitas pelo slug (chamado pela página pública /bio/:slug). Aberto p/ anon.
create or replace function public.increment_bio_view(_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set bio_views = coalesce(bio_views, 0) + 1 where bio_slug = _slug;
$$;

grant execute on function public.increment_bio_view(text) to anon, authenticated;
