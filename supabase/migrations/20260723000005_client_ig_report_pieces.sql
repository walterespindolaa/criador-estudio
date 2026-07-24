-- Relatório por peça: o get_client_ig_report passa a devolver, junto de cada
-- mídia do IG do cliente, o post do Cria Post (external_post) que a agência
-- produziu e vinculou àquela publicação (via manager_link_client_media, que grava
-- social_insights.post_id). Assim o relatório white-label mostra "as peças que
-- produzimos e o que renderam" (título/formato/hook do que a agência fez × alcance
-- e engajamento reais). Left join: mídia sem vínculo continua aparecendo normal.
-- Mesma checagem de segurança da versão anterior. Idempotente (create or replace).

create or replace function public.get_client_ig_report(
  _crm_client_id uuid,
  _since timestamptz,
  _until timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _owner uuid;
  _mgr uuid;
  _media jsonb;
  _audience jsonb;
  _stories jsonb;
  _empty jsonb := jsonb_build_object('media', '[]'::jsonb, 'audience', '[]'::jsonb, 'stories', '[]'::jsonb);
begin
  select cria_owner_id, manager_id into _owner, _mgr
  from public.crm_clients where id = _crm_client_id;

  -- só o gestor dono do cliente pode ler
  if _mgr is null or _mgr <> auth.uid() then
    return _empty;
  end if;
  -- cliente sem conta CRIA conectada: nada a retornar
  if _owner is null then
    return _empty;
  end if;

  -- Mídias do período + a peça do Cria Post vinculada (se houver).
  select coalesce(jsonb_agg(x order by x.posted_at desc), '[]'::jsonb) into _media
  from (
    select si.caption, si.media_type, si.permalink, si.thumbnail_url, si.posted_at, si.metrics,
           si.post_id,
           p.title  as linked_title,
           p.format as linked_format,
           p.hook   as linked_hook
    from public.social_insights si
    left join public.posts p on p.id = si.post_id
    where si.user_id = _owner
      and si.provider = 'instagram'
      and si.object_type = 'media'
      and si.crm_client_id is null
      and si.posted_at >= _since
      and si.posted_at < _until
  ) x;

  -- Demografia de audiência: snapshot atual (não é recortado por período).
  select coalesce(jsonb_agg(a), '[]'::jsonb) into _audience
  from (
    select au.metric, au.dimension, au.breakdown_value, au.value
    from public.social_audience au
    where au.user_id = _owner
      and au.provider = 'instagram'
      and au.crm_client_id is null
    order by au.metric, au.dimension, au.value desc
  ) a;

  -- Stories publicados dentro do período.
  select coalesce(jsonb_agg(s order by s.posted_at desc), '[]'::jsonb) into _stories
  from (
    select st.external_story_id, st.media_type, st.permalink, st.thumbnail_url,
           st.media_url, st.posted_at, st.metrics
    from public.social_stories st
    where st.user_id = _owner
      and st.provider = 'instagram'
      and st.crm_client_id is null
      and st.posted_at >= _since
      and st.posted_at < _until
  ) s;

  return jsonb_build_object('media', _media, 'audience', _audience, 'stories', _stories);
end;
$$;

grant execute on function public.get_client_ig_report(uuid, timestamptz, timestamptz) to authenticated;
