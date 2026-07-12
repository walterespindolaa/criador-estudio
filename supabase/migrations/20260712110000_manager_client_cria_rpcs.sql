-- ============================================================
-- Gestor → dados da conta CRIA do cliente (leitura)
--
-- O gestor não tem RLS nas tabelas do cliente (profiles, personas,
-- moodboard_entries, social_*). Estas três RPCs são SECURITY DEFINER e
-- só devolvem dados se o chamador REALMENTE gerencia aquele cliente:
--   existe um crm_clients com cria_owner_id = <dono> e o chamador
--   é o manager_id (ou colaborador ativo do time dele) — via acts_for().
--
-- Sem isso, os hooks useCriaClientProfiles / useCriaClientInstagram /
-- useCriaClientBrandbook chamam função inexistente e a ficha quebra.
-- ============================================================

-- Um cliente CRIA "pertence" a quem eu atuo? (dono OU colaborador do time)
create or replace function public.manager_owns_cria_client(_owner uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crm_clients c
    where c.cria_owner_id = _owner
      and public.acts_for(c.manager_id)
  );
$$;
grant execute on function public.manager_owns_cria_client(uuid) to authenticated;

-- ── 1. Perfis (foto sempre atual, sem depender do sync manual) ──────────
drop function if exists public.manager_clients_cria_profiles();
create function public.manager_clients_cria_profiles()
returns table (cria_owner_id uuid, name text, avatar_url text, niche text)
language sql stable security definer set search_path = public as $$
  select distinct on (c.cria_owner_id)
    c.cria_owner_id, p.name, p.avatar_url, p.niche
  from public.crm_clients c
  join public.profiles p on p.id = c.cria_owner_id
  where c.cria_owner_id is not null
    and public.acts_for(c.manager_id)
  order by c.cria_owner_id;
$$;
grant execute on function public.manager_clients_cria_profiles() to authenticated;

-- ── 2. Instagram do cliente (conexão + série diária + mídias) ───────────
drop function if exists public.manager_client_instagram(uuid);
create function public.manager_client_instagram(client_owner_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _conn record;
  _daily jsonb;
  _media jsonb;
begin
  if not public.manager_owns_cria_client(client_owner_id) then
    return jsonb_build_object('connected', false);
  end if;

  -- Conexão pessoal do criador (crm_client_id is null = a conta dele, não de um cliente dele).
  select sc.username, sc.profile_picture_url, sc.updated_at
    into _conn
  from public.social_connections sc
  where sc.user_id = client_owner_id
    and sc.provider = 'instagram'
    and sc.crm_client_id is null
  limit 1;

  if not found then
    return jsonb_build_object('connected', false);
  end if;

  select coalesce(jsonb_agg(d order by d.date), '[]'::jsonb) into _daily
  from (
    select m.date, m.followers, m.reach, m.profile_views, m.total_interactions
    from public.social_metrics_daily m
    where m.user_id = client_owner_id
      and m.provider = 'instagram'
      and m.date >= (current_date - interval '90 days')
    order by m.date
  ) d;

  select coalesce(jsonb_agg(x order by x.posted_at desc), '[]'::jsonb) into _media
  from (
    select i.id, i.media_type, i.caption, i.permalink, i.thumbnail_url, i.posted_at, i.metrics
    from public.social_insights i
    where i.user_id = client_owner_id
      and i.provider = 'instagram'
      and i.object_type = 'media'
    order by i.posted_at desc nulls last
    limit 24
  ) x;

  return jsonb_build_object(
    'connected', true,
    'username', _conn.username,
    'profile_picture_url', _conn.profile_picture_url,
    'last_sync', _conn.updated_at,
    'daily', _daily,
    'media', _media
  );
end; $$;
grant execute on function public.manager_client_instagram(uuid) to authenticated;

-- ── 3. Brandbook completo do cliente (perfil, pilares, itens, personas, moodboard) ──
drop function if exists public.manager_client_brandbook(uuid);
create function public.manager_client_brandbook(client_owner_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _profile jsonb;
  _pillars jsonb;
  _items   jsonb;
  _pers    jsonb;
  _mood    jsonb;
begin
  if not public.manager_owns_cria_client(client_owner_id) then
    return jsonb_build_object(
      'profile', null, 'pillars', '[]'::jsonb, 'brand_items', '[]'::jsonb,
      'personas', '[]'::jsonb, 'moodboard', '[]'::jsonb);
  end if;

  select jsonb_build_object('name', p.name, 'niche', p.niche, 'avatar_url', p.avatar_url)
    into _profile
  from public.profiles p where p.id = client_owner_id;

  select coalesce(jsonb_agg(x.name order by x.position nulls last), '[]'::jsonb) into _pillars
  from (select pi.name, pi.position from public.pillars pi where pi.user_id = client_owner_id) x;

  select coalesce(jsonb_agg(jsonb_build_object('type', b.type, 'name', b.name, 'value', b.value)
                            order by b.type, b.position nulls last), '[]'::jsonb) into _items
  from public.brand_items b where b.user_id = client_owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', pe.name, 'age_range', pe.age_range, 'gender', pe.gender,
           'location', pe.location, 'pain_points', pe.pain_points,
           'desires', pe.desires, 'interests', pe.interests,
           'how_you_help', pe.how_you_help)), '[]'::jsonb) into _pers
  from public.personas pe where pe.user_id = client_owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'section', me.section, 'question_key', me.question_key, 'answer', me.answer)
           order by me.section, me.question_key), '[]'::jsonb) into _mood
  from public.moodboard_entries me
  where me.user_id = client_owner_id
    and me.answer is not null and btrim(me.answer) <> '';

  return jsonb_build_object(
    'profile', _profile, 'pillars', _pillars, 'brand_items', _items,
    'personas', _pers, 'moodboard', _mood);
end; $$;
grant execute on function public.manager_client_brandbook(uuid) to authenticated;
