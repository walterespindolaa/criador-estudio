-- AVISO DE PEDIDO DE AJUSTE SEM O TEXTO DO CLIENTE (Walter, 19/10/2026)
--
-- Causa (provada nas definições vivas):
--  1. notify_post_approval buscava comentário com author_role = 'cliente', mas
--     o portal grava 'cliente_externo' (e 'cliente_externo_aprovacao'). Nunca achava.
--  2. request_adjustment_by_token e request_stage_adjustment_by_token faziam o
--     UPDATE do post (que dispara o aviso) ANTES de gravar o comentário. Mesmo
--     com o papel certo, o aviso pegaria o comentário anterior, ou nenhum.
-- Conserto: as duas RPCs gravam o comentário primeiro e só depois mudam o
-- status; o aviso busca o último comentário do cliente no canal do cliente,
-- dos últimos 10 minutos (pra nunca citar um pedido antigo).

create or replace function public.request_adjustment_by_token(_token text, _post_id uuid, _comment text, _midia_indice integer DEFAULT NULL::integer, _ancora_x numeric DEFAULT NULL::numeric, _ancora_y numeric DEFAULT NULL::numeric, _ancora_seg numeric DEFAULT NULL::numeric)
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
  if not exists (select 1 from public.posts p
                  where p.id = _post_id and p.external_client_id = v_client and p.user_id = v_manager)
  then raise exception 'post_not_found'; end if;
  -- Comentário ANTES do status: o aviso (trigger no posts) já encontra o texto.
  insert into public.post_approval_comments(
    post_id, author_id, author_role, content, midia_indice, ancora_x, ancora_y, ancora_seg)
  values (
    _post_id, null, 'cliente_externo', left(_comment, 2000),
    _midia_indice,
    case when _ancora_x is null then null else least(1, greatest(0, _ancora_x)) end,
    case when _ancora_y is null then null else least(1, greatest(0, _ancora_y)) end,
    case when _ancora_seg is null then null else greatest(0, _ancora_seg) end);
  update public.posts
     set approval_status = 'ajuste_solicitado', approval_updated_at = now()
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
  -- Comentário ANTES do status (mesmo motivo da função acima).
  insert into public.post_approval_comments(post_id, author_id, author_role, content)
  values (_post_id, null, 'cliente_externo', '['||v_label||'] '||left(_comment, 2000));
  update public.posts set approval_stages = v_stages, approval_status = 'ajuste_solicitado', approval_updated_at = now()
   where id = _post_id and external_client_id = v_client and user_id = v_manager;
end; $function$;

create or replace function public.notify_post_approval()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _comentario text; _ator uuid := auth.uid(); _membro record;
begin
  if new.external_client_id is not null then
    if new.approval_status is distinct from old.approval_status
       and new.approval_status in ('aprovado', 'ajuste_solicitado')
       and (_ator is null or _ator <> new.user_id) then
      -- Último recado do CLIENTE neste post, no canal do cliente, recente.
      select c.content into _comentario from public.post_approval_comments c
      where c.post_id = new.id and c.author_role like 'cliente_externo%'
        and coalesce(c.canal, 'cliente') = 'cliente'
        and c.created_at > now() - interval '10 minutes'
      order by c.created_at desc limit 1;
      insert into public.notifications (user_id, type, title, description, link)
      values (new.user_id, 'cria_post',
        case new.approval_status when 'aprovado' then 'Cliente aprovou: ' || coalesce(new.title, 'post')
          else 'Cliente pediu ajuste: ' || coalesce(new.title, 'post') end,
        case when new.approval_status = 'ajuste_solicitado' and _comentario is not null then '"' || left(_comentario, 180) || '"'
          when new.approval_status = 'aprovado' then 'Pode seguir pra produção final.'
          else 'Abra o post pra ver o pedido.' end,
        '/socialmidia/criapost');
    end if;
    return new;
  end if;

  if new.status = 'editando' and old.status is distinct from 'editando'
     and _ator is not null and _ator <> new.user_id then
    insert into public.notifications (user_id, type, title, description, link)
    values (new.user_id, 'aprovacao_pendente', 'Post pronto pra sua aprovação',
            coalesce(new.title, 'Post') || '. Dê o ok ou peça ajuste.', '/app/aprovacao');
  end if;

  if new.approval_status is distinct from old.approval_status
     and new.approval_status in ('aprovado', 'ajuste_solicitado')
     and _ator is not null and _ator = new.user_id then
    select c.content into _comentario from public.post_approval_comments c
    where c.post_id = new.id and c.author_id = new.user_id order by c.created_at desc limit 1;
    for _membro in
      select m.member_id from public.account_members m
      where m.owner_id = new.user_id and m.status = 'active' and m.member_id is not null
    loop
      insert into public.notifications (user_id, type, title, description, link)
      values (_membro.member_id, 'cria_post',
        case new.approval_status when 'aprovado' then 'Criador aprovou: ' || coalesce(new.title, 'post')
          else 'Criador pediu ajuste: ' || coalesce(new.title, 'post') end,
        case when new.approval_status = 'ajuste_solicitado' and _comentario is not null then '"' || left(_comentario, 180) || '"'
          when new.approval_status = 'aprovado' then 'Pode agendar e publicar.'
          else 'Abra o post pra ver o pedido.' end,
        '/socialmidia/aprovacoes');
    end loop;
  end if;
  return new;
end; $function$;
