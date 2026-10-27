-- Publicar no Instagram pelo Cria (Meta aprovou, 27/10/2026). O painel de
-- publicar respondia "sem permissão para este post" no post da CONTA CRIA do
-- cliente (LOG de 25/10): a regra só aceitava o dono do post ou a equipe do
-- dono. A agência que atende esse cliente (posts.agencia_id) e a equipe dela
-- ficavam de fora. Agora entram, com a mesma regra de sempre: parceiro
-- (designer, editor) nunca publica.
create or replace function public.ig_conexao_do_post(_post_id uuid, _actor uuid default null::uuid)
returns table(connection_id uuid, origem text, ig_user_id text, username text, pode_publicar boolean, motivo text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  _quem uuid := coalesce(auth.uid(), _actor);
  _p record;
  _crm uuid;
  _cria_owner uuid;
  _c public.social_connections%rowtype;
  _origem text;
begin
  if _quem is null then raise exception 'sem sessão'; end if;
  select id, user_id, external_client_id, agencia_id into _p
    from public.posts where id = _post_id and deleted_at is null;
  if _p.id is null then raise exception 'post não encontrado'; end if;
  if not (
    _p.user_id = _quem
    or exists (
      select 1 from public.manager_members m
       where m.manager_id = _p.user_id and m.member_id = _quem and m.status = 'ativo'
         and not public.eh_papel_parceiro(m.role))
    or (_p.agencia_id is not null and (
      _p.agencia_id = _quem
      or exists (
        select 1 from public.manager_members m
         where m.manager_id = _p.agencia_id and m.member_id = _quem and m.status = 'ativo'
           and not public.eh_papel_parceiro(m.role))))
  ) then
    raise exception 'sem permissão para este post';
  end if;
  if _p.external_client_id is null then
    _origem := 'criador';
    select * into _c from public.social_connections sc
     where sc.user_id = _p.user_id and sc.provider = 'instagram' and sc.crm_client_id is null
     order by sc.updated_at desc nulls last limit 1;
  else
    select ec.crm_client_id into _crm from public.external_clients ec where ec.id = _p.external_client_id;
    if _crm is not null then
      _origem := 'cliente_agencia';
      select * into _c from public.social_connections sc
       where sc.crm_client_id = _crm and sc.provider = 'instagram'
       order by sc.updated_at desc nulls last limit 1;
      if _c.id is null then
        select cc.cria_owner_id into _cria_owner from public.crm_clients cc where cc.id = _crm;
        if _cria_owner is not null then
          _origem := 'cliente_cria';
          select * into _c from public.social_connections sc
           where sc.user_id = _cria_owner and sc.provider = 'instagram' and sc.crm_client_id is null
           order by sc.updated_at desc nulls last limit 1;
        end if;
      end if;
    end if;
  end if;
  if _c.id is null then
    return query select null::uuid, _origem, null::text, null::text, false,
      'O Instagram deste perfil ainda não está conectado ao Cria.'::text;
    return;
  end if;
  return query select
    _c.id, _origem, _c.external_account_id, _c.username,
    (coalesce(_c.scopes, '') like '%instagram_business_content_publish%'
      and not _c.needs_reconnect
      and (_c.token_expires_at is null or _c.token_expires_at > now())),
    case
      when _c.needs_reconnect or (_c.token_expires_at is not null and _c.token_expires_at <= now())
        then 'A conexão com o Instagram venceu. Reconecte pra publicar pelo Cria.'
      when coalesce(_c.scopes, '') not like '%instagram_business_content_publish%'
        then 'Reconecte o Instagram pra liberar a publicação pelo Cria.'
      else null
    end;
end $function$;
