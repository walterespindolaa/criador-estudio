-- ═══════════════════════════════════════════════════════════════════════════
-- DADOS DO INSTAGRAM · CICLO 5 · RELATÓRIO DO CLIENTE NUMA FONTE SÓ (28/09/2026)
--
-- Antes o relatório do cliente tinha dois caminhos e os dois falhavam:
--   - Instagram do cliente conectado PELA AGÊNCIA (conexão com crm_client_id):
--     a função procurava os dados na conta do cliente (cria_owner_id), que
--     não existe nesse caso. Resultado: relatório sempre sem Instagram.
--   - Cliente com Cria próprio: vinham só os 48 posts mais recentes (período
--     antigo ficava cortado) e sem o post do Cria ligado, então a seção
--     "peças que produzimos" saía sempre vazia.
--
-- Agora UMA função acha a conexão certa (agência primeiro, depois a conta Cria
-- do cliente), filtra pelo período no servidor e já devolve, em cada post, a
-- peça do Cria ligada: título, formato, gancho e linha editorial.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ig_relatorio_cliente(
  _crm_client_id uuid, _since timestamptz, _until timestamptz
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _cli record;
  _conta uuid;   -- user_id dos dados do Instagram
  _crm uuid;     -- crm_client_id dos dados (null quando é a conta Cria do cliente)
  _media jsonb; _daily jsonb; _audience jsonb; _stories jsonb;
  _perfil record;
begin
  select id, manager_id, cria_owner_id into _cli from public.crm_clients where id = _crm_client_id;
  if _cli.id is null or not public.acts_for(_cli.manager_id) then
    return jsonb_build_object('connected', false);
  end if;

  -- 1) Conectado pela agência (fica em nome de quem clicou, por isso busca pelo cliente).
  select sc.user_id, sc.crm_client_id into _conta, _crm
    from public.social_connections sc
   where sc.provider = 'instagram' and sc.crm_client_id = _crm_client_id
   order by sc.updated_at desc nulls last limit 1;

  -- 2) Cliente com Cria próprio: a conexão é a da conta dele.
  -- Só com o vínculo ATIVO que o próprio cliente aceitou (acts_for_cria_owner):
  -- cria_owner_id sozinho é escrito pela agência e não prova consentimento.
  if _conta is null and _cli.cria_owner_id is not null and public.acts_for_cria_owner(_cli.cria_owner_id) then
    select sc.user_id, null::uuid into _conta, _crm
      from public.social_connections sc
     where sc.provider = 'instagram' and sc.user_id = _cli.cria_owner_id and sc.crm_client_id is null
     limit 1;
  end if;

  if _conta is null then return jsonb_build_object('connected', false); end if;

  select sc.username, sc.profile_picture_url, coalesce(sc.ultimo_sync_em, sc.updated_at) as last_sync into _perfil
    from public.social_connections sc
   where sc.user_id = _conta and sc.provider = 'instagram' and sc.crm_client_id is not distinct from _crm
   limit 1;

  select coalesce(jsonb_agg(x order by x.posted_at desc), '[]'::jsonb) into _media from (
    select i.id, i.media_type, i.caption, i.permalink, i.thumbnail_url, i.posted_at, i.metrics, i.post_id,
           p.title as linked_title, p.format as linked_format, p.hook as linked_hook,
           el.name as linked_linha
      from public.social_insights i
      left join public.posts p on p.id = i.post_id and p.deleted_at is null
      left join public.editorial_lines el on el.id = p.editorial_line_id
     where i.user_id = _conta and i.provider = 'instagram' and i.object_type = 'media'
       and i.crm_client_id is not distinct from _crm
       and i.posted_at >= _since and i.posted_at < _until
     order by i.posted_at desc
     limit 500
  ) x;

  select coalesce(jsonb_agg(d order by d.date), '[]'::jsonb) into _daily from (
    select m.date, m.followers, m.reach, m.profile_views, m.total_interactions
      from public.social_metrics_daily m
     where m.user_id = _conta and m.provider = 'instagram'
       and m.crm_client_id is not distinct from _crm
       and m.date >= (_since at time zone 'America/Sao_Paulo')::date
       and m.date < (_until at time zone 'America/Sao_Paulo')::date
  ) d;

  select coalesce(jsonb_agg(a), '[]'::jsonb) into _audience from (
    select au.metric, au.dimension, au.breakdown_value, au.value
      from public.social_audience au
     where au.user_id = _conta and au.provider = 'instagram'
       and au.crm_client_id is not distinct from _crm
  ) a;

  select coalesce(jsonb_agg(s), '[]'::jsonb) into _stories from (
    select st.external_story_id, st.media_type, st.permalink, st.thumbnail_url, st.media_url, st.posted_at, st.metrics
      from public.social_stories st
     where st.user_id = _conta and st.provider = 'instagram'
       and st.crm_client_id is not distinct from _crm
       and st.posted_at >= _since and st.posted_at < _until
  ) s;

  return jsonb_build_object('connected', true, 'conta', _conta, 'crm', _crm,
    'username', _perfil.username, 'profile_picture_url', _perfil.profile_picture_url, 'last_sync', _perfil.last_sync,
    'media', _media, 'daily', _daily, 'audience', _audience, 'stories', _stories);
end $$;

revoke all on function public.ig_relatorio_cliente(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.ig_relatorio_cliente(uuid, timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
