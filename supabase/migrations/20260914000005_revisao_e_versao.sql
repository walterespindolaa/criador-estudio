-- ═══════════════════════════════════════════════════════════════════════════
-- CIRCUITO 5: REVISÃO E VERSÃO (14/09/2026)
--
-- O FURO GRAVE: cada entrega do parceiro INSERIA uma linha nova em
-- external_media_refs, e ninguém nunca apagava a anterior. Como a tela de
-- aprovação do cliente lista TODAS as mídias da peça em ordem de position, a
-- segunda entrega virava o SLIDE 2 de um carrossel. Ou seja: o cliente pedia
-- ajuste, o designer refazia, e o cliente recebia de volta a arte errada e a
-- arte certa lado a lado, como se fosse um carrossel de duas páginas.
--
-- E não havia como saber quantas vezes uma peça voltou. Esse número é o que
-- separa "cliente exigente" de "briefing ruim", e é a base de qualquer
-- conversa sobre escopo (a pesquisa de mercado: 72% dos projetos freelance
-- sofrem scope creep e 99% das agências não cobram o extra).
--
-- O MODELO, em três colunas:
--   posts.revisoes                 quantas vezes a peça voltou pra ajuste
--   external_media_refs.entrega    veio do parceiro (true) ou é referência da
--                                  agência (false, o padrão)
--   external_media_refs.rodada     em qual rodada de entrega o arquivo entrou
--   external_media_refs.substituida  versão antiga, fora da vista
--
-- A conta de "o que é a versão atual" é feita UMA VEZ, na hora de anexar. Quem
-- lê só acrescenta `and not m.substituida`. Referência da agência nunca é
-- substituída: ela não é versão de nada.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) As colunas ─────────────────────────────────────────────────────────
alter table public.posts add column if not exists revisoes integer not null default 0;
comment on column public.posts.revisoes is
  'Quantas vezes a peça voltou pra ajuste. Sobe sozinho quando producao_status entra em ajuste.';

alter table public.external_media_refs add column if not exists entrega boolean not null default false;
alter table public.external_media_refs add column if not exists rodada integer not null default 0;
alter table public.external_media_refs add column if not exists substituida boolean not null default false;
comment on column public.external_media_refs.entrega is
  'Arquivo que o PARCEIRO entregou (true) ou material de referência da agência (false).';
comment on column public.external_media_refs.substituida is
  'Versão antiga de uma entrega: fica no histórico e sai da vista do cliente.';

-- Índice do caminho quente: "as mídias atuais desta peça".
create index if not exists idx_media_refs_post_atual
  on public.external_media_refs (post_id) where not substituida;

/* BACKFILL: quais arquivos antigos vieram do parceiro.
   A RPC sempre deixou um rastro exato na conversa ("Entrega (arquivo): NOME"),
   então dá pra marcar sem adivinhar. Rodada 0 pra todos: o mecanismo passa a
   valer da PRÓXIMA entrega em diante.

   O QUE ESTE BACKFILL NÃO FAZ, de propósito: não esconde as versões que já
   estão empilhadas. Pra saber se três arquivos são três versões ou os três
   slides de um carrossel eu teria que chutar pelo intervalo de tempo, e o chute
   errado apaga da vista do cliente uma parte legítima da peça. Peça que já está
   empilhada hoje se resolve do jeito de sempre: a agência apaga o arquivo velho
   no editor, ou o parceiro entrega de novo depois de um ajuste. */
update public.external_media_refs m
   set entrega = true
 where not m.entrega
   and exists (
     select 1 from public.post_approval_comments c
      where c.post_id = m.post_id
        and c.author_role = 'parceiro'
        and c.content = 'Entrega (arquivo): ' || m.file_name);

-- ── 2) O contador de revisões ─────────────────────────────────────────────
/* Entra no MESMO gatilho BEFORE que carimba a data de entrega (circuito 2):
   dois gatilhos BEFORE na mesma tabela pela mesma razão é convite pra um
   sobrescrever o outro. Aqui os dois campos são gravados lado a lado. */
create or replace function public.carimbar_entregue_em()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Data da entrega: só a mudança de status escreve (nunca uma edição do post).
  if new.producao_status = 'entregue'
     and old.producao_status is distinct from 'entregue' then
    new.entregue_em := now();
  end if;

  -- Voltou pra ajuste: conta a rodada. É o número que aparece no card dos dois
  -- lados e vira conversa de escopo quando passa de duas ou três.
  if new.producao_status = 'ajuste'
     and old.producao_status is distinct from 'ajuste' then
    new.revisoes := coalesce(old.revisoes, 0) + 1;
  end if;

  return new;
end; $$;

drop trigger if exists trg_carimbar_entregue_em on public.posts;
create trigger trg_carimbar_entregue_em before update on public.posts
  for each row execute function public.carimbar_entregue_em();

-- ── 3) Anexar entrega: a versão nova aposenta a anterior ──────────────────
create or replace function public.parceiro_anexar_entrega(
  _post_id uuid, _view_url text, _file_name text, _file_type text default null,
  _file_size bigint default null, _thumbnail_url text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare _dono uuid; _pos int; _id uuid; _rodada int;
begin
  if not public.parceiro_tem_o_card(_post_id) then raise exception 'sem_acesso'; end if;
  if _view_url is null or _view_url !~ '^https?://' then raise exception 'url_invalida'; end if;
  select p.user_id, coalesce(p.revisoes, 0) into _dono, _rodada
    from public.posts p where p.id = _post_id;

  /* APOSENTA AS ENTREGAS DAS RODADAS ANTERIORES. É isto que impede a versão
     velha de virar slide do carrossel do cliente. Só mexe em linhas marcadas
     como entrega: material de referência da agência não é versão de nada e
     continua aparecendo. */
  update public.external_media_refs m
     set substituida = true
   where m.post_id = _post_id and m.entrega and m.rodada < _rodada and not m.substituida;

  select coalesce(max(m.position), -1) + 1 into _pos
    from public.external_media_refs m where m.post_id = _post_id and not m.substituida;

  insert into public.external_media_refs (
    user_id, post_id, provider, external_file_id, file_name, file_type, file_size,
    thumbnail_url, view_url, download_url, position, entrega, rodada)
  values (
    _dono, _post_id, 'storage', _view_url, coalesce(_file_name, 'entrega'), _file_type, _file_size,
    coalesce(_thumbnail_url, _view_url), _view_url, _view_url, _pos, true, _rodada)
  returning id into _id;

  -- Fica registrado na conversa também (o histórico do card é a thread).
  insert into public.post_approval_comments (post_id, author_id, author_role, content)
  values (_post_id, auth.uid(),  'parceiro',
          'Entrega' || (case when _rodada > 0 then ' (revisão ' || _rodada || ')' else '' end)
            || ' (arquivo): ' || coalesce(_file_name, _view_url));
  return _id;
end; $$;
revoke all on function public.parceiro_anexar_entrega(uuid, text, text, text, bigint, text) from public, anon;
grant execute on function public.parceiro_anexar_entrega(uuid, text, text, text, bigint, text) to authenticated;

-- ── 4) O cliente só vê a versão atual ─────────────────────────────────────
-- Corpo idêntico ao de 20260810000005, mais `and not m.substituida`.
drop function if exists public.list_posts_by_token(text);
create function public.list_posts_by_token(_token text)
 returns table(post_id uuid, title text, platform text, format text, caption text, hook text, script text, content_blocks jsonb, approval_mode text, approval_stages jsonb, approval_status text, scheduled_date date, media jsonb, last_comment text, last_comment_role text, drive_folder_url text)
 language sql stable security definer set search_path to 'public'
as $function$
  with tok as (
    select t.manager_id, t.external_client_id, t.period_start, t.period_end
    from public.approval_tokens t
    where t.token = _token and t.active = true
      and (t.expires_at is null or t.expires_at > now())
      and public.has_module('aprovapost_externo', t.manager_id)
  )
  select p.id, p.title, p.platform, p.format,
         p.caption, p.hook, p.script, p.content_blocks,
         coalesce(p.approval_mode,'fast'), p.approval_stages,
         coalesce(p.approval_status,'pendente'),
         p.scheduled_date,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'provider', m.provider, 'thumbnail_url', m.thumbnail_url,
             'view_url', m.view_url, 'download_url', m.download_url,
             'bunny_video_id', m.bunny_video_id, 'file_type', m.file_type,
             'file_name', m.file_name, 'position', m.position
           ) order by m.position asc nulls last, m.created_at asc)
           from public.external_media_refs m
           where m.post_id = p.id and not m.substituida
         ), '[]'::jsonb),
         c.content, c.author_role,
         p.drive_folder_url
  from tok
  join public.posts p on p.external_client_id = tok.external_client_id and p.user_id = tok.manager_id
  left join lateral (
    select content, author_role from public.post_approval_comments
    where post_id = p.id order by created_at desc limit 1
  ) c on true
  where p.approval_status in ('pendente','ajuste_solicitado','aprovado')
    and (
      tok.period_start is null or tok.period_end is null
      or (p.scheduled_date is not null
          and p.scheduled_date >= tok.period_start
          and p.scheduled_date <= tok.period_end)
    )
  order by (coalesce(p.approval_status,'pendente') = 'ajuste_solicitado') desc,
           (coalesce(p.approval_status,'pendente') = 'pendente') desc,
           p.scheduled_date asc nulls last, p.created_at asc;
$function$;

-- ── 5) O card do parceiro: versão atual + contador ────────────────────────
create or replace function public.parceiro_abrir_card(_post_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _p public.posts;
  _cc public.crm_clients;
  _ec record;
  _coments jsonb;
  _midias jsonb;
  _agencia text;
  _versoes int;
begin
  if not public.parceiro_tem_o_card(_post_id) then
    raise exception 'sem acesso a este card';
  end if;

  select * into _p from public.posts where id = _post_id;
  select name into _agencia from public.profiles where id = _p.user_id;
  select ec.name, ec.instagram_handle, ec.crm_client_id into _ec
    from public.external_clients ec where ec.id = _p.external_client_id;
  if _ec.crm_client_id is not null then
    select * into _cc from public.crm_clients where id = _ec.crm_client_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'texto', c.content, 'papel', c.author_role, 'em', c.created_at
         ) order by c.created_at), '[]'::jsonb)
    into _coments
    from public.post_approval_comments c
   where c.post_id = _post_id
     and coalesce(c.author_role, '') in ('parceiro', 'social_media');

  -- Só a versão atual. As antigas ficam no botão de histórico.
  select coalesce(jsonb_agg(jsonb_build_object(
           'url', coalesce(nullif(btrim(m.view_url), ''), m.thumbnail_url),
           'thumb', coalesce(nullif(btrim(m.thumbnail_url), ''), m.view_url),
           'nome', m.file_name,
           'tipo', m.file_type
         ) order by m.position asc nulls last, m.created_at asc), '[]'::jsonb)
    into _midias
    from public.external_media_refs m
   where m.post_id = _post_id and not m.substituida;

  select count(*)::int into _versoes
    from public.external_media_refs m where m.post_id = _post_id and m.entrega and m.substituida;

  return jsonb_build_object(
    'id', _p.id,
    'titulo', _p.title,
    'formato', _p.format,
    'plataforma', _p.platform,
    'gancho', _p.hook,
    'roteiro', _p.script,
    'legenda', _p.caption,
    'arte', _p.art,
    'blocos', _p.content_blocks,
    'notas', _p.notes,
    'pasta_drive', _p.drive_folder_url,
    'referencia', _p.reference_url,
    'etiquetas', _p.internal_tags,
    'producao_status', coalesce(_p.producao_status, 'aguardando'),
    'prazo_producao', _p.prazo_producao,
    'prazo_status', _p.prazo_status,
    'prazo_sugerido', _p.prazo_sugerido,
    'publica_em', _p.scheduled_date,
    'aprovacao', _p.approval_status,
    'cache', _p.cache_parceiro,
    'agencia', coalesce(_agencia, 'Agência'),
    'midias', _midias,
    'revisoes', coalesce(_p.revisoes, 0),
    'versoes_antigas', _versoes,
    'external_client_id', _p.external_client_id,
    'marca', jsonb_build_object(
      'nome', coalesce(_cc.name, _ec.name),
      'handle', _ec.instagram_handle,
      'cor', _cc.color,
      'logo', _cc.logo,
      'hashtags', _cc.hashtags
    ),
    'comentarios', _coments);
end; $$;
revoke all on function public.parceiro_abrir_card(uuid) from public, anon;
grant execute on function public.parceiro_abrir_card(uuid) to authenticated;

-- ── 6) O histórico de versões (um botão, não V1/V2/V3 na tela) ────────────
/* Walter, 14/09/2026: "a parte de v1, v2, v3 do post poderia ter só uma opção
   de um botão de histórico pra ver as outras versões". Então a tela mostra a
   versão atual e um botão; as antigas vivem aqui, sob demanda. */
drop function if exists public.parceiro_versoes_da_peca(uuid);
create function public.parceiro_versoes_da_peca(_post_id uuid)
returns table (
  id uuid,
  rodada integer,
  nome text,
  tipo text,
  url text,
  thumb text,
  atual boolean,
  em timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    m.id, m.rodada, m.file_name, m.file_type,
    coalesce(nullif(btrim(m.view_url), ''), m.thumbnail_url),
    coalesce(nullif(btrim(m.thumbnail_url), ''), m.view_url),
    not m.substituida,
    m.created_at
  from public.external_media_refs m
  where m.post_id = _post_id
    and m.entrega
    and public.parceiro_tem_o_card(_post_id)
  order by m.rodada desc, m.position asc nulls last, m.created_at asc;
$$;
revoke all on function public.parceiro_versoes_da_peca(uuid) from public, anon;
grant execute on function public.parceiro_versoes_da_peca(uuid) to authenticated;

-- ── 7) A capa e a fila leem só o que está valendo ─────────────────────────
/* Corpo idêntico ao de 20260909000006, com DUAS mudanças e nada mais:
   `not m.substituida` na capa (senão a capa continua sendo a arte velha) e
   `revisoes` no fim da lista de colunas. Coluna nova no retorno obriga drop +
   create: `create or replace` não troca tipo de retorno (erro 42P13). */
drop function if exists public.parceiro_minha_fila();
create function public.parceiro_minha_fila()
returns table (
  post_id uuid,
  titulo text,
  formato text,
  plataforma text,
  producao_status text,
  prazo_producao date,
  publica_em date,
  assigned_at timestamptz,
  agencia_id uuid,
  agencia_nome text,
  cliente_nome text,
  cliente_handle text,
  cliente_cor text,
  cliente_logo text,
  etiquetas uuid[],
  prazo_status text,
  prazo_sugerido date,
  cache numeric,
  external_client_id uuid,
  capa text,
  revisoes integer
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.title, p.format, p.platform,
    coalesce(p.producao_status, 'aguardando'),
    p.prazo_producao, p.scheduled_date, p.assigned_at,
    p.user_id, coalesce(prof.name, 'Agência'),
    coalesce(cc.name, ec.name, 'Cliente'),
    ec.instagram_handle,
    cc.color, cc.logo,
    p.internal_tags,
    p.prazo_status, p.prazo_sugerido,
    p.cache_parceiro,
    p.external_client_id,
    (select coalesce(nullif(btrim(m.thumbnail_url), ''), nullif(btrim(m.view_url), ''))
       from public.external_media_refs m
      where m.post_id = p.id and not m.substituida
      order by m.position asc nulls last, m.created_at asc
      limit 1),
    coalesce(p.revisoes, 0)
  from public.posts p
  join public.manager_members m
    on m.manager_id = p.user_id
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = p.user_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  where p.assignee_id = auth.uid()
    and p.deleted_at is null
    and coalesce(p.producao_status, 'aguardando') <> 'entregue'
  order by p.prazo_producao asc nulls last, p.assigned_at asc;
$$;
revoke all on function public.parceiro_minha_fila() from public, anon;
grant execute on function public.parceiro_minha_fila() to authenticated;

/* parceiro_entregues: mesmo corpo do circuito 2 (que já trocou updated_at por
   entregue_em), agora com a capa lendo só a versão atual e com `revisoes`. */
drop function if exists public.parceiro_entregues();
create function public.parceiro_entregues()
returns table (
  post_id uuid, titulo text, formato text, entregue_em timestamptz,
  publica_em date, agencia_id uuid, agencia_nome text,
  cliente_nome text, cliente_cor text, cliente_logo text,
  aprovacao text, cache numeric, external_client_id uuid, capa text,
  revisoes integer
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.title, p.format,
    coalesce(p.entregue_em, p.updated_at),
    p.scheduled_date,
    p.user_id, coalesce(prof.name, 'Agência'),
    coalesce(cc.name, ec.name, 'Cliente'),
    cc.color, cc.logo,
    p.approval_status, p.cache_parceiro,
    p.external_client_id,
    (select coalesce(nullif(btrim(m.thumbnail_url), ''), nullif(btrim(m.view_url), ''))
       from public.external_media_refs m
      where m.post_id = p.id and not m.substituida
      order by m.position asc nulls last, m.created_at asc
      limit 1),
    coalesce(p.revisoes, 0)
  from public.posts p
  join public.manager_members m
    on m.manager_id = p.user_id
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = p.user_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  where p.assignee_id = auth.uid()
    and p.deleted_at is null
    and p.producao_status = 'entregue'
  order by coalesce(p.entregue_em, p.updated_at) desc
  limit 200;
$$;
revoke all on function public.parceiro_entregues() from public, anon;
grant execute on function public.parceiro_entregues() to authenticated;

-- Conferência:
-- select id, revisoes, producao_status from public.posts where assignee_id is not null limit 5;
-- select post_id, entrega, rodada, substituida, file_name from public.external_media_refs order by created_at desc limit 10;
