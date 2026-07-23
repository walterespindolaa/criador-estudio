-- Expansão da coleta de dados do Instagram (camada de dados; UI vem depois).
-- 1) crm_client_id nas tabelas de métricas/insights, pra separar a conta própria
--    das contas conectadas no contexto de um cliente (corrige o "caminho morto"
--    do sync, que só rodava a conexão com crm_client_id null).
-- 2) social_audience: demografia de audiência (follower/engaged por dimensão).
-- 3) social_stories: snapshot de stories (somem em 24h).
-- 4) manager_client_instagram passa a devolver demografia + stories pro gestor.
-- Idempotente: pode rodar de novo sem quebrar.

-- ─────────────────────────────────────────────────────────────
-- 1) crm_client_id em social_metrics_daily / social_insights
--    Índices únicos com NULLS NOT DISTINCT (Postgres 15+) pra que a conta própria
--    (crm_client_id null) continue deduplicando no upsert por onConflict.
-- ─────────────────────────────────────────────────────────────
alter table public.social_metrics_daily
  add column if not exists crm_client_id uuid references public.crm_clients(id) on delete cascade;
alter table public.social_metrics_daily
  drop constraint if exists social_metrics_daily_user_id_provider_date_key;
drop index if exists uq_social_metrics_daily_conn;
create unique index if not exists uq_social_metrics_daily_conn
  on public.social_metrics_daily (user_id, crm_client_id, provider, date) nulls not distinct;

alter table public.social_insights
  add column if not exists crm_client_id uuid references public.crm_clients(id) on delete cascade;
alter table public.social_insights
  drop constraint if exists social_insights_user_id_provider_object_type_object_id_key;
drop index if exists uq_social_insights_conn;
create unique index if not exists uq_social_insights_conn
  on public.social_insights (user_id, crm_client_id, provider, object_type, object_id) nulls not distinct;

-- ─────────────────────────────────────────────────────────────
-- 2) Demografia de audiência (1 linha por dimensão/bucket; snapshot mais recente)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.social_audience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  crm_client_id uuid references public.crm_clients(id) on delete cascade,
  provider text not null default 'instagram',
  metric text not null,             -- 'followers' | 'engaged'
  dimension text not null,          -- 'age' | 'gender' | 'city' | 'country'
  breakdown_value text not null,    -- '25-34' | 'M' | 'São Paulo' | 'BR'
  value integer not null default 0,
  captured_at timestamptz not null default now()
);
create unique index if not exists uq_social_audience_bucket
  on public.social_audience (user_id, crm_client_id, provider, metric, dimension, breakdown_value) nulls not distinct;
create index if not exists idx_social_audience_user
  on public.social_audience (user_id, provider, metric, dimension);

alter table public.social_audience enable row level security;
drop policy if exists "Users manage own audience" on public.social_audience;
create policy "Users manage own audience" on public.social_audience
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Leitura pelo gestor membro ativo da conta (mesmo padrão do social_insights via RPC,
-- e coerente com is_account_member usado nas tabelas de conteúdo do criador).
drop policy if exists "Members read audience" on public.social_audience;
create policy "Members read audience" on public.social_audience
  for select using (public.is_account_member(user_id));

-- ─────────────────────────────────────────────────────────────
-- 3) Stories (snapshot; stories somem em 24h)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.social_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  crm_client_id uuid references public.crm_clients(id) on delete cascade,
  provider text not null default 'instagram',
  external_story_id text not null,
  media_type text,
  permalink text,
  thumbnail_url text,
  media_url text,
  posted_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,  -- { reach, replies, total_interactions, navigation, ... }
  captured_at timestamptz not null default now()
);
create unique index if not exists uq_social_stories_conn
  on public.social_stories (user_id, crm_client_id, provider, external_story_id) nulls not distinct;
create index if not exists idx_social_stories_user
  on public.social_stories (user_id, provider, posted_at desc);

alter table public.social_stories enable row level security;
drop policy if exists "Users manage own stories" on public.social_stories;
create policy "Users manage own stories" on public.social_stories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Members read stories" on public.social_stories;
create policy "Members read stories" on public.social_stories
  for select using (public.is_account_member(user_id));

-- ─────────────────────────────────────────────────────────────
-- 4) RPC do gestor: expõe também demografia + stories do cliente (conta própria
--    do cliente = crm_client_id null). Mantém daily/media/post_id como já eram.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.manager_client_instagram(uuid);
create function public.manager_client_instagram(client_owner_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare _conn record; _daily jsonb; _media jsonb; _audience jsonb; _stories jsonb;
begin
  if not public.manager_owns_cria_client(client_owner_id) then
    return jsonb_build_object('connected', false);
  end if;

  select sc.username, sc.profile_picture_url, sc.updated_at into _conn
  from public.social_connections sc
  where sc.user_id = client_owner_id
    and sc.provider = 'instagram'
    and sc.crm_client_id is null
  limit 1;

  if not found then return jsonb_build_object('connected', false); end if;

  select coalesce(jsonb_agg(d order by d.date), '[]'::jsonb) into _daily
  from (
    select m.date, m.followers, m.reach, m.profile_views, m.total_interactions
    from public.social_metrics_daily m
    where m.user_id = client_owner_id and m.provider = 'instagram'
      and m.crm_client_id is null
      and m.date >= (current_date - interval '90 days')
    order by m.date
  ) d;

  select coalesce(jsonb_agg(x order by x.posted_at desc), '[]'::jsonb) into _media
  from (
    select i.id, i.media_type, i.caption, i.permalink, i.thumbnail_url, i.posted_at, i.metrics, i.post_id
    from public.social_insights i
    where i.user_id = client_owner_id and i.provider = 'instagram' and i.object_type = 'media'
      and i.crm_client_id is null
    order by i.posted_at desc nulls last
    limit 48
  ) x;

  select coalesce(jsonb_agg(a), '[]'::jsonb) into _audience
  from (
    select au.metric, au.dimension, au.breakdown_value, au.value
    from public.social_audience au
    where au.user_id = client_owner_id and au.provider = 'instagram'
      and au.crm_client_id is null
    order by au.metric, au.dimension, au.value desc
  ) a;

  select coalesce(jsonb_agg(s order by s.posted_at desc), '[]'::jsonb) into _stories
  from (
    select st.external_story_id, st.media_type, st.permalink, st.thumbnail_url,
           st.media_url, st.posted_at, st.metrics
    from public.social_stories st
    where st.user_id = client_owner_id and st.provider = 'instagram'
      and st.crm_client_id is null
    order by st.posted_at desc nulls last
    limit 60
  ) s;

  return jsonb_build_object(
    'connected', true, 'username', _conn.username,
    'profile_picture_url', _conn.profile_picture_url, 'last_sync', _conn.updated_at,
    'daily', _daily, 'media', _media, 'audience', _audience, 'stories', _stories);
end; $$;
grant execute on function public.manager_client_instagram(uuid) to authenticated;
