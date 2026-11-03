-- ═══════════════════════════════════════════════════════════════════════════
-- PUBLICAR EM VÁRIAS REDES · FUNDAÇÃO (02/11/2026)
-- Plano: doc "Publicar no TikTok e no YouTube pelo Cria".
--
-- Nada aqui muda o que o usuário vê nem o caminho do Instagram, que continua
-- publicando pelas colunas ig_* do post. Só prepara o chão:
--   1. conexão por rede aceita tiktok e youtube, com refresh token guardado
--      numa tabela que só o servidor lê;
--   2. post_publicacoes: uma linha por post e por rede (status, horário, id
--      externo, link, erro, opções da rede);
--   3. o Instagram passa a se espelhar nessa tabela sozinho (gatilho), sem
--      mexer na função de publicar;
--   4. conexao_do_post(post, rede): a mesma regra do ig_conexao_do_post
--      (criador, cliente da agência, cliente com conta Cria) pra qualquer rede.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Conexões: quais redes existem ─────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'social_connections_provider_chk') then
    alter table public.social_connections add constraint social_connections_provider_chk
      check (provider in ('instagram', 'tiktok', 'youtube'));
  end if;
end $$;

-- O TikTok troca o access token a cada 24h e o refresh token também muda.
-- O refresh fica FORA de social_connections: lá o dono lê a própria linha
-- pela RLS; aqui ninguém lê, só o service_role (RLS ligada e sem política).
create table if not exists public.social_connection_tokens (
  connection_id uuid primary key references public.social_connections(id) on delete cascade,
  refresh_token text not null,
  refresh_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.social_connection_tokens enable row level security;
revoke all on public.social_connection_tokens from anon, authenticated;

-- ── 2. Uma publicação por post e por rede ────────────────────────────────
create table if not exists public.post_publicacoes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  rede text not null check (rede in ('instagram', 'tiktok', 'youtube')),
  connection_id uuid references public.social_connections(id) on delete set null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'na_fila', 'publicando', 'processando', 'publicado', 'erro', 'cancelado')),
  publicar_em timestamptz,
  -- Texto por rede. Vazio = usa a legenda do post. YouTube: titulo (até 100)
  -- + texto vira a descrição. TikTok: texto vira o título do post (até 2200).
  titulo text check (titulo is null or char_length(titulo) <= 100),
  texto text,
  -- Escolhas que a rede exige na tela (TikTok: privacy_level, comentário,
  -- dueto, costura, conteúdo comercial; YouTube: privacyStatus, madeForKids,
  -- conteúdo sintético). Validadas na hora de publicar, não aqui.
  opcoes jsonb not null default '{}'::jsonb,
  external_id text,          -- ig_media_id / publish_id do TikTok / id do vídeo no YouTube
  permalink text,
  erro text,
  tentativas integer not null default 0,
  publicado_em timestamptz,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, rede)
);

-- O robô só olha a fila (e, no TikTok, quem ainda está processando).
create index if not exists idx_post_publicacoes_fila
  on public.post_publicacoes (publicar_em)
  where status in ('na_fila', 'processando');
create index if not exists idx_post_publicacoes_post on public.post_publicacoes (post_id);

alter table public.post_publicacoes enable row level security;
-- Ler: quem enxerga o post (a RLS de posts vale dentro do exists).
drop policy if exists "post_publicacoes_ler" on public.post_publicacoes;
create policy "post_publicacoes_ler" on public.post_publicacoes
  for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_publicacoes.post_id));
-- Escrever: só pelo servidor (RPCs e funções de publicar). Sem política de
-- insert/update/delete pra authenticated de propósito.
revoke insert, update, delete on public.post_publicacoes from anon, authenticated;

-- ── 3. O Instagram se espelha na tabela nova ─────────────────────────────
create or replace function public.ig_espelhar_publicacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.publish_status is null then
    if tg_op = 'INSERT' then return new; end if;
    update public.post_publicacoes
       set status = 'cancelado', updated_at = now()
     where post_id = new.id and rede = 'instagram' and status <> 'publicado';
    return new;
  end if;
  insert into public.post_publicacoes as pp
    (post_id, rede, status, publicar_em, external_id, permalink, erro, tentativas, publicado_em, criado_por)
  values
    (new.id, 'instagram', new.publish_status, new.publicar_em, new.ig_media_id, new.ig_permalink,
     new.publish_error, coalesce(new.publish_attempts, 0),
     case when new.publish_status = 'publicado' then now() end, new.publish_by)
  on conflict (post_id, rede) do update set
    status = excluded.status,
    publicar_em = excluded.publicar_em,
    external_id = excluded.external_id,
    permalink = excluded.permalink,
    erro = excluded.erro,
    tentativas = excluded.tentativas,
    publicado_em = case when excluded.status = 'publicado' then coalesce(pp.publicado_em, now()) else pp.publicado_em end,
    criado_por = coalesce(pp.criado_por, excluded.criado_por),
    updated_at = now();
  return new;
end;
$$;
revoke all on function public.ig_espelhar_publicacao() from public, anon, authenticated;

drop trigger if exists trg_ig_espelhar_publicacao on public.posts;
create trigger trg_ig_espelhar_publicacao
after insert or update of publish_status, publicar_em, ig_media_id, ig_permalink, publish_error, publish_attempts
on public.posts
for each row
execute function public.ig_espelhar_publicacao();

-- Traz o que já existe.
insert into public.post_publicacoes
  (post_id, rede, status, publicar_em, external_id, permalink, erro, tentativas, publicado_em, criado_por)
select p.id, 'instagram', p.publish_status, p.publicar_em, p.ig_media_id, p.ig_permalink,
       p.publish_error, coalesce(p.publish_attempts, 0),
       case when p.publish_status = 'publicado' then coalesce(p.publicar_em, now()) end, p.publish_by
  from public.posts p
 where p.publish_status is not null
on conflict (post_id, rede) do nothing;

-- ── 4. Com qual conta o post sai, em qualquer rede ───────────────────────
-- Mesma regra do ig_conexao_do_post (que continua existindo pro Instagram):
-- post sem cliente = conta do próprio criador; post de cliente = conexão do
-- cliente na agência, senão a conta Cria do cliente.
create or replace function public.conexao_do_post(_post_id uuid, _rede text, _actor uuid default null)
returns table(connection_id uuid, origem text, external_account_id text, username text, pode_publicar boolean, motivo text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _quem uuid := coalesce(auth.uid(), _actor);
  _p record;
  _crm uuid;
  _cria_owner uuid;
  _c public.social_connections%rowtype;
  _origem text;
  _nome text := case _rede when 'instagram' then 'Instagram' when 'tiktok' then 'TikTok' when 'youtube' then 'YouTube' end;
  _escopo text := case _rede when 'instagram' then 'instagram_business_content_publish'
                             when 'tiktok' then 'video.publish'
                             when 'youtube' then 'youtube.upload' end;
begin
  if _nome is null then raise exception 'rede desconhecida'; end if;
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
     where sc.user_id = _p.user_id and sc.provider = _rede and sc.crm_client_id is null
     order by sc.updated_at desc nulls last limit 1;
  else
    select ec.crm_client_id into _crm from public.external_clients ec where ec.id = _p.external_client_id;
    if _crm is not null then
      _origem := 'cliente_agencia';
      select * into _c from public.social_connections sc
       where sc.crm_client_id = _crm and sc.provider = _rede
       order by sc.updated_at desc nulls last limit 1;
      if _c.id is null then
        select cc.cria_owner_id into _cria_owner from public.crm_clients cc where cc.id = _crm;
        if _cria_owner is not null then
          _origem := 'cliente_cria';
          select * into _c from public.social_connections sc
           where sc.user_id = _cria_owner and sc.provider = _rede and sc.crm_client_id is null
           order by sc.updated_at desc nulls last limit 1;
        end if;
      end if;
    end if;
  end if;

  if _c.id is null then
    return query select null::uuid, _origem, null::text, null::text, false,
      ('O ' || _nome || ' deste perfil ainda não está conectado ao Cria.')::text;
    return;
  end if;

  return query select
    _c.id, _origem, _c.external_account_id, _c.username,
    (coalesce(_c.scopes, '') like '%' || _escopo || '%'
      and not coalesce(_c.needs_reconnect, false)
      -- TikTok e YouTube renovam o acesso pelo refresh token: o vencimento do
      -- access token não bloqueia, só o needs_reconnect.
      and (_rede <> 'instagram' or _c.token_expires_at is null or _c.token_expires_at > now())),
    case
      when coalesce(_c.needs_reconnect, false)
        or (_rede = 'instagram' and _c.token_expires_at is not null and _c.token_expires_at <= now())
        then 'A conexão com o ' || _nome || ' venceu. Reconecte pra publicar pelo Cria.'
      when coalesce(_c.scopes, '') not like '%' || _escopo || '%'
        then 'Reconecte o ' || _nome || ' pra liberar a publicação pelo Cria.'
      else null
    end;
end;
$$;
revoke all on function public.conexao_do_post(uuid, text, uuid) from public, anon;
grant execute on function public.conexao_do_post(uuid, text, uuid) to authenticated, service_role;
