-- ═══════════════════════════════════════════════════════════════════════════
-- PUBLICAR NO TIKTOK E NO YOUTUBE · CICLO 2 (03/11/2026)
-- Depende de 20261102000003 (post_publicacoes, conexao_do_post).
--
-- 1. agendar_publicacao_rede: liga/desliga a publicação de um post numa rede,
--    com as escolhas que a rede exige (guardadas em opcoes);
-- 2. redes_travar_publicacao / redes_pegar_da_fila / redes_processando:
--    trava de um-publica-por-vez e a fila do robô;
-- 3. robô de cada minuto, que só chama a função quando tem algo vencido.
-- Sem horário próprio, a publicação segue a data e a hora do post.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Ligar / desligar ───────────────────────────────────────────────────
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
  _c record;
  _p record;
  _quando timestamptz;
  _id uuid;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  if _rede not in ('tiktok', 'youtube') then raise exception 'rede inválida'; end if;
  -- Permissão: conexao_do_post levanta "sem permissão para este post".
  select * into _c from public.conexao_do_post(_post_id, _rede) limit 1;
  select id, external_client_id, approval_status, scheduled_date, scheduled_time
    into _p from public.posts where id = _post_id and deleted_at is null;

  if not _ligar then
    update public.post_publicacoes pp
       set status = 'cancelado', updated_at = now()
     where pp.post_id = _post_id and pp.rede = _rede and pp.status in ('rascunho', 'na_fila', 'erro');
    return query select pp.id, pp.status, pp.publicar_em from public.post_publicacoes pp
      where pp.post_id = _post_id and pp.rede = _rede;
    return;
  end if;

  if exists (select 1 from public.post_publicacoes pp where pp.post_id = _post_id and pp.rede = _rede
               and pp.status in ('publicando', 'processando', 'publicado')) then
    raise exception 'Este post já foi (ou está sendo) publicado nesta rede.';
  end if;
  if not coalesce(_c.pode_publicar, false) then
    raise exception '%', coalesce(_c.motivo, 'Esta rede não está conectada a este perfil.');
  end if;
  if _p.external_client_id is not null and coalesce(_p.approval_status, '') <> 'aprovado' then
    raise exception 'O cliente ainda não aprovou este post. A publicação libera depois da aprovação.';
  end if;
  if _p.scheduled_date is null then
    raise exception 'Defina a data do post antes de agendar.';
  end if;
  _quando := public.instante_brasilia(_p.scheduled_date, _p.scheduled_time);
  if _quando < now() - interval '2 minutes' then
    raise exception 'A data e hora deste post já passaram. Ajuste a data ou use Publicar agora.';
  end if;
  -- As escolhas que a rede exige na tela (sem valor padrão no TikTok).
  if _rede = 'tiktok' and coalesce(_opcoes->>'privacy_level', '') = '' then
    raise exception 'Escolha a privacidade do post no TikTok.';
  end if;
  if _rede = 'youtube' and (coalesce(_opcoes->>'privacyStatus', '') not in ('public', 'unlisted', 'private')
       or coalesce(jsonb_typeof(_opcoes->'selfDeclaredMadeForKids'), '') <> 'boolean') then
    raise exception 'Escolha a visibilidade e responda se o vídeo é feito para crianças.';
  end if;
  if _rede = 'youtube' and coalesce(nullif(btrim(_titulo), ''), '') = '' and
     coalesce((select nullif(btrim(title), '') from public.posts where id = _post_id), '') = '' then
    raise exception 'O vídeo precisa de um título pro YouTube.';
  end if;

  insert into public.post_publicacoes as pp
    (post_id, rede, connection_id, status, publicar_em, titulo, texto, opcoes, erro, tentativas, criado_por)
  values
    (_post_id, _rede, _c.connection_id, 'na_fila', null, nullif(btrim(_titulo), ''), nullif(btrim(_texto), ''),
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

-- ── 2. Trava e fila ───────────────────────────────────────────────────────
-- Quando sai: o horário próprio (reagendamento do robô) ou a data do post.
create or replace function public.redes_hora_de_sair(_pub public.post_publicacoes)
returns timestamptz language sql stable set search_path = public as $$
  select coalesce(_pub.publicar_em,
    (select public.instante_brasilia(p.scheduled_date, p.scheduled_time) from public.posts p where p.id = _pub.post_id));
$$;

-- "Publicar agora" e o robô passam por aqui: um publica por vez.
create or replace function public.redes_travar_publicacao(_pub_id uuid, _actor uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  _r public.post_publicacoes%rowtype;
begin
  select * into _r from public.post_publicacoes where id = _pub_id;
  if _r.id is null or _r.rede not in ('tiktok', 'youtube') then return 'sumiu'; end if;
  -- Direito ao post (levanta "sem permissão para este post").
  if _actor is not null then perform public.conexao_do_post(_r.post_id, _r.rede, _actor); end if;
  update public.post_publicacoes
     set status = 'publicando', tentativas = tentativas + 1, erro = null, updated_at = now(),
         criado_por = coalesce(criado_por, _actor)
   where id = _pub_id
     and (status in ('na_fila', 'erro', 'rascunho')
          or (status = 'publicando' and updated_at < now() - interval '15 minutes'));
  if found then return 'ok'; end if;
  return _r.status;
end $$;
revoke all on function public.redes_travar_publicacao(uuid, uuid) from public, anon, authenticated;
grant execute on function public.redes_travar_publicacao(uuid, uuid) to service_role;

-- O robô pega UMA vencida e já trava (dois robôs nunca pegam a mesma).
create or replace function public.redes_pegar_da_fila()
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  select pp.id into _id
    from public.post_publicacoes pp
    join public.posts p on p.id = pp.post_id and p.deleted_at is null
   where pp.rede in ('tiktok', 'youtube') and pp.status = 'na_fila'
     and public.redes_hora_de_sair(pp) <= now()
   order by public.redes_hora_de_sair(pp)
   limit 1
   for update of pp skip locked;
  if _id is null then return null; end if;
  update public.post_publicacoes
     set status = 'publicando', tentativas = tentativas + 1, erro = null, updated_at = now()
   where id = _id;
  return _id;
end $$;
revoke all on function public.redes_pegar_da_fila() from public, anon, authenticated;
grant execute on function public.redes_pegar_da_fila() to service_role;

-- TikTok processando há mais de 1 minuto: hora de perguntar o status.
create or replace function public.redes_processando(_limite int default 10)
returns table (id uuid) language sql security definer set search_path = public as $$
  select pp.id from public.post_publicacoes pp
   where pp.rede = 'tiktok' and pp.status = 'processando' and pp.updated_at < now() - interval '1 minute'
   order by pp.updated_at limit greatest(_limite, 1);
$$;
revoke all on function public.redes_processando(int) from public, anon, authenticated;
grant execute on function public.redes_processando(int) to service_role;

-- ── 3. Robô de cada minuto ────────────────────────────────────────────────
do $$
begin
  perform cron.unschedule('cria-redes-publicar-fila');
exception when others then null;
end $$;
select cron.schedule('cria-redes-publicar-fila', '* * * * *', $c$
  select net.http_post(
    url := 'https://ecbzfjzoqidowrsfsfih.supabase.co/functions/v1/redes-publicar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'internal_push_secret' limit 1)),
    body := '{"fila": true}'::jsonb)
  -- Só chama quando tem algo vencido ou processando.
  where exists (
    select 1 from public.post_publicacoes pp
     where pp.rede in ('tiktok', 'youtube')
       and ((pp.status = 'na_fila' and public.redes_hora_de_sair(pp) <= now())
            or (pp.status = 'processando' and pp.updated_at < now() - interval '1 minute')));
$c$);

notify pgrst, 'reload schema';
