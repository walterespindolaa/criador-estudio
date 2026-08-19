-- ============================================================
-- COMENTÁRIO NA APROVAÇÃO (portal do cliente)
--
-- Sintoma que originou isto: uma cliente aprovou um post e, como não havia
-- onde elogiar, escreveu "uau muito bom! Aprovado" no campo de AJUSTE. O post
-- foi pro gestor marcado como "ajuste_solicitado", com um elogio no lugar do
-- pedido. O trabalho voltou pra fila por falta de um campo.
--
-- Agora aprovar aceita um recado curto e OPCIONAL. Ele é gravado com um papel
-- próprio, `cliente_externo_aprovacao`, e não `cliente_externo`: assim nenhuma
-- tela confunde elogio com pedido de ajuste. Sem isso, o card do portal que
-- mostra "Você pediu: ..." (que não checa o status) exibiria o elogio como se
-- fosse uma solicitação.
--
-- Sobre o DROP antes do CREATE: adicionar um parâmetro em Postgres cria uma
-- SOBRECARGA, não substitui. As duas versões conviveriam e o PostgREST ficaria
-- ambíguo na hora de escolher. Derrubamos a assinatura antiga e concedemos o
-- grant da nova, senão o visitante anônimo toma 403 e o portal para de aprovar
-- (é exatamente o bug que a migration 20260818000001 veio consertar).
-- ============================================================

drop function if exists public.approve_post_by_token(text, uuid);

create or replace function public.approve_post_by_token(_token text, _post_id uuid, _comment text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_manager uuid; v_client uuid; v_nota text;
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

  -- O recado é opcional: aprovar sem escrever nada continua sendo um clique.
  v_nota := coalesce(trim(_comment), '');
  if v_nota <> '' then
    insert into public.post_approval_comments(post_id, author_id, author_role, content)
    values (_post_id, null, 'cliente_externo_aprovacao', left(v_nota, 280));
  end if;
end; $function$;

-- Mesma coisa na aprovação por etapas (modo "Detalhada").
drop function if exists public.approve_stage_by_token(text, uuid, text);

create or replace function public.approve_stage_by_token(_token text, _post_id uuid, _stage text, _comment text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_manager uuid; v_client uuid; v_stages jsonb; v_overall text; v_label text; v_nota text;
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

  -- Prefixa a etapa, igual ao pedido de ajuste por etapa: sem isso o gestor
  -- lê "ficou ótimo" sem saber se é do tema, da mídia ou da legenda.
  v_nota := coalesce(trim(_comment), '');
  if v_nota <> '' then
    v_label := case _stage when 'tema' then 'Tema' when 'conteudo' then 'Conteúdo' when 'midia' then 'Mídia' else 'Legenda' end;
    insert into public.post_approval_comments(post_id, author_id, author_role, content)
    values (_post_id, null, 'cliente_externo_aprovacao', '['||v_label||'] '||left(v_nota, 280));
  end if;
end; $function$;

-- ============================================================
-- O papel novo precisa contar como CLIENTE nos dois lados.
--
-- Esta função traduz o autor pro portal. Sem incluir o papel novo aqui, o
-- elogio do próprio cliente apareceria pra ele rotulado como "Equipe".
-- ============================================================
create or replace function public.list_post_comments_by_token(_token text)
returns table(post_id uuid, author text, content text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  with tok as (
    select t.manager_id, t.external_client_id
    from public.approval_tokens t
    where t.token = _token
      and t.active = true
      and (t.expires_at is null or t.expires_at > now())
      and public.has_module('aprovapost_externo', t.manager_id)
  )
  select
    p.id,
    case when c.author_role in ('cliente_externo', 'cliente', 'cliente_externo_aprovacao')
         then 'cliente' else 'equipe' end,
    c.content,
    c.created_at
  from tok
  join public.posts p
    on p.external_client_id = tok.external_client_id
   and p.user_id = tok.manager_id
  join public.post_approval_comments c on c.post_id = p.id
  where p.approval_status in ('pendente', 'ajuste_solicitado', 'aprovado')
  order by p.id, c.created_at asc;
$$;

-- O visitante do portal é ANÔNIMO: sem estes grants ele toma 403 ao aprovar.
grant execute on function public.approve_post_by_token(text, uuid, text) to anon, authenticated;
grant execute on function public.approve_stage_by_token(text, uuid, text, text) to anon, authenticated;
grant execute on function public.list_post_comments_by_token(text) to anon, authenticated;
