-- ============================================================
-- PORTAL DE APROVAÇÃO: recria as RPCs por TOKEN.
--
-- Sintoma: o cliente abre o link e recebe "Apenas o dono da conta (cliente)
-- pode aprovar ou solicitar ajuste". Essa mensagem NÃO existe no código do
-- portal: veio de uma versão da função no banco que exige auth.uid() = dono.
-- No portal público não existe login nenhum (o visitante é anon), então
-- qualquer checagem de auth.uid() trava 100% das aprovações.
--
-- Quem autoriza aqui é o TOKEN, não a sessão:
--   token ativo + não expirado + módulo aprovapost_externo ligado pro manager
--   + o post pertence ao cliente daquele token + está dentro do período do link
-- (é exatamente o que public.token_allows_post já valida).
--
-- SECURITY DEFINER porque o visitante anônimo não tem permissão nas tabelas;
-- a função é a única porta, e ela só mexe no post daquele token.
-- Idempotente: create or replace + grants.
-- ============================================================

create or replace function public.approve_post_by_token(_token text, _post_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_manager uuid; v_client uuid;
begin
  if not public.token_allows_post(_token, _post_id) then raise exception 'fora do periodo'; end if;
  select t.manager_id, t.external_client_id into v_manager, v_client
  from public.approval_tokens t
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
    and public.has_module('aprovapost_externo', t.manager_id);
  if v_manager is null then raise exception 'invalid_token'; end if;
  update public.posts
     set approval_status = 'aprovado', approval_updated_at = now(),
         approval_stages = case when approval_stages is not null
           then '{"tema":"aprovado","conteudo":"aprovado","midia":"aprovado","legenda":"aprovado"}'::jsonb
           else approval_stages end
   where id = _post_id and external_client_id = v_client and user_id = v_manager;
  if not found then raise exception 'post_not_found'; end if;
end; $function$;

create or replace function public.request_adjustment_by_token(_token text, _post_id uuid, _comment text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_manager uuid; v_client uuid;
begin
  if not public.token_allows_post(_token, _post_id) then raise exception 'fora do periodo'; end if;
  if coalesce(trim(_comment),'') = '' then raise exception 'comment_required'; end if;
  select t.manager_id, t.external_client_id into v_manager, v_client
  from public.approval_tokens t
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
    and public.has_module('aprovapost_externo', t.manager_id);
  if v_manager is null then raise exception 'invalid_token'; end if;
  update public.posts
     set approval_status = 'ajuste_solicitado', approval_updated_at = now()
   where id = _post_id and external_client_id = v_client and user_id = v_manager;
  if not found then raise exception 'post_not_found'; end if;
  insert into public.post_approval_comments(post_id, author_id, author_role, content)
  values (_post_id, null, 'cliente_externo', left(_comment, 2000));
end; $function$;

create or replace function public.approve_stage_by_token(_token text, _post_id uuid, _stage text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_manager uuid; v_client uuid; v_stages jsonb; v_overall text;
begin
  if not public.token_allows_post(_token, _post_id) then raise exception 'fora do periodo'; end if;
  if _stage not in ('tema','conteudo','midia','legenda') then raise exception 'invalid_stage'; end if;
  select t.manager_id, t.external_client_id into v_manager, v_client
  from public.approval_tokens t
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
    and public.has_module('aprovapost_externo', t.manager_id);
  if v_manager is null then raise exception 'invalid_token'; end if;

  select jsonb_set(coalesce(approval_stages,'{}'::jsonb), array[_stage], '"aprovado"'::jsonb)
    into v_stages
  from public.posts where id = _post_id and external_client_id = v_client and user_id = v_manager;
  if v_stages is null then raise exception 'post_not_found'; end if;

  if (v_stages->>'tema'='aprovado' and v_stages->>'conteudo'='aprovado'
      and v_stages->>'midia'='aprovado' and v_stages->>'legenda'='aprovado')
    then v_overall := 'aprovado';
  elsif (v_stages->>'tema'='ajuste_solicitado' or v_stages->>'conteudo'='ajuste_solicitado'
      or v_stages->>'midia'='ajuste_solicitado' or v_stages->>'legenda'='ajuste_solicitado')
    then v_overall := 'ajuste_solicitado';
  else v_overall := 'pendente';
  end if;

  update public.posts set approval_stages = v_stages, approval_status = v_overall, approval_updated_at = now()
   where id = _post_id and external_client_id = v_client and user_id = v_manager;
end; $function$;

create or replace function public.request_stage_adjustment_by_token(_token text, _post_id uuid, _stage text, _comment text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_manager uuid; v_client uuid; v_stages jsonb; v_label text;
begin
  if not public.token_allows_post(_token, _post_id) then raise exception 'fora do periodo'; end if;
  if _stage not in ('tema','conteudo','midia','legenda') then raise exception 'invalid_stage'; end if;
  if coalesce(trim(_comment),'') = '' then raise exception 'comment_required'; end if;
  select t.manager_id, t.external_client_id into v_manager, v_client
  from public.approval_tokens t
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
    and public.has_module('aprovapost_externo', t.manager_id);
  if v_manager is null then raise exception 'invalid_token'; end if;

  select jsonb_set(coalesce(approval_stages,'{}'::jsonb), array[_stage], '"ajuste_solicitado"'::jsonb)
    into v_stages
  from public.posts where id = _post_id and external_client_id = v_client and user_id = v_manager;
  if v_stages is null then raise exception 'post_not_found'; end if;

  v_label := case _stage when 'tema' then 'Tema' when 'conteudo' then 'Conteúdo' when 'midia' then 'Mídia' else 'Legenda' end;
  update public.posts set approval_stages = v_stages, approval_status = 'ajuste_solicitado', approval_updated_at = now()
   where id = _post_id and external_client_id = v_client and user_id = v_manager;
  insert into public.post_approval_comments(post_id, author_id, author_role, content)
  values (_post_id, null, 'cliente_externo', '['||v_label||'] '||left(_comment, 2000));
end; $function$;

-- O visitante do link é ANÔNIMO: sem estes grants o portal responde 404/403.
grant execute on function public.token_allows_post(text, uuid) to anon, authenticated;
grant execute on function public.approve_post_by_token(text, uuid) to anon, authenticated;
grant execute on function public.request_adjustment_by_token(text, uuid, text) to anon, authenticated;
grant execute on function public.approve_stage_by_token(text, uuid, text) to anon, authenticated;
grant execute on function public.request_stage_adjustment_by_token(text, uuid, text, text) to anon, authenticated;
