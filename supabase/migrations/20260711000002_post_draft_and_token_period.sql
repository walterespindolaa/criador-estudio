-- 1) Rascunho de post: permite anexar mídia JÁ na criação (o storage precisa do post.id).
--    Rascunho não aparece no kanban/calendário nem vai pro cliente.
alter table public.posts
  add column if not exists is_draft boolean not null default false;

create index if not exists idx_posts_draft on public.posts(external_client_id) where is_draft = false;

-- 2) Link de aprovação por PERÍODO: o social mídia escolhe mandar tudo ou só um intervalo.
--    Null nos dois = tudo (comportamento atual, retrocompatível).
alter table public.approval_tokens
  add column if not exists period_start date,
  add column if not exists period_end date;

-- O portal público lê o período do token pra filtrar os posts exibidos.
-- approval_tokens.token é TEXT (não uuid).
drop function if exists public.get_token_period(uuid);

create or replace function public.get_token_period(_token text)
returns table (period_start date, period_end date)
language sql stable security definer set search_path = public as $$
  select t.period_start, t.period_end
  from public.approval_tokens t
  where t.token = _token and t.active = true;
$$;
grant execute on function public.get_token_period(text) to anon, authenticated;
