-- ═══════════════════════════════════════════════════════════════════════════
-- DADOS DO INSTAGRAM NA BIO PÚBLICA (22/10/2026)
--
-- A página da criadora mostra seguidores, últimos vídeos e "quem me assiste"
-- puxados do Instagram conectado. Esta é a ÚNICA porta desses dados pro
-- público, e ela foi desenhada pra não vazar nada:
--
-- · o dono sai do slug, igual ao get_public_bio_blocks. Nada do que o
--   visitante manda escolhe de quem é o dado;
-- · página da agência só enxerga a conexão do MESMO cliente (gestor + cliente
--   da página). Página de criador só a conexão sem cliente do próprio dono;
-- · cada parte só sai se a página tiver um bloco NO AR pedindo ela (o dono
--   vê também com o bloco desligado, pra prévia do editor). Quem não ligou o
--   "puxar do Instagram" não expõe nada;
-- · nunca sai token, id de conta, legenda nem métrica por post além das views;
-- · público só em porcentagem e só com 100 seguidores ou mais na amostra;
-- · miniatura só do nosso storage, na pasta do próprio dono, e link só do
--   instagram.com. URL do CDN do Instagram expira e é de terceiro: fica fora.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.get_public_bio_social(_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  _uid uuid;
  _page uuid;
  _cli uuid;
  _dono boolean;
  _quer_seg boolean := false;
  _quer_vid boolean := false;
  _quer_pub boolean := false;
  _user text;
  _seg integer;
  _sync timestamptz;
  _achou boolean := false;
  _prefixo text;
  _res jsonb;
  _videos jsonb;
  _publico jsonb;
  _total numeric;
  _eng numeric;
  _alc bigint;
begin
  if _slug is null or length(btrim(_slug)) = 0 or length(_slug) > 120 then return null; end if;

  select p.id into _uid from public.profiles p where lower(p.bio_slug) = lower(btrim(_slug));
  if _uid is null then
    select bp.manager_id, bp.id, bp.crm_client_id into _uid, _page, _cli
    from public.bio_pages bp
    join public.crm_clients c on c.id = bp.crm_client_id and c.deleted_at is null
    where lower(bp.slug) = lower(btrim(_slug));
  end if;
  if _uid is null then return null; end if;
  -- Página de agência sem cliente não tem de quem puxar.
  if _page is not null and _cli is null then return null; end if;

  _dono := auth.uid() is not null and auth.uid() = _uid;

  select
    coalesce(bool_or(b.kind = 'perfil_criadora' and exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(b.data->'redes') = 'array' then b.data->'redes' else '[]'::jsonb end) r
      where r->>'rede' = 'instagram' and r->'auto' = 'true'::jsonb)), false),
    coalesce(bool_or(b.kind = 'videos' and b.data->>'fonte' = 'instagram'), false),
    coalesce(bool_or(b.kind = 'midiakit' and b.data->'auto' = 'true'::jsonb), false)
  into _quer_seg, _quer_vid, _quer_pub
  from public.bio_blocks b
  where b.estilo = 'site'
    and ((_page is null and b.page_id is null and b.user_id = _uid) or (_page is not null and b.page_id = _page))
    and (_dono or (b.is_active and (b.starts_at is null or b.starts_at <= now()) and (b.ends_at is null or b.ends_at > now())));

  if not (_quer_seg or _quer_vid or _quer_pub) then return null; end if;

  select sc.username, sc.followers_count, sc.ultimo_sync_em, true
  into _user, _seg, _sync, _achou
  from public.social_connections sc
  where sc.provider = 'instagram'
    and sc.user_id = _uid
    and ((_page is null and sc.crm_client_id is null) or (_page is not null and sc.crm_client_id = _cli))
  order by sc.updated_at desc nulls last
  limit 1;

  if not coalesce(_achou, false) then return jsonb_build_object('conectado', false); end if;

  _res := jsonb_build_object(
    'conectado', true,
    'usuario', case when _user ~ '^[A-Za-z0-9._]{1,30}$' then _user else null end,
    'atualizado_em', _sync
  );
  if _quer_seg or _quer_pub then
    _res := _res || jsonb_build_object('seguidores', _seg);
  end if;

  if _quer_vid then
    _prefixo := 'https://ecbzfjzoqidowrsfsfih.supabase.co/storage/v1/object/public/ig-thumbs/' || _uid::text || '/';
    select coalesce(jsonb_agg(v order by v_em desc), '[]'::jsonb) into _videos
    from (
      select jsonb_build_object(
               'foto', si.thumbnail_url,
               'link', si.permalink,
               'video', si.media_type in ('REELS', 'VIDEO'),
               'views', case when (si.metrics->>'views') ~ '^\d{1,12}$' then (si.metrics->>'views')::bigint end
             ) v,
             si.posted_at v_em
      from public.social_insights si
      where si.provider = 'instagram'
        and si.object_type = 'media'
        and si.user_id = _uid
        and ((_page is null and si.crm_client_id is null) or (_page is not null and si.crm_client_id = _cli))
        and si.media_type in ('REELS', 'VIDEO', 'IMAGE', 'CAROUSEL_ALBUM')
        and left(si.thumbnail_url, length(_prefixo)) = _prefixo
        and si.thumbnail_url !~ '[\s"''<>]'
        and si.permalink ~ '^https://www\.instagram\.com/(reel|p|tv)/[A-Za-z0-9_-]{5,40}/?$'
      order by si.posted_at desc nulls last
      limit 9
    ) x;
    _res := _res || jsonb_build_object('videos', _videos);
  end if;

  if _quer_pub then
    -- Fotografia mais recente de cada recorte, só de seguidores.
    with base as (
      select a.dimension, a.breakdown_value, a.value, a.captured_at,
             max(a.captured_at) over (partition by a.dimension) as ultimo
      from public.social_audience a
      where a.provider = 'instagram' and a.metric = 'followers'
        and a.user_id = _uid
        and ((_page is null and a.crm_client_id is null) or (_page is not null and a.crm_client_id = _cli))
        and a.value > 0
    ), atual as (
      select dimension, breakdown_value, sum(value)::numeric as valor
      from base where captured_at >= ultimo - interval '6 hours'
      group by 1, 2
    )
    select sum(valor) into _total from atual where dimension = 'gender';

    if coalesce(_total, 0) >= 100 then
      with base as (
        select a.dimension, a.breakdown_value, a.value, a.captured_at,
               max(a.captured_at) over (partition by a.dimension) as ultimo
        from public.social_audience a
        where a.provider = 'instagram' and a.metric = 'followers'
          and a.user_id = _uid
          and ((_page is null and a.crm_client_id is null) or (_page is not null and a.crm_client_id = _cli))
          and a.value > 0
      ), atual as (
        select dimension, breakdown_value, sum(value)::numeric as valor
        from base where captured_at >= ultimo - interval '6 hours'
        group by 1, 2
      ), genero as (
        select case when breakdown_value = 'F' then 'Mulheres' else 'Homens' end as rotulo, valor
        from atual where dimension = 'gender' and breakdown_value in ('F', 'M')
        order by valor desc limit 1
      ), idade as (
        select replace(breakdown_value, '-', ' a ') || ' anos' as rotulo, valor
        from atual where dimension = 'age' and breakdown_value ~ '^\d{2}-\d{2}$'
        order by valor desc limit 1
      ), estado as (
        select split_part(breakdown_value, ', ', 2) as rotulo, sum(valor) as valor
        from atual where dimension = 'city' and breakdown_value like '%, %'
        group by 1 order by 2 desc limit 1
      ), cidade as (
        select split_part(breakdown_value, ', ', 1) as rotulo, valor
        from atual where dimension = 'city' and breakdown_value like '%, %'
        order by valor desc limit 1
      ), tudo as (
        select 1 o, rotulo, valor from genero
        union all select 2, rotulo, valor from idade
        union all select 3, rotulo, valor from estado
        union all select 4, rotulo, valor from cidade
      )
      select coalesce(jsonb_agg(jsonb_build_object(
               'rotulo', left(rotulo, 40),
               'pct', least(100, round(valor * 100 / _total))::int) order by o), '[]'::jsonb)
      into _publico
      from tudo where rotulo <> '' and valor > 0;
      _res := _res || jsonb_build_object('publico', _publico);
    end if;

    -- Engajamento: média de interações dos posts dos últimos 90 dias sobre os
    -- seguidores. Com menos de 3 posts o número engana: não sai.
    if coalesce(_seg, 0) > 0 then
      select avg(case when (si.metrics->>'total_interactions') ~ '^\d{1,12}$' then (si.metrics->>'total_interactions')::numeric end) * 100 / _seg
      into _eng
      from public.social_insights si
      where si.provider = 'instagram' and si.object_type = 'media'
        and si.user_id = _uid
        and ((_page is null and si.crm_client_id is null) or (_page is not null and si.crm_client_id = _cli))
        and si.posted_at > now() - interval '90 days'
      having count(*) >= 3;
      if _eng is not null then _res := _res || jsonb_build_object('engajamento', round(_eng, 1)); end if;
    end if;

    select sum(m.reach) into _alc
    from public.social_metrics_daily m
    where m.provider = 'instagram' and m.user_id = _uid
      and ((_page is null and m.crm_client_id is null) or (_page is not null and m.crm_client_id = _cli))
      and m.date > current_date - 30
    having count(m.reach) >= 7;
    if coalesce(_alc, 0) > 0 then _res := _res || jsonb_build_object('alcance_30d', _alc); end if;
  end if;

  return _res;
end;
$$;

revoke all on function public.get_public_bio_social(text) from public;
grant execute on function public.get_public_bio_social(text) to anon, authenticated, service_role;
