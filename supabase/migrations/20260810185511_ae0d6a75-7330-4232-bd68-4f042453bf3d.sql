CREATE OR REPLACE FUNCTION public.token_allows_post(_token text, _post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.approval_tokens t
    join public.posts p
      on p.external_client_id = t.external_client_id
     and p.user_id = t.manager_id
    where t.token = _token
      and t.active = true
      and (t.expires_at is null or t.expires_at > now())
      and public.has_module('aprovapost_externo', t.manager_id)
      and p.id = _post_id
      and (
        t.period_start is null or t.period_end is null
        or (p.scheduled_date is not null
            and p.scheduled_date >= t.period_start
            and p.scheduled_date <= t.period_end)
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.approve_post_by_token(_token text, _post_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.approve_stage_by_token(_token text, _post_id uuid, _stage text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.request_adjustment_by_token(_token text, _post_id uuid, _comment text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.request_stage_adjustment_by_token(_token text, _post_id uuid, _stage text, _comment text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

GRANT EXECUTE ON FUNCTION public.token_allows_post(text, uuid) TO anon, authenticated;