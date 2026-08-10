-- ============================================================
-- PARTE C do conserto de takeover cross-tenant (F3/F8/F14).
--
-- Problema: crm_clients.cria_owner_id é escrito pelo PRÓPRIO chamador (a RLS de
-- crm_clients só checa manager_id = auth.uid()/acts_for), e ainda assim ele era
-- usado como PROVA de autorização pra ler dados sensíveis da conta apontada:
--   - manager_owns_cria_client (brandbook, instagram, ideas, perfis, link de mídia)
--   - get_client_ig_report / get_client_ig_media (relatório white-label)
--   - edge crm-sync-from-cria (copia brandbook/persona da conta pro CRM)
-- Bastava setar cria_owner_id = vítima num crm_client do atacante pra ler a conta
-- da vítima.
--
-- Conserto: a aresta de autorização passa a ser um vínculo CONSENTIDO pela conta
-- da vítima — account_members ativo (owner_id = conta do cliente, member_id = a
-- gestora). O helper acts_for_cria_owner exige esse vínculo e ainda aceita o
-- colaborador ativo do time da gestora (acts_for), preservando o acesso legítimo
-- de equipe. Além disso, um TRIGGER impede o cliente de gravar um cria_owner_id
-- sem vínculo consentido (o import legítimo continua, porque ele só usa contas de
-- account_members ativo; service_role das edges é confiado e não é barrado).
--
-- Idempotente.
-- ============================================================

-- ── Helper: o usuário logado (ou seu colaborador ativo) tem vínculo CONSENTIDO
--    com a conta _owner? ─────────────────────────────────────────────────────
create or replace function public.acts_for_cria_owner(_owner uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select _owner is not null and exists (
    select 1 from public.account_members am
    where am.owner_id = _owner
      and am.status = 'active'
      and public.acts_for(am.member_id)   -- a gestora dona do vínculo OU seu colaborador ativo
  );
$$;
grant execute on function public.acts_for_cria_owner(uuid) to authenticated;

-- ── manager_owns_cria_client: para de confiar em cria_owner_id auto-declarado.
--    Agora exige o vínculo consentido. Mantém o acesso de colaborador (acts_for
--    dentro do helper). Assinatura idêntica → nada que chama muda. ─────────────
create or replace function public.manager_owns_cria_client(_owner uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.acts_for_cria_owner(_owner);
$$;
grant execute on function public.manager_owns_cria_client(uuid) to authenticated;

-- ── get_client_ig_report: mesma lógica, autorização por vínculo consentido ────
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
  _media jsonb;
  _audience jsonb;
  _stories jsonb;
  _empty jsonb := jsonb_build_object('media', '[]'::jsonb, 'audience', '[]'::jsonb, 'stories', '[]'::jsonb);
begin
  select cria_owner_id into _owner
  from public.crm_clients where id = _crm_client_id;

  -- cliente sem conta CRIA conectada: nada a retornar
  if _owner is null then
    return _empty;
  end if;
  -- Autorização por vínculo CONSENTIDO (account_members ativo), NÃO pela coluna
  -- cria_owner_id que o próprio tenant escreve (F3/F8/F14).
  if not public.acts_for_cria_owner(_owner) then
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

-- ── get_client_ig_media: mesma lógica ────────────────────────────────────────
create or replace function public.get_client_ig_media(
  _crm_client_id uuid,
  _since timestamptz,
  _until timestamptz
)
returns table (
  caption text, media_type text, permalink text, thumbnail_url text,
  posted_at timestamptz, metrics jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner uuid;
begin
  select cria_owner_id into _owner
  from public.crm_clients where id = _crm_client_id;

  if _owner is null then
    return;
  end if;
  -- Autorização por vínculo CONSENTIDO (account_members ativo), NÃO pela coluna
  -- cria_owner_id auto-declarada (F3/F8/F14).
  if not public.acts_for_cria_owner(_owner) then
    return;
  end if;

  return query
    select si.caption, si.media_type, si.permalink, si.thumbnail_url, si.posted_at, si.metrics
    from public.social_insights si
    where si.user_id = _owner
      and si.provider = 'instagram'
      and si.object_type = 'media'
      and si.posted_at >= _since
      and si.posted_at < _until;
end;
$$;
grant execute on function public.get_client_ig_media(uuid, timestamptz, timestamptz) to authenticated;

-- ── Trigger: barra cria_owner_id auto-declarado sem vínculo consentido ────────
-- O import legítimo (useImportCriaClients) grava cria_owner_id pelo cliente, mas
-- só com contas de my_managed_accounts (= account_members ativo), então passa.
-- Uma tentativa de apontar pra uma conta de terceiro é rejeitada. service_role
-- (edges/webhook) tem auth.uid() nulo → confiado, não é validado aqui.
create or replace function public.crm_clients_guard_cria_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.cria_owner_id is not null
     and new.cria_owner_id is distinct from (case when tg_op = 'UPDATE' then old.cria_owner_id else null end)
  then
    if not public.acts_for_cria_owner(new.cria_owner_id) then
      raise exception 'cria_owner_id sem vínculo consentido (account_members ativo) para %', new.cria_owner_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crm_clients_guard_cria_owner on public.crm_clients;
create trigger trg_crm_clients_guard_cria_owner
  before insert or update on public.crm_clients
  for each row execute function public.crm_clients_guard_cria_owner();
