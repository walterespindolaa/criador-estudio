-- ═══════════════════════════════════════════════════════════════════════════
-- META POR HORA (21/10/2026)
--
-- Walter: "10 - ok" (puxar os números do anúncio por hora pra cruzar com o
-- mapa de dias e horários). A rodada das 8h e 20h passa a gravar, por
-- campanha, impressões, gasto e cliques em cada hora do dia (fuso da conta,
-- breakdown hourly_stats_aggregated_by_advertiser_time_zone). A grade da aba
-- "Dias e horários" ganha essas três contagens, então dá pra ver lado a lado
-- QUANDO a Meta gasta e QUANDO as visitas e os cadastros acontecem.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.trafego_meta_horario (
  dia date not null,
  hora smallint not null check (hora between 0 and 23),
  campanha_id text not null,
  campanha_nome text,
  publico text check (publico in ('criador','social','outro')),
  impressoes integer not null default 0,
  gasto numeric(12,2) not null default 0,
  cliques_link integer not null default 0,
  thruplays integer not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (dia, hora, campanha_id)
);
alter table public.trafego_meta_horario enable row level security;

create or replace function public.admin_trafego_horarios(_dias integer default 30, _origem text default 'todas')
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_d int := greatest(7, least(_dias, 180));
  v_fim date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date := v_fim - v_d + 1;
  v_bio_user uuid;
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'acesso negado';
  end if;
  select id into v_bio_user from public.profiles where bio_slug = 'criasocialclub' limit 1;

  with
  vis as (
    select (criado_em at time zone 'America/Sao_Paulo') t, converteu, tempo_ativo_s
    from public.site_leituras
    where dia between v_ini and v_fim
      and case _origem
            when 'meta' then public.trafego_origem(utm_source, utm_medium, tem_fbclid) = 'Anúncio Meta'
            when 'organico' then public.trafego_origem(utm_source, utm_medium, tem_fbclid) <> 'Anúncio Meta'
            else true end
  ),
  cad as (
    select (u.created_at at time zone 'America/Sao_Paulo') t
    from auth.users u
    where (u.created_at at time zone 'America/Sao_Paulo')::date between v_ini and v_fim
      and case _origem
            when 'meta' then coalesce(u.raw_user_meta_data->>'utm_source','') in ('meta','facebook','instagram','fb','ig')
                             or u.raw_user_meta_data->>'veio_de_anuncio' = 'meta'
            when 'organico' then not (coalesce(u.raw_user_meta_data->>'utm_source','') in ('meta','facebook','instagram','fb','ig')
                             or coalesce(u.raw_user_meta_data->>'veio_de_anuncio','') = 'meta')
            else true end
  ),
  vis_g as (
    select extract(dow from t)::int dow, extract(hour from t)::int hora, count(*) visitas,
           count(*) filter (where converteu) converteram,
           percentile_cont(0.5) within group (order by tempo_ativo_s) tempo_mediano
    from vis group by 1,2
  ),
  cad_g as (
    select extract(dow from t)::int dow, extract(hour from t)::int hora, count(*) cadastros
    from cad group by 1,2
  ),
  meta_g as (
    select extract(dow from dia)::int dow, hora::int hora,
           sum(impressoes) impressoes_meta, sum(gasto) gasto_meta, sum(cliques_link) cliques_meta
    from public.trafego_meta_horario where dia between v_ini and v_fim group by 1,2
  ),
  grade as (
    select g.dow, h.hora, coalesce(v.visitas,0) visitas, coalesce(v.converteram,0) converteram,
           v.tempo_mediano, coalesce(c.cadastros,0) cadastros,
           coalesce(m.impressoes_meta,0) impressoes_meta, coalesce(m.gasto_meta,0) gasto_meta, coalesce(m.cliques_meta,0) cliques_meta
    from generate_series(0,6) g(dow) cross join generate_series(0,23) h(hora)
    left join vis_g v on v.dow = g.dow and v.hora = h.hora
    left join cad_g c on c.dow = g.dow and c.hora = h.hora
    left join meta_g m on m.dow = g.dow and m.hora = h.hora
  ),
  -- Quantas vezes cada dia da semana apareceu no período (pra média por dia,
  -- senão um período de 10 dias dá peso dobrado pra 3 dias da semana).
  ocorr as (
    select extract(dow from d)::int dow, count(*) n
    from generate_series(v_ini, v_fim, interval '1 day') d group by 1
  ),
  bio as (
    select extract(dow from dia)::int dow, coalesce(sum(views),0) views
    from public.bio_stats_daily
    where user_id = v_bio_user and page_id is null and block_id is null and dia between v_ini and v_fim
    group by 1
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('ini', v_ini, 'fim', v_fim, 'dias', v_d),
    'origem', _origem,
    'grade', coalesce((select jsonb_agg(jsonb_build_object('dow', dow, 'hora', hora, 'visitas', visitas, 'converteram', converteram,
                                                          'cadastros', cadastros, 'tempo_mediano', tempo_mediano,
                        'impressoes_meta', impressoes_meta, 'gasto_meta', gasto_meta, 'cliques_meta', cliques_meta) order by dow, hora) from grade), '[]'::jsonb),
    'ocorrencias', coalesce((select jsonb_object_agg(dow, n) from ocorr), '{}'::jsonb),
    'bio_por_dia', coalesce((select jsonb_object_agg(dow, views) from bio), '{}'::jsonb)
  ) into r;
  return r;
end;
$$;
revoke all on function public.admin_trafego_horarios(integer, text) from public, anon;
grant execute on function public.admin_trafego_horarios(integer, text) to authenticated;
