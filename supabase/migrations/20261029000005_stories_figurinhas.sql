-- STORIES DO CLIENTE (mockup aprovado 29/10/2026).
-- 1) ig_salvar_opcoes guarda as FIGURINHAS do story (link, enquete, caixinha,
--    música, local). A API do Instagram não publica nenhuma delas (doc IG User
--    Media, "Story Limitations"), então ter qualquer uma liga pelo_celular.
-- 2) story_figurinhas_by_token: o link do cliente desenha a figurinha por cima
--    do story pra ele aprovar o texto e a pergunta (função à parte pra não
--    mexer no list_posts_by_token).
-- 3) ig_lembrar_conferencia: post "pelo celular" não recebe mais o falso
--    "falta conferir" e passa a receber "Hora de postar pelo celular" na hora.

create or replace function public.ig_salvar_opcoes(_post_id uuid, _opcoes jsonb)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  _o jsonb := coalesce(_opcoes, '{}'::jsonb);
  _limpo jsonb := '{}'::jsonb;
  _collab jsonb;
  _tags jsonb;
  _f jsonb := '{}'::jsonb;
  _fi jsonb := case when jsonb_typeof(_o->'figurinhas') = 'object' then _o->'figurinhas' else '{}'::jsonb end;
  _ops jsonb;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  perform 1 from public.ig_conexao_do_post(_post_id);
  select coalesce(jsonb_agg(v), '[]'::jsonb) into _collab from (
    select distinct lower(regexp_replace(btrim(x), '^@', '')) v
      from jsonb_array_elements_text(case when jsonb_typeof(_o->'collaborators') = 'array' then _o->'collaborators' else '[]'::jsonb end) x
     where regexp_replace(btrim(x), '^@', '') ~ '^[A-Za-z0-9._]{1,30}$'
  ) s;
  if jsonb_array_length(_collab) > 3 then raise exception 'Collab aceita até 3 perfis.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'username', lower(regexp_replace(btrim(t->>'username'), '^@', '')),
           'x', least(1, greatest(0, coalesce((t->>'x')::numeric, 0.5))),
           'y', least(1, greatest(0, coalesce((t->>'y')::numeric, 0.5))))), '[]'::jsonb)
    into _tags
    from jsonb_array_elements(case when jsonb_typeof(_o->'user_tags') = 'array' then _o->'user_tags' else '[]'::jsonb end) t
   where regexp_replace(btrim(coalesce(t->>'username', '')), '^@', '') ~ '^[A-Za-z0-9._]{1,30}$';
  if jsonb_array_length(_tags) > 20 then raise exception 'Dá pra marcar até 20 pessoas.'; end if;
  _limpo := jsonb_build_object('collaborators', _collab, 'user_tags', _tags);
  if nullif(btrim(coalesce(_o->>'alt_text', '')), '') is not null then
    _limpo := _limpo || jsonb_build_object('alt_text', left(btrim(_o->>'alt_text'), 1000));
  end if;
  if _o->>'trial' in ('MANUAL', 'SS_PERFORMANCE') then
    _limpo := _limpo || jsonb_build_object('trial', _o->>'trial');
  end if;
  if jsonb_typeof(_o->'share_to_feed') = 'boolean' then
    _limpo := _limpo || jsonb_build_object('share_to_feed', (_o->>'share_to_feed')::boolean);
  end if;
  if jsonb_typeof(_o->'musica_celular') = 'boolean' then
    _limpo := _limpo || jsonb_build_object('musica_celular', (_o->>'musica_celular')::boolean);
  end if;
  if jsonb_typeof(_o->'pelo_celular') = 'boolean' then
    _limpo := _limpo || jsonb_build_object('pelo_celular', (_o->>'pelo_celular')::boolean);
  end if;

  -- Figurinhas do story: só texto curto e link http(s).
  if nullif(btrim(coalesce(_fi->'link'->>'url', '')), '') is not null then
    if btrim(_fi->'link'->>'url') !~* '^https?://' and btrim(_fi->'link'->>'url') !~* '^[a-z0-9.-]+\.[a-z]{2,}' then
      raise exception 'O link da figurinha precisa ser um endereço (ex.: wa.me/5547...).';
    end if;
    _f := _f || jsonb_build_object('link', jsonb_build_object(
      'url', left(btrim(_fi->'link'->>'url'), 500),
      'texto', left(btrim(coalesce(_fi->'link'->>'texto', '')), 40)));
  end if;
  if nullif(btrim(coalesce(_fi->'enquete'->>'pergunta', '')), '') is not null then
    select coalesce(jsonb_agg(left(btrim(x), 40)), '[]'::jsonb) into _ops
      from (select x from jsonb_array_elements_text(case when jsonb_typeof(_fi->'enquete'->'opcoes') = 'array' then _fi->'enquete'->'opcoes' else '[]'::jsonb end) x
             where btrim(x) <> '' limit 4) s;
    _f := _f || jsonb_build_object('enquete', jsonb_build_object('pergunta', left(btrim(_fi->'enquete'->>'pergunta'), 120), 'opcoes', _ops));
  end if;
  if nullif(btrim(coalesce(_fi->'caixinha'->>'pergunta', '')), '') is not null then
    _f := _f || jsonb_build_object('caixinha', jsonb_build_object('pergunta', left(btrim(_fi->'caixinha'->>'pergunta'), 120)));
  end if;
  if nullif(btrim(coalesce(_fi->'musica'->>'nome', '')), '') is not null then
    _f := _f || jsonb_build_object('musica', jsonb_build_object('nome', left(btrim(_fi->'musica'->>'nome'), 120)));
  end if;
  if nullif(btrim(coalesce(_fi->'local'->>'nome', '')), '') is not null then
    _f := _f || jsonb_build_object('local', jsonb_build_object('nome', left(btrim(_fi->'local'->>'nome'), 120)));
  end if;
  if _f <> '{}'::jsonb then
    _limpo := _limpo || jsonb_build_object('figurinhas', _f, 'pelo_celular', true);
  end if;

  update public.posts set ig_opcoes = _limpo where id = _post_id;
  return _limpo;
end $function$;

create or replace function public.story_figurinhas_by_token(_token text)
returns table(post_id uuid, scheduled_time text, figurinhas jsonb)
language sql stable security definer
set search_path to 'public'
as $function$
  select p.id, left(p.scheduled_time::text, 5), coalesce(p.ig_opcoes->'figurinhas', '{}'::jsonb)
    from public.approval_tokens t
    join public.posts p on p.external_client_id = t.external_client_id and p.user_id = t.manager_id
   where t.token = _token and t.active = true
     and (t.expires_at is null or t.expires_at > now())
     and public.has_module('aprovapost_externo', t.manager_id)
     and lower(coalesce(p.format, '')) in ('story', 'stories')
     and p.approval_status in ('pendente', 'ajuste_solicitado', 'aprovado')
     and p.deleted_at is null;
$function$;
grant execute on function public.story_figurinhas_by_token(text) to anon, authenticated;

create or replace function public.ig_lembrar_conferencia()
returns integer
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  _r record;
  _n integer := 0;
  _resumo text;
begin
  -- Falta conferir (2 h antes): só o que o Cria publica sozinho.
  for _r in
    select p.id, p.user_id, p.agencia_id, p.title
      from public.posts p
     where p.deleted_at is null
       and p.external_client_id is not null
       and p.approval_status = 'aprovado'
       and p.publish_status is null
       and p.scheduled_date is not null
       and p.publish_lembrete_em is null
       and coalesce((p.ig_opcoes->>'pelo_celular')::boolean, false) = false
       and coalesce((p.ig_opcoes->>'musica_celular')::boolean, false) = false
       and public.instante_brasilia(p.scheduled_date, p.scheduled_time) between now() and now() + interval '2 hours'
  loop
    if not coalesce((select c.pode_publicar from public.ig_conexao_do_post(_r.id, _r.user_id) c limit 1), false) then
      continue;
    end if;
    insert into public.notifications (user_id, type, title, description, link, read)
    values (coalesce(_r.agencia_id, _r.user_id), 'publicacao_instagram', 'Falta conferir um post',
           '"' || left(coalesce(_r.title, 'Post'), 60) || '" sai em menos de 2 horas e ninguém conferiu. Sem conferência, não publica.',
           '/socialmidia/criapost/publicacoes', false);
    update public.posts set publish_lembrete_em = now() where id = _r.id;
    _n := _n + 1;
  end loop;

  -- Hora de postar pelo celular: no horário, com o que vai na figurinha.
  for _r in
    select p.id, p.user_id, p.agencia_id, p.title, p.ig_opcoes
      from public.posts p
     where p.deleted_at is null
       and p.external_client_id is not null
       and p.approval_status = 'aprovado'
       and p.publish_status is null
       and p.scheduled_date is not null
       and p.publish_lembrete_em is null
       and (coalesce((p.ig_opcoes->>'pelo_celular')::boolean, false) or coalesce((p.ig_opcoes->>'musica_celular')::boolean, false))
       and public.instante_brasilia(p.scheduled_date, p.scheduled_time) between now() - interval '20 minutes' and now() + interval '5 minutes'
  loop
    _resumo := concat_ws(' · ',
      case when _r.ig_opcoes->'figurinhas' ? 'link' then 'link' end,
      case when _r.ig_opcoes->'figurinhas' ? 'enquete' then 'enquete' end,
      case when _r.ig_opcoes->'figurinhas' ? 'caixinha' then 'caixinha' end,
      case when _r.ig_opcoes->'figurinhas' ? 'musica' or coalesce((_r.ig_opcoes->>'musica_celular')::boolean, false) then 'música' end,
      case when _r.ig_opcoes->'figurinhas' ? 'local' then 'local' end);
    insert into public.notifications (user_id, type, title, description, link, read)
    values (coalesce(_r.agencia_id, _r.user_id), 'publicacao_instagram', 'Hora de postar pelo celular',
           '"' || left(coalesce(_r.title, 'Story'), 60) || '"' || case when _resumo <> '' then ' leva ' || _resumo else '' end
           || '. Baixe a mídia, copie o que vai na figurinha e poste pelo app. Depois marque "Postei".',
           '/socialmidia/criapost/publicacoes', false);
    update public.posts set publish_lembrete_em = now() where id = _r.id;
    _n := _n + 1;
  end loop;
  return _n;
end $function$;
