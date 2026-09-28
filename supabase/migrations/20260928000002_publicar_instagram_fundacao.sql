-- ═══════════════════════════════════════════════════════════════════════════
-- PUBLICAR NO INSTAGRAM · CICLO 1 · FUNDAÇÃO (28/09/2026)
-- Plano: CRIA/publicar-instagram-plano.md
--
-- Nada aqui muda o que o usuário vê. Só prepara o chão:
--   1. onde registrar a publicação no post (L3 e L11 do plano);
--   2. marcar conexão que precisa reconectar (L10);
--   3. UMA função que responde "com qual Instagram este post sai e quem pode
--      mandar" cobrindo os três jeitos de conectar (L9). Ela nunca devolve o
--      token: o token só é lido pela função de publicar, no servidor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Colunas de publicação no post ──────────────────────────────────────
alter table public.posts
  add column if not exists auto_publish boolean not null default false,
  -- Data + hora de Brasília viram um instante de verdade (com fuso). O robô
  -- do ciclo 6 compara com now(); texto "HH:MM" solto não dá pra comparar.
  add column if not exists publicar_em timestamptz,
  add column if not exists publish_status text,
  add column if not exists publish_error text,
  add column if not exists publish_attempts integer not null default 0,
  add column if not exists publish_by uuid references public.profiles(id) on delete set null,
  add column if not exists ig_container_id text,
  add column if not exists ig_media_id text,
  add column if not exists ig_permalink text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_publish_status_chk') then
    alter table public.posts add constraint posts_publish_status_chk
      check (publish_status is null or publish_status in ('na_fila', 'publicando', 'publicado', 'erro'));
  end if;
end $$;

comment on column public.posts.publish_status is
  'Publicação pelo Cria no Instagram: null (não usa), na_fila, publicando, publicado, erro.';
comment on column public.posts.publicar_em is
  'Instante (com fuso) em que o robô publica, montado de scheduled_date + scheduled_time em America/Sao_Paulo.';

-- O robô só olha a fila: índice parcial pequeno, não pesa no resto da tabela.
create index if not exists idx_posts_fila_publicacao
  on public.posts (publicar_em)
  where auto_publish and publish_status = 'na_fila' and deleted_at is null;

-- Monta o instante de Brasília a partir da data e da hora do post. Hora
-- vazia ou inválida vira 09:00 (horário padrão de publicação), e o texto
-- aceita "9:5", "09:05" e "09:05:00".
create or replace function public.instante_brasilia(_data date, _hora text)
returns timestamptz language plpgsql stable as $$
declare _h time;
begin
  if _data is null then return null; end if;
  begin
    _h := nullif(btrim(coalesce(_hora, '')), '')::time;
  exception when others then
    _h := null;
  end;
  return (_data + coalesce(_h, time '09:00')) at time zone 'America/Sao_Paulo';
end $$;

-- ── 2. Conexão que precisa reconectar ─────────────────────────────────────
alter table public.social_connections
  add column if not exists needs_reconnect boolean not null default false;

-- ── 3. Qual Instagram publica este post, e quem pode mandar ───────────────
-- Três jeitos de o Instagram estar conectado:
--   a) post do CRIADOR (sem external_client_id): conexão própria do dono
--      (user_id = dono, crm_client_id nulo);
--   b) post de CLIENTE conectado pela agência: conexão com crm_client_id do
--      cliente, gravada em nome de QUEM CLICOU (pode ser membro da equipe,
--      por isso a busca é pelo cliente e não pelo user_id);
--   c) cliente com CONTA CRIA própria (crm_clients.cria_owner_id): conexão
--      própria da conta dele.
-- Quem pode mandar publicar: o dono do post ou membro ativo da equipe dele.
-- _actor: quem pede. Chamada do navegador ignora o parâmetro e usa quem está
-- logado (ninguém pergunta "como se fosse outra pessoa"). O servidor, sem
-- sessão, passa o actor explicitamente.
create or replace function public.ig_conexao_do_post(_post_id uuid, _actor uuid default null)
returns table (
  connection_id uuid,
  origem text,               -- 'criador' | 'cliente_agencia' | 'cliente_cria'
  ig_user_id text,
  username text,
  pode_publicar boolean,     -- token com a permissão, válido e sem pedido de reconexão
  motivo text                -- por que não pode (em português), null quando pode
)
language plpgsql stable security definer set search_path = public as $$
declare
  _quem uuid := coalesce(auth.uid(), _actor);
  _p record;
  _crm uuid;
  _cria_owner uuid;
  -- rowtype (não record): se nenhum ramo buscar a conexão, os campos ficam
  -- nulos em vez de estourar "record não atribuído".
  _c public.social_connections%rowtype;
  _origem text;
begin
  if _quem is null then raise exception 'sem sessão'; end if;

  select id, user_id, external_client_id into _p
    from public.posts where id = _post_id and deleted_at is null;
  if _p.id is null then raise exception 'post não encontrado'; end if;

  if not (_p.user_id = _quem or exists (
    select 1 from public.manager_members m
     where m.manager_id = _p.user_id and m.member_id = _quem and m.status = 'ativo'
       and not public.eh_papel_parceiro(m.role)
  )) then
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
end $$;

revoke all on function public.ig_conexao_do_post(uuid, uuid) from public, anon;
grant execute on function public.ig_conexao_do_post(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
