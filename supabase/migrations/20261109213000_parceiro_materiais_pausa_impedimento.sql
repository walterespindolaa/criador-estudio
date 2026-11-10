-- PAUSA E IMPEDIMENTO NA PRODUÇÃO DO PARCEIRO (Walter e Agatha, 09/11/2026).
-- 1. Libera 'aguardando' em parceiro_marcar pra designer poder devolver um
--    post de Fazendo pra Novo quando pausar pra priorizar outro.
-- 2. Cria producao_impedimento em posts e as RPCs parceiro_impedimento e
--    parceiro_meus_impedimentos pra sinalizar quando o card está travado
--    esperando fotos ou briefing da agência, visível nos dois lados sem tirar
--    o post da coluna atual.

alter table public.posts add column if not exists producao_impedimento text;

create or replace function public.parceiro_marcar(_post_id uuid, _status text, _link text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _limpo text;
begin
  if not public.parceiro_tem_o_card(_post_id) then
    raise exception 'sem acesso a este card';
  end if;
  if _status not in ('aguardando', 'em_producao', 'entregue') then
    raise exception 'status de produção inválido: %', _status;
  end if;
  update public.posts
     set producao_status = _status,
         producao_impedimento = case when _status in ('aguardando', 'entregue') then null else producao_impedimento end
   where id = _post_id;

  -- O link da versão final vira comentário carimbado: fica na conversa do
  -- card, a social mídia recebe, e três meses depois ainda dá pra achar.
  _limpo := btrim(coalesce(_link, ''));
  if _status = 'entregue' and _limpo <> '' then
    if _limpo !~* '^https?://' then
      raise exception 'link de entrega inválido';
    end if;
    insert into public.post_approval_comments (post_id, content, author_role)
    values (_post_id, left('Entrega: ' || _limpo, 4000), 'parceiro');
  end if;
end; $function$;

create or replace function public.parceiro_impedimento(_post_id uuid, _motivo text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _eh_parceiro boolean := public.parceiro_tem_o_card(_post_id);
  _eh_agencia boolean := exists (
    select 1 from public.posts p
     where p.id = _post_id
       and (public.acts_for(p.user_id)
            or (p.agencia_id is not null and public.acts_for(p.agencia_id)))
  );
  _limpo text := btrim(coalesce(_motivo, ''));
begin
  if not (_eh_parceiro or _eh_agencia) then
    raise exception 'sem acesso a este card';
  end if;

  if _limpo = '' then
    update public.posts set producao_impedimento = null where id = _post_id;
  else
    update public.posts set producao_impedimento = left(_limpo, 280) where id = _post_id;
    if _eh_parceiro then
      insert into public.post_approval_comments (post_id, content, author_role)
      values (_post_id, '⏸ Impedimento: ' || left(_limpo, 280), 'parceiro');
    end if;
  end if;
end; $function$;

revoke all on function public.parceiro_impedimento(uuid, text) from public, anon;
grant execute on function public.parceiro_impedimento(uuid, text) to authenticated, service_role;

create or replace function public.parceiro_meus_impedimentos()
 returns table(post_id uuid, impedimento text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.id, btrim(p.producao_impedimento)
    from public.posts p
   where p.assignee_id = auth.uid()
     and p.deleted_at is null
     and coalesce(p.producao_status, 'aguardando') <> 'entregue'
     and nullif(btrim(p.producao_impedimento), '') is not null;
$function$;

revoke all on function public.parceiro_meus_impedimentos() from public, anon;
grant execute on function public.parceiro_meus_impedimentos() to authenticated, service_role;

do $$
declare _def text;
begin
  _def := pg_get_functiondef('public.parceiro_abrir_card(uuid)'::regprocedure);
  if position('''impedimento''' in _def) = 0 then
    _def := replace(
      _def,
      '''urgente'', coalesce(_p.urgente, false));',
      '''urgente'', coalesce(_p.urgente, false), ''impedimento'', nullif(btrim(_p.producao_impedimento), ''''));'
    );
    if position('''impedimento''' in _def) = 0 then
      raise exception 'parceiro_abrir_card mudou: não achei o fim do jsonb_build_object';
    end if;
    execute _def;
  end if;
end $$;
