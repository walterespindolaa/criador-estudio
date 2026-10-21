-- ═══════════════════════════════════════════════════════════════════════════
-- MOTOR DE ANÁLISE DE TRÁFEGO DO CRIA (21/10/2026)
--
-- Walter: "criar um sistema de acompanhamento de acesso no link in bio na
-- parte admin ... acessos via tráfego no site pra criador e para social media
-- ... você preencher 1 ou 2x por dia via agendamento ... cada post, saber o
-- que está entregando e o que não, trazer sugestões".
--
-- Quatro fontes, um painel:
--   1. site_visitas         visitas e cliques da LP (criasocialclub.com.br),
--                            gravadas pela edge `site-track`. Sem IP, sem
--                            e-mail: só página, origem (UTM) e uma sessão
--                            aleatória da aba.
--   2. trafego_meta_diario  números de cada anúncio por dia, preenchidos pelo
--                            agendamento das 8h e 20h (Meta Ads -> SQL).
--   3. bio_stats_daily      já existia (edge bio-track). O painel só lê a bio
--                            da conta do Cria.
--   4. auth.users           cadastros com a UTM que o Signup passou a gravar
--                            nos metadados.
--   + trafego_analises      o que o agendamento concluiu: resumo, alertas e
--                            sugestões, uma linha por rodada.
--
-- Leitura só por admin (RPC admin_trafego_painel). Escrita só por service
-- role (edge e agendamento). Nenhuma policy de select/insert pra anon ou
-- authenticated nas tabelas novas: RLS ligado e fechado.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. VISITAS DO SITE ──────────────────────────────────────────────────────
create table if not exists public.site_visitas (
  id bigserial primary key,
  criado_em timestamptz not null default now(),
  dia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  evento text not null check (evento in ('view','cta','leu','ficou30','preco')),
  pagina text not null,
  publico text not null default 'outro' check (publico in ('criador','social','outro')),
  sessao text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  tem_fbclid boolean not null default false,
  referrer_host text,
  dispositivo text check (dispositivo in ('mobile','desktop')),
  alvo text
);
create index if not exists site_visitas_dia_idx on public.site_visitas (dia, publico);
create index if not exists site_visitas_camp_idx on public.site_visitas (utm_campaign, dia);
alter table public.site_visitas enable row level security;

-- ── 2. META ADS POR ANÚNCIO E DIA ───────────────────────────────────────────
create table if not exists public.trafego_meta_diario (
  dia date not null,
  ad_id text not null,
  ad_nome text,
  adset_id text,
  adset_nome text,
  campanha_id text,
  campanha_nome text,
  publico text check (publico in ('criador','social','outro')),
  status text,
  impressoes integer not null default 0,
  alcance integer not null default 0,
  frequencia numeric(8,2),
  gasto numeric(12,2) not null default 0,
  cpm numeric(10,2),
  ctr numeric(8,3),
  cliques_link integer not null default 0,
  visitas_lp integer not null default 0,
  thruplays integer not null default 0,
  custo_thruplay numeric(10,4),
  p25 integer not null default 0,
  p50 integer not null default 0,
  p75 integer not null default 0,
  p100 integer not null default 0,
  tempo_medio_s numeric(8,2),
  engajamento integer not null default 0,
  ranking_qualidade text,
  ranking_engajamento text,
  atualizado_em timestamptz not null default now(),
  primary key (dia, ad_id)
);
create index if not exists trafego_meta_diario_pub_idx on public.trafego_meta_diario (publico, dia);
alter table public.trafego_meta_diario enable row level security;

-- ── 3. O QUE O AGENDAMENTO CONCLUIU ─────────────────────────────────────────
create table if not exists public.trafego_analises (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  periodo_ini date,
  periodo_fim date,
  resumo text not null,
  destaques jsonb not null default '[]'::jsonb,   -- [{titulo, detalhe}]
  alertas jsonb not null default '[]'::jsonb,     -- [{nivel:'alto'|'medio', titulo, detalhe}]
  sugestoes jsonb not null default '[]'::jsonb,   -- [{prioridade:1..3, titulo, porque, acao}]
  por_anuncio jsonb not null default '[]'::jsonb, -- [{ad_id, veredito, motivo}]
  fonte text not null default 'agendamento'
);
create index if not exists trafego_analises_criado_idx on public.trafego_analises (criado_em desc);
alter table public.trafego_analises enable row level security;

-- ── 4. QUAL PÚBLICO É ESTA PÁGINA / CAMPANHA ────────────────────────────────
create or replace function public.trafego_publico(_pagina text, _campanha text)
returns text language sql immutable as $$
  select case
    when coalesce(_campanha,'') ilike '%social%' then 'social'
    when coalesce(_campanha,'') ilike '%criador%' then 'criador'
    when coalesce(_pagina,'') ilike '/social-media%' then 'social'
    when coalesce(_pagina,'') in ('/', '/index', '/index.html', '/funcionalidades', '/funcionalidades.html') then 'criador'
    else 'outro' end
$$;

-- ── 5. O PAINEL ─────────────────────────────────────────────────────────────
-- Um JSON só com tudo que a aba Tráfego desenha. Veredito por anúncio sai
-- daqui (regra fixa, explicável), e o agendamento acrescenta a leitura dele
-- em trafego_analises.por_anuncio.
create or replace function public.admin_trafego_painel(_dias integer default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_ini date := ((now() at time zone 'America/Sao_Paulo')::date - greatest(1, least(_dias, 90)) + 1);
  v_fim date := (now() at time zone 'America/Sao_Paulo')::date;
  v_bio_user uuid;
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'acesso negado';
  end if;

  select id into v_bio_user from public.profiles where bio_slug = 'criasocialclub' limit 1;

  with
  meta as (
    select * from public.trafego_meta_diario where dia between v_ini and v_fim
  ),
  meta_pub as (
    select publico,
           sum(impressoes) impressoes, sum(alcance) alcance, sum(gasto) gasto,
           sum(thruplays) thruplays, sum(cliques_link) cliques_link, sum(visitas_lp) visitas_lp,
           sum(p25) p25, sum(p100) p100
    from meta group by publico
  ),
  site as (
    select * from public.site_visitas where dia between v_ini and v_fim
  ),
  site_pub as (
    select publico,
           count(distinct sessao) filter (where evento='view') sessoes,
           count(distinct sessao) filter (where evento='view' and (utm_source in ('meta','facebook','instagram','fb','ig') or tem_fbclid)) sessoes_meta,
           count(distinct sessao) filter (where evento='view' and utm_medium = 'bio') sessoes_bio,
           count(distinct sessao) filter (where evento='leu') leram,
           count(distinct sessao) filter (where evento='ficou30') ficaram,
           count(distinct sessao) filter (where evento='cta') clicaram_testar
    from site group by publico
  ),
  cad as (
    select public.trafego_publico(null, u.raw_user_meta_data->>'utm_campaign') as publico_utm,
           coalesce(u.raw_user_meta_data->>'account_intent','criador') as intencao,
           u.raw_user_meta_data->>'utm_source' as src
    from auth.users u
    where (u.created_at at time zone 'America/Sao_Paulo')::date between v_ini and v_fim
  ),
  cad_pub as (
    select case when publico_utm <> 'outro' then publico_utm
                when intencao = 'manager' then 'social' else 'criador' end as publico,
           count(*) total,
           count(*) filter (where src is not null) com_origem,
           count(*) filter (where src in ('meta','facebook','instagram','fb','ig')) da_meta
    from cad group by 1
  ),
  funil as (
    select p.publico,
      jsonb_build_object(
        'publico', p.publico,
        'gasto', coalesce(m.gasto,0),
        'impressoes', coalesce(m.impressoes,0),
        'alcance', coalesce(m.alcance,0),
        'thruplays', coalesce(m.thruplays,0),
        'cliques_link', coalesce(m.cliques_link,0),
        'visitas_lp_meta', coalesce(m.visitas_lp,0),
        'sessoes_site', coalesce(s.sessoes,0),
        'sessoes_meta', coalesce(s.sessoes_meta,0),
        'sessoes_bio', coalesce(s.sessoes_bio,0),
        'leram', coalesce(s.leram,0),
        'ficaram_30s', coalesce(s.ficaram,0),
        'clicaram_testar', coalesce(s.clicaram_testar,0),
        'cadastros', coalesce(c.total,0),
        'cadastros_meta', coalesce(c.da_meta,0),
        'custo_thruplay', case when coalesce(m.thruplays,0) > 0 then round(m.gasto / m.thruplays, 4) end,
        'custo_clique', case when coalesce(m.cliques_link,0) > 0 then round(m.gasto / m.cliques_link, 2) end,
        'custo_cadastro', case when coalesce(c.da_meta,0) > 0 then round(m.gasto / c.da_meta, 2) end,
        'retencao_100', case when coalesce(m.p25,0) > 0 then round(100.0 * m.p100 / m.p25, 1) end
      ) j
    from (values ('criador'),('social')) p(publico)
    left join meta_pub m on m.publico = p.publico
    left join site_pub s on s.publico = p.publico
    left join cad_pub c on c.publico = p.publico
  ),
  ads as (
    select ad_id, max(ad_nome) ad_nome, max(publico) publico, max(campanha_nome) campanha_nome,
           (array_agg(status order by dia desc))[1] status,
           sum(impressoes) impressoes, sum(alcance) alcance, sum(gasto) gasto,
           sum(thruplays) thruplays, sum(cliques_link) cliques_link, sum(p25) p25, sum(p100) p100,
           round(avg(tempo_medio_s),1) tempo_medio_s,
           (array_agg(ranking_qualidade order by dia desc))[1] ranking_qualidade,
           max(frequencia) frequencia_max
    from meta group by ad_id
  ),
  ads_c as (
    select a.*,
      case when thruplays > 0 then gasto / thruplays end cpt,
      case when impressoes > 0 then 100.0 * cliques_link / impressoes end ctr_link,
      case when impressoes > 0 then 100.0 * thruplays / impressoes end taxa_thruplay,
      case when p25 > 0 then 100.0 * p100 / p25 end retencao
    from ads a
  ),
  med as (
    select publico,
           percentile_cont(0.5) within group (order by cpt) med_cpt,
           percentile_cont(0.5) within group (order by ctr_link) med_ctr
    from ads_c where impressoes >= 1000 and cpt is not null group by publico
  ),
  ads_v as (
    select a.*,
      case
        when a.impressoes < 1000 then 'aprendendo'
        when a.cpt is null then 'sem_dado'
        when a.cpt <= m.med_cpt * 0.8 and coalesce(a.ctr_link,0) >= coalesce(m.med_ctr,0) then 'escalar'
        when a.cpt >= m.med_cpt * 1.5 then 'pausar'
        when coalesce(a.frequencia_max,0) >= 3.5 then 'cansando'
        else 'manter' end veredito
    from ads_c a left join med m on m.publico = a.publico
  ),
  serie as (
    select d::date dia,
      coalesce((select sum(gasto) from meta where meta.dia = d::date),0) gasto,
      coalesce((select sum(impressoes) from meta where meta.dia = d::date),0) impressoes,
      coalesce((select sum(cliques_link) from meta where meta.dia = d::date),0) cliques,
      coalesce((select count(distinct sessao) from site where site.dia = d::date and evento='view' and publico='criador'),0) visitas_criador,
      coalesce((select count(distinct sessao) from site where site.dia = d::date and evento='view' and publico='social'),0) visitas_social,
      coalesce((select sum(views) from public.bio_stats_daily b where b.user_id = v_bio_user and b.page_id is null and b.block_id is null and b.dia = d::date),0) bio_views
    from generate_series(v_ini, v_fim, interval '1 day') d
  ),
  bio_tot as (
    select coalesce(sum(views) filter (where block_id is null),0) views,
           coalesce(sum(clicks) filter (where block_id is not null),0) clicks
    from public.bio_stats_daily
    where user_id = v_bio_user and page_id is null and dia between v_ini and v_fim
  ),
  bio_orig as (
    select origem, sum(views) views
    from public.bio_stats_daily
    where user_id = v_bio_user and page_id is null and block_id is null and dia between v_ini and v_fim
    group by origem
  ),
  bio_blocos as (
    select b.id, b.kind, b.position, b.is_active,
           coalesce(b.data->>'titulo', b.kind) titulo, b.data->>'url' url,
           coalesce(sum(s.clicks),0) clicks
    from public.bio_blocks b
    left join public.bio_stats_daily s on s.block_id = b.id and s.dia between v_ini and v_fim
    where b.user_id = v_bio_user and b.page_id is null
    group by b.id
  ),
  site_camp as (
    select coalesce(utm_campaign,'(sem campanha)') campanha, coalesce(utm_source,'(direto)') origem, publico,
           count(distinct sessao) filter (where evento='view') sessoes,
           count(distinct sessao) filter (where evento='cta') clicaram_testar
    from site group by 1,2,3
  ),
  ig as (
    select si.object_id, si.media_type, left(coalesce(si.caption,''),140) legenda, si.permalink, si.thumbnail_url,
           si.posted_at, si.metrics
    from public.social_insights si
    where si.user_id = v_bio_user and si.provider = 'instagram' and si.object_type = 'media'
      and si.posted_at >= (v_ini - 30)
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('ini', v_ini, 'fim', v_fim, 'dias', v_fim - v_ini + 1),
    'meta_atualizado_em', (select max(atualizado_em) from public.trafego_meta_diario),
    'funil', (select jsonb_agg(j order by j->>'publico') from funil),
    'anuncios', coalesce((select jsonb_agg(jsonb_build_object(
        'ad_id', ad_id, 'nome', ad_nome, 'publico', publico, 'campanha', campanha_nome, 'status', status,
        'impressoes', impressoes, 'alcance', alcance, 'gasto', gasto, 'thruplays', thruplays,
        'cliques_link', cliques_link, 'custo_thruplay', round(cpt::numeric, 4),
        'ctr_link', round(ctr_link::numeric, 2), 'taxa_thruplay', round(taxa_thruplay::numeric, 1),
        'retencao', round(retencao::numeric, 1), 'tempo_medio_s', tempo_medio_s,
        'frequencia', frequencia_max, 'ranking_qualidade', ranking_qualidade, 'veredito', veredito
      ) order by publico, gasto desc) from ads_v), '[]'::jsonb),
    'serie', coalesce((select jsonb_agg(to_jsonb(serie) order by dia) from serie), '[]'::jsonb),
    'bio', jsonb_build_object(
      'slug', 'criasocialclub',
      'views', (select views from bio_tot),
      'clicks', (select clicks from bio_tot),
      'origens', coalesce((select jsonb_agg(jsonb_build_object('origem', origem, 'views', views) order by views desc) from bio_orig), '[]'::jsonb),
      'blocos', coalesce((select jsonb_agg(jsonb_build_object('titulo', titulo, 'kind', kind, 'url', url, 'ativo', is_active, 'clicks', clicks) order by position) from bio_blocos), '[]'::jsonb)
    ),
    'site_campanhas', coalesce((select jsonb_agg(to_jsonb(site_camp) order by sessoes desc) from site_camp), '[]'::jsonb),
    'ig_posts', coalesce((select jsonb_agg(to_jsonb(ig) order by posted_at desc) from ig), '[]'::jsonb),
    'ig_conectado', exists(select 1 from public.social_connections where user_id = v_bio_user and provider = 'instagram'),
    'analises', coalesce((select jsonb_agg(to_jsonb(a) order by a.criado_em desc) from (
        select * from public.trafego_analises order by criado_em desc limit 6) a), '[]'::jsonb)
  ) into r;

  return r;
end;
$$;

revoke all on function public.admin_trafego_painel(integer) from public, anon;
grant execute on function public.admin_trafego_painel(integer) to authenticated;
