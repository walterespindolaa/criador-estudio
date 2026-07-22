-- Vínculo entre a mídia publicada no Instagram do cliente (social_insights) e o
-- post que o social mídia produziu no Cria Post (posts externos). Assim o
-- resultado real volta pro post e alimenta a análise cruzada ("o que funciona").
--
-- 1) manager_client_instagram passa a devolver o post_id de cada mídia (o vínculo).
-- 2) manager_link_client_media: o gestor vincula/desvincula uma mídia do cliente a
--    um post externo DELE pra esse cliente, e o resultado é copiado pro post.

-- 1) READ: incluir post_id na mídia
drop function if exists public.manager_client_instagram(uuid);
create function public.manager_client_instagram(client_owner_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare _conn record; _daily jsonb; _media jsonb;
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
      and m.date >= (current_date - interval '90 days')
    order by m.date
  ) d;

  select coalesce(jsonb_agg(x order by x.posted_at desc), '[]'::jsonb) into _media
  from (
    select i.id, i.media_type, i.caption, i.permalink, i.thumbnail_url, i.posted_at, i.metrics, i.post_id
    from public.social_insights i
    where i.user_id = client_owner_id and i.provider = 'instagram' and i.object_type = 'media'
    order by i.posted_at desc nulls last
    limit 24
  ) x;

  return jsonb_build_object(
    'connected', true, 'username', _conn.username,
    'profile_picture_url', _conn.profile_picture_url, 'last_sync', _conn.updated_at,
    'daily', _daily, 'media', _media);
end; $$;
grant execute on function public.manager_client_instagram(uuid) to authenticated;

-- 2) LINK/UNLINK: gestor vincula uma mídia do cliente a um post externo dele.
create or replace function public.manager_link_client_media(
  client_owner_id uuid, media_id uuid, link_post_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Autoriza: o chamador precisa gerir a conta Cria deste cliente.
  if not public.manager_owns_cria_client(client_owner_id) then
    raise exception 'not_allowed';
  end if;

  -- A mídia tem que ser do próprio cliente.
  if not exists (
    select 1 from public.social_insights i
    where i.id = media_id and i.user_id = client_owner_id and i.object_type = 'media'
  ) then
    raise exception 'media_not_found';
  end if;

  -- Se está vinculando, o post tem que ser um post externo desse cliente
  -- (external_client -> crm_client cujo cria_owner_id é o cliente).
  if link_post_id is not null then
    if not exists (
      select 1
      from public.posts p
      join public.external_clients ec on ec.id = p.external_client_id
      join public.crm_clients cc on cc.id = ec.crm_client_id
      where p.id = link_post_id and cc.cria_owner_id = client_owner_id
    ) then
      raise exception 'post_not_allowed';
    end if;
  end if;

  update public.social_insights set post_id = link_post_id where id = media_id;

  -- Resultado real volta pro post do Cria (alimenta relatório e análise cruzada).
  if link_post_id is not null then
    update public.posts p set
      result_reach    = coalesce((i.metrics->>'reach')::numeric::int, p.result_reach),
      result_views    = coalesce((i.metrics->>'views')::numeric::int, p.result_views),
      result_comments = coalesce((i.metrics->>'comments')::numeric::int, p.result_comments),
      result_saves    = coalesce((i.metrics->>'saved')::numeric::int, (i.metrics->>'saves')::numeric::int, p.result_saves),
      result_shares   = coalesce((i.metrics->>'shares')::numeric::int, p.result_shares)
    from public.social_insights i
    where i.id = media_id and p.id = link_post_id;
  end if;
end; $$;
grant execute on function public.manager_link_client_media(uuid, uuid, uuid) to authenticated;
