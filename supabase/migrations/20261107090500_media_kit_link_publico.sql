-- ============================================================
-- MEDIA KIT PRA MANDAR PRA MARCA (Walter, 06/11/2026; mockup aprovado)
--
--  - media_kit_profiles ganha: capa (padrão Cria, neutro, cor livre ou uma
--    das capas do Cria), slug do link público, publico (link no ar ou não),
--    mostrar (blocos ligados/desligados) e aviso_mensal.
--  - media_kit_versoes: cópias do kit por marca, com capa, cor e blocos
--    próprios e um endereço próprio (criaclub.bio/slug/kit/versao).
--  - media_kit_aberturas: cada abertura do link público (pro "quem abriu").
--  - RPC media_kit_publico(_slug, _versao, _contar): a ÚNICA porta de
--    leitura pública. Devolve só o que está marcado como visível e só se o
--    link estiver no ar. Os números são calculados na hora a partir do que o
--    robô do Instagram grava (a cada 20 min), com a mesma conta da tela.
--  - Aviso todo dia 1º pra revisar o kit (notifications -> push).
--
-- Idempotente.
-- ============================================================

alter table public.media_kit_profiles add column if not exists capa text not null default 'cria';
alter table public.media_kit_profiles add column if not exists slug text;
alter table public.media_kit_profiles add column if not exists publico boolean not null default false;
alter table public.media_kit_profiles add column if not exists mostrar jsonb not null
  default '{"numeros":true,"audiencia":true,"desempenho":true,"conteudos":true,"valores":true}'::jsonb;
alter table public.media_kit_profiles add column if not exists aviso_mensal boolean not null default true;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'media_kit_slug_formato') then
    alter table public.media_kit_profiles add constraint media_kit_slug_formato
      check (slug is null or slug ~ '^[a-z0-9][a-z0-9._-]{1,38}[a-z0-9]$');
  end if;
end $$;
create unique index if not exists media_kit_profiles_slug_uniq on public.media_kit_profiles (lower(slug)) where slug is not null;

-- ── Versões por marca ──────────────────────────────────────────────
create table if not exists public.media_kit_versoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 1 and 60),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$'),
  capa text,
  accent text,
  mostrar jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);
alter table public.media_kit_versoes enable row level security;
drop policy if exists media_kit_versoes_dono on public.media_kit_versoes;
create policy media_kit_versoes_dono on public.media_kit_versoes for all
  using (auth.uid() = user_id or public.is_perfil_proprio(user_id))
  with check (auth.uid() = user_id or public.is_perfil_proprio(user_id));

-- ── Aberturas do link ─────────────────────────────────────────────
create table if not exists public.media_kit_aberturas (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  versao_id uuid references public.media_kit_versoes(id) on delete set null,
  aberto_em timestamptz not null default now()
);
create index if not exists media_kit_aberturas_dono on public.media_kit_aberturas (user_id, aberto_em desc);
alter table public.media_kit_aberturas enable row level security;
-- Só a dona LÊ. Ninguém grava direto: quem grava é a RPC pública.
drop policy if exists media_kit_aberturas_ler on public.media_kit_aberturas;
create policy media_kit_aberturas_ler on public.media_kit_aberturas for select
  using (auth.uid() = user_id or public.is_perfil_proprio(user_id));

-- ── Leitura pública ───────────────────────────────────────────────
create or replace function public.media_kit_publico(_slug text, _versao text default null, _contar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.media_kit_profiles;
  v public.media_kit_versoes;
  p public.profiles;
  m jsonb;
  capa text;
  cor text;
  dono uuid;
  r jsonb;
  st jsonb := null;
  des jsonb := null;
  posts jsonb := null;
  atualizado date;
  seg int; seg0 int; alcance bigint; inter bigint; visitas bigint; engaj bigint;
  salvos bigint; qtd int; media_alc int;
begin
  if _slug is null or length(_slug) > 60 then return null; end if;
  select * into k from public.media_kit_profiles where lower(slug) = lower(_slug) and publico limit 1;
  if not found then return null; end if;
  dono := k.user_id;
  m := coalesce(k.mostrar, '{}'::jsonb);
  capa := coalesce(k.capa, 'cria');
  cor := coalesce(k.accent, '#0061EE');

  if _versao is not null and _versao <> '' then
    select * into v from public.media_kit_versoes where user_id = dono and slug = lower(_versao);
    if not found then return null; end if;
    m := m || coalesce(v.mostrar, '{}'::jsonb);
    capa := coalesce(v.capa, capa);
    cor := coalesce(v.accent, cor);
  end if;

  select * into p from public.profiles where id = dono;

  -- Números da conta (mesma conta da tela: últimos 30 dias).
  if coalesce((m->>'numeros')::boolean, true) or coalesce((m->>'desempenho')::boolean, true) then
    select d.followers into seg from public.social_metrics_daily d
      where d.user_id = dono and d.provider = 'instagram' and d.crm_client_id is null
        and d.date >= current_date - 30 and d.followers is not null order by d.date desc limit 1;
    select d.followers into seg0 from public.social_metrics_daily d
      where d.user_id = dono and d.provider = 'instagram' and d.crm_client_id is null
        and d.date >= current_date - 30 and d.followers is not null order by d.date asc limit 1;
    select coalesce(sum(d.reach), 0), max(d.date) into alcance, atualizado from public.social_metrics_daily d
      where d.user_id = dono and d.provider = 'instagram' and d.crm_client_id is null and d.date >= current_date - 30;
    select coalesce(
      (select (d.metrics->>'total_interactions_30d')::bigint from public.social_metrics_daily d
        where d.user_id = dono and d.provider = 'instagram' and d.crm_client_id is null and d.date >= current_date - 30
          and d.metrics ? 'total_interactions_30d' and d.metrics->>'total_interactions_30d' is not null order by d.date desc limit 1),
      (select sum(d.total_interactions) from public.social_metrics_daily d
        where d.user_id = dono and d.provider = 'instagram' and d.crm_client_id is null and d.date >= current_date - 30)) into inter;
    select coalesce(
      (select (d.metrics->>'profile_views_30d')::bigint from public.social_metrics_daily d
        where d.user_id = dono and d.provider = 'instagram' and d.crm_client_id is null and d.date >= current_date - 30
          and d.metrics->>'profile_views_30d' is not null order by d.date desc limit 1),
      (select sum(d.profile_views) from public.social_metrics_daily d
        where d.user_id = dono and d.provider = 'instagram' and d.crm_client_id is null and d.date >= current_date - 30)) into visitas;
    select coalesce(
      (select (d.metrics->>'accounts_engaged_30d')::bigint from public.social_metrics_daily d
        where d.user_id = dono and d.provider = 'instagram' and d.crm_client_id is null and d.date >= current_date - 30
          and d.metrics->>'accounts_engaged_30d' is not null order by d.date desc limit 1),
      (select sum(d.accounts_engaged) from public.social_metrics_daily d
        where d.user_id = dono and d.provider = 'instagram' and d.crm_client_id is null and d.date >= current_date - 30)) into engaj;

    with mid as (
      select coalesce((s.metrics->>'saved')::bigint, (s.metrics->>'saves')::bigint, 0) as salvo,
             coalesce((s.metrics->>'reach')::bigint, 0) as alc
      from public.social_insights s
      where s.user_id = dono and s.provider = 'instagram' and s.object_type = 'media' and s.crm_client_id is null
      order by s.posted_at desc nulls last limit 200
    )
    select coalesce(sum(salvo), 0), count(*)::int,
           coalesce(round(avg(alc) filter (where alc > 0)), 0)::int
      into salvos, qtd, media_alc from mid;

    if coalesce((m->>'numeros')::boolean, true) then
      st := jsonb_build_object(
        'followers', coalesce(seg, 0),
        'reachMonth', alcance,
        'engagementPct', case when alcance > 0 then least(100, coalesce(inter, 0)::numeric * 100 / alcance) else 0 end,
        'saves', salvos);
    end if;
    if coalesce((m->>'desempenho')::boolean, true) then
      des := jsonb_build_object(
        'followersGrowth', case when seg is not null and seg0 is not null then seg - seg0 else 0 end,
        'profileViews', coalesce(visitas, 0),
        'accountsEngaged', coalesce(engaj, 0),
        'interactions', coalesce(inter, 0),
        'avgReach', media_alc,
        'postsCount', qtd);
    end if;
  end if;

  -- Melhores conteúdos: os escolhidos a dedo ou os 3 de maior alcance.
  if coalesce((m->>'conteudos')::boolean, true) and coalesce(k.show_top_posts, true) then
    with base as (
      select s.id, s.media_type, s.caption, s.thumbnail_url, s.metrics, s.posted_at,
             po.title, po.format
      from public.social_insights s
      left join public.posts po on po.id = s.post_id
      where s.user_id = dono and s.provider = 'instagram' and s.object_type = 'media' and s.crm_client_id is null
    ), escolhidos as (
      select b.*, e.ord from base b
      join jsonb_array_elements_text(coalesce(k.featured_post_ids, '[]'::jsonb)) with ordinality e(id, ord) on e.id = b.id::text
    ), lista as (
      select * from (select *, ord as ordem from escolhidos) x
      union all
      select * from (
        select b.*, null::bigint as ord, null::bigint as ordem from base b
        where not exists (select 1 from escolhidos)
          and b.posted_at >= now() - interval '90 days'
        order by coalesce((b.metrics->>'reach')::bigint, 0) desc limit 3
      ) y
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', coalesce(nullif(l.title, ''), nullif(left(coalesce(l.caption, ''), 60), ''), 'Publicação'),
      'format', coalesce(l.format, case l.media_type when 'VIDEO' then 'Reels' when 'CAROUSEL_ALBUM' then 'Carrossel' else 'Foto' end),
      'reach', coalesce((l.metrics->>'reach')::bigint, 0),
      'saves', coalesce((l.metrics->>'saved')::bigint, (l.metrics->>'saves')::bigint, 0),
      'thumbnail_url', l.thumbnail_url
    ) order by l.ordem nulls last, coalesce((l.metrics->>'reach')::bigint, 0) desc), '[]'::jsonb)
    into posts from (select * from lista limit 3) l;
  end if;

  r := jsonb_build_object(
    'nome', coalesce(nullif(trim(k.display_name), ''), p.name, 'Media kit'),
    'handle', (select '@' || c.username from public.social_connections c
                where c.user_id = dono and c.provider = 'instagram' and c.crm_client_id is null limit 1),
    'avatar_url', coalesce(k.avatar_url, p.avatar_url),
    'niche', coalesce(k.niche, p.niche, ''),
    'bio', coalesce(k.bio, p.bio, ''),
    'capa', capa,
    'accent', cor,
    'contato', k.contact,
    'cidades', case when coalesce((m->>'audiencia')::boolean, true) then k.cities end,
    'genero', case when coalesce((m->>'audiencia')::boolean, true) then k.gender end,
    'audiencia', case when coalesce((m->>'audiencia')::boolean, true) then k.audience end,
    'servicos', case when coalesce((m->>'valores')::boolean, true) then k.services end,
    'stats', st,
    'desempenho', des,
    'posts', coalesce(posts, '[]'::jsonb),
    'atualizado_em', atualizado,
    'versao', case when v.id is not null then v.nome end
  );

  -- Conta a abertura (a dona olhando o próprio link não conta).
  if _contar and (auth.uid() is null or auth.uid() <> dono) then
    insert into public.media_kit_aberturas (user_id, versao_id) values (dono, v.id);
  end if;
  return r;
end $$;

revoke all on function public.media_kit_publico(text, text, boolean) from public;
grant execute on function public.media_kit_publico(text, text, boolean) to anon, authenticated;

-- ── Aviso todo dia 1º (09h23 de Brasília) ─────────────────────────
do $$ begin
  if exists (select 1 from cron.job where jobname = 'cria-media-kit-mensal') then
    perform cron.unschedule('cria-media-kit-mensal');
  end if;
end $$;
select cron.schedule('cria-media-kit-mensal', '23 12 1 * *', $cron$
  insert into public.notifications (user_id, type, title, description, link)
  select k.user_id, 'media_kit', 'Hora de revisar seu media kit',
         'Os números já se atualizaram sozinhos. Confira audiência e valores antes de mandar pra uma marca.',
         '/app/media-kit'
  from public.media_kit_profiles k
  where k.aviso_mensal and k.updated_at > now() - interval '1 year';
$cron$);
