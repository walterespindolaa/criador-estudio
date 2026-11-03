-- TikTok e YouTube só pro master enquanto o fluxo é testado (Walter, 03/11/2026).
-- 1. Validação comum (quem pode, conexão, aprovação, escolhas da rede);
-- 2. agendar_publicacao_rede passa a exigir admin;
-- 3. preparar_publicacao_rede: grava as escolhas sem data, pro "Publicar agora".
-- Pra liberar pra todos depois: tirar a linha do is_admin() das duas funções.

create or replace function public.validar_publicacao_rede(_post_id uuid, _rede text, _opcoes jsonb, _titulo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _c record;
  _p record;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  if _rede not in ('tiktok', 'youtube') then raise exception 'rede inválida'; end if;
  select * into _c from public.conexao_do_post(_post_id, _rede) limit 1;
  select id, title, external_client_id, approval_status, publish_sem_aprovacao_motivo
    into _p from public.posts where id = _post_id and deleted_at is null;
  if exists (select 1 from public.post_publicacoes pp where pp.post_id = _post_id and pp.rede = _rede
               and pp.status in ('publicando', 'processando', 'publicado')) then
    raise exception 'Este post já foi (ou está sendo) publicado nesta rede.';
  end if;
  if not coalesce(_c.pode_publicar, false) then
    raise exception '%', coalesce(_c.motivo, 'Esta rede não está conectada a este perfil.');
  end if;
  if _p.external_client_id is not null and coalesce(_p.approval_status, '') <> 'aprovado'
     and coalesce(_p.publish_sem_aprovacao_motivo, '') = '' then
    raise exception 'O cliente ainda não aprovou este post.';
  end if;
  if _rede = 'tiktok' and coalesce(_opcoes->>'privacy_level', '') = '' then
    raise exception 'Escolha a privacidade do post no TikTok.';
  end if;
  if _rede = 'tiktok' and coalesce((_opcoes->>'brand_content_toggle')::boolean, false)
     and _opcoes->>'privacy_level' = 'SELF_ONLY' then
    raise exception 'Conteúdo de marca não pode sair como "só eu" no TikTok.';
  end if;
  if _rede = 'youtube' and (coalesce(_opcoes->>'privacyStatus', '') not in ('public', 'unlisted', 'private')
       or coalesce(jsonb_typeof(_opcoes->'selfDeclaredMadeForKids'), '') <> 'boolean') then
    raise exception 'Escolha a visibilidade e responda se o vídeo é feito para crianças.';
  end if;
  if _rede = 'youtube' and coalesce(nullif(btrim(_titulo), ''), nullif(btrim(_p.title), '')) is null then
    raise exception 'O vídeo precisa de um título pro YouTube.';
  end if;
  return _c.connection_id;
end;
$$;
revoke all on function public.validar_publicacao_rede(uuid, text, jsonb, text) from public, anon, authenticated;

create or replace function public.agendar_publicacao_rede(
  _post_id uuid, _rede text, _ligar boolean,
  _opcoes jsonb default '{}'::jsonb, _titulo text default null, _texto text default null)
returns table (pub_id uuid, status text, publicar_em timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  _conn uuid;
  _p record;
  _quando timestamptz;
  _id uuid;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  if not public.is_admin() then raise exception 'sem permissão'; end if;

  if not _ligar then
    perform public.conexao_do_post(_post_id, _rede);
    update public.post_publicacoes pp
       set status = 'cancelado', updated_at = now()
     where pp.post_id = _post_id and pp.rede = _rede and pp.status in ('rascunho', 'na_fila', 'erro');
    return query select pp.id, pp.status, pp.publicar_em from public.post_publicacoes pp
      where pp.post_id = _post_id and pp.rede = _rede;
    return;
  end if;

  _conn := public.validar_publicacao_rede(_post_id, _rede, _opcoes, _titulo);
  select scheduled_date, scheduled_time into _p from public.posts where id = _post_id;
  if _p.scheduled_date is null then
    raise exception 'Defina a data do post antes de agendar.';
  end if;
  _quando := public.instante_brasilia(_p.scheduled_date, _p.scheduled_time);
  if _quando < now() - interval '2 minutes' then
    raise exception 'A data e hora deste post já passaram. Ajuste a data ou use Publicar agora.';
  end if;

  insert into public.post_publicacoes as pp
    (post_id, rede, connection_id, status, publicar_em, titulo, texto, opcoes, erro, tentativas, criado_por)
  values
    (_post_id, _rede, _conn, 'na_fila', null, nullif(btrim(_titulo), ''), nullif(btrim(_texto), ''),
     coalesce(_opcoes, '{}'::jsonb), null, 0, auth.uid())
  on conflict (post_id, rede) do update set
    connection_id = excluded.connection_id, status = 'na_fila', publicar_em = null,
    titulo = excluded.titulo, texto = excluded.texto, opcoes = excluded.opcoes,
    erro = null, tentativas = 0, criado_por = excluded.criado_por, updated_at = now()
  returning pp.id into _id;
  return query select _id, 'na_fila'::text, _quando;
end;
$$;
revoke all on function public.agendar_publicacao_rede(uuid, text, boolean, jsonb, text, text) from public, anon;
grant execute on function public.agendar_publicacao_rede(uuid, text, boolean, jsonb, text, text) to authenticated;

create or replace function public.preparar_publicacao_rede(
  _post_id uuid, _rede text, _opcoes jsonb default '{}'::jsonb, _titulo text default null, _texto text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _conn uuid;
  _id uuid;
begin
  _conn := public.validar_publicacao_rede(_post_id, _rede, _opcoes, _titulo);
  insert into public.post_publicacoes as pp
    (post_id, rede, connection_id, status, publicar_em, titulo, texto, opcoes, erro, tentativas, criado_por)
  values
    (_post_id, _rede, _conn, 'rascunho', null, nullif(btrim(_titulo), ''), nullif(btrim(_texto), ''),
     coalesce(_opcoes, '{}'::jsonb), null, 0, auth.uid())
  on conflict (post_id, rede) do update set
    connection_id = excluded.connection_id, status = 'rascunho', publicar_em = null,
    titulo = excluded.titulo, texto = excluded.texto, opcoes = excluded.opcoes,
    erro = null, tentativas = 0, criado_por = excluded.criado_por, updated_at = now()
  returning pp.id into _id;
  return _id;
end;
$$;
revoke all on function public.preparar_publicacao_rede(uuid, text, jsonb, text, text) from public, anon;
grant execute on function public.preparar_publicacao_rede(uuid, text, jsonb, text, text) to authenticated;

notify pgrst, 'reload schema';
