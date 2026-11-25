-- ═══════════════════════════════════════════════════════════════════════════
-- PUBLICAR NO LINKEDIN (PERFIL PESSOAL) · 25/11/2026
-- Walter, 25/11/2026: "linkedin vamos implementar já que é rapido e adaptar o
-- sistema pra isso?". Página de empresa fica em stand by.
-- Plano: nota do cofre Anotacoes/2026-11-25-linkedin-e-google-meu-negocio.
--
-- Mesmo motor do TikTok e do YouTube (post_publicacoes + redes-publicar), com
-- duas diferenças do LinkedIn:
--   - o acesso dura 60 dias e NÃO renova (refresh token só pra parceiro
--     aprovado do LinkedIn). Vencido, bloqueia igual ao Instagram e pede
--     reconectar; conexao_vence_em mostra na tela quantos dias faltam;
--   - vídeo fica "processando" no LinkedIn até ficar pronto, e só então o
--     robô cria o post (mesmo caminho do TikTok em redes_processando).
-- Continua só pro master (is_admin) até o Walter testar.
-- Idempotente: pode rodar de novo sem estragar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. As tabelas aceitam a rede nova ─────────────────────────────────────
alter table public.social_connections drop constraint if exists social_connections_provider_chk;
alter table public.social_connections add constraint social_connections_provider_chk
  check (provider in ('instagram', 'tiktok', 'youtube', 'linkedin'));

-- O check da coluna rede nasceu sem nome. Apaga qualquer check que olhe só a
-- coluna rede (seja qual for o nome que o Postgres deu) e recria com nome fixo.
do $$
declare _n text;
begin
  for _n in
    select c.conname from pg_constraint c
     where c.conrelid = 'public.post_publicacoes'::regclass and c.contype = 'c'
       and pg_get_constraintdef(c.oid) like '%rede%' and pg_get_constraintdef(c.oid) not like '%status%'
  loop
    execute format('alter table public.post_publicacoes drop constraint %I', _n);
  end loop;
end $$;
alter table public.post_publicacoes add constraint post_publicacoes_rede_check
  check (rede in ('instagram', 'tiktok', 'youtube', 'linkedin'));

-- ── 2. conexao_do_post conhece o LinkedIn ─────────────────────────────────
-- A função foi remendada em 20261105000000 (equipe da conta), então o remendo
-- é feito em cima da definição que está no banco, trecho por trecho.
do $$
declare
  _def text;
  _de text[] := array[
    E'when ''youtube'' then ''YouTube'' end;',
    E'when ''youtube'' then ''youtube.upload'' end;',
    E'(_rede <> ''instagram'' or _c.token_expires_at',
    E'or (_rede = ''instagram'' and _c.token_expires_at'];
  _para text[] := array[
    E'when ''youtube'' then ''YouTube'' when ''linkedin'' then ''LinkedIn'' end;',
    E'when ''youtube'' then ''youtube.upload''\n                             when ''linkedin'' then ''w_member_social'' end;',
    E'(_rede not in (''instagram'', ''linkedin'') or _c.token_expires_at',
    E'or (_rede in (''instagram'', ''linkedin'') and _c.token_expires_at'];
  i int;
begin
  _def := pg_get_functiondef('public.conexao_do_post(uuid,text,uuid)'::regprocedure);
  if position('''linkedin''' in _def) > 0 then return; end if;
  for i in 1 .. array_length(_de, 1) loop
    if position(_de[i] in _def) = 0 then raise exception 'trecho não achado em conexao_do_post: %', _de[i]; end if;
    _def := replace(_def, _de[i], _para[i]);
  end loop;
  execute _def;
end $$;

-- ── 3. Quando vence a conexão (aviso dos 60 dias na tela) ─────────────────
-- Sem mexer no retorno de conexao_do_post (trocar o retorno exige drop e
-- recriar a função remendada). Mesma regra de quem pode ver o post.
create or replace function public.conexao_vence_em(_post_id uuid, _rede text)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _id uuid;
  _vence timestamptz;
begin
  select c.connection_id into _id from public.conexao_do_post(_post_id, _rede) c limit 1;
  if _id is null then return null; end if;
  select sc.token_expires_at into _vence from public.social_connections sc where sc.id = _id;
  return _vence;
end;
$$;
revoke all on function public.conexao_vence_em(uuid, text) from public, anon;
grant execute on function public.conexao_vence_em(uuid, text) to authenticated;

-- ── 4. Validação comum aceita o LinkedIn ──────────────────────────────────
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
  if _rede not in ('tiktok', 'youtube', 'linkedin') then raise exception 'rede inválida'; end if;
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
  if _rede = 'linkedin' and coalesce(_opcoes->>'visibility', '') not in ('PUBLIC', 'CONNECTIONS') then
    raise exception 'Escolha quem pode ver o post no LinkedIn.';
  end if;
  return _c.connection_id;
end;
$$;
revoke all on function public.validar_publicacao_rede(uuid, text, jsonb, text) from public, anon, authenticated;

-- ── 5. Trava, fila e processando ──────────────────────────────────────────
create or replace function public.redes_travar_publicacao(_pub_id uuid, _actor uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  _r public.post_publicacoes%rowtype;
begin
  select * into _r from public.post_publicacoes where id = _pub_id;
  if _r.id is null or _r.rede not in ('tiktok', 'youtube', 'linkedin') then return 'sumiu'; end if;
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

create or replace function public.redes_pegar_da_fila()
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  select pp.id into _id
    from public.post_publicacoes pp
    join public.posts p on p.id = pp.post_id and p.deleted_at is null
   where pp.rede in ('tiktok', 'youtube', 'linkedin') and pp.status = 'na_fila'
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

-- TikTok e vídeo do LinkedIn processando há mais de 1 minuto: hora de perguntar.
create or replace function public.redes_processando(_limite int default 10)
returns table (id uuid) language sql security definer set search_path = public as $$
  select pp.id from public.post_publicacoes pp
   where pp.rede in ('tiktok', 'linkedin') and pp.status = 'processando' and pp.updated_at < now() - interval '1 minute'
   order by pp.updated_at limit greatest(_limite, 1);
$$;
revoke all on function public.redes_processando(int) from public, anon, authenticated;
grant execute on function public.redes_processando(int) to service_role;

-- ── 6. Robô de cada minuto olha o LinkedIn também ─────────────────────────
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
     where pp.rede in ('tiktok', 'youtube', 'linkedin')
       and ((pp.status = 'na_fila' and public.redes_hora_de_sair(pp) <= now())
            or (pp.status = 'processando' and pp.updated_at < now() - interval '1 minute')));
$c$);

notify pgrst, 'reload schema';
