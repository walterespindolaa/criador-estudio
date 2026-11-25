-- ═══════════════════════════════════════════════════════════════════════════
-- RESULTADO DO POST NO LINKEDIN, DIGITADO À MÃO · 25/11/2026
-- Walter, 25/11/2026: "as métricas". A API do perfil pessoal NÃO libera
-- métrica de post (precisa de r_member_postAnalytics, da Community Management
-- API, que pede análise do LinkedIn). Enquanto isso a pessoa copia os números
-- da aba Estatísticas do post e guarda aqui.
-- Mora em social_insights (provider linkedin, object_type media, object_id =
-- id do post), a mesma tabela dos números do Instagram. Quando a Community
-- Management API for aprovada, o robô passa a encher as mesmas linhas.
-- Só o master enquanto o LinkedIn está em teste. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.linkedin_resultado(_post_id uuid)
returns table (metrics jsonb, permalink text, captured_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _dono uuid;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  -- Direito ao post (levanta "sem permissão para este post").
  perform public.conexao_do_post(_post_id, 'linkedin');
  select p.user_id into _dono from public.posts p where p.id = _post_id;
  return query
    select si.metrics,
           coalesce(si.permalink, (select pp.permalink from public.post_publicacoes pp where pp.post_id = _post_id and pp.rede = 'linkedin')),
           si.captured_at
      from public.social_insights si
     where si.user_id = _dono and si.provider = 'linkedin' and si.object_type = 'media' and si.object_id = _post_id::text
     limit 1;
  if not found then
    return query select '{}'::jsonb,
      (select pp.permalink from public.post_publicacoes pp where pp.post_id = _post_id and pp.rede = 'linkedin'),
      null::timestamptz;
  end if;
end;
$$;
revoke all on function public.linkedin_resultado(uuid) from public, anon;
grant execute on function public.linkedin_resultado(uuid) to authenticated;

create or replace function public.linkedin_resultado_salvar(_post_id uuid, _metricas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _dono uuid;
  _limpo jsonb := '{}'::jsonb;
  _k text;
  _link text;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  perform public.conexao_do_post(_post_id, 'linkedin');
  select p.user_id into _dono from public.posts p where p.id = _post_id and p.deleted_at is null;
  if _dono is null then raise exception 'post não encontrado'; end if;
  -- Só os quatro números, inteiros e não negativos.
  foreach _k in array array['impressoes', 'reacoes', 'comentarios', 'compartilhamentos'] loop
    if jsonb_typeof(_metricas->_k) = 'number' and (_metricas->>_k)::numeric >= 0 then
      _limpo := _limpo || jsonb_build_object(_k, floor((_metricas->>_k)::numeric)::bigint);
    end if;
  end loop;
  _limpo := _limpo || jsonb_build_object('fonte', 'manual');
  select pp.permalink into _link from public.post_publicacoes pp where pp.post_id = _post_id and pp.rede = 'linkedin';

  update public.social_insights si
     set metrics = _limpo, permalink = coalesce(_link, si.permalink), captured_at = now()
   where si.user_id = _dono and si.crm_client_id is null and si.provider = 'linkedin'
     and si.object_type = 'media' and si.object_id = _post_id::text;
  if not found then
    insert into public.social_insights (user_id, provider, object_type, object_id, post_id, permalink, metrics, captured_at)
    values (_dono, 'linkedin', 'media', _post_id::text, _post_id, _link, _limpo, now());
  end if;
end;
$$;
revoke all on function public.linkedin_resultado_salvar(uuid, jsonb) from public, anon;
grant execute on function public.linkedin_resultado_salvar(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
