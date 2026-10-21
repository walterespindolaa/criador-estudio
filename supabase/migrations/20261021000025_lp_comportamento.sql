-- ═══════════════════════════════════════════════════════════════════════════
-- COMPORTAMENTO NA LP + RESUMO COM COMPARAÇÃO (21/10/2026)
--
-- Walter: "precisamos entender também até onde a pessoa normalmente acessa,
-- onde ela clica, o que faz, quanto tempo fica na tela, como melhorar a
-- retenção e conversão".
--
-- 1. site_leituras: UMA linha por carregamento de página (visita). O track.js
--    soma no navegador e manda o acumulado quando a aba some (e a cada 15s):
--    tempo ATIVO (aba visível e alguém mexendo nos últimos 30s), até onde
--    rolou, quantos segundos ficou em cada seção, a ordem das seções, em qual
--    seção estava quando saiu, quantos cliques e se clicou em testar/assinar.
--    Acumulado + upsert por visita = reenviar não duplica nada.
-- 2. site_visitas ganha o evento 'clique' (todo botão/link/imagem clicada, com
--    a seção e a altura da página em %), pra saber ONDE clicam.
-- 3. admin_lp_comportamento(_dias, _pagina): o raio-x de uma página.
-- 4. admin_trafego_kpis(_dias): os números do topo com o período anterior do
--    mesmo tamanho, pra cada cartão mostrar se subiu ou caiu.
--
-- Mesma regra de privacidade do motor: sem IP, sem e-mail, sem cookie.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. CLIQUES ──────────────────────────────────────────────────────────────
alter table public.site_visitas drop constraint if exists site_visitas_evento_check;
alter table public.site_visitas add constraint site_visitas_evento_check
  check (evento in ('view','cta','leu','ficou30','preco','clique'));
alter table public.site_visitas add column if not exists secao text;
alter table public.site_visitas add column if not exists pos_y smallint; -- altura do clique na página, 0 a 100
create index if not exists site_visitas_pag_evt_idx on public.site_visitas (pagina, evento, dia);

-- ── 2. LEITURA DE CADA VISITA ───────────────────────────────────────────────
create table if not exists public.site_leituras (
  visita text primary key,
  sessao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  dia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  pagina text not null,
  publico text not null default 'outro' check (publico in ('criador','social','outro')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  tem_fbclid boolean not null default false,
  referrer_host text,
  dispositivo text check (dispositivo in ('mobile','desktop')),
  tempo_ativo_s integer not null default 0,
  scroll_max smallint not null default 0,
  secoes jsonb not null default '{}'::jsonb,  -- {"hero": 12, "planos": 30} segundos em cada seção
  mapa text[],                                 -- ordem das seções na página
  secao_saida text,
  cliques integer not null default 0,
  converteu boolean not null default false
);
create index if not exists site_leituras_pag_dia_idx on public.site_leituras (pagina, dia);
alter table public.site_leituras enable row level security;

-- Origem resumida, igual pra todo lugar do painel.
create or replace function public.trafego_origem(_source text, _medium text, _fbclid boolean)
returns text language sql immutable as $$
  select case
    when coalesce(_medium,'') = 'bio' then 'Link na bio'
    when _fbclid or coalesce(_source,'') in ('meta','facebook','instagram','fb','ig') then 'Anúncio Meta'
    when coalesce(_source,'') <> '' then 'Outra campanha'
    else 'Direto / busca' end
$$;

-- ── 3. RAIO-X DE UMA PÁGINA ─────────────────────────────────────────────────
create or replace function public.admin_lp_comportamento(_dias integer default 14, _pagina text default '/')
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_d int := greatest(1, least(_dias, 90));
  v_fim date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date := v_fim - v_d + 1;
  v_pini date := v_ini - v_d;
  v_pfim date := v_ini - 1;
  v_mapa text[];
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'acesso negado';
  end if;

  -- Ordem das seções: a da visita mais recente (a página pode ter mudado).
  select mapa into v_mapa from public.site_leituras
   where pagina = _pagina and mapa is not null order by atualizado_em desc limit 1;

  with
  l as (select * from public.site_leituras where pagina = _pagina and dia between v_ini and v_fim),
  lp as (select * from public.site_leituras where pagina = _pagina and dia between v_pini and v_pfim),
  resumo as (
    select count(*) visitas,
      percentile_cont(0.5) within group (order by tempo_ativo_s) tempo_mediano,
      round(avg(tempo_ativo_s)) tempo_medio,
      round(100.0 * count(*) filter (where tempo_ativo_s < 5) / nullif(count(*),0), 1) rejeicao,
      round(avg(scroll_max)) scroll_medio,
      round(100.0 * count(*) filter (where scroll_max >= 90) / nullif(count(*),0), 1) chegou_fim,
      round(100.0 * count(*) filter (where converteu) / nullif(count(*),0), 1) conversao,
      count(*) filter (where converteu) converteram
    from l
  ),
  resumo_ant as (
    select count(*) visitas,
      percentile_cont(0.5) within group (order by tempo_ativo_s) tempo_mediano,
      round(avg(tempo_ativo_s)) tempo_medio,
      round(100.0 * count(*) filter (where tempo_ativo_s < 5) / nullif(count(*),0), 1) rejeicao,
      round(avg(scroll_max)) scroll_medio,
      round(100.0 * count(*) filter (where scroll_max >= 90) / nullif(count(*),0), 1) chegou_fim,
      round(100.0 * count(*) filter (where converteu) / nullif(count(*),0), 1) conversao,
      count(*) filter (where converteu) converteram
    from lp
  ),
  faixas as (
    select f.ordem, f.rotulo, count(l.visita) visitas
    from (values (1,'até 5s',0,5),(2,'5 a 15s',5,15),(3,'15 a 30s',15,30),(4,'30s a 1min',30,60),
                 (5,'1 a 3min',60,180),(6,'mais de 3min',180,1000000)) f(ordem, rotulo, de, ate)
    left join l on l.tempo_ativo_s >= f.de and l.tempo_ativo_s < f.ate
    group by f.ordem, f.rotulo
  ),
  rolagem as (
    select m.marca, count(l.visita) filter (where l.scroll_max >= m.marca) chegaram
    from (values (25),(50),(75),(90)) m(marca) cross join l
    group by m.marca
  ),
  secs as (
    select s.id, s.ord,
      count(l.visita) filter (where l.secoes ? s.id) chegaram,
      round(avg((l.secoes->>s.id)::numeric) filter (where l.secoes ? s.id), 1) seg_medio,
      count(l.visita) filter (where l.secao_saida = s.id) saidas,
      count(l.visita) filter (where l.secao_saida = s.id and not l.converteu) saidas_sem_converter
    from unnest(coalesce(v_mapa, '{}'::text[])) with ordinality s(id, ord)
    left join l on true
    group by s.id, s.ord
  ),
  -- Todo clique da página. leva_cadastro = o mesmo botão também aparece como
  -- "cta" (link pro cadastro/checkout), pra destacar na lista.
  clq as (
    select coalesce(v.alvo,'(sem rótulo)') alvo, v.secao,
           count(*) cliques, count(distinct v.sessao) pessoas, round(avg(v.pos_y)) pos_y,
           exists (select 1 from public.site_visitas c where c.evento = 'cta' and c.pagina = _pagina and c.alvo = v.alvo) leva_cadastro
    from public.site_visitas v
    where v.pagina = _pagina and v.evento = 'clique' and v.dia between v_ini and v_fim
    group by 1,2, v.alvo
  ),
  disp as (
    select coalesce(dispositivo,'?') dispositivo, count(*) visitas,
      percentile_cont(0.5) within group (order by tempo_ativo_s) tempo_mediano,
      round(avg(scroll_max)) scroll_medio,
      round(100.0 * count(*) filter (where tempo_ativo_s < 5) / nullif(count(*),0), 1) rejeicao,
      round(100.0 * count(*) filter (where converteu) / nullif(count(*),0), 1) conversao
    from l group by 1
  ),
  orig as (
    select public.trafego_origem(utm_source, utm_medium, tem_fbclid) origem,
      coalesce(utm_campaign, '') campanha, coalesce(utm_content, '') conteudo,
      count(*) visitas,
      percentile_cont(0.5) within group (order by tempo_ativo_s) tempo_mediano,
      round(avg(scroll_max)) scroll_medio,
      round(100.0 * count(*) filter (where tempo_ativo_s < 5) / nullif(count(*),0), 1) rejeicao,
      round(100.0 * count(*) filter (where converteu) / nullif(count(*),0), 1) conversao
    from l group by 1,2,3
  ),
  serie as (
    select d::date dia,
      (select count(*) from l where l.dia = d::date) visitas,
      (select count(*) from l where l.dia = d::date and l.converteu) converteram,
      (select percentile_cont(0.5) within group (order by tempo_ativo_s) from l where l.dia = d::date) tempo_mediano
    from generate_series(v_ini, v_fim, interval '1 day') d
  ),
  paginas as (
    select pagina, count(*) visitas from public.site_leituras where dia between v_ini and v_fim group by 1
  )
  select jsonb_build_object(
    'pagina', _pagina,
    'periodo', jsonb_build_object('ini', v_ini, 'fim', v_fim, 'dias', v_d),
    'paginas', coalesce((select jsonb_agg(to_jsonb(paginas) order by visitas desc) from paginas), '[]'::jsonb),
    'resumo', (select to_jsonb(resumo) from resumo),
    'anterior', (select to_jsonb(resumo_ant) from resumo_ant),
    'faixas_tempo', coalesce((select jsonb_agg(jsonb_build_object('rotulo', rotulo, 'visitas', visitas) order by ordem) from faixas), '[]'::jsonb),
    'rolagem', coalesce((select jsonb_agg(to_jsonb(rolagem) order by marca) from rolagem), '[]'::jsonb),
    'secoes', coalesce((select jsonb_agg(to_jsonb(secs) order by ord) from secs), '[]'::jsonb),
    'cliques', coalesce((select jsonb_agg(to_jsonb(c) order by c.cliques desc) from (select * from clq order by cliques desc limit 25) c), '[]'::jsonb),
    'dispositivos', coalesce((select jsonb_agg(to_jsonb(disp) order by visitas desc) from disp), '[]'::jsonb),
    'origens', coalesce((select jsonb_agg(to_jsonb(orig) order by visitas desc) from orig), '[]'::jsonb),
    'serie', coalesce((select jsonb_agg(to_jsonb(serie) order by dia) from serie), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;
revoke all on function public.admin_lp_comportamento(integer, text) from public, anon;
grant execute on function public.admin_lp_comportamento(integer, text) to authenticated;

-- ── 4. NÚMEROS DO TOPO, COM O PERÍODO ANTERIOR ──────────────────────────────
-- Função interna (sem grant): soma um intervalo qualquer.
create or replace function public.trafego_kpis_periodo(_ini date, _fim date)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with
  bio_user as (select id from public.profiles where bio_slug = 'criasocialclub' limit 1),
  m as (
    select coalesce(sum(gasto),0) gasto, coalesce(sum(impressoes),0) impressoes, coalesce(sum(alcance),0) alcance,
           coalesce(sum(cliques_link),0) cliques_link, coalesce(sum(thruplays),0) thruplays
    from public.trafego_meta_diario where dia between _ini and _fim
  ),
  s as (
    select count(distinct sessao) filter (where evento='view') visitas,
           count(distinct sessao) filter (where evento='view' and (utm_source in ('meta','facebook','instagram','fb','ig') or tem_fbclid)) visitas_meta,
           count(distinct sessao) filter (where evento='view' and utm_medium='bio') visitas_bio,
           count(distinct sessao) filter (where evento='cta') clicaram_testar
    from public.site_visitas where dia between _ini and _fim
  ),
  lt as (
    select percentile_cont(0.5) within group (order by tempo_ativo_s) tempo_mediano,
           round(100.0 * count(*) filter (where converteu) / nullif(count(*),0), 1) conversao_lp,
           round(100.0 * count(*) filter (where tempo_ativo_s < 5) / nullif(count(*),0), 1) rejeicao
    from public.site_leituras where dia between _ini and _fim
  ),
  c as (
    select count(*) cadastros,
           count(*) filter (where u.raw_user_meta_data->>'utm_source' in ('meta','facebook','instagram','fb','ig')
                               or u.raw_user_meta_data->>'veio_de_anuncio' = 'meta') cadastros_meta,
           count(*) filter (where u.raw_user_meta_data->>'utm_medium' = 'bio') cadastros_bio
    from auth.users u where (u.created_at at time zone 'America/Sao_Paulo')::date between _ini and _fim
  ),
  b as (
    select coalesce(sum(views) filter (where block_id is null),0) bio_views,
           coalesce(sum(clicks) filter (where block_id is not null),0) bio_cliques
    from public.bio_stats_daily
    where user_id = (select id from bio_user) and page_id is null and dia between _ini and _fim
  )
  select jsonb_build_object(
    'gasto', m.gasto, 'impressoes', m.impressoes, 'alcance', m.alcance, 'cliques_link', m.cliques_link, 'thruplays', m.thruplays,
    'visitas', s.visitas, 'visitas_meta', s.visitas_meta, 'visitas_bio', s.visitas_bio, 'clicaram_testar', s.clicaram_testar,
    'tempo_mediano', lt.tempo_mediano, 'conversao_lp', lt.conversao_lp, 'rejeicao', lt.rejeicao,
    'cadastros', c.cadastros, 'cadastros_meta', c.cadastros_meta, 'cadastros_bio', c.cadastros_bio,
    'bio_views', b.bio_views, 'bio_cliques', b.bio_cliques,
    'cpm', case when m.impressoes > 0 then round(1000 * m.gasto / m.impressoes, 2) end,
    'ctr', case when m.impressoes > 0 then round(100.0 * m.cliques_link / m.impressoes, 2) end,
    'custo_visita', case when s.visitas_meta > 0 then round(m.gasto / s.visitas_meta, 2) end,
    'custo_cadastro', case when c.cadastros_meta > 0 then round(m.gasto / c.cadastros_meta, 2) end
  )
  from m, s, lt, c, b
$$;
revoke all on function public.trafego_kpis_periodo(date, date) from public, anon, authenticated;

create or replace function public.admin_trafego_kpis(_dias integer default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_d int := greatest(1, least(_dias, 90));
  v_fim date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date := v_fim - v_d + 1;
begin
  if not public.is_admin() then
    raise exception 'acesso negado';
  end if;
  return jsonb_build_object(
    'atual', public.trafego_kpis_periodo(v_ini, v_fim),
    'anterior', public.trafego_kpis_periodo(v_ini - v_d, v_ini - 1),
    'periodo', jsonb_build_object('ini', v_ini, 'fim', v_fim, 'dias', v_d)
  );
end;
$$;
revoke all on function public.admin_trafego_kpis(integer) from public, anon;
grant execute on function public.admin_trafego_kpis(integer) to authenticated;
